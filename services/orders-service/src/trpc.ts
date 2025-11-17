import { initTRPC } from '@trpc/server';
import { Context } from './context';
import superjson from 'superjson';
import { toTRPCError } from './lib/errors';
import { logger } from './lib/logger';
import { procedureCallCounter, procedureDuration } from './lib/metrics';

/**
 * Initialize tRPC with context and transformer
 */
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
 * Create base router
 */
export const router = t.router;

/**
 * Create base procedure with logging and metrics
 */
export const publicProcedure = t.procedure.use(async ({ path, next, ctx }) => {
  const start = Date.now();

  logger.info('Procedure called', {
    path,
    correlationId: ctx.correlationId,
  });

  try {
    const result = await next();
    const duration = (Date.now() - start) / 1000;

    procedureCallCounter.inc({ procedure: path, status: 'success' });
    procedureDuration.observe({ procedure: path }, duration);

    logger.info('Procedure completed', {
      path,
      correlationId: ctx.correlationId,
      duration,
    });

    return result;
  } catch (error) {
    const duration = (Date.now() - start) / 1000;

    procedureCallCounter.inc({ procedure: path, status: 'error' });
    procedureDuration.observe({ procedure: path }, duration);

    logger.error('Procedure failed', {
      path,
      correlationId: ctx.correlationId,
      duration,
      error: error instanceof Error ? error.message : String(error),
    });

    // Convert to tRPC error
    throw toTRPCError(error instanceof Error ? error : new Error(String(error)));
  }
});

/**
 * Create middleware helper
 */
export const middleware = t.middleware;

/**
 * Merge routers helper
 */
export const mergeRouters = t.mergeRouters;
