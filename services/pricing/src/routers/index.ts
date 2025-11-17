import { router } from '../trpc';
import { pricingRouter } from './pricing';
import { adminRouter } from './admin';

/**
 * Combined application router
 */
export const appRouter = router({
  pricing: pricingRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
