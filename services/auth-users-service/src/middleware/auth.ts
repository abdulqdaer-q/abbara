import { TRPCError } from '@trpc/server';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt';
import { logger } from '../utils/logger';

export interface AuthContext {
  user: AccessTokenPayload;
  isAuthenticated: true;
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Authenticate user from token
 */
export function authenticateUser(token?: string | null): AuthContext {
  if (!token) {
    logger.warn('Authentication failed: No token provided');
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  try {
    const payload = verifyAccessToken(token);
    logger.debug('User authenticated', { userId: payload.userId });

    return {
      user: payload,
      isAuthenticated: true,
    };
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', { error });
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Optional authentication - returns user if token is valid, null otherwise
 */
export function optionalAuth(token?: string | null): AuthContext | null {
  if (!token) {
    return null;
  }

  try {
    const payload = verifyAccessToken(token);
    return {
      user: payload,
      isAuthenticated: true,
    };
  } catch (error) {
    return null;
  }
}
