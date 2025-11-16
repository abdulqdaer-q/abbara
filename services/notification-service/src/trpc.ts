import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { Context } from './types/context';

/**
 * Initialize tRPC with context type
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        correlationId: error.cause instanceof Error ? undefined : error.cause,
      },
    };
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router;
export const middleware = t.middleware;

/**
 * Public (unauthed) procedure
 */
export const publicProcedure = t.procedure;

/**
 * Authentication middleware
 * Ensures user is authenticated before proceeding
 */
const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Type narrowing: user is now guaranteed to exist
    },
  });
});

/**
 * Protected procedure (requires authentication)
 */
export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Role-based authorization middleware
 */
const requireRole = (allowedRoles: string[]) =>
  middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    if (!allowedRoles.includes(ctx.user.role)) {
      ctx.logger.warn(
        `User ${ctx.user.id} with role ${ctx.user.role} attempted to access resource requiring roles: ${allowedRoles.join(', ')}`
      );
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });

/**
 * Admin procedure (requires admin or superadmin role)
 */
export const adminProcedure = t.procedure.use(requireRole(['admin', 'superadmin']));
