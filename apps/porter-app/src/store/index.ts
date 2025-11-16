import { configureStore } from '@reduxjs/toolkit';

import authReducer from './slices/authSlice';
import jobReducer from './slices/jobSlice';
import availabilityReducer from './slices/availabilitySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    job: jobReducer,
    availability: availabilityReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['job/setActiveJob'],
        ignoredActionPaths: ['payload.timestamp'],
        ignoredPaths: ['job.activeJob.scheduledAt'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
