import { router } from '../trpc';
import { ordersRouter } from './orders';
import { assignmentsRouter } from './assignments';
import { waypointsRouter, evidenceRouter } from './waypoints';
import { adminRouter } from './admin';

/**
 * Main application router
 * Combines all sub-routers
 */
export const appRouter = router({
  orders: ordersRouter,
  assignments: assignmentsRouter,
  waypoints: waypointsRouter,
  evidence: evidenceRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
