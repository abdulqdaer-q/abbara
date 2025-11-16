import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';
import { authenticateUser, AuthContext } from '../middleware/auth';
import { logger } from '../utils/logger';

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    logger.error('tRPC error', {
      code: error.code,
      message: error.message,
    });

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.code === 'BAD_REQUEST' && error.cause,
      },
    };
  },
});

/**
 * Base router and procedure builders
 */
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Authenticated procedure - requires valid JWT
 */
export const authenticatedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const auth = authenticateUser(ctx.token);

  logger.debug('Authenticated request', {
    userId: auth.user.userId,
    correlationId: ctx.correlationId,
  });

  return next({
    ctx: {
      ...ctx,
      auth,
    },
  });
});

/**
 * Admin-only procedure
 */
export const adminProcedure = authenticatedProcedure.use(async ({ ctx, next }) => {
  if (ctx.auth.user.role !== 'ADMIN') {
    logger.warn('Admin access denied', {
      userId: ctx.auth.user.userId,
      role: ctx.auth.user.role,
    });

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next();
});

/**
 * Porter-only procedure
 */
export const porterProcedure = authenticatedProcedure.use(async ({ ctx, next }) => {
  if (ctx.auth.user.role !== 'PORTER' && ctx.auth.user.role !== 'ADMIN') {
    logger.warn('Porter access denied', {
      userId: ctx.auth.user.userId,
      role: ctx.auth.user.role,
    });

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Porter access required',
    });
  }

  return next();
});

/**
 * Middleware for idempotency key handling
 */
export const withIdempotency = t.middleware(async ({ ctx, next, rawInput }) => {
  const input = rawInput as any;
  const idempotencyKey = input?.idempotencyKey;

  if (idempotencyKey) {
    logger.debug('Processing with idempotency key', {
      idempotencyKey,
      correlationId: ctx.correlationId,
    });

    // In a production environment, you would check if this idempotency key
    // has been processed before and return the cached result
    // For now, we just log it
  }

  return next();
});

// Extended context type with auth
export type AuthenticatedContext = Context & {
  auth: AuthContext;
};
