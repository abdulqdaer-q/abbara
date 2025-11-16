import { appRouter } from '../../src/routers';
import { createContext } from '../../src/context';
import { generateToken } from '../../src/middleware/auth';

describe('Users Router Integration Tests', () => {
  const mockContext = {
    admin: {
      userId: 'admin-123',
      email: 'admin@movenow.com',
      role: 'SUPER_ADMIN' as const,
    },
    correlationId: 'test-corr-id',
    ipAddress: '127.0.0.1',
    userAgent: 'Jest Test',
  };

  describe('listUsers', () => {
    it('should require authentication', async () => {
      const caller = appRouter.createCaller({
        ...mockContext,
        admin: null,
      } as any);

      await expect(
        caller.users.list({ page: 1, limit: 20 })
      ).rejects.toThrow('Authentication required');
    });

    it('should require VIEW_USERS permission', async () => {
      const caller = appRouter.createCaller({
        ...mockContext,
        admin: {
          ...mockContext.admin,
          role: 'SUPPORT' as const,
        },
      } as any);

      // SUPPORT role has VIEW_USERS permission, so this should succeed
      // In a real test, you'd mock the database
      await expect(
        caller.users.list({ page: 1, limit: 20 })
      ).resolves.toBeDefined();
    });
  });

  describe('updateStatus', () => {
    it('should require UPDATE_USER_STATUS permission', async () => {
      const caller = appRouter.createCaller({
        ...mockContext,
        admin: {
          ...mockContext.admin,
          role: 'SUPPORT' as const,
        },
      } as any);

      await expect(
        caller.users.updateStatus({
          userId: 'user-123',
          newStatus: 'SUSPENDED',
          reason: 'Test reason',
        })
      ).rejects.toThrow('does not have permission');
    });
  });
});
