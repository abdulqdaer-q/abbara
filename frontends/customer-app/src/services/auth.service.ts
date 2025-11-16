import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { vanillaTrpcClient } from './trpc';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  role: 'CUSTOMER' | 'PORTER' | 'ADMIN';
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  emailOrPhone: string;
  password: string;
}

export interface RegisterData {
  email?: string;
  phone?: string;
  password: string;
  displayName: string;
}

class AuthService {
  /**
   * Store tokens securely
   */
  async storeTokens(tokens: AuthTokens): Promise<void> {
    try {
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Get refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to get refresh token:', error);
      return null;
    }
  }

  /**
   * Store user data
   */
  async storeUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to store user:', error);
      throw new Error('Failed to store user data');
    }
  }

  /**
   * Get stored user data
   */
  async getUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }

  /**
   * Clear all stored auth data
   */
  async clearAuth(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to clear auth:', error);
    }
  }

  /**
   * Login with email or phone
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response = await vanillaTrpcClient.auth.login.mutate({
        emailOrPhone: credentials.emailOrPhone,
        password: credentials.password,
      });

      const user: User = {
        id: response.user.id,
        email: response.user.email || undefined,
        phone: response.user.phone || undefined,
        displayName: response.user.displayName,
        avatarUrl: response.user.avatarUrl || undefined,
        role: response.user.role as 'CUSTOMER' | 'PORTER' | 'ADMIN',
        emailVerified: response.user.emailVerified,
        phoneVerified: response.user.phoneVerified,
      };

      const tokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };

      await this.storeTokens(tokens);
      await this.storeUser(user);

      return { user, tokens };
    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error?.message || 'Login failed. Please check your credentials.');
    }
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response = await vanillaTrpcClient.auth.register.mutate({
        email: data.email,
        phone: data.phone,
        password: data.password,
        displayName: data.displayName,
        role: 'CUSTOMER', // Always register as customer in customer app
      });

      const user: User = {
        id: response.user.id,
        email: response.user.email || undefined,
        phone: response.user.phone || undefined,
        displayName: response.user.displayName,
        avatarUrl: response.user.avatarUrl || undefined,
        role: response.user.role as 'CUSTOMER' | 'PORTER' | 'ADMIN',
        emailVerified: response.user.emailVerified,
        phoneVerified: response.user.phoneVerified,
      };

      const tokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };

      await this.storeTokens(tokens);
      await this.storeUser(user);

      return { user, tokens };
    } catch (error: any) {
      console.error('Registration failed:', error);
      throw new Error(error?.message || 'Registration failed. Please try again.');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<string> {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await vanillaTrpcClient.auth.refresh.mutate({
        refreshToken,
      });

      await this.storeTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      return response.accessToken;
    } catch (error: any) {
      console.error('Token refresh failed:', error);
      await this.clearAuth();
      throw new Error('Session expired. Please login again.');
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = await this.getRefreshToken();
      if (refreshToken) {
        await vanillaTrpcClient.auth.logout.mutate({ refreshToken });
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      await this.clearAuth();
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(emailOrPhone: string): Promise<void> {
    try {
      await vanillaTrpcClient.auth.requestPasswordReset.mutate({
        emailOrPhone,
      });
    } catch (error: any) {
      console.error('Password reset request failed:', error);
      throw new Error(error?.message || 'Failed to request password reset.');
    }
  }

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    try {
      await vanillaTrpcClient.auth.confirmPasswordReset.mutate({
        token,
        newPassword,
      });
    } catch (error: any) {
      console.error('Password reset confirmation failed:', error);
      throw new Error(error?.message || 'Failed to reset password.');
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    const user = await this.getUser();
    return !!(accessToken && user);
  }
}

export const authService = new AuthService();
