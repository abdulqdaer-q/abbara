import { create } from 'zustand';

export type JobStatus = 'pending' | 'accepted' | 'arrived' | 'loaded' | 'in_transit' | 'delivered' | 'completed';

export interface Job {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  pickupLocation: {
    address: string;
    lat: number;
    lng: number;
  };
  dropoffLocation: {
    address: string;
    lat: number;
    lng: number;
  };
  vehicleType: string;
  estimatedPrice: number;
  distance: number;
  status: JobStatus;
  scheduledFor?: Date;
  createdAt: Date;
}

interface JobState {
  availableJobs: Job[];
  activeJob: Job | null;
  completedJobs: Job[];
  
  setAvailableJobs: (jobs: Job[]) => void;
  setActiveJob: (job: Job | null) => void;
  updateJobStatus: (jobId: string, status: JobStatus) => void;
  addCompletedJob: (job: Job) => void;
}

export const useJobStore = create<JobState>((set) => ({
  availableJobs: [],
  activeJob: null,
  completedJobs: [],

  setAvailableJobs: (jobs) => set({ availableJobs: jobs }),
  
  setActiveJob: (job) => set({ activeJob: job }),

  updateJobStatus: (jobId, status) => set((state) => {
    if (state.activeJob?.id === jobId) {
      return { activeJob: { ...state.activeJob, status } };
    }
    return state;
  }),

  addCompletedJob: (job) => set((state) => ({
    completedJobs: [job, ...state.completedJobs],
  })),
}));
