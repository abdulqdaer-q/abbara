import { useAuthStore } from '../store/useAuthStore';
import type { LoginCredentials, RegisterData } from '../services/auth.service';

/**
 * Hook for authentication operations
 */
export const useAuth = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshAuth,
    clearError,
  } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshAuth,
    clearError,
  };
};
