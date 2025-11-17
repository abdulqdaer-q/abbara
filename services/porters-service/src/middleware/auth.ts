import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger';

export interface JWTPayload {
  userId: string;
  role: 'client' | 'porter' | 'admin' | 'superadmin';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: process.env.JWT_ISSUER || 'movenow-auth-service',
      audience: process.env.JWT_AUDIENCE || 'movenow-services',
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    logger.warn('JWT verification failed', { error });
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader?: string): string {
  if (!authHeader) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No authorization header provided',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid authorization header format',
    });
  }

  return parts[1];
}

/**
 * Verify user has porter role
 */
export function requirePorter(payload: JWTPayload): void {
  if (payload.role !== 'porter') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Porter role required',
    });
  }
}

/**
 * Verify user has admin role
 */
export function requireAdmin(payload: JWTPayload): void {
  if (payload.role !== 'admin' && payload.role !== 'superadmin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin role required',
    });
  }
}

/**
 * Verify user is accessing their own porter profile
 */
export async function requireOwnPorterProfile(
  userId: string,
  porterId: string
): Promise<void> {
  const { prisma } = await import('../lib/prisma');

  const porter = await prisma.porterProfile.findUnique({
    where: { id: porterId },
    select: { userId: true },
  });

  if (!porter || porter.userId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied: not your porter profile',
    });
  }
}

export default {
  verifyToken,
  extractToken,
  requirePorter,
  requireAdmin,
  requireOwnPorterProfile,
};
