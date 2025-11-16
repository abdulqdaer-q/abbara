import { TRPCError } from '@trpc/server';
import { UserRole } from '@movenow/common';
import { AuthContext } from './auth';
import { logger } from '../utils/logger';

/**
 * Role hierarchy for authorization checks
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  CUSTOMER: 1,
  PORTER: 2,
  ADMIN: 3,
};

/**
 * Check if user has required role
 */
export function requireRole(authContext: AuthContext | null, ...roles: UserRole[]): void {
  if (!authContext || !authContext.isAuthenticated) {
    logger.warn('Authorization failed: User not authenticated');
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  const userRole = authContext.user.role;

  if (!roles.includes(userRole)) {
    logger.warn('Authorization failed: Insufficient permissions', {
      userId: authContext.user.userId,
      userRole,
      requiredRoles: roles,
    });

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  }

  logger.debug('Authorization successful', {
    userId: authContext.user.userId,
    userRole,
  });
}

/**
 * Check if user has minimum role level
 */
export function requireMinRole(authContext: AuthContext | null, minRole: UserRole): void {
  if (!authContext || !authContext.isAuthenticated) {
    logger.warn('Authorization failed: User not authenticated');
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  const userRole = authContext.user.role;
  const userLevel = ROLE_HIERARCHY[userRole];
  const minLevel = ROLE_HIERARCHY[minRole];

  if (userLevel < minLevel) {
    logger.warn('Authorization failed: Insufficient role level', {
      userId: authContext.user.userId,
      userRole,
      minRole,
    });

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  }

  logger.debug('Authorization successful', {
    userId: authContext.user.userId,
    userRole,
  });
}

/**
 * Check if user is accessing their own resource
 */
export function requireSelfOrAdmin(
  authContext: AuthContext | null,
  resourceUserId: string
): void {
  if (!authContext || !authContext.isAuthenticated) {
    logger.warn('Authorization failed: User not authenticated');
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  const { userId, role } = authContext.user;

  // Admins can access any resource
  if (role === 'ADMIN') {
    logger.debug('Authorization successful: Admin access', { userId });
    return;
  }

  // Users can only access their own resources
  if (userId !== resourceUserId) {
    logger.warn('Authorization failed: User can only access own resources', {
      userId,
      resourceUserId,
    });

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied',
    });
  }

  logger.debug('Authorization successful: Self access', { userId });
}
