import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '@movenow/common';

export interface AccessTokenPayload {
  userId: string;
  email?: string;
  phone?: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  type: 'refresh';
}

/**
 * Sign an access token
 */
export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  const tokenPayload: AccessTokenPayload = {
    ...payload,
    type: 'access',
  };

  const options: SignOptions = {
    expiresIn: config.JWT_ACCESS_EXPIRY,
    algorithm: config.JWT_ALGORITHM,
  } as SignOptions;

  const secret = config.JWT_ALGORITHM === 'RS256'
    ? config.JWT_PRIVATE_KEY || config.JWT_ACCESS_SECRET
    : config.JWT_ACCESS_SECRET;

  return jwt.sign(tokenPayload, secret, options);
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const options: VerifyOptions = {
    algorithms: [config.JWT_ALGORITHM],
  };

  const secret = config.JWT_ALGORITHM === 'RS256'
    ? config.JWT_PUBLIC_KEY || config.JWT_ACCESS_SECRET
    : config.JWT_ACCESS_SECRET;

  const payload = jwt.verify(token, secret, options) as AccessTokenPayload;

  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return payload;
}

/**
 * Sign a refresh token
 */
export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>): string {
  const tokenPayload: RefreshTokenPayload = {
    ...payload,
    type: 'refresh',
  };

  const options: SignOptions = {
    expiresIn: config.JWT_REFRESH_EXPIRY,
    algorithm: 'HS256', // Always use HS256 for refresh tokens
  } as SignOptions;

  return jwt.sign(tokenPayload, config.JWT_REFRESH_SECRET, options);
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const options: VerifyOptions = {
    algorithms: ['HS256'],
  };

  const payload = jwt.verify(token, config.JWT_REFRESH_SECRET, options) as RefreshTokenPayload;

  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return payload;
}

/**
 * Decode a token without verification (for debugging)
 */
export function decodeToken(token: string): any {
  return jwt.decode(token);
}
