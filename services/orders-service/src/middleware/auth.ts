import { middleware } from '../trpc';
import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JWTPayload {
  userId: string;
  role: 'customer' | 'porter' | 'admin';
  email?: string;
}

/**
 * Middleware to verify JWT token and attach user info to context
 */
export const requireAuth = middleware(async ({ ctx, next }) => {
  const token = ctx.token;

  if (!token) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No authentication token provided',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    return next({
      ctx: {
        ...ctx,
        user: {
          userId: decoded.userId,
          role: decoded.role,
          email: decoded.email,
        },
      },
    });
  } catch (error) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
});

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireAuth.unstable_pipe(
  middleware(async ({ ctx, next }) => {
    if (ctx.user?.role !== 'admin') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Admin access required',
      });
    }

    return next();
  })
);

/**
 * Middleware to require porter role
 */
export const requirePorter = requireAuth.unstable_pipe(
  middleware(async ({ ctx, next }) => {
    if (ctx.user?.role !== 'porter' && ctx.user?.role !== 'admin') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Porter access required',
      });
    }

    return next();
  })
);

/**
 * Middleware to require customer role
 */
export const requireCustomer = requireAuth.unstable_pipe(
  middleware(async ({ ctx, next }) => {
    if (ctx.user?.role !== 'customer' && ctx.user?.role !== 'admin') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Customer access required',
      });
    }

    return next();
  })
);
