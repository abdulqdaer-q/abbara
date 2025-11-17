import crypto from 'crypto';

/**
 * Generate a random token
 */
export function generateToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash a token using SHA-256
 * Used for storing refresh tokens and password reset tokens
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate and hash a token pair
 * Returns both the plain token (to send to client) and the hash (to store in DB)
 */
export function generateTokenPair(bytes: number = 32): {
  token: string;
  hash: string;
} {
  const token = generateToken(bytes);
  const hash = hashToken(token);
  return { token, hash };
}

/**
 * Generate a numeric verification code (for SMS/email)
 */
export function generateVerificationCode(length: number = 6): string {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += digits[crypto.randomInt(0, digits.length)];
  }
  return code;
}
