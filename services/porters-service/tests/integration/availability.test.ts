import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { prisma } from '../../src/lib/prisma';
import { initRedis, getAvailabilityRedis, closeRedis } from '../../src/lib/redis';
import availabilityService from '../../src/services/availabilityService';

// Mock Kafka to prevent actual event publishing
jest.mock('../../src/lib/kafka');
jest.mock('../../src/lib/metrics');

describe('Availability Integration Tests', () => {
  beforeAll(async () => {
    // Initialize Redis for tests
    await initRedis();
  });

  afterAll(async () => {
    // Cleanup
    await prisma.porterProfile.deleteMany({});
    await closeRedis();
  });

  it('should toggle porter availability online', async () => {
    const porter = await prisma.porterProfile.create({
      data: {
        userId: 'user-avail-1',
        firstName: 'Test',
        lastName: 'Porter',
        phone: '+1234567890',
        email: 'test@porter.com',
        vehicleType: 'SEDAN',
        verificationStatus: 'VERIFIED',
      },
    });

    await availabilityService.setAvailability(
      porter.id,
      porter.userId,
      true,
      { lat: 40.7128, lng: -74.0060 }
    );

    const availability = await availabilityService.getAvailability(porter.id);

    expect(availability).toBeDefined();
    expect(availability!.online).toBe(true);
    expect(availability!.location).toEqual({ lat: 40.7128, lng: -74.0060 });
  });

  it('should toggle porter availability offline', async () => {
    const porter = await prisma.porterProfile.create({
      data: {
        userId: 'user-avail-2',
        firstName: 'Offline',
        lastName: 'Test',
        phone: '+1234567891',
        email: 'offline@porter.com',
        vehicleType: 'VAN',
        verificationStatus: 'VERIFIED',
      },
    });

    // Set online first
    await availabilityService.setAvailability(porter.id, porter.userId, true);

    // Then set offline
    await availabilityService.setAvailability(porter.id, porter.userId, false);

    const availability = await availabilityService.getAvailability(porter.id);

    expect(availability).toBeDefined();
    expect(availability!.online).toBe(false);
  });

  it('should update online porters count in Redis', async () => {
    const porter1 = await prisma.porterProfile.create({
      data: {
        userId: 'user-count-1',
        firstName: 'Count',
        lastName: 'One',
        phone: '+1234567892',
        email: 'count1@porter.com',
        vehicleType: 'TRUCK',
        verificationStatus: 'VERIFIED',
      },
    });

    const porter2 = await prisma.porterProfile.create({
      data: {
        userId: 'user-count-2',
        firstName: 'Count',
        lastName: 'Two',
        phone: '+1234567893',
        email: 'count2@porter.com',
        vehicleType: 'SUV',
        verificationStatus: 'VERIFIED',
      },
    });

    const beforeCount = await availabilityService.getOnlinePortersCount();

    await availabilityService.setAvailability(porter1.id, porter1.userId, true);
    await availabilityService.setAvailability(porter2.id, porter2.userId, true);

    const afterCount = await availabilityService.getOnlinePortersCount();

    expect(afterCount).toBe(beforeCount + 2);

    // Clean up
    await availabilityService.setAvailability(porter1.id, porter1.userId, false);
    await availabilityService.setAvailability(porter2.id, porter2.userId, false);
  });

  it('should persist availability to Redis with correct TTL', async () => {
    const porter = await prisma.porterProfile.create({
      data: {
        userId: 'user-ttl-1',
        firstName: 'TTL',
        lastName: 'Test',
        phone: '+1234567894',
        email: 'ttl@porter.com',
        vehicleType: 'MOTORCYCLE',
        verificationStatus: 'VERIFIED',
      },
    });

    await availabilityService.setAvailability(porter.id, porter.userId, true);

    const redis = getAvailabilityRedis();
    const ttl = await redis.ttl(`porter:availability:${porter.id}`);

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600); // Max TTL is 1 hour

    // Clean up
    await availabilityService.setAvailability(porter.id, porter.userId, false);
  });

  it('should be queryable within 100ms (latency test)', async () => {
    const porter = await prisma.porterProfile.create({
      data: {
        userId: 'user-latency-1',
        firstName: 'Latency',
        lastName: 'Test',
        phone: '+1234567895',
        email: 'latency@porter.com',
        vehicleType: 'BICYCLE',
        verificationStatus: 'VERIFIED',
      },
    });

    await availabilityService.setAvailability(porter.id, porter.userId, true);

    const start = Date.now();
    await availabilityService.getAvailability(porter.id);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);

    // Clean up
    await availabilityService.setAvailability(porter.id, porter.userId, false);
  });

  it('should maintain online porter set correctly', async () => {
    const porter = await prisma.porterProfile.create({
      data: {
        userId: 'user-set-1',
        firstName: 'Set',
        lastName: 'Test',
        phone: '+1234567896',
        email: 'set@porter.com',
        vehicleType: 'SEDAN',
        verificationStatus: 'VERIFIED',
      },
    });

    await availabilityService.setAvailability(porter.id, porter.userId, true);

    const onlineIds = await availabilityService.getOnlinePorterIds();
    expect(onlineIds).toContain(porter.id);

    await availabilityService.setAvailability(porter.id, porter.userId, false);

    const offlineIds = await availabilityService.getOnlinePorterIds();
    expect(offlineIds).not.toContain(porter.id);
  });

  it('should handle heartbeat updates', async () => {
    const porter = await prisma.porterProfile.create({
      data: {
        userId: 'user-heartbeat-1',
        firstName: 'Heartbeat',
        lastName: 'Test',
        phone: '+1234567897',
        email: 'heartbeat@porter.com',
        vehicleType: 'VAN',
        verificationStatus: 'VERIFIED',
      },
    });

    await availabilityService.setAvailability(porter.id, porter.userId, true);

    const before = await availabilityService.getAvailability(porter.id);
    const beforeTime = new Date(before!.lastSeen);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    await availabilityService.updateHeartbeat(porter.id);

    const after = await availabilityService.getAvailability(porter.id);
    const afterTime = new Date(after!.lastSeen);

    expect(afterTime.getTime()).toBeGreaterThan(beforeTime.getTime());

    // Clean up
    await availabilityService.setAvailability(porter.id, porter.userId, false);
  });
});
