import { TRPCError } from '@trpc/server';
import { Bid, BiddingWindow, BidStrategy, Prisma } from '@prisma/client';
import { getPrismaClient } from '../lib/db';
import { getRedisClient, RedisLock, getRedisLock } from '../lib/redis';
import { publishEvent } from '../lib/kafka';
import { logger } from '../lib/logger';
import {
  EventType,
  BidOpenedEvent,
  BidPlacedEvent,
  BidAcceptedEvent,
  BidWinnerSelectedEvent,
  BidClosedEvent,
  BidCancelledEvent,
  BidExpiredEvent,
} from '@movenow/common';
import { strategyEngine, PorterMetadata } from './strategyEngine';
import { validatePorterEligibility } from '../middleware/auth';
import {
  biddingWindowsTotal,
  activeBiddingWindows,
  bidsTotal,
  bidAcceptanceDuration,
  timeToFirstBid,
  lockAcquisitionAttempts,
} from '../lib/metrics';
import { config } from '../config';

/**
 * Bidding Service - Core business logic
 */
export class BiddingService {
  private prisma = getPrismaClient();
  private redis = getRedisClient();
  private redisLock = getRedisLock();

  /**
   * Open a new bidding window
   */
  async openBiddingWindow(params: {
    orderIds: string[];
    biddingWindowDurationSec?: number;
    allowedPorterFilters?: Record<string, any>;
    strategyId?: string;
    minimumBidCents?: number;
    reservePriceCents?: number;
    createdBy: string;
    correlationId: string;
  }): Promise<BiddingWindow> {
    const {
      orderIds,
      biddingWindowDurationSec = config.defaultBiddingWindowDurationSec,
      allowedPorterFilters,
      strategyId = config.defaultStrategyId,
      minimumBidCents = config.defaultMinBidCents,
      reservePriceCents,
      createdBy,
      correlationId,
    } = params;

    // Validate strategy exists
    const strategy = await this.prisma.bidStrategy.findUnique({
      where: { id: strategyId },
    });

    if (!strategy || !strategy.isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid or inactive strategy',
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + biddingWindowDurationSec * 1000);

    // Create bidding window
    const window = await this.prisma.biddingWindow.create({
      data: {
        orderIds,
        status: 'OPEN',
        strategyId,
        configuration: {
          minimumBidCents,
          reservePriceCents,
          allowedPorterFilters,
          maxBidsPerPorter: config.maxBidsPerPorter,
        },
        openAt: now,
        expiresAt,
        createdBy,
        correlationId,
      },
    });

    // Cache active window in Redis with TTL
    await this.redis.setex(
      `bidding:window:${window.id}`,
      biddingWindowDurationSec + 60, // Extra buffer
      JSON.stringify(window)
    );

    // Update metrics
    biddingWindowsTotal.inc({ status: 'open' });
    activeBiddingWindows.inc();

    // Publish event
    const event: BidOpenedEvent = {
      type: EventType.BID_OPENED,
      timestamp: now,
      correlationId,
      biddingWindowId: window.id,
      orderIds,
      expiresAt,
      strategyId,
      configuration: {
        minBidCents: minimumBidCents,
        reservePriceCents,
        allowedPorterFilters,
      },
    };

    await publishEvent(event);

    logger.info('Bidding window opened', {
      windowId: window.id,
      orderIds,
      expiresAt,
      correlationId,
    });

    return window;
  }

  /**
   * Place a bid
   */
  async placeBid(params: {
    biddingWindowId: string;
    porterId: string;
    amountCents: number;
    estimatedArrivalMinutes: number;
    metadata?: Record<string, any>;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<{
    bid: Bid;
    currentTopBid?: { amountCents: number; rank: number };
  }> {
    const {
      biddingWindowId,
      porterId,
      amountCents,
      estimatedArrivalMinutes,
      metadata,
      idempotencyKey,
      correlationId,
    } = params;

    // Check idempotency - if bid with this key exists, return it
    const existingBid = await this.prisma.bid.findUnique({
      where: { idempotencyKey },
    });

    if (existingBid) {
      logger.debug('Idempotent bid request', { bidId: existingBid.id });
      return { bid: existingBid };
    }

    // Get bidding window
    const window = await this.getBiddingWindow(biddingWindowId);

    if (!window) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Bidding window not found',
      });
    }

