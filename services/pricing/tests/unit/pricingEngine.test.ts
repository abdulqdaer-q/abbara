import { PricingEngine } from '../../src/services/pricingEngine';
import { prisma } from '../../src/lib/db';
import { PricingEstimateInput } from '@movenow/common';

// Mock Prisma
jest.mock('../../src/lib/db', () => ({
  prisma: {
    pricingRule: {
      findMany: jest.fn(),
    },
  },
}));

describe('PricingEngine', () => {
  let pricingEngine: PricingEngine;

  beforeEach(() => {
    pricingEngine = new PricingEngine();
    jest.clearAllMocks();
  });

  describe('calculateEstimate', () => {
    it('should calculate basic fare with base fare rule', async () => {
      // Mock pricing rules
      const mockRules = [
        {
          id: 'rule1',
          version: 1,
          name: 'Base Fare',
          ruleType: 'BASE_FARE',
          enabled: true,
          status: 'ACTIVE',
          priority: 0,
          config: { amountCents: 500 },
          vehicleTypes: ['SEDAN'],
          customerTypes: ['CONSUMER'],
          effectiveFrom: new Date('2020-01-01'),
          effectiveTo: null,
          timeWindows: [],
          geoZones: [],
          createdBy: 'system',
          lastModifiedBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          previousVersionId: null,
          minOrderValue: null,
          maxOrderValue: null,
          description: null,
        },
      ];

      (prisma.pricingRule.findMany as jest.Mock).mockResolvedValue(mockRules);

      const input: PricingEstimateInput = {
        pickup: { lat: 40.7128, lng: -74.006, address: '123 Main St' },
        dropoff: { lat: 40.7589, lng: -73.9851, address: '456 Park Ave' },
        vehicleType: 'sedan',
        porterCount: 0,
      };

      const result = await pricingEngine.calculateEstimate(
        input,
        5000, // 5 km
        600, // 10 minutes
        'test-correlation-id'
      );

      expect(result.baseFareCents).toBe(500);
      expect(result.totalCents).toBeGreaterThanOrEqual(500);
      expect(result.rulesApplied).toHaveLength(1);
      expect(result.rulesApplied[0].ruleId).toBe('rule1');
    });

    it('should apply per-km pricing', async () => {
      const mockRules = [
        {
          id: 'rule1',
          version: 1,
          name: 'Base Fare',
          ruleType: 'BASE_FARE',
          enabled: true,
          status: 'ACTIVE',
          priority: 0,
          config: { amountCents: 500 },
          vehicleTypes: ['SEDAN'],
          customerTypes: ['CONSUMER'],
          effectiveFrom: new Date('2020-01-01'),
          effectiveTo: null,
          timeWindows: [],
          geoZones: [],
          createdBy: 'system',
          lastModifiedBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          previousVersionId: null,
          minOrderValue: null,
          maxOrderValue: null,
          description: null,
        },
        {
          id: 'rule2',
          version: 1,
          name: 'Per KM',
          ruleType: 'PER_KM',
          enabled: true,
          status: 'ACTIVE',
          priority: 0,
          config: { ratePerKm: 100 }, // $1 per km
          vehicleTypes: ['SEDAN'],
          customerTypes: ['CONSUMER'],
          effectiveFrom: new Date('2020-01-01'),
          effectiveTo: null,
          timeWindows: [],
          geoZones: [],
          createdBy: 'system',
          lastModifiedBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          previousVersionId: null,
          minOrderValue: null,
          maxOrderValue: null,
          description: null,
        },
      ];

      (prisma.pricingRule.findMany as jest.Mock).mockResolvedValue(mockRules);

      const input: PricingEstimateInput = {
        pickup: { lat: 40.7128, lng: -74.006, address: '123 Main St' },
        dropoff: { lat: 40.7589, lng: -73.9851, address: '456 Park Ave' },
        vehicleType: 'sedan',
        porterCount: 0,
      };

      const result = await pricingEngine.calculateEstimate(
        input,
        10000, // 10 km
        600,
        'test-correlation-id'
      );

      expect(result.baseFareCents).toBe(500);
      expect(result.distanceFareCents).toBe(1000); // 10 km * 100 cents
      expect(result.rulesApplied).toHaveLength(2);
    });

    it('should apply porter fees', async () => {
      const mockRules = [
        {
          id: 'rule1',
          version: 1,
          name: 'Base Fare',
          ruleType: 'BASE_FARE',
          enabled: true,
          status: 'ACTIVE',
          priority: 0,
          config: { amountCents: 500 },
          vehicleTypes: ['SEDAN'],
          customerTypes: ['CONSUMER'],
          effectiveFrom: new Date('2020-01-01'),
          effectiveTo: null,
          timeWindows: [],
          geoZones: [],
          createdBy: 'system',
          lastModifiedBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          previousVersionId: null,
          minOrderValue: null,
          maxOrderValue: null,
          description: null,
        },
        {
          id: 'rule2',
          version: 1,
          name: 'Porter Fee',
          ruleType: 'PORTER_FEE',
          enabled: true,
          status: 'ACTIVE',
          priority: 0,
          config: { perPorter: 800 }, // $8 per porter
          vehicleTypes: ['SEDAN'],
          customerTypes: ['CONSUMER'],
          effectiveFrom: new Date('2020-01-01'),
          effectiveTo: null,
          timeWindows: [],
          geoZones: [],
          createdBy: 'system',
          lastModifiedBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          previousVersionId: null,
          minOrderValue: null,
          maxOrderValue: null,
          description: null,
        },
      ];

      (prisma.pricingRule.findMany as jest.Mock).mockResolvedValue(mockRules);

      const input: PricingEstimateInput = {
        pickup: { lat: 40.7128, lng: -74.006, address: '123 Main St' },
        dropoff: { lat: 40.7589, lng: -73.9851, address: '456 Park Ave' },
        vehicleType: 'sedan',
        porterCount: 2,
      };

      const result = await pricingEngine.calculateEstimate(
        input,
        5000,
        600,
        'test-correlation-id'
      );

      expect(result.porterFeesCents).toBe(1600); // 2 porters * 800 cents
      expect(result.rulesApplied).toHaveLength(2);
    });

    it('should apply minimum fare', async () => {
      const mockRules = [
        {
          id: 'rule1',
          version: 1,
          name: 'Base Fare',
          ruleType: 'BASE_FARE',
          enabled: true,
          status: 'ACTIVE',
          priority: 0,
          config: { amountCents: 200 },
          vehicleTypes: ['SEDAN'],
          customerTypes: ['CONSUMER'],
          effectiveFrom: new Date('2020-01-01'),
          effectiveTo: null,
          timeWindows: [],
          geoZones: [],
          createdBy: 'system',
          lastModifiedBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          previousVersionId: null,
          minOrderValue: null,
          maxOrderValue: null,
          description: null,
        },
        {
          id: 'rule2',
          version: 1,
          name: 'Minimum Fare',
          ruleType: 'MINIMUM_FARE',
          enabled: true,
          status: 'ACTIVE',
          priority: 0,
          config: { minimumCents: 500 },
          vehicleTypes: ['SEDAN'],
          customerTypes: ['CONSUMER'],
          effectiveFrom: new Date('2020-01-01'),
          effectiveTo: null,
          timeWindows: [],
          geoZones: [],
          createdBy: 'system',
          lastModifiedBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          previousVersionId: null,
          minOrderValue: null,
          maxOrderValue: null,
          description: null,
        },
      ];

      (prisma.pricingRule.findMany as jest.Mock).mockResolvedValue(mockRules);

      const input: PricingEstimateInput = {
        pickup: { lat: 40.7128, lng: -74.006, address: '123 Main St' },
        dropoff: { lat: 40.7589, lng: -73.9851, address: '456 Park Ave' },
        vehicleType: 'sedan',
        porterCount: 0,
      };

      const result = await pricingEngine.calculateEstimate(
        input,
        1000, // 1 km - very short trip
        120,
        'test-correlation-id'
      );

      // Should enforce minimum fare
      expect(result.subtotalCents).toBeGreaterThanOrEqual(500);
      expect(result.breakdown.some(item => item.type === 'MINIMUM_FARE_ADJUSTMENT')).toBe(true);
    });
  });
});
