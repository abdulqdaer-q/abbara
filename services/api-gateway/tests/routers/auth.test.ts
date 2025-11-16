import { appRouter } from '../../src/routers';
import { Context } from '../../src/context';
import { Logger } from 'winston';

/**
 * Unit tests for auth router
 */
describe('Auth Router', () => {
  const createMockContext = (overrides?: Partial<Context>): Context => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    return {
      user: null,
      correlationId: 'test-correlation-id',
      logger: mockLogger,
      services: {
        auth: {
          login: {
            mutate: jest.fn().mockResolvedValue({
              accessToken: 'test-access-token',
              refreshToken: 'test-refresh-token',
              user: {
                id: 'user-123',
                email: 'test@example.com',
                role: 'client',
              },
            }),
          },
          refresh: {
            mutate: jest.fn().mockResolvedValue({
              accessToken: 'new-access-token',
              refreshToken: 'new-refresh-token',
            }),
          },
          logout: {
            mutate: jest.fn().mockResolvedValue({ success: true }),
          },
        } as any,
        orders: {} as any,
        pricing: {} as any,
        porters: {} as any,
        payments: {} as any,
        notifications: {} as any,
      },
      ...overrides,
    };
  };

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(ctx.services.auth.login.mutate).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'client',
        },
      });
    });

    it('should validate email format', async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auth.login({
          email: 'invalid-email',
          password: 'password123',
        })
      ).rejects.toThrow();
    });

    it('should validate password length', async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auth.login({
          email: 'test@example.com',
          password: 'short',
        })
      ).rejects.toThrow();
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.refresh({
        refreshToken: 'old-refresh-token',
      });

      expect(ctx.services.auth.refresh.mutate).toHaveBeenCalledWith({
        refreshToken: 'old-refresh-token',
      });

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const ctx = createMockContext({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'client',
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout({
        refreshToken: 'test-refresh-token',
      });

      expect(ctx.services.auth.logout.mutate).toHaveBeenCalledWith({
        refreshToken: 'test-refresh-token',
      });

      expect(result).toEqual({ success: true });
    });

    it('should require authentication', async () => {
      const ctx = createMockContext({ user: null });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auth.logout({
          refreshToken: 'test-refresh-token',
        })
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('me', () => {
    it('should return current user info', async () => {
      const ctx = createMockContext({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'client',
        },
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'client',
      });
    });

    it('should require authentication', async () => {
      const ctx = createMockContext({ user: null });
      const caller = appRouter.createCaller(ctx);

      await expect(caller.auth.me()).rejects.toThrow('Authentication required');
    });
  });
});
