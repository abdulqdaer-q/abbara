import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { config } from '../lib/config';
import { AdminRole } from '../types/schemas';
import { logger } from '../lib/logger';

export interface JWTPayload {
  userId: string;
  email: string;
  role: AdminRole;
  iat?: number;
  exp?: number;
}

/**
 * Verify JWT token and extract payload
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;
    return payload;
  } catch (error) {
    logger.warn('Invalid JWT token', { error });
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Generate JWT token for admin user
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string {
  if (!authHeader) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Missing authorization header',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid authorization header format. Expected: Bearer <token>',
    });
  }

  return parts[1];
}
