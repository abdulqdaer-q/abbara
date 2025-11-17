import { TRPCError } from '@trpc/server';
import { extractToken, authenticateUser, optionalAuth } from '../../src/middleware/auth';
import { requireRole, requireMinRole, requireSelfOrAdmin } from '../../src/middleware/rbac';
import { signAccessToken } from '../../src/utils/jwt';

// Mock logger
jest.mock('../../src/utils/logger');

describe('Middleware Tests', () => {
  describe('extractToken', () => {
    it('should extract token from valid Bearer header', () => {
      const token = extractToken('Bearer my-token-123');
      expect(token).toBe('my-token-123');
    });

    it('should return null for missing header', () => {
      const token = extractToken(undefined);
      expect(token).toBeNull();
    });

    it('should return null for invalid format', () => {
      const token = extractToken('InvalidFormat my-token');
      expect(token).toBeNull();
    });

    it('should return null for missing token part', () => {
      const token = extractToken('Bearer');
      expect(token).toBeNull();
    });

    it('should return null for empty string', () => {
      const token = extractToken('');
      expect(token).toBeNull();
    });
  });

  describe('authenticateUser', () => {
    it('should authenticate user with valid token', () => {
      const token = signAccessToken({
        userId: 'user-1',
        email: 'test@example.com',
        role: 'CUSTOMER',
      });

      const result = authenticateUser(token);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('isAuthenticated', true);
      expect(result.user.userId).toBe('user-1');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('CUSTOMER');
    });

    it('should throw error for missing token', () => {
      expect(() => authenticateUser(null)).toThrow(TRPCError);
      expect(() => authenticateUser(null)).toThrow('Authentication required');
    });

    it('should throw error for undefined token', () => {
      expect(() => authenticateUser(undefined)).toThrow(TRPCError);
      expect(() => authenticateUser(undefined)).toThrow('Authentication required');
    });

    it('should throw error for invalid token', () => {
      expect(() => authenticateUser('invalid-token')).toThrow(TRPCError);
      expect(() => authenticateUser('invalid-token')).toThrow('Invalid or expired token');
    });

    it('should throw error for malformed token', () => {
      expect(() => authenticateUser('not.a.valid.jwt')).toThrow(TRPCError);
    });
  });

  describe('optionalAuth', () => {
    it('should return auth context with valid token', () => {
      const token = signAccessToken({
        userId: 'user-1',
        email: 'test@example.com',
        role: 'CUSTOMER',
      });

      const result = optionalAuth(token);

      expect(result).not.toBeNull();
      expect(result?.user.userId).toBe('user-1');
      expect(result?.isAuthenticated).toBe(true);
    });

    it('should return null for missing token', () => {
      const result = optionalAuth(null);
      expect(result).toBeNull();
    });

    it('should return null for undefined token', () => {
      const result = optionalAuth(undefined);
      expect(result).toBeNull();
    });

    it('should return null for invalid token', () => {
      const result = optionalAuth('invalid-token');
      expect(result).toBeNull();
    });

    it('should not throw error for invalid token', () => {
      expect(() => optionalAuth('invalid-token')).not.toThrow();
    });
  });

  describe('requireRole', () => {
    it('should allow access with correct role', () => {
      const authContext = {
        user: {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'CUSTOMER' as const,
          type: 'access' as const,
        },
        isAuthenticated: true as const,
      };

      expect(() => requireRole(authContext, 'CUSTOMER')).not.toThrow();
    });

    it('should allow access with one of multiple allowed roles', () => {
      const authContext = {
        user: {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'PORTER' as const,
          type: 'access' as const,
        },
        isAuthenticated: true as const,
      };

      expect(() => requireRole(authContext, 'CUSTOMER', 'PORTER', 'ADMIN')).not.toThrow();
    });

    it('should deny access with incorrect role', () => {
      const authContext = {
        user: {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'CUSTOMER' as const,
          type: 'access' as const,
        },
        isAuthenticated: true as const,
      };

      expect(() => requireRole(authContext, 'ADMIN')).toThrow(TRPCError);
      expect(() => requireRole(authContext, 'ADMIN')).toThrow('Insufficient permissions');
    });

    it('should deny access for unauthenticated user', () => {
      expect(() => requireRole(null, 'CUSTOMER')).toThrow(TRPCError);
      expect(() => requireRole(null, 'CUSTOMER')).toThrow('Authentication required');
    });

    it('should deny access when isAuthenticated is false', () => {
      const authContext = {
        user: {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'CUSTOMER' as const,
          type: 'access' as const,
        },
        isAuthenticated: false as any,
      };

      expect(() => requireRole(authContext, 'CUSTOMER')).toThrow(TRPCError);
    });
  });

  describe('requireMinRole', () => {
    it('should allow access for exact role match', () => {
      const authContext = {
        user: {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'PORTER' as const,
          type: 'access' as const,
        },
        isAuthenticated: true as const,
      };

      expect(() => requireMinRole(authContext, 'PORTER')).not.toThrow();
    });

    it('should allow access for higher role', () => {
      const authContext = {
        user: {
          userId: 'admin-1',
          email: 'admin@example.com',
          role: 'ADMIN' as const,
          type: 'access' as const,
        },
        isAuthenticated: true as const,
      };

      expect(() => requireMinRole(authContext, 'CUSTOMER')).not.toThrow();
      expect(() => requireMinRole(authContext, 'PORTER')).not.toThrow();
    });

    it('should deny access for lower role', () => {
      const authContext = {
        user: {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'CUSTOMER' as const,
          type: 'access' as const,
        },
        isAuthenticated: true as const,
      };

      expect(() => requireMinRole(authContext, 'ADMIN')).toThrow(TRPCError);
      expect(() => requireMinRole(authContext, 'ADMIN')).toThrow('Insufficient permissions');
    });

    it('should deny access for unauthenticated user', () => {
      expect(() => requireMinRole(null, 'CUSTOMER')).toThrow(TRPCError);
      expect(() => requireMinRole(null, 'CUSTOMER')).toThrow('Authentication required');
    });

    it('should handle role hierarchy correctly', () => {
      const customerContext = {
        user: { userId: 'user-1', role: 'CUSTOMER' as const, type: 'access' as const },
        isAuthenticated: true as const,
      };

      const porterContext = {
        user: { userId: 'user-2', role: 'PORTER' as const, type: 'access' as const },
        isAuthenticated: true as const,
      };

      const adminContext = {
        user: { userId: 'user-3', role: 'ADMIN' as const, type: 'access' as const },
        isAuthenticated: true as const,
      };

      // CUSTOMER can only access CUSTOMER level
      expect(() => requireMinRole(customerContext, 'CUSTOMER')).not.toThrow();
      expect(() => requireMinRole(customerContext, 'PORTER')).toThrow();
      expect(() => requireMinRole(customerContext, 'ADMIN')).toThrow();

      // PORTER can access CUSTOMER and PORTER levels
      expect(() => requireMinRole(porterContext, 'CUSTOMER')).not.toThrow();
      expect(() => requireMinRole(porterContext, 'PORTER')).not.toThrow();
      expect(() => requireMinRole(porterContext, 'ADMIN')).toThrow();

      // ADMIN can access all levels
      expect(() => requireMinRole(adminContext, 'CUSTOMER')).not.toThrow();
      expect(() => requireMinRole(adminContext, 'PORTER')).not.toThrow();
      expect(() => requireMinRole(adminContext, 'ADMIN')).not.toThrow();
    });
  });

  describe('requireSelfOrAdmin', () => {
    it('should allow user to access their own resources', () => {
      const authContext = {
        user: {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'CUSTOMER' as const,
          type: 'access' as const,
        },
        isAuthenticated: true as const,
      };

      expect(() => requireSelfOrAdmin(authContext, 'user-1')).not.toThrow();
    });

    it('should allow admin to access any resources', () => {
      const authContext = {
        user: {
          userId: 'admin-1',
          email: 'admin@example.com',
          role: 'ADMIN' as const,
          type: 'access' as const,
        },
        isAuthenticated: true as const,
      };

      expect(() => requireSelfOrAdmin(authContext, 'user-1')).not.toThrow();
      expect(() => requireSelfOrAdmin(authContext, 'user-2')).not.toThrow();
      expect(() => requireSelfOrAdmin(authContext, 'any-user-id')).not.toThrow();
    });

    it('should deny non-admin user from accessing other resources', () => {
      const authContext = {
        user: {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'CUSTOMER' as const,
          type: 'access' as const,
        },
        isAuthenticated: true as const,
      };

      expect(() => requireSelfOrAdmin(authContext, 'user-2')).toThrow(TRPCError);
      expect(() => requireSelfOrAdmin(authContext, 'user-2')).toThrow('Access denied');
    });

    it('should deny porter from accessing other user resources', () => {
      const authContext = {
        user: {
          userId: 'porter-1',
          email: 'porter@example.com',
          role: 'PORTER' as const,
          type: 'access' as const,
        },
        isAuthenticated: true as const,
      };

      expect(() => requireSelfOrAdmin(authContext, 'user-1')).toThrow(TRPCError);
    });

    it('should deny access for unauthenticated user', () => {
      expect(() => requireSelfOrAdmin(null, 'user-1')).toThrow(TRPCError);
      expect(() => requireSelfOrAdmin(null, 'user-1')).toThrow('Authentication required');
    });
  });
});
