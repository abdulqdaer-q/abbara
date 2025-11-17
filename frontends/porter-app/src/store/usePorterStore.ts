import { create } from 'zustand';

export type PorterStatus = 'offline' | 'online' | 'busy' | 'on_job';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

interface PorterProfile {
  id: string;
  userId: string;
  verificationStatus: VerificationStatus;
  vehicleType?: string;
  vehiclePlate?: string;
  rating: number;
  totalRatings: number;
  totalJobs: number;
  documentsMetadata?: any;
}

interface PorterState {
  status: PorterStatus;
  isOnline: boolean;
  profile: PorterProfile | null;
  currentLocation: { lat: number; lng: number } | null;
  
  setStatus: (status: PorterStatus) => void;
  toggleOnline: () => void;
  setProfile: (profile: PorterProfile) => void;
  updateLocation: (location: { lat: number; lng: number }) => void;
}

export const usePorterStore = create<PorterState>((set) => ({
  status: 'offline',
  isOnline: false,
  profile: null,
  currentLocation: null,

  setStatus: (status) => set({ status, isOnline: status !== 'offline' }),
  
  toggleOnline: () => set((state) => ({
    isOnline: !state.isOnline,
    status: !state.isOnline ? 'online' : 'offline',
  })),

  setProfile: (profile) => set({ profile }),

  updateLocation: (location) => set({ currentLocation: location }),
}));
