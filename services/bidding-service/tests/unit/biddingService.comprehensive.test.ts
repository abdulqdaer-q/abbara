import { BiddingService } from '../../src/services/biddingService';
import { TRPCError } from '@trpc/server';

// Mock dependencies
jest.mock('../../src/lib/db', () => ({
  getPrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('../../src/lib/redis', () => ({
  getRedisClient: jest.fn(() => mockRedis),
  getRedisLock: jest.fn(() => mockRedisLock),
}));

jest.mock('../../src/lib/kafka', () => ({
  publishEvent: jest.fn(),
}));

jest.mock('../../src/lib/logger');
jest.mock('../../src/lib/metrics', () => ({
  biddingWindowsTotal: { inc: jest.fn() },
  activeBiddingWindows: { inc: jest.fn(), dec: jest.fn() },
  bidsTotal: { inc: jest.fn() },
  bidAcceptanceDuration: { startTimer: jest.fn(() => jest.fn()) },
  timeToFirstBid: { observe: jest.fn() },
  lockAcquisitionAttempts: { inc: jest.fn() },
}));

jest.mock('../../src/middleware/auth', () => ({
  validatePorterEligibility: jest.fn(() => ({ eligible: true })),
}));

jest.mock('../../src/services/strategyEngine', () => ({
  strategyEngine: {
    evaluateBids: jest.fn(() => [{ bidId: 'bid-1', score: 100 }]),
  },
}));

const mockPrisma: any = {
  biddingWindow: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  bidStrategy: {
    findUnique: jest.fn(),
  },
  bid: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  bidAuditEvent: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

const mockRedis: any = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

const mockRedisLock: any = {
  withLock: jest.fn((key, ttl, callback) => callback()),
};

describe('BiddingService - Comprehensive Tests', () => {
  let biddingService: BiddingService;

  beforeEach(() => {
    jest.clearAllMocks();
    biddingService = new BiddingService();
  });

  describe('openBiddingWindow', () => {
    it('should open a new bidding window successfully', async () => {
      const mockStrategy = {
        id: 'strategy-1',
        name: 'Default Strategy',
        isActive: true,
      };

      const mockWindow = {
        id: 'window-1',
        orderIds: ['order-1', 'order-2'],
        status: 'OPEN',
        strategyId: 'strategy-1',
        configuration: {
          minimumBidCents: 1000,
          maxBidsPerPorter: 3,
        },
        openAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
        createdBy: 'customer-1',
        correlationId: 'corr-1',
      };

      mockPrisma.bidStrategy.findUnique.mockResolvedValue(mockStrategy);
      mockPrisma.biddingWindow.create.mockResolvedValue(mockWindow);

      const result = await biddingService.openBiddingWindow({
        orderIds: ['order-1', 'order-2'],
        biddingWindowDurationSec: 600,
        strategyId: 'strategy-1',
        minimumBidCents: 1000,
        createdBy: 'customer-1',
        correlationId: 'corr-1',
      });

      expect(result).toEqual(mockWindow);
      expect(mockPrisma.bidStrategy.findUnique).toHaveBeenCalledWith({
        where: { id: 'strategy-1' },
      });
      expect(mockPrisma.biddingWindow.create).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should reject inactive strategy', async () => {
      const inactiveStrategy = {
        id: 'strategy-1',
        name: 'Inactive Strategy',
        isActive: false,
      };

      mockPrisma.bidStrategy.findUnique.mockResolvedValue(inactiveStrategy);

      await expect(
        biddingService.openBiddingWindow({
          orderIds: ['order-1'],
          strategyId: 'strategy-1',
          createdBy: 'customer-1',
          correlationId: 'corr-1',
        })
      ).rejects.toThrow('Invalid or inactive strategy');
    });

    it('should reject non-existent strategy', async () => {
      mockPrisma.bidStrategy.findUnique.mockResolvedValue(null);

      await expect(
        biddingService.openBiddingWindow({
          orderIds: ['order-1'],
          strategyId: 'nonexistent',
          createdBy: 'customer-1',
          correlationId: 'corr-1',
        })
      ).rejects.toThrow('Invalid or inactive strategy');
    });

    it('should apply custom configuration', async () => {
      const mockStrategy = {
        id: 'strategy-1',
        isActive: true,
      };

      mockPrisma.bidStrategy.findUnique.mockResolvedValue(mockStrategy);
      mockPrisma.biddingWindow.create.mockResolvedValue({ id: 'window-1' });

      await biddingService.openBiddingWindow({
        orderIds: ['order-1'],
        strategyId: 'strategy-1',
        minimumBidCents: 5000,
        reservePriceCents: 10000,
        allowedPorterFilters: { minRating: 4.5 },
        createdBy: 'customer-1',
        correlationId: 'corr-1',
      });

      expect(mockPrisma.biddingWindow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          configuration: expect.objectContaining({
            minimumBidCents: 5000,
            reservePriceCents: 10000,
            allowedPorterFilters: { minRating: 4.5 },
          }),
        }),
      });
    });
  });

  describe('placeBid', () => {
    const mockWindow = {
      id: 'window-1',
      orderIds: ['order-1'],
      status: 'OPEN',
      strategyId: 'strategy-1',
      configuration: {
        minimumBidCents: 1000,
        maxBidsPerPorter: 3,
      },
      openAt: new Date(Date.now() - 300000),
      expiresAt: new Date(Date.now() + 300000),
    };

    beforeEach(() => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockWindow));
      mockPrisma.biddingWindow.findUnique.mockResolvedValue(mockWindow);
      mockPrisma.bid.count.mockResolvedValue(0);
    });

    it('should place a bid successfully', async () => {
      const mockBid = {
        id: 'bid-1',
        biddingWindowId: 'window-1',
        porterId: 'porter-1',
        amountCents: 2000,
        estimatedArrivalMinutes: 15,
        status: 'PLACED',
        placedAt: new Date(),
        idempotencyKey: 'idem-1',
      };

      mockPrisma.bid.findUnique.mockResolvedValue(null); // No existing bid
      mockPrisma.bid.create.mockResolvedValue(mockBid);
      mockPrisma.bid.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      const result = await biddingService.placeBid({
        biddingWindowId: 'window-1',
        porterId: 'porter-1',
        amountCents: 2000,
        estimatedArrivalMinutes: 15,
        idempotencyKey: 'idem-1',
        correlationId: 'corr-1',
      });

      expect(result.bid).toEqual(mockBid);
      expect(mockPrisma.bid.create).toHaveBeenCalled();
    });

    it('should handle idempotent requests', async () => {
      const existingBid = {
        id: 'bid-1',
        biddingWindowId: 'window-1',
        porterId: 'porter-1',
        amountCents: 2000,
        idempotencyKey: 'idem-1',
      };

      mockPrisma.bid.findUnique.mockResolvedValue(existingBid);

      const result = await biddingService.placeBid({
        biddingWindowId: 'window-1',
        porterId: 'porter-1',
        amountCents: 2000,
        estimatedArrivalMinutes: 15,
        idempotencyKey: 'idem-1',
        correlationId: 'corr-1',
      });

      expect(result.bid).toEqual(existingBid);
      expect(mockPrisma.bid.create).not.toHaveBeenCalled();
    });

    it('should reject bid below minimum amount', async () => {
      mockPrisma.bid.findUnique.mockResolvedValue(null);

      await expect(
        biddingService.placeBid({
          biddingWindowId: 'window-1',
          porterId: 'porter-1',
          amountCents: 500, // Below minimum of 1000
          estimatedArrivalMinutes: 15,
          idempotencyKey: 'idem-1',
          correlationId: 'corr-1',
        })
      ).rejects.toThrow('Bid amount must be at least');
    });

    it('should reject bid on closed window', async () => {
      const closedWindow = { ...mockWindow, status: 'CLOSED' };
      mockRedis.get.mockResolvedValue(JSON.stringify(closedWindow));
      mockPrisma.biddingWindow.findUnique.mockResolvedValue(closedWindow);
      mockPrisma.bid.findUnique.mockResolvedValue(null);

      await expect(
        biddingService.placeBid({
          biddingWindowId: 'window-1',
          porterId: 'porter-1',
          amountCents: 2000,
          estimatedArrivalMinutes: 15,
          idempotencyKey: 'idem-1',
          correlationId: 'corr-1',
        })
      ).rejects.toThrow('Bidding window is CLOSED');
    });

    it('should reject bid on expired window', async () => {
      const expiredWindow = {
        ...mockWindow,
        expiresAt: new Date(Date.now() - 10000), // Expired
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(expiredWindow));
      mockPrisma.biddingWindow.findUnique.mockResolvedValue(expiredWindow);
      mockPrisma.bid.findUnique.mockResolvedValue(null);

      await expect(
        biddingService.placeBid({
          biddingWindowId: 'window-1',
          porterId: 'porter-1',
          amountCents: 2000,
          estimatedArrivalMinutes: 15,
          idempotencyKey: 'idem-1',
          correlationId: 'corr-1',
        })
      ).rejects.toThrow('Bidding window has expired');
    });

    it('should reject bid when max bids per porter exceeded', async () => {
      mockPrisma.bid.findUnique.mockResolvedValue(null);
      mockPrisma.bid.count.mockResolvedValue(3); // Already at max

      await expect(
        biddingService.placeBid({
          biddingWindowId: 'window-1',
          porterId: 'porter-1',
          amountCents: 2000,
          estimatedArrivalMinutes: 15,
          idempotencyKey: 'idem-1',
          correlationId: 'corr-1',
        })
      ).rejects.toThrow('Maximum bids per porter exceeded');
    });

    it('should reject ineligible porter', async () => {
      const { validatePorterEligibility } = require('../../src/middleware/auth');
      validatePorterEligibility.mockResolvedValue({
        eligible: false,
        reason: 'Rating too low',
      });

      mockPrisma.bid.findUnique.mockResolvedValue(null);

      await expect(
        biddingService.placeBid({
          biddingWindowId: 'window-1',
          porterId: 'porter-1',
          amountCents: 2000,
          estimatedArrivalMinutes: 15,
          idempotencyKey: 'idem-1',
          correlationId: 'corr-1',
        })
      ).rejects.toThrow('Rating too low');
    });
  });

  describe('acceptBid', () => {
    it('should accept bid with distributed lock', async () => {
      const mockWindow = {
        id: 'window-1',
        orderIds: ['order-1'],
        status: 'OPEN',
      };

      const mockBid = {
        id: 'bid-1',
        biddingWindowId: 'window-1',
        porterId: 'porter-1',
        amountCents: 2000,
        status: 'PLACED',
      };

      const acceptedBid = { ...mockBid, status: 'ACCEPTED', acceptedAt: new Date() };
      const closedWindow = { ...mockWindow, status: 'CLOSED', closedAt: new Date() };

      mockRedisLock.withLock.mockImplementation((key, ttl, callback) => callback());

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx: any = {
          biddingWindow: {
            findUnique: jest.fn().mockResolvedValue(mockWindow),
            update: jest.fn().mockResolvedValue(closedWindow),
          },
          bid: {
            findUnique: jest.fn().mockResolvedValue(mockBid),
            update: jest.fn().mockResolvedValue(acceptedBid),
            updateMany: jest.fn(),
          },
          bidAuditEvent: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await biddingService.acceptBid({
        biddingWindowId: 'window-1',
        bidId: 'bid-1',
        acceptedBy: 'customer-1',
        correlationId: 'corr-1',
      });

      expect(result.bid.status).toBe('ACCEPTED');
      expect(result.window.status).toBe('CLOSED');
      expect(mockRedisLock.withLock).toHaveBeenCalled();
    });

    it('should reject accepting already accepted bid', async () => {
      const mockWindow = {
        id: 'window-1',
        status: 'OPEN',
      };

      const acceptedBid = {
        id: 'bid-1',
        biddingWindowId: 'window-1',
        status: 'ACCEPTED',
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx: any = {
          biddingWindow: {
            findUnique: jest.fn().mockResolvedValue(mockWindow),
          },
          bid: {
            findUnique: jest.fn().mockResolvedValue(acceptedBid),
          },
        };
        return callback(tx);
      });

      await expect(
        biddingService.acceptBid({
          biddingWindowId: 'window-1',
          bidId: 'bid-1',
          acceptedBy: 'customer-1',
          correlationId: 'corr-1',
        })
      ).rejects.toThrow('Bid is already ACCEPTED');
    });

    it('should expire other bids when accepting one', async () => {
      const mockWindow = { id: 'window-1', status: 'OPEN', orderIds: ['order-1'] };
      const mockBid = {
        id: 'bid-1',
        biddingWindowId: 'window-1',
        porterId: 'porter-1',
        amountCents: 2000,
        status: 'PLACED',
      };

      const updateManyMock = jest.fn();

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx: any = {
          biddingWindow: {
            findUnique: jest.fn().mockResolvedValue(mockWindow),
            update: jest.fn().mockResolvedValue({ ...mockWindow, status: 'CLOSED' }),
          },
          bid: {
            findUnique: jest.fn().mockResolvedValue(mockBid),
            update: jest.fn().mockResolvedValue({ ...mockBid, status: 'ACCEPTED' }),
            updateMany: updateManyMock,
          },
          bidAuditEvent: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      await biddingService.acceptBid({
        biddingWindowId: 'window-1',
        bidId: 'bid-1',
        acceptedBy: 'customer-1',
        correlationId: 'corr-1',
      });

      expect(updateManyMock).toHaveBeenCalledWith({
        where: {
          biddingWindowId: 'window-1',
          id: { not: 'bid-1' },
          status: 'PLACED',
        },
        data: expect.objectContaining({
          status: 'EXPIRED',
        }),
      });
    });
  });

  describe('cancelBid', () => {
    it('should cancel a placed bid', async () => {
      const placedBid = {
        id: 'bid-1',
        biddingWindowId: 'window-1',
        porterId: 'porter-1',
        status: 'PLACED',
      };

      const cancelledBid = {
        ...placedBid,
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Porter unavailable',
      };

      mockPrisma.bid.findUnique.mockResolvedValue(placedBid);
      mockPrisma.bid.update.mockResolvedValue(cancelledBid);
      mockPrisma.bidAuditEvent.create.mockResolvedValue({});

      const result = await biddingService.cancelBid({
        bidId: 'bid-1',
        reason: 'Porter unavailable',
        correlationId: 'corr-1',
      });

      expect(result.status).toBe('CANCELLED');
      expect(result.cancelReason).toBe('Porter unavailable');
    });

    it('should reject cancelling non-placed bid', async () => {
      const acceptedBid = {
        id: 'bid-1',
        status: 'ACCEPTED',
      };

      mockPrisma.bid.findUnique.mockResolvedValue(acceptedBid);

      await expect(
        biddingService.cancelBid({
          bidId: 'bid-1',
          reason: 'Test',
          correlationId: 'corr-1',
        })
      ).rejects.toThrow('Cannot cancel bid with status ACCEPTED');
    });

    it('should reject cancelling non-existent bid', async () => {
      mockPrisma.bid.findUnique.mockResolvedValue(null);

      await expect(
        biddingService.cancelBid({
          bidId: 'nonexistent',
          reason: 'Test',
          correlationId: 'corr-1',
        })
      ).rejects.toThrow('Bid not found');
    });
  });

  describe('closeBiddingWindow', () => {
    it('should close open bidding window', async () => {
      const mockWindow = {
        id: 'window-1',
        orderIds: ['order-1'],
        status: 'OPEN',
      };

      const mockBids = [
        { id: 'bid-1', status: 'PLACED' },
        { id: 'bid-2', status: 'PLACED' },
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(mockWindow));
      mockPrisma.biddingWindow.findUnique.mockResolvedValue(mockWindow);
      mockPrisma.bid.findMany.mockResolvedValue(mockBids);

      mockPrisma.$transaction.mockResolvedValue([
        { ...mockWindow, status: 'CLOSED', closedAt: new Date() },
        { count: 2 },
      ]);

      const result = await biddingService.closeBiddingWindow({
        biddingWindowId: 'window-1',
        actor: 'admin-1',
        correlationId: 'corr-1',
      });

      expect(result.window.status).toBe('CLOSED');
      expect(result.summary.totalBids).toBe(2);
    });

    it('should reject closing already closed window', async () => {
      const closedWindow = {
        id: 'window-1',
        status: 'CLOSED',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(closedWindow));
      mockPrisma.biddingWindow.findUnique.mockResolvedValue(closedWindow);

      await expect(
        biddingService.closeBiddingWindow({
          biddingWindowId: 'window-1',
          actor: 'admin-1',
          correlationId: 'corr-1',
        })
      ).rejects.toThrow('Bidding window is already CLOSED');
    });

    it('should handle closing window with no bids', async () => {
      const mockWindow = {
        id: 'window-1',
        orderIds: ['order-1'],
        status: 'OPEN',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockWindow));
      mockPrisma.biddingWindow.findUnique.mockResolvedValue(mockWindow);
      mockPrisma.bid.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockResolvedValue([
        { ...mockWindow, status: 'CLOSED' },
        { count: 0 },
      ]);

      const result = await biddingService.closeBiddingWindow({
        biddingWindowId: 'window-1',
        actor: 'admin-1',
        correlationId: 'corr-1',
      });

      expect(result.summary.totalBids).toBe(0);
    });
  });

  describe('getActiveBidsForOrder', () => {
    it('should get active bids for an order', async () => {
      const mockBids = [
        {
          id: 'bid-1',
          porterId: 'porter-1',
          amountCents: 2000,
          status: 'PLACED',
        },
        {
          id: 'bid-2',
          porterId: 'porter-2',
          amountCents: 1800,
          status: 'PLACED',
        },
      ];

      mockPrisma.$transaction.mockResolvedValue([mockBids, 2]);

      const result = await biddingService.getActiveBidsForOrder({
        orderId: 'order-1',
        page: 1,
        pageSize: 20,
      });

      expect(result.bids).toEqual(mockBids);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should support pagination', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 50]);

      const result = await biddingService.getActiveBidsForOrder({
        orderId: 'order-1',
        page: 3,
        pageSize: 10,
      });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(50);
    });

    it('should return empty array for order with no bids', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await biddingService.getActiveBidsForOrder({
        orderId: 'order-1',
      });

      expect(result.bids).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
