import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';
import superjson from 'superjson';
import { logger } from './lib/logger';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause
            ? error.cause
            : null,
      },
    };
  },
});

/**
 * Public (unprotected) procedure
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.admin) {
    logger.warn('Unauthorized access attempt', {
      correlationId: ctx.correlationId,
      ipAddress: ctx.ipAddress,
    });
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  return next({
    ctx: {
      ...ctx,
      admin: ctx.admin,
    },
  });
});

/**
 * Create router
 */
export const router = t.router;

/**
 * Middleware for logging
 */
export const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();

  logger.info('tRPC request started', {
    path,
    type,
    correlationId: ctx.correlationId,
    adminId: ctx.admin?.userId,
  });

  const result = await next();

  const duration = Date.now() - start;

  if (result.ok) {
    logger.info('tRPC request completed', {
      path,
      type,
      duration,
      correlationId: ctx.correlationId,
    });
  } else {
    logger.error('tRPC request failed', {
      path,
      type,
      duration,
      correlationId: ctx.correlationId,
      error: result.error,
    });
  }

  return result;
});

export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;
