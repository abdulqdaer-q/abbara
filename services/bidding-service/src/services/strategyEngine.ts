import { Bid, BidStrategy } from '@prisma/client';
import { logger } from '../lib/logger';
import { strategyEvaluationDuration } from '../lib/metrics';

/**
 * Porter metadata for strategy evaluation
 */
export interface PorterMetadata {
  porterId: string;
  rating: number; // 0-5
  reliabilityScore: number; // 0-100
  completedJobs: number;
  distanceMeters?: number;
}

/**
 * Bid with porter metadata for evaluation
 */
export interface BidWithMetadata extends Bid {
  porterMetadata?: PorterMetadata;
}

/**
 * Strategy evaluation result
 */
export interface EvaluationResult {
  bidId: string;
  score: number;
  rank: number;
  breakdown: {
    priceScore: number;
    etaScore: number;
    ratingScore: number;
    reliabilityScore: number;
    distanceScore: number;
  };
}

/**
 * Strategy parameters interface
 */
export interface StrategyParameters {
  priceWeight: number; // 0-1
  etaWeight: number; // 0-1
  ratingWeight: number; // 0-1
  reliabilityWeight: number; // 0-1
  distanceWeight: number; // 0-1
}

/**
 * Default strategy parameters (weighted scoring)
 */
const DEFAULT_STRATEGY_PARAMS: StrategyParameters = {
  priceWeight: 0.4,
  etaWeight: 0.3,
  ratingWeight: 0.15,
  reliabilityWeight: 0.1,
  distanceWeight: 0.05,
};

/**
 * Strategy evaluation engine
 */
export class StrategyEngine {
  /**
   * Evaluate and rank bids according to strategy
   */
  async evaluateBids(
    bids: BidWithMetadata[],
    strategy: BidStrategy,
    porterMetadataMap: Map<string, PorterMetadata> = new Map()
  ): Promise<EvaluationResult[]> {
    const endTimer = strategyEvaluationDuration.startTimer({
      strategy_id: strategy.id,
    });

    try {
      const params = this.parseStrategyParameters(strategy.parameters);

      // Enrich bids with porter metadata
      const enrichedBids = bids.map((bid) => ({
        ...bid,
        porterMetadata: porterMetadataMap.get(bid.porterId),
      }));

      // Calculate scores for each bid
      const evaluations = enrichedBids.map((bid) =>
        this.calculateBidScore(bid, params, enrichedBids)
      );

      // Sort by score descending and assign ranks
      evaluations.sort((a, b) => b.score - a.score);
      evaluations.forEach((eval, index) => {
        eval.rank = index + 1;
      });

      logger.debug('Bids evaluated', {
        strategyId: strategy.id,
        totalBids: bids.length,
        topScore: evaluations[0]?.score,
      });

      return evaluations;
    } finally {
      endTimer();
    }
  }