    if (window.status !== 'OPEN') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Bidding window is ${window.status}`,
      });
    }

    // Check if window expired
    if (new Date() > window.expiresAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Bidding window has expired',
      });
    }

    // Validate configuration
    const configuration = window.configuration as any;
    if (
      configuration.minimumBidCents &&
      amountCents < configuration.minimumBidCents
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Bid amount must be at least ${configuration.minimumBidCents} cents`,
      });
    }

    // Check max bids per porter
    const porterBidCount = await this.prisma.bid.count({
      where: {
        biddingWindowId,
        porterId,
        status: { in: ['PLACED', 'ACCEPTED'] },
      },
    });

    if (porterBidCount >= (configuration.maxBidsPerPorter || 5)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Maximum bids per porter exceeded',
      });
    }

    // Validate porter eligibility
    const eligibility = await validatePorterEligibility(
      porterId,
      configuration.allowedPorterFilters
    );

    if (!eligibility.eligible) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: eligibility.reason || 'Porter not eligible for this bidding window',
      });
    }

    const now = new Date();

    // Create bid
    const bid = await this.prisma.bid.create({
      data: {
        biddingWindowId,
        porterId,
        amountCents,
        estimatedArrivalMinutes,
        metadata: metadata as Prisma.InputJsonValue,
        status: 'PLACED',
        placedAt: now,
        idempotencyKey,
        correlationId,
      },
    });

    // Create audit event
    await this.createAuditEvent(bid.id, 'BID_PLACED', {
      bidId: bid.id,
      amountCents,
      estimatedArrivalMinutes,
    });

    // Update metrics
    bidsTotal.inc({ status: 'placed' });

    // Track time to first bid
    const existingBidsCount = await this.prisma.bid.count({
      where: { biddingWindowId },
    });

    if (existingBidsCount === 1) {
      const timeToFirstMs = now.getTime() - window.openAt.getTime();
      timeToFirstBid.observe(timeToFirstMs / 1000);
    }

    // Publish event
    const event: BidPlacedEvent = {
      type: EventType.BID_PLACED,
      timestamp: now,
      correlationId,
      bidId: bid.id,
      biddingWindowId,
      porterId,
      amountCents,
      estimatedArrivalMinutes,
      placedAt: now,
    };

    await publishEvent(event);

    logger.info('Bid placed', {
      bidId: bid.id,
      windowId: biddingWindowId,
      porterId,
      amountCents,
      correlationId,
    });

    // Get current top bid (optional, for UI feedback)
    const currentTopBid = await this.getCurrentTopBid(biddingWindowId);

    return { bid, currentTopBid };
  }

  /**
   * Accept a bid (with race-safe locking)
   */
  async acceptBid(params: {
    biddingWindowId: string;
    bidId: string;
    acceptedBy: string;
    correlationId: string;
  }): Promise<{
    bid: Bid;
    window: BiddingWindow;
  }> {
    const { biddingWindowId, bidId, acceptedBy, correlationId } = params;

    const endTimer = bidAcceptanceDuration.startTimer();

    try {
      // Acquire distributed lock to prevent race conditions
      const lockKey = `accept:${biddingWindowId}`;

      lockAcquisitionAttempts.inc({ result: 'attempt' });

      return await this.redisLock.withLock(
        lockKey,
        config.bidAcceptanceLockTtlSec,
        async () => {
          lockAcquisitionAttempts.inc({ result: 'success' });

          // Use database transaction for atomicity
          const result = await this.prisma.$transaction(async (tx) => {
            // Get bidding window with lock
            const window = await tx.biddingWindow.findUnique({
              where: { id: biddingWindowId },
            });

            if (!window) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Bidding window not found',
              });
            }

            if (window.status !== 'OPEN') {
              throw new TRPCError({
                code: 'CONFLICT',
                message: `Bidding window is already ${window.status}`,
              });
            }

            // Get bid with lock
            const bid = await tx.bid.findUnique({
              where: { id: bidId },
            });

            if (!bid) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Bid not found',
              });
            }

            if (bid.biddingWindowId !== biddingWindowId) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Bid does not belong to this bidding window',
              });
            }

            if (bid.status !== 'PLACED') {
              throw new TRPCError({
                code: 'CONFLICT',
                message: `Bid is already ${bid.status}`,
              });
            }

            const now = new Date();

            // Update bid to accepted
            const acceptedBid = await tx.bid.update({
              where: { id: bidId },
              data: {
                status: 'ACCEPTED',
                acceptedAt: now,
                acceptedBy,
              },
            });

            // Close bidding window
            const closedWindow = await tx.biddingWindow.update({
              where: { id: biddingWindowId },
              data: {
                status: 'CLOSED',
                closedAt: now,
              },
            });

            // Mark other bids as expired
            await tx.bid.updateMany({
              where: {
                biddingWindowId,
                id: { not: bidId },
                status: 'PLACED',
              },
              data: {
                status: 'EXPIRED',
                expiredAt: now,
              },
            });

            // Create audit event
            await tx.bidAuditEvent.create({
              data: {
                bidId,
                eventType: 'BID_ACCEPTED',
                payload: {
                  acceptedBy,
                  acceptedAt: now,
                } as Prisma.InputJsonValue,
                timestamp: now,
                actor: acceptedBy,
                correlationId,
              },
            });

            return { bid: acceptedBid, window: closedWindow };
          });

          // Update metrics
          bidsTotal.inc({ status: 'accepted' });
          biddingWindowsTotal.inc({ status: 'closed' });
          activeBiddingWindows.dec();

          // Clear Redis cache
          await this.redis.del(`bidding:window:${biddingWindowId}`);

          const now = new Date();

          // Publish BidAccepted event
          const acceptedEvent: BidAcceptedEvent = {
            type: EventType.BID_ACCEPTED,
            timestamp: now,
            correlationId,
            bidId,
            biddingWindowId,
            porterId: result.bid.porterId,
            amountCents: result.bid.amountCents,
            acceptedAt: now,
            acceptedBy,
          };

          await publishEvent(acceptedEvent);

          // Publish BidWinnerSelected event
          const winnerEvent: BidWinnerSelectedEvent = {
            type: EventType.BID_WINNER_SELECTED,
            timestamp: now,
            correlationId,
            biddingWindowId,
            bidId,
            orderIds: result.window.orderIds,
            winnerPorterId: result.bid.porterId,
            winningAmountCents: result.bid.amountCents,
            selectedAt: now,
          };

          await publishEvent(winnerEvent);

          logger.info('Bid accepted', {
            bidId,
            windowId: biddingWindowId,
            porterId: result.bid.porterId,
            acceptedBy,
            correlationId,
          });

          return result;
        }
      );
    } catch (error) {
      lockAcquisitionAttempts.inc({ result: 'failure' });

      if (error instanceof Error && error.message.includes('Failed to acquire lock')) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Another bid acceptance is in progress',
        });
      }

      throw error;
    } finally {
      endTimer();
    }
  }

  /**
   * Cancel a bid
   */
  async cancelBid(params: {
    bidId: string;
    reason: string;
    correlationId: string;
  }): Promise<Bid> {
    const { bidId, reason, correlationId } = params;

    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
    });

    if (!bid) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Bid not found',
      });
    }

    if (bid.status !== 'PLACED') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot cancel bid with status ${bid.status}`,
      });
    }

    const now = new Date();

    const cancelledBid = await this.prisma.bid.update({
      where: { id: bidId },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelReason: reason,
      },
    });

    // Create audit event
    await this.createAuditEvent(bidId, 'BID_CANCELLED', {
      reason,
      cancelledAt: now,
    });

    // Update metrics
    bidsTotal.inc({ status: 'cancelled' });

    // Publish event
    const event: BidCancelledEvent = {
      type: EventType.BID_CANCELLED,
      timestamp: now,
      correlationId,
      bidId,
      biddingWindowId: bid.biddingWindowId,
      porterId: bid.porterId,
      cancelledAt: now,
      reason,
    };

    await publishEvent(event);

    logger.info('Bid cancelled', { bidId, reason, correlationId });

    return cancelledBid;
  }

  /**
   * Close bidding window (manual or automatic)
   */
  async closeBiddingWindow(params: {
    biddingWindowId: string;
    actor: string;
    correlationId: string;
  }): Promise<{
    window: BiddingWindow;
    summary: {
      totalBids: number;
      winningBid?: Bid;
    };
  }> {
    const { biddingWindowId, actor, correlationId } = params;

    const window = await this.getBiddingWindow(biddingWindowId);

    if (!window) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Bidding window not found',
      });
    }

    if (window.status !== 'OPEN') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Bidding window is already ${window.status}`,
      });
    }

    const now = new Date();

    // Get all placed bids
    const bids = await this.prisma.bid.findMany({
      where: {
        biddingWindowId,
        status: 'PLACED',
      },
    });

    const totalBids = bids.length;

    // Close window and expire remaining bids
    const [closedWindow] = await this.prisma.$transaction([
      this.prisma.biddingWindow.update({
        where: { id: biddingWindowId },
        data: {
          status: 'CLOSED',
          closedAt: now,
        },
      }),
      this.prisma.bid.updateMany({
        where: {
          biddingWindowId,
          status: 'PLACED',
        },
        data: {
          status: 'EXPIRED',
          expiredAt: now,
        },
      }),
    ]);

    // Update metrics
    biddingWindowsTotal.inc({ status: 'closed' });
    activeBiddingWindows.dec();

    // Clear Redis cache
    await this.redis.del(`bidding:window:${biddingWindowId}`);

    // Determine outcome
    let outcome: 'winner_selected' | 'expired' | 'cancelled' | 'no_bids';
    if (totalBids === 0) {
      outcome = 'no_bids';
    } else {
      outcome = 'expired';
    }

    // Publish event
    const event: BidClosedEvent = {
      type: EventType.BID_CLOSED,
      timestamp: now,
      correlationId,
      biddingWindowId,
      orderIds: window.orderIds,
      closedAt: now,
      outcome,
    };

    await publishEvent(event);

    logger.info('Bidding window closed', {
      windowId: biddingWindowId,
      totalBids,
      outcome,
      correlationId,
    });

    return {
      window: closedWindow,
      summary: {
        totalBids,
      },
    };
  }

  /**
   * Get active bids for an order
   */
  async getActiveBidsForOrder(params: {
    orderId: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    bids: Bid[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { orderId, page = 1, pageSize = 20 } = params;

    const skip = (page - 1) * pageSize;

    const [bids, total] = await this.prisma.$transaction([
      this.prisma.bid.findMany({
        where: {
          biddingWindow: {
            orderIds: {
              has: orderId,
            },
            status: 'OPEN',
          },
          status: 'PLACED',
        },
        orderBy: {
          placedAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      this.prisma.bid.count({
        where: {
          biddingWindow: {
            orderIds: {
              has: orderId,
            },
            status: 'OPEN',
          },
          status: 'PLACED',
        },
      }),
    ]);

    return {
      bids,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Get bidding window (with Redis caching)
   */
  private async getBiddingWindow(
    id: string
  ): Promise<BiddingWindow | null> {
    // Try cache first
    const cached = await this.redis.get(`bidding:window:${id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const window = await this.prisma.biddingWindow.findUnique({
      where: { id },
    });

    return window;
  }

  /**
   * Get current top bid for a window
   */
  private async getCurrentTopBid(
    biddingWindowId: string
  ): Promise<{ amountCents: number; rank: number } | undefined> {
    const window = await this.getBiddingWindow(biddingWindowId);
    if (!window) return undefined;

    const bids = await this.prisma.bid.findMany({
      where: {
        biddingWindowId,
        status: 'PLACED',
      },
    });

    if (bids.length === 0) return undefined;

    const strategy = await this.prisma.bidStrategy.findUnique({
      where: { id: window.strategyId },
    });

    if (!strategy) return undefined;

    const evaluations = await strategyEngine.evaluateBids(bids, strategy);

    const topBid = evaluations[0];

    return {
      amountCents: bids.find((b) => b.id === topBid.bidId)?.amountCents ?? 0,
      rank: 1,
    };
  }

  /**
   * Create audit event
   */
  private async createAuditEvent(
    bidId: string,
    eventType: 'BID_PLACED' | 'BID_ACCEPTED' | 'BID_CANCELLED' | 'BID_EXPIRED' | 'BID_EVALUATED',
    payload: Record<string, any>
  ): Promise<void> {
    await this.prisma.bidAuditEvent.create({
      data: {
        bidId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        timestamp: new Date(),
      },
    });
  }
}

/**
 * Singleton instance
 */
export const biddingService = new BiddingService();
