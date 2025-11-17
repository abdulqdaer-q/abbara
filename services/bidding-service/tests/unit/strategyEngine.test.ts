import { StrategyEngine, BidWithMetadata, PorterMetadata } from '../../src/services/strategyEngine';
import { BidStrategy } from '@prisma/client';

describe('StrategyEngine', () => {
  let engine: StrategyEngine;

  beforeEach(() => {
    engine = new StrategyEngine();
  });

  const createMockStrategy = (params?: any): BidStrategy => ({
    id: 'test-strategy',
    name: 'Test Strategy',
    description: 'Test',
    version: 1,
    parameters: params || {
      priceWeight: 0.4,
      etaWeight: 0.3,
      ratingWeight: 0.15,
      reliabilityWeight: 0.1,
      distanceWeight: 0.05,
    },
    isActive: true,
    createdAt: new Date(),
    effectiveFrom: new Date(),
    deprecatedAt: null,
  });

  const createMockBid = (overrides?: Partial<BidWithMetadata>): BidWithMetadata => ({
    id: overrides?.id || 'bid-1',
    biddingWindowId: 'window-1',
    porterId: 'porter-1',
    amountCents: overrides?.amountCents || 10000,
    estimatedArrivalMinutes: overrides?.estimatedArrivalMinutes || 30,
    metadata: null,
    status: 'PLACED',
    placedAt: new Date(),
    acceptedAt: null,
    cancelledAt: null,
    expiredAt: null,
    idempotencyKey: 'key-1',
    correlationId: null,
    cancelReason: null,
    acceptedBy: null,
    ...overrides,
  });

  describe('evaluateBids', () => {
    it('should evaluate and rank bids by score', async () => {
      const strategy = createMockStrategy();

      const bids: BidWithMetadata[] = [
        createMockBid({ id: 'bid-1', amountCents: 15000, estimatedArrivalMinutes: 45 }),
        createMockBid({ id: 'bid-2', amountCents: 10000, estimatedArrivalMinutes: 30 }),
        createMockBid({ id: 'bid-3', amountCents: 12000, estimatedArrivalMinutes: 20 }),
      ];

      const results = await engine.evaluateBids(bids, strategy);

      expect(results).toHaveLength(3);
      expect(results[0].rank).toBe(1);
      expect(results[1].rank).toBe(2);
      expect(results[2].rank).toBe(3);

      // Scores should be in descending order
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });

    it('should consider porter metadata in scoring', async () => {
      const strategy = createMockStrategy();

      const porterMetadata = new Map<string, PorterMetadata>([
        ['porter-1', { porterId: 'porter-1', rating: 5, reliabilityScore: 95, completedJobs: 100 }],
        ['porter-2', { porterId: 'porter-2', rating: 3, reliabilityScore: 60, completedJobs: 20 }],
      ]);

      const bids: BidWithMetadata[] = [
        createMockBid({ id: 'bid-1', porterId: 'porter-1', amountCents: 12000 }),
        createMockBid({ id: 'bid-2', porterId: 'porter-2', amountCents: 10000 }),
      ];

      const results = await engine.evaluateBids(bids, strategy, porterMetadata);

      expect(results).toHaveLength(2);

      // Bid from higher-rated porter might rank higher despite higher price
      // depending on weights
      expect(results[0].breakdown.ratingScore).toBeGreaterThan(0);
      expect(results[1].breakdown.ratingScore).toBeGreaterThan(0);
    });

    it('should handle single bid correctly', async () => {
      const strategy = createMockStrategy();
      const bids: BidWithMetadata[] = [
        createMockBid({ id: 'bid-1', amountCents: 10000 }),
      ];

      const results = await engine.evaluateBids(bids, strategy);

      expect(results).toHaveLength(1);
      expect(results[0].rank).toBe(1);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should normalize scores correctly', async () => {
      const strategy = createMockStrategy();

      const bids: BidWithMetadata[] = [
        createMockBid({ id: 'bid-1', amountCents: 5000, estimatedArrivalMinutes: 10 }),
        createMockBid({ id: 'bid-2', amountCents: 20000, estimatedArrivalMinutes: 60 }),
      ];

      const results = await engine.evaluateBids(bids, strategy);

      // Lower price and faster ETA should score higher
      const lowPriceBid = results.find(r => r.bidId === 'bid-1');
      const highPriceBid = results.find(r => r.bidId === 'bid-2');

      expect(lowPriceBid?.score).toBeGreaterThan(highPriceBid?.score || 0);
      expect(lowPriceBid?.rank).toBe(1);
      expect(highPriceBid?.rank).toBe(2);
    });
  });

  describe('previewBidRanking', () => {
    it('should preview hypothetical bid ranking', async () => {
      const strategy = createMockStrategy();

      const existingBids: BidWithMetadata[] = [
        createMockBid({ id: 'bid-1', amountCents: 15000, estimatedArrivalMinutes: 45 }),
        createMockBid({ id: 'bid-2', amountCents: 12000, estimatedArrivalMinutes: 30 }),
      ];

      const hypotheticalBid = {
        amountCents: 10000,
        estimatedArrivalMinutes: 25,
      };

      const preview = await engine.previewBidRanking(
        hypotheticalBid,
        existingBids,
        strategy
      );

      expect(preview.totalBids).toBe(3); // 2 existing + 1 hypothetical
      expect(preview.estimatedRank).toBeGreaterThan(0);
      expect(preview.estimatedRank).toBeLessThanOrEqual(3);
      expect(preview.estimatedScore).toBeGreaterThan(0);
    });

    it('should rank competitive bid highly', async () => {
      const strategy = createMockStrategy();

      const existingBids: BidWithMetadata[] = [
        createMockBid({ id: 'bid-1', amountCents: 15000, estimatedArrivalMinutes: 45 }),
      ];

      const competitiveBid = {
        amountCents: 8000, // Much lower price
        estimatedArrivalMinutes: 20, // Much faster
      };

      const preview = await engine.previewBidRanking(
        competitiveBid,
        existingBids,
        strategy
      );

      expect(preview.estimatedRank).toBe(1); // Should be top bid
    });
  });
});
