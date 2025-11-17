import { PricingEngine } from '../../src/services/pricingEngine';

jest.mock('../../src/lib/logger');
jest.mock('../../src/lib/redis', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
  },
}));

describe('PricingEngine Comprehensive Tests', () => {
  let pricingEngine: PricingEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    pricingEngine = new PricingEngine();
  });

  describe('calculateBasePrice', () => {
    it('should calculate base price for distance', async () => {
      const result = await pricingEngine.calculateBasePrice({
        distanceMeters: 5000, // 5km
        vehicleType: 'VAN',
      });

      expect(result).toHaveProperty('basePriceCents');
      expect(result.basePriceCents).toBeGreaterThan(0);
    });

    it('should apply minimum fare', async () => {
      const result = await pricingEngine.calculateBasePrice({
        distanceMeters: 100, // Very short distance
        vehicleType: 'VAN',
      });

      // Should apply minimum fare
      expect(result.basePriceCents).toBeGreaterThanOrEqual(500); // Minimum fare
    });

    it('should vary by vehicle type', async () => {
      const vanPrice = await pricingEngine.calculateBasePrice({
        distanceMeters: 5000,
        vehicleType: 'VAN',
      });

      const truckPrice = await pricingEngine.calculateBasePrice({
        distanceMeters: 5000,
        vehicleType: 'TRUCK',
      });

      expect(truckPrice.basePriceCents).toBeGreaterThan(vanPrice.basePriceCents);
    });

    it('should calculate price for long distance', async () => {
      const result = await pricingEngine.calculateBasePrice({
        distanceMeters: 50000, // 50km
        vehicleType: 'VAN',
      });

      expect(result.basePriceCents).toBeGreaterThan(5000);
    });
  });

  describe('applyDynamicPricing', () => {
    it('should apply surge pricing during high demand', async () => {
      const basePrice = 1000;

      const result = await pricingEngine.applyDynamicPricing({
        basePriceCents: basePrice,
        location: {
          lat: 40.7128,
          lng: -74.006,
        },
        timeOfDay: new Date('2024-01-01T18:00:00Z'), // Peak hour
        demandLevel: 'high',
      });

      expect(result.finalPriceCents).toBeGreaterThan(basePrice);
      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
    });

    it('should not apply surge during low demand', async () => {
      const basePrice = 1000;

      const result = await pricingEngine.applyDynamicPricing({
        basePriceCents: basePrice,
        location: {
          lat: 40.7128,
          lng: -74.006,
        },
        timeOfDay: new Date('2024-01-01T03:00:00Z'), // Off-peak
        demandLevel: 'low',
      });

      expect(result.finalPriceCents).toBe(basePrice);
      expect(result.surgeMultiplier).toBe(1.0);
    });

    it('should apply time-based multipliers', async () => {
      const peakResult = await pricingEngine.applyDynamicPricing({
        basePriceCents: 1000,
        timeOfDay: new Date('2024-01-01T08:00:00Z'), // Morning rush
      });

      const offPeakResult = await pricingEngine.applyDynamicPricing({
        basePriceCents: 1000,
        timeOfDay: new Date('2024-01-01T14:00:00Z'), // Afternoon
      });

      expect(peakResult.finalPriceCents).toBeGreaterThanOrEqual(offPeakResult.finalPriceCents);
    });
  });

  describe('applyPromoCode', () => {
    it('should apply percentage discount', async () => {
      const result = await pricingEngine.applyPromoCode({
        priceCents: 1000,
        promoCode: 'SAVE20',
        promoType: 'percentage',
        discountValue: 20,
      });

      expect(result.discountedPriceCents).toBe(800);
      expect(result.discountCents).toBe(200);
    });

    it('should apply fixed amount discount', async () => {
      const result = await pricingEngine.applyPromoCode({
        priceCents: 1000,
        promoCode: 'SAVE100',
        promoType: 'fixed',
        discountValue: 100,
      });

      expect(result.discountedPriceCents).toBe(900);
      expect(result.discountCents).toBe(100);
    });

    it('should not apply discount below minimum', async () => {
      const result = await pricingEngine.applyPromoCode({
        priceCents: 500,
        promoCode: 'SAVE90PERCENT',
        promoType: 'percentage',
        discountValue: 90,
        minimumPriceCents: 300,
      });

      expect(result.discountedPriceCents).toBeGreaterThanOrEqual(300);
    });

    it('should cap discount at order value', async () => {
      const result = await pricingEngine.applyPromoCode({
        priceCents: 500,
        promoCode: 'BIG100',
        promoType: 'fixed',
        discountValue: 1000, // More than order value
      });

      expect(result.discountedPriceCents).toBeGreaterThan(0);
      expect(result.discountCents).toBeLessThanOrEqual(500);
    });
  });

  describe('calculateTotalPrice', () => {
    it('should calculate total with all factors', async () => {
      const result = await pricingEngine.calculateTotalPrice({
        distanceMeters: 10000,
        vehicleType: 'VAN',
        location: {
          lat: 40.7128,
          lng: -74.006,
        },
        timeOfDay: new Date(),
        promoCode: 'SAVE10',
      });

      expect(result).toHaveProperty('basePriceCents');
      expect(result).toHaveProperty('surgeMultiplier');
      expect(result).toHaveProperty('discountCents');
      expect(result).toHaveProperty('finalPriceCents');
    });

    it('should provide price breakdown', async () => {
      const result = await pricingEngine.calculateTotalPrice({
        distanceMeters: 5000,
        vehicleType: 'VAN',
      });

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown).toHaveProperty('baseFare');
      expect(result.breakdown).toHaveProperty('distanceFare');
      expect(result.breakdown).toHaveProperty('timeFare');
    });
  });

  describe('estimatePrice', () => {
    it('should provide price estimate with range', async () => {
      const result = await pricingEngine.estimatePrice({
        pickupLocation: {
          lat: 40.7128,
          lng: -74.006,
        },
        dropoffLocation: {
          lat: 40.7589,
          lng: -73.9851,
        },
        vehicleType: 'VAN',
      });

      expect(result).toHaveProperty('estimatedPriceCents');
      expect(result).toHaveProperty('minPriceCents');
      expect(result).toHaveProperty('maxPriceCents');
      expect(result.maxPriceCents).toBeGreaterThan(result.minPriceCents);
    });

    it('should include surge estimate', async () => {
      const result = await pricingEngine.estimatePrice({
        pickupLocation: {
          lat: 40.7128,
          lng: -74.006,
        },
        dropoffLocation: {
          lat: 40.7589,
          lng: -73.9851,
        },
        vehicleType: 'VAN',
        estimatedTimeOfService: new Date('2024-01-01T18:00:00Z'), // Peak time
      });

      expect(result).toHaveProperty('surgeEstimate');
    });
  });

  describe('price caching', () => {
    it('should cache pricing calculations', async () => {
      const { redis } = require('../../src/lib/redis');

      redis.get.mockResolvedValue(null);

      await pricingEngine.calculateBasePrice({
        distanceMeters: 5000,
        vehicleType: 'VAN',
      });

      expect(redis.setex).toHaveBeenCalled();
    });

    it('should return cached price when available', async () => {
      const { redis } = require('../../src/lib/redis');

      const cachedPrice = {
        basePriceCents: 1000,
        breakdown: {},
      };

      redis.get.mockResolvedValue(JSON.stringify(cachedPrice));

      const result = await pricingEngine.calculateBasePrice({
        distanceMeters: 5000,
        vehicleType: 'VAN',
      });

      expect(result.basePriceCents).toBe(1000);
    });
  });

  describe('edge cases', () => {
    it('should handle zero distance', async () => {
      const result = await pricingEngine.calculateBasePrice({
        distanceMeters: 0,
        vehicleType: 'VAN',
      });

      expect(result.basePriceCents).toBeGreaterThan(0); // Minimum fare
    });

    it('should handle negative prices gracefully', async () => {
      await expect(
        pricingEngine.calculateBasePrice({
          distanceMeters: -1000,
          vehicleType: 'VAN',
        })
      ).rejects.toThrow();
    });

    it('should handle unknown vehicle type', async () => {
      await expect(
        pricingEngine.calculateBasePrice({
          distanceMeters: 5000,
          vehicleType: 'UNKNOWN',
        })
      ).rejects.toThrow();
    });

    it('should handle extreme distances', async () => {
      const result = await pricingEngine.calculateBasePrice({
        distanceMeters: 1000000, // 1000km
        vehicleType: 'VAN',
      });

      expect(result.basePriceCents).toBeGreaterThan(0);
      expect(result.basePriceCents).toBeLessThan(Number.MAX_SAFE_INTEGER);
    });
  });
});
