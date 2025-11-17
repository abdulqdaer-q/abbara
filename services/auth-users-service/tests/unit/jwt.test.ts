import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from '../../src/utils/jwt';

describe('JWT Utilities', () => {
  describe('Access Tokens', () => {
    it('should sign and verify an access token', () => {
      const payload = {
        userId: '123',
        email: 'test@example.com',
        role: 'CUSTOMER' as const,
      };

      const token = signAccessToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = verifyAccessToken(token);
      expect(verified.userId).toBe(payload.userId);
      expect(verified.email).toBe(payload.email);
      expect(verified.role).toBe(payload.role);
      expect(verified.type).toBe('access');
    });

    it('should reject an invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });

    it('should reject a refresh token as access token', () => {
      const refreshToken = signRefreshToken({
        userId: '123',
        tokenId: 'token-id',
      });

      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });
  });

  describe('Refresh Tokens', () => {
    it('should sign and verify a refresh token', () => {
      const payload = {
        userId: '123',
        tokenId: 'token-id-123',
      };

      const token = signRefreshToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = verifyRefreshToken(token);
      expect(verified.userId).toBe(payload.userId);
      expect(verified.tokenId).toBe(payload.tokenId);
      expect(verified.type).toBe('refresh');
    });

    it('should reject an invalid token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow();
    });

    it('should reject an access token as refresh token', () => {
      const accessToken = signAccessToken({
        userId: '123',
        role: 'CUSTOMER',
      });

      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });
  });
});