  /**
   * Calculate score for a single bid
   */
  private calculateBidScore(
    bid: BidWithMetadata,
    params: StrategyParameters,
    allBids: BidWithMetadata[]
  ): EvaluationResult {
    const { porterMetadata } = bid;

    // Extract min/max values for normalization
    const amounts = allBids.map((b) => b.amountCents);
    const etas = allBids.map((b) => b.estimatedArrivalMinutes);
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    const minEta = Math.min(...etas);
    const maxEta = Math.max(...etas);

    // Price score (lower is better, normalized to 0-100)
    const priceScore =
      maxAmount === minAmount
        ? 100
        : ((maxAmount - bid.amountCents) / (maxAmount - minAmount)) * 100;

    // ETA score (lower is better, normalized to 0-100)
    const etaScore =
      maxEta === minEta
        ? 100
        : ((maxEta - bid.estimatedArrivalMinutes) / (maxEta - minEta)) * 100;

    // Rating score (higher is better, already 0-5, scale to 0-100)
    const ratingScore = porterMetadata ? (porterMetadata.rating / 5) * 100 : 50;

    // Reliability score (already 0-100)
    const reliabilityScore = porterMetadata?.reliabilityScore ?? 50;

    // Distance score (closer is better, normalized to 0-100)
    const distanceScore = porterMetadata?.distanceMeters
      ? Math.max(0, 100 - porterMetadata.distanceMeters / 100)
      : 50;

    // Weighted total score
    const totalScore =
      priceScore * params.priceWeight +
      etaScore * params.etaWeight +
      ratingScore * params.ratingWeight +
      reliabilityScore * params.reliabilityWeight +
      distanceScore * params.distanceWeight;

    return {
      bidId: bid.id,
      score: Math.round(totalScore * 100) / 100, // Round to 2 decimals
      rank: 0, // Will be assigned later
      breakdown: {
        priceScore: Math.round(priceScore * 100) / 100,
        etaScore: Math.round(etaScore * 100) / 100,
        ratingScore: Math.round(ratingScore * 100) / 100,
        reliabilityScore: Math.round(reliabilityScore * 100) / 100,
        distanceScore: Math.round(distanceScore * 100) / 100,
      },
    };
  }

  /**
   * Parse strategy parameters from JSON
   */
  private parseStrategyParameters(
    parametersJson: any
  ): StrategyParameters {
    try {
      const params = typeof parametersJson === 'string'
        ? JSON.parse(parametersJson)
        : parametersJson;

      return {
        priceWeight: params.priceWeight ?? DEFAULT_STRATEGY_PARAMS.priceWeight,
        etaWeight: params.etaWeight ?? DEFAULT_STRATEGY_PARAMS.etaWeight,
        ratingWeight: params.ratingWeight ?? DEFAULT_STRATEGY_PARAMS.ratingWeight,
        reliabilityWeight:
          params.reliabilityWeight ?? DEFAULT_STRATEGY_PARAMS.reliabilityWeight,
        distanceWeight:
          params.distanceWeight ?? DEFAULT_STRATEGY_PARAMS.distanceWeight,
      };
    } catch (error) {
      logger.warn('Failed to parse strategy parameters, using defaults', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return DEFAULT_STRATEGY_PARAMS;
    }
  }

  /**
   * Preview bid outcome (simulation for UI)
   */
  async previewBidRanking(
    hypotheticalBid: {
      amountCents: number;
      estimatedArrivalMinutes: number;
      porterMetadata?: PorterMetadata;
    },
    existingBids: BidWithMetadata[],
    strategy: BidStrategy
  ): Promise<{
    estimatedRank: number;
    estimatedScore: number;
    totalBids: number;
  }> {
    const params = this.parseStrategyParameters(strategy.parameters);

    // Create a mock bid for evaluation
    const mockBid: BidWithMetadata = {
      id: 'preview',
      biddingWindowId: 'preview',
      porterId: 'preview',
      amountCents: hypotheticalBid.amountCents,
      estimatedArrivalMinutes: hypotheticalBid.estimatedArrivalMinutes,
      metadata: null,
      status: 'PLACED',
      placedAt: new Date(),
      acceptedAt: null,
      cancelledAt: null,
      expiredAt: null,
      idempotencyKey: 'preview',
      correlationId: null,
      cancelReason: null,
      acceptedBy: null,
      porterMetadata: hypotheticalBid.porterMetadata,
    };

    // Evaluate with existing bids
    const allBids = [...existingBids, mockBid];
    const evaluations = await this.evaluateBids(allBids, strategy, new Map());

    const previewResult = evaluations.find((e) => e.bidId === 'preview');

    return {
      estimatedRank: previewResult?.rank ?? allBids.length,
      estimatedScore: previewResult?.score ?? 0,
      totalBids: allBids.length,
    };
  }
}

/**
 * Singleton instance
 */
export const strategyEngine = new StrategyEngine();
