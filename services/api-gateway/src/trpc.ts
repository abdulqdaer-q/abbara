import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { Context } from './context';

/**
 * Initialize tRPC with context
 */
export const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        correlationId: (error.cause as any)?.correlationId,
      },
    };
  },
});

/**
 * Export reusable router and procedure builders
 */
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware to require authentication
 */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      cause: {
        correlationId: ctx.correlationId,
      },
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Type narrowing - user is guaranteed to exist
    },
  });
});

/**
 * Protected procedure that requires authentication
 */
export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Middleware for role-based access control
 */
export const requireRole = (allowedRoles: string[]) => {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        cause: {
          correlationId: ctx.correlationId,
        },
      });
    }

    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        cause: {
          correlationId: ctx.correlationId,
          userRole: ctx.user.role,
          requiredRoles: allowedRoles,
        },
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });
};

/**
 * Admin-only procedure
 */
export const adminProcedure = t.procedure.use(requireRole(['admin', 'superadmin']));
