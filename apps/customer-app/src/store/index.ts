import { configureStore } from '@reduxjs/toolkit';

import authReducer from './slices/authSlice';
import orderReducer from './slices/orderSlice';
import notificationReducer from './slices/notificationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    order: orderReducer,
    notification: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['order/setActiveOrder'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.timestamp', 'payload.scheduledAt'],
        // Ignore these paths in the state
        ignoredPaths: ['order.activeOrder.scheduledAt'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
