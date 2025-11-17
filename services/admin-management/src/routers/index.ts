import { router } from '../trpc';
import { usersRouter } from './users';
import { portersRouter } from './porters';
import { vehicleTypesRouter } from './vehicleTypes';
import { promoCodesRouter } from './promoCodes';
import { ordersRouter } from './orders';
import { analyticsRouter } from './analytics';
import { settingsRouter } from './settings';

/**
 * Main application router
 */
export const appRouter = router({
  users: usersRouter,
  porters: portersRouter,
  vehicleTypes: vehicleTypesRouter,
  promoCodes: promoCodesRouter,
  orders: ordersRouter,
  analytics: analyticsRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
