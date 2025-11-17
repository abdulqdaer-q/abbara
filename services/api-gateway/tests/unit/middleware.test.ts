import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole, verifyAccessToken } from '../../src/middleware/requireAuth';
import { config } from '../../src/config';

describe('API Gateway Middleware Tests', () => {
  describe('requireAuth', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        headers: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
    });

    it('should authenticate with valid Bearer token', () => {
      const token = jwt.sign(
        {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'customer',
        },
        config.jwt.accessSecret
      );

      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        role: 'customer',
      });
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', () => {
      mockReq.headers = {};

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid header format', () => {
      mockReq.headers = {
        authorization: 'InvalidFormat token',
      };

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed Bearer token', () => {
      mockReq.headers = {
        authorization: 'Bearer invalid-token',
      };

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with expired token', () => {
      const expiredToken = jwt.sign(
        {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'customer',
        },
        config.jwt.accessSecret,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      mockReq.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle tokens from different roles', () => {
      const roles = ['customer', 'porter', 'admin'];

      roles.forEach((role) => {
        const token = jwt.sign(
          {
            userId: `${role}-1`,
            email: `${role}@example.com`,
            role,
          },
          config.jwt.accessSecret
        );

        mockReq.headers = {
          authorization: `Bearer ${token}`,
        };

        mockNext = jest.fn();

        requireAuth(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect((mockReq as any).user.role).toBe(role);
      });
    });
  });

  describe('requireRole', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
    });

    it('should allow access for correct role', () => {
      (mockReq as any).user = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
      };

      const middleware = requireRole(['admin']);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow access for one of multiple allowed roles', () => {
      (mockReq as any).user = {
        id: 'porter-1',
        email: 'porter@example.com',
        role: 'porter',
      };

      const middleware = requireRole(['admin', 'porter']);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for incorrect role', () => {
      (mockReq as any).user = {
        id: 'customer-1',
        email: 'customer@example.com',
        role: 'customer',
      };

      const middleware = requireRole(['admin', 'porter']);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Access denied. Required roles: admin, porter',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for missing user', () => {
      (mockReq as any).user = undefined;

      const middleware = requireRole(['admin']);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle single role requirement', () => {
      (mockReq as any).user = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
      };

      const middleware = requireRole(['admin']);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle multiple role requirements', () => {
      (mockReq as any).user = {
        id: 'customer-1',
        email: 'customer@example.com',
        role: 'customer',
      };

      const middleware = requireRole(['customer', 'porter', 'admin']);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid token', () => {
      const token = jwt.sign(
        {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'customer',
        },
        config.jwt.accessSecret
      );

      const result = verifyAccessToken(token);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-1');
      expect(result?.email).toBe('test@example.com');
      expect(result?.role).toBe('customer');
    });

    it('should return null for invalid token', () => {
      const result = verifyAccessToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      const expiredToken = jwt.sign(
        {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'customer',
        },
        config.jwt.accessSecret,
        { expiresIn: '-1h' }
      );

      const result = verifyAccessToken(expiredToken);

      expect(result).toBeNull();
    });

    it('should return null for token signed with wrong secret', () => {
      const token = jwt.sign(
        {
          userId: 'user-1',
          email: 'test@example.com',
          role: 'customer',
        },
        'wrong-secret'
      );

      const result = verifyAccessToken(token);

      expect(result).toBeNull();
    });

    it('should verify tokens for different roles', () => {
      const roles = ['customer', 'porter', 'admin'];

      roles.forEach((role) => {
        const token = jwt.sign(
          {
            userId: `${role}-1`,
            email: `${role}@example.com`,
            role,
          },
          config.jwt.accessSecret
        );

        const result = verifyAccessToken(token);

        expect(result).not.toBeNull();
        expect(result?.role).toBe(role);
      });
    });

    it('should handle malformed tokens gracefully', () => {
      const malformedTokens = [
        '',
        'not.a.token',
        'Bearer token',
        null as any,
        undefined as any,
      ];

      malformedTokens.forEach((token) => {
        const result = verifyAccessToken(token);
        expect(result).toBeNull();
      });
    });
  });
});
