import * as Location from 'expo-location';
import type { Location as LocationType } from '../store/useOrderStore';

class LocationService {
  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        console.warn('Location permission not granted');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  /**
   * Request background location permissions (for tracking)
   */
  async requestBackgroundPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();

      if (status !== 'granted') {
        console.warn('Background location permission not granted');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting background location permissions:', error);
      return false;
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Watch location changes
   */
  async watchLocation(
    callback: (location: { lat: number; lng: number }) => void
  ): Promise<Location.LocationSubscription | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      return await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          callback({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        }
      );
    } catch (error) {
      console.error('Error watching location:', error);
      return null;
    }
  }

  /**
   * Reverse geocode (get address from coordinates)
   */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });

      if (result.length === 0) {
        return null;
      }

      const address = result[0];
      const parts = [
        address.name,
        address.street,
        address.city,
        address.region,
        address.postalCode,
        address.country,
      ].filter(Boolean);

      return parts.join(', ');
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  }

  /**
   * Forward geocode (get coordinates from address)
   */
  async forwardGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const result = await Location.geocodeAsync(address);

      if (result.length === 0) {
        return null;
      }

      return {
        lat: result[0].latitude,
        lng: result[0].longitude,
      };
    } catch (error) {
      console.error('Error forward geocoding:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two points (in meters)
   */
  calculateDistance(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (from.lat * Math.PI) / 180;
    const φ2 = (to.lat * Math.PI) / 180;
    const Δφ = ((to.lat - from.lat) * Math.PI) / 180;
    const Δλ = ((to.lng - from.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Format distance for display
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }
}

export const locationService = new LocationService();
