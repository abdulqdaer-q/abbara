import { appRouter } from '../../src/routers';
import { Context } from '../../src/context';

jest.mock('../../src/lib/logger');

describe('Admin Router Tests', () => {
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
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
      },
    };

    caller = appRouter.createCaller(mockContext as Context);
  });

  describe('getUser', () => {
    it('should allow admin to get user details', async () => {
      const result = await caller.admin.getUser('user-1');

      expect(result).toHaveProperty('id', 'user-1');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('role');
      expect(result).toHaveProperty('createdAt');
      expect(mockContext.logger!.info).toHaveBeenCalledWith(
        'Admin fetching user',
        {
          targetUserId: 'user-1',
          adminId: 'admin-1',
        }
      );
    });

    it('should reject non-admin users', async () => {
      mockContext.user = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'customer',
      };

      caller = appRouter.createCaller(mockContext as Context);

      await expect(caller.admin.getUser('user-2')).rejects.toThrow();
    });

    it('should reject unauthenticated requests', async () => {
      mockContext.user = undefined;

      caller = appRouter.createCaller(mockContext as Context);

      await expect(caller.admin.getUser('user-1')).rejects.toThrow();
    });
  });

  describe('listUsers', () => {
    it('should allow admin to list users without filters', async () => {
      const result = await caller.admin.listUsers({});

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.users)).toBe(true);
      expect(mockContext.logger!.info).toHaveBeenCalledWith(
        'Admin listing users',
        expect.any(Object)
      );
    });

    it('should allow admin to list users with role filter', async () => {
      const result = await caller.admin.listUsers({
        role: 'porter',
      });

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('total');
    });

    it('should allow admin to list users with pagination', async () => {
      const result = await caller.admin.listUsers({
        limit: 10,
        offset: 20,
      });

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('total');
      expect(mockContext.logger!.info).toHaveBeenCalledWith(
        'Admin listing users',
        {
          filters: { limit: 10, offset: 20 },
          adminId: 'admin-1',
        }
      );
    });

    it('should allow admin to list users with search query', async () => {
      const result = await caller.admin.listUsers({
        search: 'john',
      });

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('total');
    });

    it('should reject non-admin users', async () => {
      mockContext.user = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'customer',
      };

      caller = appRouter.createCaller(mockContext as Context);

      await expect(caller.admin.listUsers({})).rejects.toThrow();
    });
  });

  describe('updateUserRole', () => {
    it('should allow admin to update user role', async () => {
      const result = await caller.admin.updateUserRole({
        userId: 'user-1',
        role: 'porter',
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('userId', 'user-1');
      expect(result).toHaveProperty('newRole', 'porter');
      expect(mockContext.logger!.info).toHaveBeenCalledWith(
        'Admin updating user role',
        {
          userId: 'user-1',
          newRole: 'porter',
          adminId: 'admin-1',
        }
      );
    });

    it('should allow changing role to admin', async () => {
      const result = await caller.admin.updateUserRole({
        userId: 'user-1',
        role: 'admin',
      });

      expect(result).toHaveProperty('newRole', 'admin');
    });

    it('should allow changing role to customer', async () => {
      const result = await caller.admin.updateUserRole({
        userId: 'porter-1',
        role: 'customer',
      });

      expect(result).toHaveProperty('newRole', 'customer');
    });

    it('should reject non-admin users', async () => {
      mockContext.user = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'porter',
      };

      caller = appRouter.createCaller(mockContext as Context);

      await expect(
        caller.admin.updateUserRole({
          userId: 'user-2',
          role: 'admin',
        })
      ).rejects.toThrow();
    });

    it('should reject unauthenticated requests', async () => {
      mockContext.user = undefined;

      caller = appRouter.createCaller(mockContext as Context);

      await expect(
        caller.admin.updateUserRole({
          userId: 'user-1',
          role: 'admin',
        })
      ).rejects.toThrow();
    });
  });

  describe('getSystemStats', () => {
    it('should allow admin to get system stats', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const result = await caller.admin.getSystemStats({
        startDate,
        endDate,
      });

      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('porters');
      expect(result.orders).toHaveProperty('total');
      expect(result.orders).toHaveProperty('completed');
      expect(result.orders).toHaveProperty('cancelled');
      expect(result.orders).toHaveProperty('revenue');
      expect(mockContext.logger!.info).toHaveBeenCalledWith(
        'Admin fetching system stats',
        {
          startDate,
          endDate,
          adminId: 'admin-1',
        }
      );
    });

    it('should allow getting stats without date range', async () => {
      const result = await caller.admin.getSystemStats({});

      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('porters');
    });

    it('should return proper stat structure', async () => {
      const result = await caller.admin.getSystemStats({});

      // Validate orders stats
      expect(typeof result.orders.total).toBe('number');
      expect(typeof result.orders.completed).toBe('number');
      expect(typeof result.orders.cancelled).toBe('number');
      expect(typeof result.orders.revenue).toBe('number');

      // Validate users stats
      expect(typeof result.users.total).toBe('number');
      expect(typeof result.users.active).toBe('number');
      expect(typeof result.users.newSignups).toBe('number');

      // Validate porters stats
      expect(typeof result.porters.total).toBe('number');
      expect(typeof result.porters.active).toBe('number');
      expect(typeof result.porters.avgRating).toBe('number');
    });

    it('should reject non-admin users', async () => {
      mockContext.user = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'customer',
      };

      caller = appRouter.createCaller(mockContext as Context);

      await expect(caller.admin.getSystemStats({})).rejects.toThrow();
    });

    it('should reject porter users', async () => {
      mockContext.user = {
        id: 'porter-1',
        email: 'porter@example.com',
        role: 'porter',
      };

      caller = appRouter.createCaller(mockContext as Context);

      await expect(caller.admin.getSystemStats({})).rejects.toThrow();
    });
  });
});
