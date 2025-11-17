import { getAvailabilityRedis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { incrementOnlinePorters, decrementOnlinePorters } from '../lib/metrics';
import { getKafkaClient } from '../lib/kafka';
import { EventType, PorterOnlineEvent, PorterOfflineEvent } from '@movenow/common';
import { getCorrelationId } from '../lib/correlation';

/**
 * Redis keys:
 * - porter:availability:{porterId} -> JSON { online: boolean, lastSeen: timestamp, location?: {lat, lng} }
 * - porter:online -> Set of currently online porter IDs
 */

interface AvailabilityState {
  online: boolean;
  lastSeen: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export class AvailabilityService {
  /**
   * Set porter online/offline status
   * This is atomic and low-latency using Redis
   */
  async setAvailability(
    porterId: string,
    userId: string,
    online: boolean,
    location?: { lat: number; lng: number }
  ): Promise<void> {
    const redis = getAvailabilityRedis();
    const now = new Date().toISOString();

    const state: AvailabilityState = {
      online,
      lastSeen: now,
      ...(location && { location }),
    };

    // Atomic operations
    const multi = redis.multi();

    // Update porter availability state
    multi.set(
      `porter:availability:${porterId}`,
      JSON.stringify(state),
      { EX: 3600 } // Expire after 1 hour of inactivity
    );

    // Update online set
    if (online) {
      multi.sAdd('porter:online', porterId);
      incrementOnlinePorters();
    } else {
      multi.sRem('porter:online', porterId);
      decrementOnlinePorters();
    }

    await multi.exec();

    logger.info('Porter availability updated', {
      porterId,
      online,
      location: location ? `${location.lat},${location.lng}` : undefined,
    });

    // Publish event
    await this.publishAvailabilityEvent(porterId, userId, online, location);
  }

  /**
   * Get porter availability status
   */
  async getAvailability(porterId: string): Promise<AvailabilityState | null> {
    const redis = getAvailabilityRedis();
    const data = await redis.get(`porter:availability:${porterId}`);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Get all currently online porter IDs
   */
  async getOnlinePorterIds(): Promise<string[]> {
    const redis = getAvailabilityRedis();
    return await redis.sMembers('porter:online');
  }

  /**
   * Get count of online porters
   */
  async getOnlinePortersCount(): Promise<number> {
    const redis = getAvailabilityRedis();
    return await redis.sCard('porter:online');
  }

  /**
   * Check if porter is currently online
   */
  async isPorterOnline(porterId: string): Promise<boolean> {
    const availability = await this.getAvailability(porterId);
    return availability?.online ?? false;
  }

  /**
   * Create or update availability window (scheduled)
   */
  async createAvailabilityWindow(
    porterId: string,
    startAt: Date,
    endAt: Date,
    timezone = 'UTC',
    isRecurring = false,
    recurrence?: Record<string, unknown>
  ) {
    return await prisma.availabilityWindow.create({
      data: {
        porterId,
        startAt,
        endAt,
        timezone,
        isRecurring,
        recurrence: recurrence as any,
        isActive: true,
      },
    });
  }

  /**
   * Get porter's scheduled availability windows
   */
  async getScheduledWindows(porterId: string, activeOnly = true) {
    return await prisma.availabilityWindow.findMany({
      where: {
        porterId,
        ...(activeOnly && { isActive: true }),
      },
      orderBy: { startAt: 'asc' },
    });
  }

  /**
   * Update heartbeat/last-seen timestamp
   */
  async updateHeartbeat(porterId: string): Promise<void> {
    const redis = getAvailabilityRedis();
    const data = await redis.get(`porter:availability:${porterId}`);

    if (data) {
      const state: AvailabilityState = JSON.parse(data);
      state.lastSeen = new Date().toISOString();

      await redis.set(
        `porter:availability:${porterId}`,
        JSON.stringify(state),
        { EX: 3600 }
      );
    }
  }

  /**
   * Publish availability event to Kafka
   */
  private async publishAvailabilityEvent(
    porterId: string,
    userId: string,
    online: boolean,
    location?: { lat: number; lng: number }
  ): Promise<void> {
    try {
      const kafka = getKafkaClient();
      const correlationId = getCorrelationId();

      if (online) {
        const event: PorterOnlineEvent = {
          type: EventType.PORTER_ONLINE,
          timestamp: new Date(),
          correlationId,
          userId,
          porterId,
          location,
        };
        await kafka.publishEvent(event);
      } else {
        const event: PorterOfflineEvent = {
          type: EventType.PORTER_OFFLINE,
          timestamp: new Date(),
          correlationId,
          userId,
          porterId,
        };
        await kafka.publishEvent(event);
      }
    } catch (error) {
      logger.error('Failed to publish availability event', {
        error,
        porterId,
        online,
      });
      // Don't throw - availability state is already updated
    }
  }
}

export default new AvailabilityService();
