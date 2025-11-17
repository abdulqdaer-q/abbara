import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '../store/useOrderStore';
import { User } from './auth.service';

const OFFLINE_ORDERS_KEY = 'offline_orders';
const OFFLINE_USER_PROFILE_KEY = 'offline_user_profile';
const OFFLINE_FAVORITES_KEY = 'offline_favorites';
const OFFLINE_CACHE_PREFIX = 'offline_cache_';

export interface SavedLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
}

/**
 * Service for managing offline data storage and retrieval
 * Provides caching capabilities for critical app data
 */
class OfflineService {
  /**
   * Cache orders for offline access
   */
  async cacheOrders(orders: Order[]): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(orders));
    } catch (error) {
      console.error('Failed to cache orders:', error);
    }
  }

  /**
   * Get cached orders
   */
  async getCachedOrders(): Promise<Order[]> {
    try {
      const cached = await AsyncStorage.getItem(OFFLINE_ORDERS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Failed to get cached orders:', error);
      return [];
    }
  }

  /**
   * Cache user profile for offline access
   */
  async cacheUserProfile(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_USER_PROFILE_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to cache user profile:', error);
    }
  }

  /**
   * Get cached user profile
   */
  async getCachedUserProfile(): Promise<User | null> {
    try {
      const cached = await AsyncStorage.getItem(OFFLINE_USER_PROFILE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Failed to get cached user profile:', error);
      return null;
    }
  }

  /**
   * Save favorite/saved locations
   */
  async saveFavoriteLocations(locations: SavedLocation[]): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_FAVORITES_KEY, JSON.stringify(locations));
    } catch (error) {
      console.error('Failed to save favorite locations:', error);
    }
  }

  /**
   * Get favorite/saved locations
   */
  async getFavoriteLocations(): Promise<SavedLocation[]> {
    try {
      const cached = await AsyncStorage.getItem(OFFLINE_FAVORITES_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Failed to get favorite locations:', error);
      return [];
    }
  }

  /**
   * Add a favorite location
   */
  async addFavoriteLocation(location: Omit<SavedLocation, 'id' | 'createdAt'>): Promise<void> {
    try {
      const favorites = await this.getFavoriteLocations();
      const newLocation: SavedLocation = {
        ...location,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      favorites.push(newLocation);
      await this.saveFavoriteLocations(favorites);
    } catch (error) {
      console.error('Failed to add favorite location:', error);
      throw error;
    }
  }

  /**
   * Remove a favorite location
   */
  async removeFavoriteLocation(id: string): Promise<void> {
    try {
      const favorites = await this.getFavoriteLocations();
      const filtered = favorites.filter((loc) => loc.id !== id);
      await this.saveFavoriteLocations(filtered);
    } catch (error) {
      console.error('Failed to remove favorite location:', error);
      throw error;
    }
  }

  /**
   * Generic cache setter for any data
   */
  async setCacheItem<T>(key: string, data: T): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${OFFLINE_CACHE_PREFIX}${key}`,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error(`Failed to cache item ${key}:`, error);
    }
  }

  /**
   * Generic cache getter for any data
   */
  async getCacheItem<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${OFFLINE_CACHE_PREFIX}${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error(`Failed to get cached item ${key}:`, error);
      return null;
    }
  }

  /**
   * Clear specific cache item
   */
  async clearCacheItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${OFFLINE_CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error(`Failed to clear cache item ${key}:`, error);
    }
  }

  /**
   * Clear all offline data (useful for logout)
   */
  async clearAllOfflineData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(
        (key) =>
          key.startsWith(OFFLINE_CACHE_PREFIX) ||
          key === OFFLINE_ORDERS_KEY ||
          key === OFFLINE_USER_PROFILE_KEY ||
          key === OFFLINE_FAVORITES_KEY
      );
      await AsyncStorage.multiRemove(offlineKeys);
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }

  /**
   * Get storage info (for debugging/monitoring)
   */
  async getStorageInfo(): Promise<{ keys: string[]; size: number }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(
        (key) =>
          key.startsWith(OFFLINE_CACHE_PREFIX) ||
          key === OFFLINE_ORDERS_KEY ||
          key === OFFLINE_USER_PROFILE_KEY ||
          key === OFFLINE_FAVORITES_KEY
      );

      // Estimate size
      let totalSize = 0;
      for (const key of offlineKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }

      return { keys: offlineKeys, size: totalSize };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { keys: [], size: 0 };
    }
  }
}

export const offlineService = new OfflineService();
