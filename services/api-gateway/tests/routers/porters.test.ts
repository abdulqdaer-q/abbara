import { appRouter } from '../../src/routers';
import { Context } from '../../src/context';

jest.mock('../../src/lib/logger');

describe('Porters Router Tests', () => {
  let mockContext: Partial<Context>;
  let caller: any;

  beforeEach(() => {
    mockContext = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      } as any,
      correlationId: 'test-correlation-id',
      services: {
        porters: {
          nearby: {
            query: jest.fn(),
          },
          getPorter: {
            query: jest.fn(),
          },
        } as any,
      } as any,
    };

    caller = appRouter.createCaller(mockContext as Context);
  });

  describe('nearby', () => {
    it('should find nearby porters', async () => {
      const mockPorters = [
        {
          id: 'porter-1',
          name: 'John Porter',
          vehicleType: 'van',
          rating: 4.8,
          distance: 500,
        },
        {
          id: 'porter-2',
          name: 'Jane Porter',
          vehicleType: 'truck',
          rating: 4.9,
          distance: 1200,
        },
      ];

      (mockContext.services!.porters.nearby.query as jest.Mock).mockResolvedValue(mockPorters);

      const result = await caller.porters.nearby({
        lat: 40.7128,
        lng: -74.006,
        radiusMeters: 5000,
        vehicleType: 'van',
      });

      expect(result).toEqual(mockPorters);
      expect(mockContext.services!.porters.nearby.query).toHaveBeenCalledWith({
        lat: 40.7128,
        lng: -74.006,
        radiusMeters: 5000,
        vehicleType: 'van',
      });
      expect(mockContext.logger!.info).toHaveBeenCalledWith(
        'Finding nearby porters',
        expect.any(Object)
      );
    });

    it('should find nearby porters without vehicle type filter', async () => {
      const mockPorters = [
        { id: 'porter-1', name: 'John Porter', rating: 4.8 },
      ];

      (mockContext.services!.porters.nearby.query as jest.Mock).mockResolvedValue(mockPorters);

      const result = await caller.porters.nearby({
        lat: 40.7128,
        lng: -74.006,
        radiusMeters: 3000,
      });

      expect(result).toEqual(mockPorters);
      expect(mockContext.services!.porters.nearby.query).toHaveBeenCalledWith({
        lat: 40.7128,
        lng: -74.006,
        radiusMeters: 3000,
        vehicleType: undefined,
      });
    });

    it('should return empty array when no porters nearby', async () => {
      (mockContext.services!.porters.nearby.query as jest.Mock).mockResolvedValue([]);

      const result = await caller.porters.nearby({
        lat: 40.7128,
        lng: -74.006,
        radiusMeters: 1000,
      });

      expect(result).toEqual([]);
    });

    it('should handle downstream service errors', async () => {
      const error = new Error('Porters service unavailable');
      (mockContext.services!.porters.nearby.query as jest.Mock).mockRejectedValue(error);

      await expect(
        caller.porters.nearby({
          lat: 40.7128,
          lng: -74.006,
          radiusMeters: 5000,
        })
      ).rejects.toThrow();

      expect(mockContext.logger!.error).toHaveBeenCalledWith(
        'Failed to find nearby porters',
        expect.any(Object)
      );
    });

    it('should validate input coordinates', async () => {
      await expect(
        caller.porters.nearby({
          lat: 200, // Invalid latitude
          lng: -74.006,
          radiusMeters: 5000,
        })
      ).rejects.toThrow();

      await expect(
        caller.porters.nearby({
          lat: 40.7128,
          lng: -200, // Invalid longitude
          radiusMeters: 5000,
        })
      ).rejects.toThrow();
    });

    it('should validate radius is positive', async () => {
      await expect(
        caller.porters.nearby({
          lat: 40.7128,
          lng: -74.006,
          radiusMeters: -1000, // Negative radius
        })
      ).rejects.toThrow();
    });
  });

  describe('get', () => {
    it('should get porter details by ID', async () => {
      const mockPorter = {
        id: 'porter-1',
        name: 'John Porter',
        email: 'john@example.com',
        phone: '+1234567890',
        vehicleType: 'van',
        rating: 4.8,
        completedOrders: 150,
      };

      (mockContext.services!.porters.getPorter.query as jest.Mock).mockResolvedValue(mockPorter);

      const result = await caller.porters.get('porter-1');

      expect(result).toEqual(mockPorter);
      expect(mockContext.services!.porters.getPorter.query).toHaveBeenCalledWith('porter-1');
      expect(mockContext.logger!.info).toHaveBeenCalledWith(
        'Fetching porter details',
        { porterId: 'porter-1' }
      );
    });

    it('should handle porter not found', async () => {
      const error = new Error('Porter not found');
      (mockContext.services!.porters.getPorter.query as jest.Mock).mockRejectedValue(error);

      await expect(caller.porters.get('nonexistent-porter')).rejects.toThrow();

      expect(mockContext.logger!.error).toHaveBeenCalledWith(
        'Failed to fetch porter details',
        expect.any(Object)
      );
    });

    it('should handle downstream service errors', async () => {
      const error = new Error('Porters service unavailable');
      (mockContext.services!.porters.getPorter.query as jest.Mock).mockRejectedValue(error);

      await expect(caller.porters.get('porter-1')).rejects.toThrow();
    });
  });

  describe('subscribeToJobs - Protected', () => {
    beforeEach(() => {
      mockContext.user = {
        id: 'porter-1',
        email: 'porter@example.com',
        role: 'porter',
      };
    });

    it('should allow porter to subscribe to job notifications', async () => {
      const result = await caller.porters.subscribeToJobs({
        porterId: 'porter-1',
      });

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('namespace', 'porter');
      expect(mockContext.logger!.info).toHaveBeenCalledWith(
        'Porter subscribing to jobs',
        expect.any(Object)
      );
    });

    it('should allow admin to subscribe on behalf of porter', async () => {
      mockContext.user = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
      };

      const result = await caller.porters.subscribeToJobs({
        porterId: 'porter-2',
      });

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('token');
    });

    it('should reject non-porter users', async () => {
      mockContext.user = {
        id: 'customer-1',
        email: 'customer@example.com',
        role: 'customer',
      };

      await expect(
        caller.porters.subscribeToJobs({
          porterId: 'porter-1',
        })
      ).rejects.toThrow('Only porters can subscribe to job notifications');
    });

    it('should reject unauthenticated users', async () => {
      mockContext.user = undefined;

      await expect(
        caller.porters.subscribeToJobs({
          porterId: 'porter-1',
        })
      ).rejects.toThrow();
    });
  });
});
