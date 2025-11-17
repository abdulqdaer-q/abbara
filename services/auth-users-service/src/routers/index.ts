import { router } from '../trpc/trpc';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { portersRouter } from './porters';

/**
 * Main application router
 */
export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  porters: portersRouter,
});

export type AppRouter = typeof appRouter;
