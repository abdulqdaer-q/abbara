import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';
import superjson from 'superjson';

/**
 * Initialize tRPC with context
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware to check if user is admin
 */
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Admin access required',
    });
  }
  return next({
    ctx: {
      ...ctx,
      isAdmin: true,
    },
  });
});

/**
 * Protected admin procedure
 */
export const adminProcedure = t.procedure.use(isAdmin);
