import jwt from 'jsonwebtoken';
import { authService } from '../../src/services/auth.service';
import { config } from '../../src/config';

describe('AuthService', () => {
  describe('generateSocketToken', () => {
    it('should generate a valid socket token', () => {
      const userId = 'test-user-123';
      const role = 'CUSTOMER' as const;

      const token = authService.generateSocketToken(userId, role);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify the token
      const payload = jwt.verify(token, config.jwt.socketSecret) as any;
      expect(payload.userId).toBe(userId);
      expect(payload.role).toBe(role);
    });
  });

  describe('verifySocketToken', () => {
    it('should verify a valid socket token', () => {
      const userId = 'test-user-123';
      const role = 'PORTER' as const;

      const token = authService.generateSocketToken(userId, role);
      const payload = authService.verifySocketToken(token);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(userId);
      expect(payload?.role).toBe(role);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const payload = authService.verifySocketToken(invalidToken);

      expect(payload).toBeNull();
    });

    it('should return null for expired token', () => {
      const expiredToken = jwt.sign(
        { userId: 'test', role: 'CUSTOMER' },
        config.jwt.socketSecret,
        { expiresIn: '0s' }
      );

      // Wait a bit to ensure expiration
      setTimeout(() => {
        const payload = authService.verifySocketToken(expiredToken);
        expect(payload).toBeNull();
      }, 100);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const userId = 'test-user-456';
      const role = 'ADMIN' as const;

      const token = jwt.sign(
        { userId, role },
        config.jwt.accessSecret,
        { expiresIn: '15m' }
      );

      const payload = authService.verifyAccessToken(token);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(userId);
      expect(payload?.role).toBe(role);
    });

    it('should return null for token with wrong secret', () => {
      const token = jwt.sign(
        { userId: 'test', role: 'CUSTOMER' },
        'wrong-secret',
        { expiresIn: '15m' }
      );

      const payload = authService.verifyAccessToken(token);
      expect(payload).toBeNull();
    });
  });

  describe('verifyToken', () => {
    it('should verify socket token first', () => {
      const userId = 'test-user-789';
      const role = 'CUSTOMER' as const;

      const socketToken = authService.generateSocketToken(userId, role);
      const payload = authService.verifyToken(socketToken);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(userId);
    });

    it('should fallback to access token if socket token fails', () => {
      const userId = 'test-user-abc';
      const role = 'PORTER' as const;

      const accessToken = jwt.sign(
        { userId, role },
        config.jwt.accessSecret,
        { expiresIn: '15m' }
      );

      const payload = authService.verifyToken(accessToken);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(userId);
    });

    it('should return null if both verifications fail', () => {
      const invalidToken = 'completely.invalid.token';
      const payload = authService.verifyToken(invalidToken);

      expect(payload).toBeNull();
    });
  });

  describe('extractToken', () => {
    it('should extract token from query params', () => {
      const auth = {
        token: 'test-token-123',
      };

      const token = authService.extractToken(auth);
      expect(token).toBe('test-token-123');
    });

    it('should extract token from authorization header', () => {
      const auth = {
        authorization: 'Bearer test-token-456',
      };

      const token = authService.extractToken(auth);
      expect(token).toBe('test-token-456');
    });

    it('should handle authorization header case-insensitively', () => {
      const auth = {
        authorization: 'bearer test-token-789',
      };

      const token = authService.extractToken(auth);
      expect(token).toBe('test-token-789');
    });

    it('should return null for missing auth', () => {
      const token = authService.extractToken(null);
      expect(token).toBeNull();
    });

    it('should return null for invalid authorization format', () => {
      const auth = {
        authorization: 'InvalidFormat test-token',
      };

      const token = authService.extractToken(auth);
      expect(token).toBeNull();
    });
  });
});
