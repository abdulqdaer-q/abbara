import { Server } from 'socket.io';
import {
  SocketEvent,
  LocationUpdatePayload,
  LocationUpdatePayloadSchema,
  LocationUpdateEvent,
} from '@movenow/common';
import { AuthenticatedSocket, PorterLocation } from '../types';
import { redisService } from '../services/redis.service';
import { kafkaService } from '../services/kafka.service';
import { metricsService } from '../services/metrics.service';
import { rateLimiter } from '../middleware/rateLimiter';
import { createLogger } from '../lib/logger';
import { config } from '../config';

export class LocationHandler {
  private sampleCounter: Map<string, number> = new Map();

  constructor(private io: Server) {}

  /**
   * Handle location update from porter
   */
  async handleLocationUpdate(
    socket: AuthenticatedSocket,
    payload: LocationUpdatePayload
  ): Promise<void> {
    const log = createLogger({
      correlationId: socket.correlationId,
      socketId: socket.id,
      userId: socket.userId,
    });

    const endTimer = metricsService.timeMessageProcessing(SocketEvent.LOCATION_UPDATE);

    try {
      // Validate role
      if (socket.role !== 'PORTER') {
        socket.emit(SocketEvent.LOCATION_ERROR, {
          error: 'FORBIDDEN',
          message: 'Only porters can send location updates',
        });
        metricsService.recordMessageError(SocketEvent.LOCATION_UPDATE, 'forbidden');
        return;
      }

      // Check rate limit
      const allowed = await rateLimiter.checkLocation(socket);
      if (!allowed) {
        socket.emit(SocketEvent.LOCATION_ERROR, {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many location updates',
        });
        return;
      }

      // Validate payload
      const result = LocationUpdatePayloadSchema.safeParse(payload);
      if (!result.success) {
        socket.emit(SocketEvent.LOCATION_ERROR, {
          error: 'INVALID_PAYLOAD',
          message: result.error.message,
        });
        metricsService.recordMessageError(SocketEvent.LOCATION_UPDATE, 'validation');
        return;
      }

      const validatedPayload = result.data;

      // Store location in Redis
      const porterLocation: PorterLocation = {
        porterId: socket.userId,
        lat: validatedPayload.lat,
        lng: validatedPayload.lng,
        accuracy: validatedPayload.accuracy,
        heading: validatedPayload.heading,
        speed: validatedPayload.speed,
        timestamp: validatedPayload.timestamp,
      };

      await redisService.storePorterLocation(socket.userId, porterLocation);

      // Record metrics
      metricsService.recordLocationUpdate();

      // Sample and persist to Kafka (not every update)
      const shouldPersist = this.shouldSampleLocation(socket.userId);
      if (shouldPersist) {
        await kafkaService.publish(config.topics.porterEvents, {
          type: 'porter.location.updated',
          timestamp: Date.now(),
          correlationId: socket.correlationId,
          payload: porterLocation,
        });
      }

      // Fan out to subscribed clients (customers tracking this porter's order)
      await this.fanOutLocationUpdate(socket.userId, validatedPayload);

      // Acknowledge receipt
      socket.emit(SocketEvent.LOCATION_UPDATED, {
        success: true,
        timestamp: Date.now(),
      });

      log.debug('Location update processed', {
        lat: validatedPayload.lat,
        lng: validatedPayload.lng,
        sampled: shouldPersist,
      });
    } catch (error) {
      log.error('Error handling location update', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      socket.emit(SocketEvent.LOCATION_ERROR, {
        error: 'INTERNAL_ERROR',
        message: 'Failed to process location update',
      });
      metricsService.recordMessageError(SocketEvent.LOCATION_UPDATE, 'internal');
    } finally {
      endTimer();
    }
  }

  /**
   * Fan out location update to subscribed clients
   */
  private async fanOutLocationUpdate(
    porterId: string,
    location: LocationUpdatePayload
  ): Promise<void> {
    const endTimer = metricsService.timeFanout();

    try {
      // TODO: Get active order for porter from Redis or database
      // For now, we'll broadcast to all clients in the porter's room
      // In production, this should query which order the porter is assigned to
      // and only send to clients subscribed to that order

      const porterLocation = await redisService.getPorterLocation(porterId);
      if (!porterLocation || !porterLocation.orderId) {
        // Porter not currently assigned to an order
        return;
      }

      // Get subscriptions for the order
      const subscriptions = await redisService.getOrderSubscriptions(porterLocation.orderId);

      if (subscriptions.length === 0) {
        return;
      }

      // Create location event
      const locationEvent: LocationUpdateEvent = {
        orderId: porterLocation.orderId,
        porterId: porterId,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        heading: location.heading,
        speed: location.speed,
        timestamp: location.timestamp,
      };

      // Send to all subscribed users
      for (const subscription of subscriptions) {
        const sockets = await redisService.getUserSockets(subscription.userId);
        for (const socketId of sockets) {
          this.io.to(socketId).emit(SocketEvent.LOCATION_UPDATED, locationEvent);
          metricsService.recordMessageSent('client', SocketEvent.LOCATION_UPDATED);
        }
      }
    } catch (error) {
      createLogger({ userId: porterId }).error('Error fanning out location update', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      metricsService.recordDeliveryFailure(SocketEvent.LOCATION_UPDATED);
    } finally {
      endTimer();
    }
  }

  /**
   * Determine if location should be sampled for persistence
   */
  private shouldSampleLocation(porterId: string): boolean {
    const count = this.sampleCounter.get(porterId) || 0;
    const newCount = count + 1;

    this.sampleCounter.set(porterId, newCount);

    // Sample every Nth update
    if (newCount % config.location.sampleRate === 0) {
      this.sampleCounter.set(porterId, 0);
      return true;
    }

    return false;
  }

  /**
   * Get current porter location (for queries)
   */
  async getPorterLocation(porterId: string): Promise<PorterLocation | null> {
    return await redisService.getPorterLocation(porterId);
  }
}
