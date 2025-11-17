import { appRouter } from '../../src/routers';
import { Context } from '../../src/context';

jest.mock('../../src/lib/logger');
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    promoCode: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    vehicleType: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback || Promise.resolve([])),
  },
}));

describe('Admin Management Router Tests', () => {
  let mockContext: Partial<Context>;
  let caller: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      user: {
        id: 'admin-1',
        role: 'ADMIN',
      },
      correlationId: 'test-correlation-id',
    } as any;

    caller = appRouter.createCaller(mockContext as Context);
  });

  describe('users router', () => {
    it('should list users with filters', async () => {
      const { prisma } = require('../../src/lib/prisma');

      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'test@example.com',
          role: 'CUSTOMER',
          createdAt: new Date(),
        },
      ]);
      prisma.user.count.mockResolvedValue(1);

      const result = await caller.users.list({
        role: 'CUSTOMER',
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('total');
    });

    it('should get single user by ID', async () => {
      const { prisma } = require('../../src/lib/prisma');

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await caller.users.getById({ userId: 'user-1' });

      expect(result).toEqual(mockUser);
    });

    it('should update user details', async () => {
      const { prisma } = require('../../src/lib/prisma');

      const updatedUser = {
        id: 'user-1',
        displayName: 'Updated Name',
        role: 'PORTER',
      };

      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await caller.users.update({
        userId: 'user-1',
        displayName: 'Updated Name',
        role: 'PORTER',
      });

      expect(result.displayName).toBe('Updated Name');
    });
  });

  describe('analytics router', () => {
    it('should get order statistics', async () => {
      const { prisma } = require('../../src/lib/prisma');

      prisma.order.count.mockResolvedValue(100);
      prisma.order.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: 50 },
        { status: 'PENDING', _count: 30 },
        { status: 'CANCELLED', _count: 20 },
      ]);
      prisma.order.aggregate.mockResolvedValue({
        _sum: { priceCents: 1000000 },
      });

      const result = await caller.analytics.orderStats({});

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('byStatus');
      expect(result).toHaveProperty('revenue');
    });

    it('should filter analytics by date range', async () => {
      const { prisma } = require('../../src/lib/prisma');

      prisma.order.count.mockResolvedValue(50);
      prisma.order.groupBy.mockResolvedValue([]);
      prisma.order.aggregate.mockResolvedValue({
        _sum: { priceCents: 500000 },
      });

      await caller.analytics.orderStats({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(prisma.order.count).toHaveBeenCalled();
    });
  });

  describe('promoCodes router', () => {
    it('should create promo code', async () => {
      const { prisma } = require('../../src/lib/prisma');

      const mockPromo = {
        id: 'promo-1',
        code: 'SAVE20',
        discountPercentage: 20,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      };

      prisma.promoCode.create.mockResolvedValue(mockPromo);

      const result = await caller.promoCodes.create({
        code: 'SAVE20',
        discountPercentage: 20,
        expiresAt: new Date(Date.now() + 86400000),
      });

      expect(result.code).toBe('SAVE20');
      expect(result.discountPercentage).toBe(20);
    });

    it('should list promo codes', async () => {
      const { prisma } = require('../../src/lib/prisma');

      const mockPromos = [
        { id: 'promo-1', code: 'SAVE20', isActive: true },
        { id: 'promo-2', code: 'SAVE10', isActive: true },
      ];

      prisma.promoCode.findMany.mockResolvedValue(mockPromos);

      const result = await caller.promoCodes.list({});

      expect(result).toHaveLength(2);
    });

    it('should deactivate promo code', async () => {
      const { prisma } = require('../../src/lib/prisma');

      const deactivatedPromo = {
        id: 'promo-1',
        code: 'SAVE20',
        isActive: false,
      };

      prisma.promoCode.update.mockResolvedValue(deactivatedPromo);

      const result = await caller.promoCodes.deactivate({
        promoCodeId: 'promo-1',
      });

      expect(result.isActive).toBe(false);
    });
  });

  describe('vehicleTypes router', () => {
    it('should list vehicle types', async () => {
      const { prisma } = require('../../src/lib/prisma');

      const mockVehicles = [
        {
          id: 'vehicle-1',
          name: 'Van',
          basePriceCents: 5000,
          isActive: true,
        },
        {
          id: 'vehicle-2',
          name: 'Truck',
          basePriceCents: 8000,
          isActive: true,
        },
      ];

      prisma.vehicleType.findMany.mockResolvedValue(mockVehicles);

      const result = await caller.vehicleTypes.list();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Van');
    });

    it('should create vehicle type', async () => {
      const { prisma } = require('../../src/lib/prisma');

      const mockVehicle = {
        id: 'vehicle-1',
        name: 'Motorcycle',
        basePriceCents: 3000,
        maxWeightKg: 50,
        isActive: true,
      };

      prisma.vehicleType.create.mockResolvedValue(mockVehicle);

      const result = await caller.vehicleTypes.create({
        name: 'Motorcycle',
        basePriceCents: 3000,
        maxWeightKg: 50,
      });

      expect(result.name).toBe('Motorcycle');
      expect(result.basePriceCents).toBe(3000);
    });

    it('should update vehicle type', async () => {
      const { prisma } = require('../../src/lib/prisma');

      const updatedVehicle = {
        id: 'vehicle-1',
        name: 'Van',
        basePriceCents: 6000,
        isActive: true,
      };

      prisma.vehicleType.update.mockResolvedValue(updatedVehicle);

      const result = await caller.vehicleTypes.update({
        vehicleTypeId: 'vehicle-1',
        basePriceCents: 6000,
      });

      expect(result.basePriceCents).toBe(6000);
    });
  });
});
