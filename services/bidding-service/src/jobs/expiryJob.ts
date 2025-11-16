import cron from 'node-cron';
import { getPrismaClient } from '../lib/db';
import { getRedisClient } from '../lib/redis';
import { publishEvent } from '../lib/kafka';
import { logger } from '../lib/logger';
import { EventType, BidExpiredEvent, BidClosedEvent } from '@movenow/common';
import { biddingWindowsTotal, activeBiddingWindows } from '../lib/metrics';

/**
 * Scheduled job to enforce bidding window expiry
 * Runs every 10 seconds to check for expired windows
 */
export class ExpiryJob {
  private prisma = getPrismaClient();
  private redis = getRedisClient();
  private cronJob?: cron.ScheduledTask;

  /**
   * Start the expiry enforcement job
   */
  start(): void {
    // Run every 10 seconds
    this.cronJob = cron.schedule('*/10 * * * * *', async () => {
      await this.processExpiredWindows();
    });

    logger.info('Expiry job started (runs every 10 seconds)');
  }

  /**
   * Stop the job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('Expiry job stopped');
    }
  }

  /**
   * Process expired bidding windows
   */
  private async processExpiredWindows(): Promise<void> {
    try {
      const now = new Date();

      // Find all open windows that have expired
      const expiredWindows = await this.prisma.biddingWindow.findMany({
        where: {
          status: 'OPEN',
          expiresAt: {
            lte: now,
          },
        },
        include: {
          bids: {
            where: {
              status: 'PLACED',
            },
          },
        },
      });

      if (expiredWindows.length === 0) {
        return; // No expired windows
      }

      logger.info('Processing expired bidding windows', {
        count: expiredWindows.length,
      });

      for (const window of expiredWindows) {
        await this.expireWindow(window);
      }
    } catch (error) {
      logger.error('Error processing expired windows', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Expire a single bidding window
   */
  private async expireWindow(
    window: any // BiddingWindow with bids
  ): Promise<void> {
    const now = new Date();

    try {
      // Use transaction to ensure atomicity
      await this.prisma.$transaction(async (tx) => {
        // Close the window
        await tx.biddingWindow.update({
          where: { id: window.id },
          data: {
            status: 'CLOSED',
            closedAt: now,
          },
        });

        // Mark all active bids as expired
        await tx.bid.updateMany({
          where: {
            biddingWindowId: window.id,
            status: 'PLACED',
          },
          data: {
            status: 'EXPIRED',
            expiredAt: now,
          },
        });

        // Create audit events for expired bids
        const auditEvents = window.bids.map((bid: any) => ({
          bidId: bid.id,
          eventType: 'BID_EXPIRED' as const,
          payload: {
            expiredAt: now,
            reason: 'Bidding window expired',
          },
          timestamp: now,
        }));

        if (auditEvents.length > 0) {
          await tx.bidAuditEvent.createMany({
            data: auditEvents,
          });
        }
      });

      // Update metrics
      biddingWindowsTotal.inc({ status: 'expired' });
      activeBiddingWindows.dec();

      // Clear Redis cache
      await this.redis.del(`bidding:window:${window.id}`);

      // Publish BidExpired event
      const expiredEvent: BidExpiredEvent = {
        type: EventType.BID_EXPIRED,
        timestamp: now,
        correlationId: window.correlationId || 'system-expiry',
        biddingWindowId: window.id,
        orderIds: window.orderIds,
        totalBids: window.bids.length,
        expiredAt: now,
      };

      await publishEvent(expiredEvent);

      // Publish BidClosed event
      const closedEvent: BidClosedEvent = {
        type: EventType.BID_CLOSED,
        timestamp: now,
        correlationId: window.correlationId || 'system-expiry',
        biddingWindowId: window.id,
        orderIds: window.orderIds,
        closedAt: now,
        outcome: window.bids.length === 0 ? 'no_bids' : 'expired',
      };

      await publishEvent(closedEvent);

      logger.info('Bidding window expired', {
        windowId: window.id,
        orderIds: window.orderIds,
        totalBids: window.bids.length,
      });
    } catch (error) {
      logger.error('Error expiring bidding window', {
        windowId: window.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
export const expiryJob = new ExpiryJob();
