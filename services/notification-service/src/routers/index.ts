import { router } from '../trpc';
import { notificationRouter } from './notification';
import { messagingRouter } from './messaging';
import { preferencesRouter } from './preferences';
import { broadcastRouter } from './broadcast';

/**
 * Main application router
 * Combines all feature routers into a single exported router
 */
export const appRouter = router({
  notification: notificationRouter,
  messaging: messagingRouter,
  preferences: preferencesRouter,
  broadcast: broadcastRouter,
});

/**
 * Export type definition for client
 */
export type AppRouter = typeof appRouter;
