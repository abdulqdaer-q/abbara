import { z } from 'zod';
import { router, protectedProcedure, porterProcedure, adminProcedure } from '../trpc';
import { biddingService } from '../services/biddingService';
import { strategyEngine } from '../services/strategyEngine';
import { getPrismaClient } from '../lib/db';

/**
 * Input schemas for bidding procedures
 */
const openBiddingWindowSchema = z.object({
  orderIds: z.array(z.string()).min(1),
  biddingWindowDurationSec: z.number().int().min(10).max(3600).optional(),
  allowedPorterFilters: z.record(z.any()).optional(),
  strategyId: z.string().optional(),
  minimumBidCents: z.number().int().min(0).optional(),
  reservePriceCents: z.number().int().min(0).optional(),
  idempotencyKey: z.string(),
});

const placeBidSchema = z.object({
  biddingWindowId: z.string(),
  amountCents: z.number().int().min(0),
  estimatedArrivalMinutes: z.number().int().min(1).max(480),
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string(),
});

const acceptBidSchema = z.object({
  biddingWindowId: z.string(),
  bidId: z.string(),
  idempotencyKey: z.string(),
});

const cancelBidSchema = z.object({
  bidId: z.string(),
  reason: z.string().min(1).max(500),
  idempotencyKey: z.string(),
});

const closeBiddingWindowSchema = z.object({
  biddingWindowId: z.string(),
});

const getActiveBidsSchema = z.object({
  orderId: z.string(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

const getBiddingWindowSchema = z.object({
  biddingWindowId: z.string(),
});

const previewBidOutcomeSchema = z.object({
  biddingWindowId: z.string(),
  amountCents: z.number().int().min(0),
  estimatedArrivalMinutes: z.number().int().min(1).max(480),
  porterMetadata: z
    .object({
      rating: z.number().min(0).max(5),
      reliabilityScore: z.number().min(0).max(100),
      completedJobs: z.number().int().min(0),
      distanceMeters: z.number().min(0).optional(),
    })
    .optional(),
});

/**
 * Bidding router
 */
export const biddingRouter = router({
  /**
   * Open a new bidding window
   * Requires: authenticated user (customer or admin)
   */
  openBiddingWindow: protectedProcedure
    .input(openBiddingWindowSchema)
    .mutation(async ({ input, ctx }) => {
      return await biddingService.openBiddingWindow({
        ...input,
        createdBy: ctx.user.id,
        correlationId: ctx.correlationId,
      });
    }),

  /**
   * Place a bid
   * Requires: authenticated porter
   */
  placeBid: porterProcedure
    .input(placeBidSchema)
    .mutation(async ({ input, ctx }) => {
      return await biddingService.placeBid({
        ...input,
        porterId: ctx.user.id,
        correlationId: ctx.correlationId,
      });
    }),

  /**
   * Accept a bid (select winner)
   * Requires: authenticated user (customer or admin)
   */
  acceptBid: protectedProcedure
    .input(acceptBidSchema)
    .mutation(async ({ input, ctx }) => {
      return await biddingService.acceptBid({
        ...input,
        acceptedBy: ctx.user.id,
        correlationId: ctx.correlationId,
      });
    }),

  /**
   * Cancel a bid
   * Requires: authenticated porter (own bid) or admin
   */
  cancelBid: protectedProcedure
    .input(cancelBidSchema)
    .mutation(async ({ input, ctx }) => {
      // TODO: Add authorization check to ensure porter can only cancel their own bids
      return await biddingService.cancelBid({
        ...input,
        correlationId: ctx.correlationId,
      });
    }),

  /**
   * Close a bidding window (manual)
   * Requires: admin
   */
  closeBiddingWindow: adminProcedure
    .input(closeBiddingWindowSchema)
    .mutation(async ({ input, ctx }) => {
      return await biddingService.closeBiddingWindow({
        ...input,
        actor: ctx.user.id,
        correlationId: ctx.correlationId,
      });
    }),

  /**
   * Get active bids for an order
   * Requires: authenticated user
   */
  getActiveBidsForOrder: protectedProcedure
    .input(getActiveBidsSchema)
    .query(async ({ input }) => {
      return await biddingService.getActiveBidsForOrder(input);
    }),

  /**
   * Get bidding window details
   * Requires: authenticated user
   */
  getBiddingWindow: protectedProcedure
    .input(getBiddingWindowSchema)
    .query(async ({ input }) => {
      const prisma = getPrismaClient();

      const window = await prisma.biddingWindow.findUnique({
        where: { id: input.biddingWindowId },
        include: {
          strategy: true,
          bids: {
            where: {
              status: { in: ['PLACED', 'ACCEPTED'] },
            },
            orderBy: {
              placedAt: 'desc',
            },
          },
        },
      });

      return window;
    }),

  /**
   * Preview bid outcome (simulation for UI)
   * Requires: authenticated porter
   */
  previewBidOutcome: porterProcedure
    .input(previewBidOutcomeSchema)
    .query(async ({ input, ctx }) => {
      const prisma = getPrismaClient();

      const window = await prisma.biddingWindow.findUnique({
        where: { id: input.biddingWindowId },
        include: {
          strategy: true,
          bids: {
            where: {
              status: 'PLACED',
            },
          },
        },
      });

      if (!window) {
        throw new Error('Bidding window not found');
      }

      const porterMetadata = input.porterMetadata
        ? {
            porterId: ctx.user.id,
            ...input.porterMetadata,
          }
        : undefined;

      return await strategyEngine.previewBidRanking(
        {
          amountCents: input.amountCents,
          estimatedArrivalMinutes: input.estimatedArrivalMinutes,
          porterMetadata,
        },
        window.bids,
        window.strategy
      );
    }),

  /**
   * Get bid history for a porter
   * Requires: authenticated porter
   */
  getMyBids: porterProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z.enum(['PLACED', 'ACCEPTED', 'CANCELLED', 'EXPIRED']).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const prisma = getPrismaClient();
      const { page, pageSize, status } = input;
      const skip = (page - 1) * pageSize;

      const where = {
        porterId: ctx.user.id,
        ...(status ? { status } : {}),
      };

      const [bids, total] = await prisma.$transaction([
        prisma.bid.findMany({
          where,
          include: {
            biddingWindow: {
              select: {
                id: true,
                orderIds: true,
                status: true,
                openAt: true,
                expiresAt: true,
              },
            },
          },
          orderBy: {
            placedAt: 'desc',
          },
          skip,
          take: pageSize,
        }),
        prisma.bid.count({ where }),
      ]);

      return {
        bids,
        total,
        page,
        pageSize,
      };
    }),

  /**
   * Get bidding statistics (admin only)
   */
  getStatistics: adminProcedure
    .input(
      z.object({
        biddingWindowId: z.string().optional(),
        orderId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const prisma = getPrismaClient();

      if (input.biddingWindowId) {
        return await prisma.bidStatistics.findUnique({
          where: { biddingWindowId: input.biddingWindowId },
        });
      }

      if (input.orderId) {
        return await prisma.bidStatistics.findFirst({
          where: { orderId: input.orderId },
          orderBy: { createdAt: 'desc' },
        });
      }

      return null;
    }),
});
