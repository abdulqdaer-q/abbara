import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OrderDetail, OrderStatus } from '@movenow/common';

interface JobState {
  activeJob: OrderDetail | null;
  jobRequests: OrderDetail[];
  completedJobs: OrderDetail[];
  isLoading: boolean;
  error: string | null;
}

const initialState: JobState = {
  activeJob: null,
  jobRequests: [],
  completedJobs: [],
  isLoading: false,
  error: null,
};

const jobSlice = createSlice({
  name: 'job',
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setActiveJob(state, action: PayloadAction<OrderDetail | null>) {
      state.activeJob = action.payload;
    },
    addJobRequest(state, action: PayloadAction<OrderDetail>) {
      state.jobRequests.push(action.payload);
    },
    removeJobRequest(state, action: PayloadAction<string>) {
      state.jobRequests = state.jobRequests.filter(job => job.id !== action.payload);
    },
    acceptJob(state, action: PayloadAction<OrderDetail>) {
      state.activeJob = action.payload;
      state.jobRequests = state.jobRequests.filter(job => job.id !== action.payload.id);
    },
    updateJobStatus(state, action: PayloadAction<{ jobId: string; status: OrderStatus }>) {
      if (state.activeJob?.id === action.payload.jobId) {
        state.activeJob.status = action.payload.status;
      }
    },
    completeJob(state, action: PayloadAction<OrderDetail>) {
      if (state.activeJob?.id === action.payload.id) {
        state.completedJobs.unshift(action.payload);
        state.activeJob = null;
      }
    },
  },
});

export const {
  setLoading,
  setError,
  setActiveJob,
  addJobRequest,
  removeJobRequest,
  acceptJob,
  updateJobStatus,
  completeJob,
} = jobSlice.actions;

export default jobSlice.reducer;
