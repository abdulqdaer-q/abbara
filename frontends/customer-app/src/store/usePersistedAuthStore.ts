import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, type User, type LoginCredentials, type RegisterData } from '../services/auth.service';
import { offlineService } from '../services/offline.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
  updateUser: (user: User) => void;
  setHydrated: (hydrated: boolean) => void;
}

/**
 * Persisted auth store with offline support
 * Automatically saves and restores auth state
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  isHydrated: false,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await authService.login(credentials);

      // Cache user profile for offline access
      await offlineService.cacheUserProfile(user);

      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await authService.register(data);

      // Cache user profile for offline access
      await offlineService.cacheUserProfile(user);

      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      await offlineService.clearAllOfflineData();
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    } catch (error: any) {
      console.error('Logout error:', error);
      // Still clear auth state on logout error
      await offlineService.clearAllOfflineData();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  refreshAuth: async () => {
    set({ isLoading: true });
    try {
      // Try to get user from auth service (which checks AsyncStorage)
      let user = await authService.getUser();
      const isAuthenticated = await authService.isAuthenticated();

      // If not found in auth service, try offline cache
      if (!user && isAuthenticated) {
        user = await offlineService.getCachedUserProfile();
      }

      set({ user, isAuthenticated, isLoading: false, isHydrated: true });
    } catch (error) {
      console.error('Auth refresh error:', error);
      set({ user: null, isAuthenticated: false, isLoading: false, isHydrated: true });
    }
  },

  clearError: () => set({ error: null }),

  updateUser: async (user) => {
    set({ user });
    // Update cache
    await offlineService.cacheUserProfile(user);
  },

  setHydrated: (hydrated) => set({ isHydrated: hydrated }),
}));
