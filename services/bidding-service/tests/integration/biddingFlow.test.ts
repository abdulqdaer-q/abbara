/**
 * Integration test for complete bidding flow
 *
 * This test requires:
 * - PostgreSQL database
 * - Redis instance
 * - Kafka broker (or mocked)
 *
 * Run with: npm run test:integration
 */

import { BiddingService } from '../../src/services/biddingService';
import { getPrismaClient } from '../../src/lib/db';
import { getRedisClient } from '../../src/lib/redis';

describe('Bidding Flow Integration', () => {
  let biddingService: BiddingService;
  let prisma: ReturnType<typeof getPrismaClient>;
  let redis: ReturnType<typeof getRedisClient>;

  beforeAll(async () => {
    prisma = getPrismaClient();
    redis = getRedisClient();
    biddingService = new BiddingService();

    // Setup test database
    // await prisma.$executeRaw`TRUNCATE TABLE bidding_windows, bids, bid_strategies, bid_audit_events CASCADE`;

    // Create a test strategy
    await prisma.bidStrategy.upsert({
      where: { id: 'test-strategy' },
      create: {
        id: 'test-strategy',
        name: 'Test Strategy',
        description: 'Test strategy for integration tests',
        parameters: {
          priceWeight: 0.4,
          etaWeight: 0.3,
          ratingWeight: 0.15,
          reliabilityWeight: 0.1,
          distanceWeight: 0.05,
        },
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Cleanup
    await redis.quit();
    await prisma.$disconnect();
  });

  describe('Complete bidding lifecycle', () => {
    it('should handle open window -> place bids -> accept bid flow', async () => {
      // 1. Open bidding window
      const window = await biddingService.openBiddingWindow({
        orderIds: ['order-123'],
        biddingWindowDurationSec: 300,
        strategyId: 'test-strategy',
        minimumBidCents: 5000,
        createdBy: 'user-1',
        correlationId: 'test-correlation-1',
      });

      expect(window.id).toBeDefined();
      expect(window.status).toBe('OPEN');
      expect(window.orderIds).toContain('order-123');

      // 2. Place multiple bids
      const bid1 = await biddingService.placeBid({
        biddingWindowId: window.id,
        porterId: 'porter-1',
        amountCents: 10000,
        estimatedArrivalMinutes: 30,
        idempotencyKey: `bid-1-${Date.now()}`,
        correlationId: 'test-correlation-1',
      });

      expect(bid1.bid.id).toBeDefined();
      expect(bid1.bid.status).toBe('PLACED');

      const bid2 = await biddingService.placeBid({
        biddingWindowId: window.id,
        porterId: 'porter-2',
        amountCents: 12000,
        estimatedArrivalMinutes: 25,
        idempotencyKey: `bid-2-${Date.now()}`,
        correlationId: 'test-correlation-1',
      });

      expect(bid2.bid.id).toBeDefined();

      // 3. Get active bids
      const activeBids = await biddingService.getActiveBidsForOrder({
        orderId: 'order-123',
      });

      expect(activeBids.bids.length).toBeGreaterThanOrEqual(2);
      expect(activeBids.total).toBeGreaterThanOrEqual(2);

      // 4. Accept a bid
      const acceptance = await biddingService.acceptBid({
        biddingWindowId: window.id,
        bidId: bid1.bid.id,
        acceptedBy: 'user-1',
        correlationId: 'test-correlation-1',
      });

      expect(acceptance.bid.status).toBe('ACCEPTED');
      expect(acceptance.window.status).toBe('CLOSED');

      // 5. Verify other bids are expired
      const updatedBid2 = await prisma.bid.findUnique({
        where: { id: bid2.bid.id },
      });

      expect(updatedBid2?.status).toBe('EXPIRED');
    }, 30000); // 30 second timeout for this integration test

    it('should handle idempotent bid placement', async () => {
      const window = await biddingService.openBiddingWindow({
        orderIds: ['order-456'],
        biddingWindowDurationSec: 300,
        strategyId: 'test-strategy',
        createdBy: 'user-1',
        correlationId: 'test-correlation-2',
      });

      const idempotencyKey = `bid-idempotent-${Date.now()}`;

      // Place bid twice with same idempotency key
      const bid1 = await biddingService.placeBid({
        biddingWindowId: window.id,
        porterId: 'porter-1',
        amountCents: 10000,
        estimatedArrivalMinutes: 30,
        idempotencyKey,
        correlationId: 'test-correlation-2',
      });

      const bid2 = await biddingService.placeBid({
        biddingWindowId: window.id,
        porterId: 'porter-1',
        amountCents: 10000,
        estimatedArrivalMinutes: 30,
        idempotencyKey,
        correlationId: 'test-correlation-2',
      });

      // Should return the same bid
      expect(bid1.bid.id).toBe(bid2.bid.id);

      // Verify only one bid was created
      const allBids = await prisma.bid.findMany({
        where: { biddingWindowId: window.id },
      });

      const sameBids = allBids.filter(b => b.idempotencyKey === idempotencyKey);
      expect(sameBids.length).toBe(1);
    }, 30000);

    it('should enforce minimum bid amount', async () => {
      const window = await biddingService.openBiddingWindow({
        orderIds: ['order-789'],
        biddingWindowDurationSec: 300,
        strategyId: 'test-strategy',
        minimumBidCents: 10000,
        createdBy: 'user-1',
        correlationId: 'test-correlation-3',
      });

      // Attempt to place bid below minimum
      await expect(
        biddingService.placeBid({
          biddingWindowId: window.id,
          porterId: 'porter-1',
          amountCents: 5000, // Below minimum
          estimatedArrivalMinutes: 30,
          idempotencyKey: `bid-low-${Date.now()}`,
          correlationId: 'test-correlation-3',
        })
      ).rejects.toThrow(/must be at least/);
    }, 30000);
  });
});
