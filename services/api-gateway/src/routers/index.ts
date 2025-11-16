import { router } from '../trpc';
import { authRouter } from './auth';
import { ordersRouter } from './orders';
import { portersRouter } from './porters';
import { paymentsRouter } from './payments';
import { adminRouter } from './admin';
import { realtimeRouter } from './realtime';

/**
 * Main application router
 * Composes all feature routers into a single tRPC router
 */
export const appRouter = router({
  auth: authRouter,
  orders: ordersRouter,
  porters: portersRouter,
  payments: paymentsRouter,
  admin: adminRouter,
  realtime: realtimeRouter,
});

/**
 * Export type definition for client-side usage
 */
export type AppRouter = typeof appRouter;
