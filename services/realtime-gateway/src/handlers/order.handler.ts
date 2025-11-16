import { Server } from 'socket.io';
import {
  SocketEvent,
  OrderSubscriptionPayload,
  OrderSubscriptionPayloadSchema,
  OrderStatusChangeEvent,
} from '@movenow/common';
import { AuthenticatedSocket, OrderSubscription } from '../types';
import { redisService } from '../services/redis.service';
import { metricsService } from '../services/metrics.service';
import { createLogger } from '../lib/logger';

export class OrderHandler {
  constructor(private io: Server) {}

  /**
   * Handle order subscription request
   */
  async handleSubscribe(
    socket: AuthenticatedSocket,
    payload: OrderSubscriptionPayload
  ): Promise<void> {
    const log = createLogger({
      correlationId: socket.correlationId,
      socketId: socket.id,
      userId: socket.userId,
    });

    try {
      // Validate payload
      const result = OrderSubscriptionPayloadSchema.safeParse(payload);
      if (!result.success) {
        socket.emit(SocketEvent.SUBSCRIPTION_ERROR, {
          error: 'INVALID_PAYLOAD',
          message: result.error.message,
        });
        return;
      }

      const { orderId } = result.data;

      // Authorization check
      // TODO: Verify that the user has permission to subscribe to this order
      // - Customer can subscribe to their own orders
      // - Porter can subscribe to orders they are assigned to
      // - Admin can subscribe to any order
      // For now, we'll allow any authenticated user (should be enhanced)

      if (socket.role !== 'client' && socket.role !== 'porter' && socket.role !== 'admin') {
        socket.emit(SocketEvent.SUBSCRIPTION_ERROR, {
          error: 'FORBIDDEN',
          message: 'Insufficient permissions to subscribe to order',
        });
        return;
      }

      // Create subscription
      const subscription: OrderSubscription = {
        orderId,
        userId: socket.userId,
        role: socket.role,
        subscribedAt: Date.now(),
      };

      await redisService.subscribeToOrder(orderId, subscription);

      // Join socket room for this order
      socket.join(`order:${orderId}`);

      log.info('Subscribed to order', { orderId });

      socket.emit(SocketEvent.SUBSCRIPTION_CONFIRMED, {
        success: true,
        orderId,
      });
    } catch (error) {
      log.error('Error subscribing to order', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      socket.emit(SocketEvent.SUBSCRIPTION_ERROR, {
        error: 'INTERNAL_ERROR',
        message: 'Failed to subscribe to order',
      });
    }
  }

  /**
   * Handle order unsubscription request
   */
  async handleUnsubscribe(
    socket: AuthenticatedSocket,
    payload: OrderSubscriptionPayload
  ): Promise<void> {
    const log = createLogger({
      correlationId: socket.correlationId,
      socketId: socket.id,
      userId: socket.userId,
    });

    try {
      // Validate payload
      const result = OrderSubscriptionPayloadSchema.safeParse(payload);
      if (!result.success) {
        socket.emit(SocketEvent.SUBSCRIPTION_ERROR, {
          error: 'INVALID_PAYLOAD',
          message: result.error.message,
        });
        return;
      }

      const { orderId } = result.data;

      await redisService.unsubscribeFromOrder(orderId, socket.userId);

      // Leave socket room
      socket.leave(`order:${orderId}`);

      log.info('Unsubscribed from order', { orderId });

      socket.emit(SocketEvent.SUBSCRIPTION_CONFIRMED, {
        success: true,
        orderId,
      });
    } catch (error) {
      log.error('Error unsubscribing from order', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      socket.emit(SocketEvent.SUBSCRIPTION_ERROR, {
        error: 'INTERNAL_ERROR',
        message: 'Failed to unsubscribe from order',
      });
    }
  }

  /**
   * Broadcast order status change to subscribed clients
   */
  async broadcastStatusChange(statusChange: OrderStatusChangeEvent): Promise<void> {
    const log = createLogger({ correlationId: statusChange.orderId });

    try {
      const subscriptions = await redisService.getOrderSubscriptions(statusChange.orderId);

      if (subscriptions.length === 0) {
        log.debug('No subscriptions for order status change', {
          orderId: statusChange.orderId,
        });
        return;
      }

      // Send to room
      this.io.to(`order:${statusChange.orderId}`).emit(
        SocketEvent.ORDER_STATUS_CHANGED,
        statusChange
      );

      log.info('Broadcasted order status change', {
        orderId: statusChange.orderId,
        status: statusChange.status,
        subscriberCount: subscriptions.length,
      });

      metricsService.recordMessageSent('order', SocketEvent.ORDER_STATUS_CHANGED);
    } catch (error) {
      log.error('Error broadcasting status change', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      metricsService.recordDeliveryFailure(SocketEvent.ORDER_STATUS_CHANGED);
    }
  }

  /**
   * Broadcast order timeline update to subscribed clients
   */
  async broadcastTimelineUpdate(orderId: string, timeline: any): Promise<void> {
    const log = createLogger({ correlationId: orderId });

    try {
      const subscriptions = await redisService.getOrderSubscriptions(orderId);

      if (subscriptions.length === 0) {
        return;
      }

      this.io.to(`order:${orderId}`).emit(SocketEvent.ORDER_TIMELINE_UPDATED, {
        orderId,
        timeline,
        timestamp: Date.now(),
      });

      log.info('Broadcasted order timeline update', {
        orderId,
        subscriberCount: subscriptions.length,
      });

      metricsService.recordMessageSent('order', SocketEvent.ORDER_TIMELINE_UPDATED);
    } catch (error) {
      log.error('Error broadcasting timeline update', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      metricsService.recordDeliveryFailure(SocketEvent.ORDER_TIMELINE_UPDATED);
    }
  }
}
