import { router } from '../trpc';
import { biddingRouter } from './bidding';
import { strategyRouter } from './strategy';

/**
 * Main application router
 */
export const appRouter = router({
  bidding: biddingRouter,
  strategy: strategyRouter,
});

export type AppRouter = typeof appRouter;
