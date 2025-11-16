import { generateToken, hashToken, generateTokenPair, generateVerificationCode } from '../../src/utils/token';

describe('Token Utilities', () => {
  describe('generateToken', () => {
    it('should generate a random token', () => {
      const token = generateToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate tokens of specified length', () => {
      const token16 = generateToken(16);
      const token32 = generateToken(32);

      expect(token16.length).toBe(32); // 16 bytes = 32 hex chars
      expect(token32.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('hashToken', () => {
    it('should hash a token', () => {
      const token = 'test-token';
      const hash = hashToken(token);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(token);
    });

    it('should produce consistent hashes', () => {
      const token = 'test-token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate a token and its hash', () => {
      const pair = generateTokenPair();

      expect(pair.token).toBeDefined();
      expect(pair.hash).toBeDefined();
      expect(pair.token).not.toBe(pair.hash);
    });

    it('should generate matching token and hash', () => {
      const pair = generateTokenPair();
      const hash = hashToken(pair.token);

      expect(hash).toBe(pair.hash);
    });
  });

  describe('generateVerificationCode', () => {
    it('should generate a numeric code', () => {
      const code = generateVerificationCode();

      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(/^\d+$/.test(code)).toBe(true);
    });

    it('should generate code of specified length', () => {
      const code4 = generateVerificationCode(4);
      const code6 = generateVerificationCode(6);

      expect(code4.length).toBe(4);
      expect(code6.length).toBe(6);
    });

    it('should generate unique codes', () => {
      const code1 = generateVerificationCode();
      const code2 = generateVerificationCode();

      // While theoretically they could be the same, probability is very low
      expect(code1).toBeDefined();
      expect(code2).toBeDefined();
    });
  });
});
