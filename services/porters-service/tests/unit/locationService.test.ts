import { LocationService } from '../../src/services/locationService';
import { getLocationRedis } from '../../src/lib/redis';
import { prisma } from '../../src/lib/prisma';
import { getKafkaClient } from '../../src/lib/kafka';

// Mock dependencies
jest.mock('../../src/lib/redis', () => ({
  getLocationRedis: jest.fn(() => ({
    set: jest.fn(),
    get: jest.fn(),
    mGet: jest.fn(),
    keys: jest.fn(),
  })),
}));

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    locationHistory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('../../src/lib/kafka', () => ({
  getKafkaClient: jest.fn(() => ({
    publishEvent: jest.fn(),
  })),
}));

jest.mock('../../src/lib/metrics', () => ({
  recordLocationUpdate: jest.fn(),
}));

jest.mock('../../src/lib/logger');
jest.mock('../../src/lib/correlation', () => ({
  getCorrelationId: jest.fn(() => 'test-correlation-id'),
}));

describe('LocationService Tests', () => {
  let locationService: LocationService;
  let mockRedis: any;
  let mockKafka: any;

  beforeEach(() => {
    jest.clearAllMocks();
    locationService = new LocationService();
    mockRedis = getLocationRedis();
    mockKafka = getKafkaClient();
  });

  describe('updateLocation', () => {
    it('should update porter location in Redis', async () => {
      mockRedis.set.mockResolvedValue('OK');
      (prisma.locationHistory.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.locationHistory.create as jest.Mock).mockResolvedValue({});

      await locationService.updateLocation(
        'porter-1',
        'user-1',
        40.7128,
        -74.006,
        10
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        'porter:location:porter-1',
        expect.any(String),
        { EX: 3600 }
      );

      // Verify location data structure
      const callArgs = mockRedis.set.mock.calls[0];
      const locationData = JSON.parse(callArgs[1]);
      expect(locationData).toMatchObject({
        lat: 40.7128,
        lng: -74.006,
        accuracy: 10,
        timestamp: expect.any(String),
      });
    });

    it('should update location with order context', async () => {
      mockRedis.set.mockResolvedValue('OK');
      (prisma.locationHistory.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.locationHistory.create as jest.Mock).mockResolvedValue({});

      await locationService.updateLocation(
        'porter-1',
        'user-1',
        40.7128,
        -74.006,
        10,
        'order-1'
      );

      const callArgs = mockRedis.set.mock.calls[0];
      const locationData = JSON.parse(callArgs[1]);
      expect(locationData.orderId).toBe('order-1');
    });

    it('should publish location event to Kafka', async () => {
      mockRedis.set.mockResolvedValue('OK');
      (prisma.locationHistory.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.locationHistory.create as jest.Mock).mockResolvedValue({});

      await locationService.updateLocation(
        'porter-1',
        'user-1',
        40.7128,
        -74.006
      );

      expect(mockKafka.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'porter.location.updated',
          porterId: 'porter-1',
          userId: 'user-1',
          lat: 40.7128,
          lng: -74.006,
        })
      );
    });

    it('should snapshot location when interval passed', async () => {
      mockRedis.set.mockResolvedValue('OK');

      // Last snapshot was 2 minutes ago
      const oldDate = new Date(Date.now() - 120 * 1000);
      (prisma.locationHistory.findFirst as jest.Mock).mockResolvedValue({
        id: 'snapshot-1',
        porterId: 'porter-1',
        capturedAt: oldDate,
      });
      (prisma.locationHistory.create as jest.Mock).mockResolvedValue({});

      await locationService.updateLocation(
        'porter-1',
        'user-1',
        40.7128,
        -74.006
      );

      expect(prisma.locationHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          porterId: 'porter-1',
          latitude: 40.7128,
          longitude: -74.006,
        }),
      });
    });

    it('should not snapshot if interval not passed', async () => {
      mockRedis.set.mockResolvedValue('OK');

      // Last snapshot was 30 seconds ago
      const recentDate = new Date(Date.now() - 30 * 1000);
      (prisma.locationHistory.findFirst as jest.Mock).mockResolvedValue({
        id: 'snapshot-1',
        porterId: 'porter-1',
        capturedAt: recentDate,
      });

      await locationService.updateLocation(
        'porter-1',
        'user-1',
        40.7128,
        -74.006
      );

      expect(prisma.locationHistory.create).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        locationService.updateLocation('porter-1', 'user-1', 40.7128, -74.006)
      ).rejects.toThrow();
    });
  });

  describe('getLastLocation', () => {
    it('should get last location from Redis', async () => {
      const locationData = {
        lat: 40.7128,
        lng: -74.006,
        accuracy: 10,
        timestamp: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(locationData));

      const result = await locationService.getLastLocation('porter-1');

      expect(result).toEqual(locationData);
      expect(mockRedis.get).toHaveBeenCalledWith('porter:location:porter-1');
    });

    it('should return null if location not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await locationService.getLastLocation('porter-1');

      expect(result).toBeNull();
    });

    it('should parse JSON location data correctly', async () => {
      const locationData = {
        lat: 40.7128,
        lng: -74.006,
        accuracy: 15,
        timestamp: '2024-01-01T12:00:00Z',
        orderId: 'order-1',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(locationData));

      const result = await locationService.getLastLocation('porter-1');

      expect(result).toEqual(locationData);
      expect(result?.orderId).toBe('order-1');
    });
  });

  describe('getMultipleLocations', () => {
    it('should get multiple porter locations in batch', async () => {
      const locations = [
        JSON.stringify({ lat: 40.7128, lng: -74.006, timestamp: '2024-01-01T12:00:00Z' }),
        JSON.stringify({ lat: 40.7589, lng: -73.9851, timestamp: '2024-01-01T12:01:00Z' }),
      ];

      mockRedis.mGet.mockResolvedValue(locations);

      const result = await locationService.getMultipleLocations(['porter-1', 'porter-2']);

      expect(result.size).toBe(2);
      expect(result.get('porter-1')).toMatchObject({ lat: 40.7128, lng: -74.006 });
      expect(result.get('porter-2')).toMatchObject({ lat: 40.7589, lng: -73.9851 });
      expect(mockRedis.mGet).toHaveBeenCalledWith([
        'porter:location:porter-1',
        'porter:location:porter-2',
      ]);
    });

    it('should handle missing locations', async () => {
      const locations = [
        JSON.stringify({ lat: 40.7128, lng: -74.006, timestamp: '2024-01-01T12:00:00Z' }),
        null, // porter-2 has no location
      ];

      mockRedis.mGet.mockResolvedValue(locations);

      const result = await locationService.getMultipleLocations(['porter-1', 'porter-2']);

      expect(result.size).toBe(1);
      expect(result.has('porter-1')).toBe(true);
      expect(result.has('porter-2')).toBe(false);
    });

    it('should handle empty porter list', async () => {
      mockRedis.mGet.mockResolvedValue([]);

      const result = await locationService.getMultipleLocations([]);

      expect(result.size).toBe(0);
    });
  });

  describe('findNearbyPorters', () => {
    it('should find porters within radius', async () => {
      mockRedis.keys.mockResolvedValue([
        'porter:location:porter-1',
        'porter:location:porter-2',
        'porter:location:porter-3',
      ]);

      const locations = [
        JSON.stringify({ lat: 40.7128, lng: -74.006, timestamp: '2024-01-01T12:00:00Z' }),
        JSON.stringify({ lat: 40.7589, lng: -73.9851, timestamp: '2024-01-01T12:00:00Z' }),
        JSON.stringify({ lat: 40.8000, lng: -74.1000, timestamp: '2024-01-01T12:00:00Z' }),
      ];

      mockRedis.mGet.mockResolvedValue(locations);

      const result = await locationService.findNearbyPorters(
        40.7128,
        -74.006,
        10000 // 10km radius
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('porterId');
      expect(result[0]).toHaveProperty('distance');
      expect(result[0]).toHaveProperty('location');
    });

    it('should sort results by distance', async () => {
      mockRedis.keys.mockResolvedValue([
        'porter:location:porter-1',
        'porter:location:porter-2',
      ]);

      const locations = [
        JSON.stringify({ lat: 40.7128, lng: -74.006, timestamp: '2024-01-01T12:00:00Z' }),
        JSON.stringify({ lat: 40.7129, lng: -74.007, timestamp: '2024-01-01T12:00:00Z' }),
      ];

      mockRedis.mGet.mockResolvedValue(locations);

      const result = await locationService.findNearbyPorters(40.7128, -74.006, 10000);

      // Verify results are sorted by distance (closest first)
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].distance).toBeLessThanOrEqual(result[i + 1].distance);
      }
    });

    it('should exclude porters outside radius', async () => {
      mockRedis.keys.mockResolvedValue([
        'porter:location:porter-1',
        'porter:location:porter-2',
      ]);

      const locations = [
        JSON.stringify({ lat: 40.7128, lng: -74.006, timestamp: '2024-01-01T12:00:00Z' }), // Very close
        JSON.stringify({ lat: 50.0000, lng: -80.0000, timestamp: '2024-01-01T12:00:00Z' }), // Very far
      ];

      mockRedis.mGet.mockResolvedValue(locations);

      const result = await locationService.findNearbyPorters(40.7128, -74.006, 1000); // 1km radius

      // Should only include porter-1
      expect(result.length).toBe(1);
      expect(result[0].porterId).toBe('porter-1');
    });

    it('should return empty array when no porters nearby', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await locationService.findNearbyPorters(40.7128, -74.006, 10000);

      expect(result).toEqual([]);
    });
  });

  describe('getLocationHistory', () => {
    it('should get location history for porter', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          porterId: 'porter-1',
          latitude: 40.7128,
          longitude: -74.006,
          capturedAt: new Date(),
        },
        {
          id: 'history-2',
          porterId: 'porter-1',
          latitude: 40.7129,
          longitude: -74.007,
          capturedAt: new Date(),
        },
      ];

      (prisma.locationHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const result = await locationService.getLocationHistory('porter-1');

      expect(result).toEqual(mockHistory);
      expect(prisma.locationHistory.findMany).toHaveBeenCalledWith({
        where: { porterId: 'porter-1' },
        orderBy: { capturedAt: 'desc' },
        take: 100,
      });
    });

    it('should filter history by order', async () => {
      (prisma.locationHistory.findMany as jest.Mock).mockResolvedValue([]);

      await locationService.getLocationHistory('porter-1', 'order-1');

      expect(prisma.locationHistory.findMany).toHaveBeenCalledWith({
        where: { porterId: 'porter-1', orderId: 'order-1' },
        orderBy: { capturedAt: 'desc' },
        take: 100,
      });
    });

    it('should respect custom limit', async () => {
      (prisma.locationHistory.findMany as jest.Mock).mockResolvedValue([]);

      await locationService.getLocationHistory('porter-1', undefined, 50);

      expect(prisma.locationHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe('cleanupOldHistory', () => {
    it('should cleanup old location history', async () => {
      (prisma.locationHistory.deleteMany as jest.Mock).mockResolvedValue({ count: 150 });

      const count = await locationService.cleanupOldHistory();

      expect(count).toBe(150);
      expect(prisma.locationHistory.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should use default retention period of 90 days', async () => {
      delete process.env.LOCATION_HISTORY_RETENTION_DAYS;
      (prisma.locationHistory.deleteMany as jest.Mock).mockResolvedValue({ count: 100 });

      await locationService.cleanupOldHistory();

      const call = (prisma.locationHistory.deleteMany as jest.Mock).mock.calls[0][0];
      const cutoffDate = call.where.createdAt.lt;
      const daysDiff = Math.floor((Date.now() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBeCloseTo(90, 0);
    });

    it('should return 0 when no records deleted', async () => {
      (prisma.locationHistory.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      const count = await locationService.cleanupOldHistory();

      expect(count).toBe(0);
    });
  });
});
