import { useQuery, useMutation, useQueryClient } from 'react-query';

/**
 * Custom hooks for tRPC API integration
 * These hooks provide type-safe API calls with React Query for caching and state management
 */

// Mock API calls - Replace with actual tRPC client calls
const mockApi = {
  getPorterProfile: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      id: 'porter-123',
      name: 'John Porter',
      email: 'john@example.com',
      phone: '+1234567890',
      verified: true,
      rating: 4.8,
      totalJobs: 247,
    };
  },

  getEarnings: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      totalEarnings: 12450.00,
      thisWeekEarnings: 875.50,
      thisMonthEarnings: 3250.00,
      availableBalance: 2450.00,
      pendingWithdrawal: 0,
    };
  },

  getActiveJob: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return null; // or return active job data
  },

  getJobRequests: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
  },

  getJobHistory: async (filters?: any) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
  },

  getRatings: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
  },

  getTransactions: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
  },

  acceptJob: async (jobId: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, jobId };
  },

  rejectJob: async (jobId: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true };
  },

  updateLocation: async (location: { latitude: number; longitude: number }) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { success: true };
  },

  setAvailability: async (isOnline: boolean) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, isOnline };
  },

  requestWithdrawal: async (amount: number, accountNumber: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      success: true,
      withdrawalId: 'wd-' + Date.now(),
      amount,
      status: 'pending',
    };
  },

  updateProfile: async (data: any) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, ...data };
  },
};

// Porter Profile Hook
export const usePorterProfile = () => {
  return useQuery('porterProfile', mockApi.getPorterProfile, {
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Earnings Hook
export const useEarnings = () => {
  return useQuery('earnings', mockApi.getEarnings, {
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Active Job Hook
export const useActiveJob = () => {
  return useQuery('activeJob', mockApi.getActiveJob, {
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

// Job Requests Hook
export const useJobRequests = () => {
  return useQuery('jobRequests', mockApi.getJobRequests, {
    refetchInterval: 5000, // Refetch every 5 seconds when online
  });
};

// Job History Hook
export const useJobHistory = (filters?: any) => {
  return useQuery(['jobHistory', filters], () => mockApi.getJobHistory(filters), {
    staleTime: 5 * 60 * 1000,
  });
};

// Ratings Hook
export const useRatings = () => {
  return useQuery('ratings', mockApi.getRatings, {
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Transactions Hook
export const useTransactions = () => {
  return useQuery('transactions', mockApi.getTransactions, {
    staleTime: 2 * 60 * 1000,
  });
};

// Accept Job Mutation
export const useAcceptJob = () => {
  const queryClient = useQueryClient();

  return useMutation(mockApi.acceptJob, {
    onSuccess: () => {
      queryClient.invalidateQueries('jobRequests');
      queryClient.invalidateQueries('activeJob');
    },
  });
};

// Reject Job Mutation
export const useRejectJob = () => {
  const queryClient = useQueryClient();

  return useMutation(mockApi.rejectJob, {
    onSuccess: () => {
      queryClient.invalidateQueries('jobRequests');
    },
  });
};

// Update Location Mutation
export const useUpdateLocation = () => {
  return useMutation(mockApi.updateLocation);
};

// Set Availability Mutation
export const useSetAvailability = () => {
  const queryClient = useQueryClient();

  return useMutation(mockApi.setAvailability, {
    onSuccess: () => {
      queryClient.invalidateQueries('porterProfile');
    },
  });
};

// Request Withdrawal Mutation
export const useRequestWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation(
    ({ amount, accountNumber }: { amount: number; accountNumber: string }) =>
      mockApi.requestWithdrawal(amount, accountNumber),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('earnings');
        queryClient.invalidateQueries('transactions');
      },
    }
  );
};

// Update Profile Mutation
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation(mockApi.updateProfile, {
    onSuccess: () => {
      queryClient.invalidateQueries('porterProfile');
    },
  });
};
