import { getLocationRedis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { recordLocationUpdate } from '../lib/metrics';
import { getKafkaClient } from '../lib/kafka';
import { EventType, PorterLocationUpdatedEvent } from '@movenow/common';
import { getCorrelationId } from '../lib/correlation';
import { getDistance } from 'geolib';

/**
 * Redis keys:
 * - porter:location:{porterId} -> JSON { lat, lng, accuracy, timestamp }
 */

interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: string;
  orderId?: string;
}

export class LocationService {
  private snapshotInterval: number;

  constructor() {
    this.snapshotInterval = parseInt(
      process.env.LOCATION_SNAPSHOT_INTERVAL_SECONDS || '60'
    );
  }

  /**
   * Update porter location (low-latency, Redis-first)
   */
  async updateLocation(
    porterId: string,
    userId: string,
    lat: number,
    lng: number,
    accuracy?: number,
    orderId?: string
  ): Promise<void> {
    const startTime = Date.now();
    const redis = getLocationRedis();

    const locationData: LocationData = {
      lat,
      lng,
      accuracy,
      timestamp: new Date().toISOString(),
      orderId,
    };

    // Store in Redis for low-latency reads
    await redis.set(
      `porter:location:${porterId}`,
      JSON.stringify(locationData),
      { EX: 3600 } // Expire after 1 hour
    );

    const latency = (Date.now() - startTime) / 1000;
    recordLocationUpdate(latency);

    // Check if we should persist a snapshot
    await this.maybeSnapshotLocation(porterId, lat, lng, accuracy, orderId);

    // Publish event
    await this.publishLocationEvent(porterId, userId, lat, lng, accuracy, orderId);

    logger.debug('Porter location updated', {
      porterId,
      lat,
      lng,
      accuracy,
      orderId,
      latency,
    });
  }

  /**
   * Get porter's last known location from Redis
   */
  async getLastLocation(porterId: string): Promise<LocationData | null> {
    const redis = getLocationRedis();
    const data = await redis.get(`porter:location:${porterId}`);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Get multiple porters' locations in batch
   */
  async getMultipleLocations(porterIds: string[]): Promise<Map<string, LocationData>> {
    const redis = getLocationRedis();
    const keys = porterIds.map((id) => `porter:location:${id}`);
    const values = await redis.mGet(keys);

    const result = new Map<string, LocationData>();

    values.forEach((value, index) => {
      if (value) {
        result.set(porterIds[index], JSON.parse(value));
      }
    });

    return result;
  }

  /**
   * Query nearby porters within a radius
   * Note: This is a simple implementation. For production, consider using Redis GEO commands
   * or PostGIS for more efficient spatial queries.
   */
  async findNearbyPorters(
    lat: number,
    lng: number,
    radiusMeters: number,
    _onlineOnly = true
  ): Promise<Array<{ porterId: string; distance: number; location: LocationData }>> {
    const redis = getLocationRedis();

    // Get all location keys
    const keys = await redis.keys('porter:location:*');
    const porterIds = keys.map((key) => key.replace('porter:location:', ''));

    // Get all locations
    const locations = await this.getMultipleLocations(porterIds);

    const nearby: Array<{ porterId: string; distance: number; location: LocationData }> = [];

    for (const [porterId, location] of locations.entries()) {
      const distance = getDistance(
        { latitude: lat, longitude: lng },
        { latitude: location.lat, longitude: location.lng }
      );

      if (distance <= radiusMeters) {
        nearby.push({
          porterId,
          distance,
          location,
        });
      }
    }

    // Sort by distance
    nearby.sort((a, b) => a.distance - b.distance);

    return nearby;
  }

  /**
   * Get location history from database
   */
  async getLocationHistory(
    porterId: string,
    orderId?: string,
    limit = 100
  ) {
    return await prisma.locationHistory.findMany({
      where: {
        porterId,
        ...(orderId && { orderId }),
      },
      orderBy: { capturedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Persist location snapshot to database if interval has passed
   */
  private async maybeSnapshotLocation(
    porterId: string,
    lat: number,
    lng: number,
    accuracy?: number,
    orderId?: string
  ): Promise<void> {
    try {
      // Check last snapshot time
      const lastSnapshot = await prisma.locationHistory.findFirst({
        where: { porterId },
        orderBy: { capturedAt: 'desc' },
      });

      const now = new Date();
      const shouldSnapshot =
        !lastSnapshot ||
        (now.getTime() - lastSnapshot.capturedAt.getTime()) / 1000 >= this.snapshotInterval;

      if (shouldSnapshot) {
        await prisma.locationHistory.create({
          data: {
            porterId,
            latitude: lat,
            longitude: lng,
            accuracy,
            orderId,
            capturedAt: now,
          },
        });

        logger.debug('Location snapshot persisted', { porterId });
      }
    } catch (error) {
      logger.error('Failed to persist location snapshot', {
        error,
        porterId,
      });
      // Don't throw - snapshot failure shouldn't block location updates
    }
  }

  /**
   * Publish location update event
   */
  private async publishLocationEvent(
    porterId: string,
    userId: string,
    lat: number,
    lng: number,
    accuracy?: number,
    orderId?: string
  ): Promise<void> {
    try {
      const kafka = getKafkaClient();
      const event: PorterLocationUpdatedEvent = {
        type: EventType.PORTER_LOCATION_UPDATED,
        timestamp: new Date(),
        correlationId: getCorrelationId(),
        userId,
        porterId,
        lat,
        lng,
        accuracy,
        orderId,
      };

      await kafka.publishEvent(event);
    } catch (error) {
      logger.error('Failed to publish location event', {
        error,
        porterId,
      });
      // Don't throw - location is already stored
    }
  }

  /**
   * Clean up old location history based on retention policy
   */
  async cleanupOldHistory(): Promise<number> {
    const retentionDays = parseInt(process.env.LOCATION_HISTORY_RETENTION_DAYS || '90');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.locationHistory.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info('Cleaned up old location history', {
      count: result.count,
      retentionDays,
    });

    return result.count;
  }
}

export default new LocationService();
