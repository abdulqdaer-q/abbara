import { EachMessagePayload } from 'kafkajs';
import { subscribeToEvents } from '../lib/kafka';
import { getPrismaClient } from '../lib/db';
import { logger } from '../lib/logger';
import { EventType } from '@movenow/common';

/**
 * Event consumer service for handling domain events
 */
export class EventConsumer {
  private prisma = getPrismaClient();

  /**
   * Start consuming events
   */
  async start(): Promise<void> {
    const topics = [
      'movenow.order-cancelled',
      'movenow.porter-suspended',
      'movenow.order-assigned',
      'movenow.order-completed',
    ];

    await subscribeToEvents(topics, this.handleEvent.bind(this));

    logger.info('Event consumer started', { topics });
  }

  /**
   * Handle incoming event
   */
  private async handleEvent(payload: EachMessagePayload): Promise<void> {
    const { topic, message } = payload;

    if (!message.value) {
      logger.warn('Received empty message', { topic });
      return;
    }

    const eventData = JSON.parse(message.value.toString());
    const eventType = message.headers?.['event-type']?.toString();

    logger.debug('Processing event', { eventType, topic });

    try {
      switch (eventType) {
        case EventType.ORDER_CANCELLED:
          await this.handleOrderCancelled(eventData);
          break;

        case EventType.PORTER_SUSPENDED:
          await this.handlePorterSuspended(eventData);
          break;

        case EventType.ORDER_ASSIGNED:
          await this.handleOrderAssigned(eventData);
          break;

        case EventType.ORDER_COMPLETED:
          await this.handleOrderCompleted(eventData);
          break;

        default:
          logger.warn('Unknown event type', { eventType });
      }
    } catch (error) {
      logger.error('Error handling event', {
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error; // Rethrow to trigger Kafka retry
    }
  }

  /**
   * Handle OrderCancelled event
   * Cancel active bidding windows for the cancelled order
   */
  private async handleOrderCancelled(event: any): Promise<void> {
    const { orderId, correlationId } = event;

    logger.info('Handling OrderCancelled', { orderId, correlationId });

    // Find active bidding windows containing this order
    const windows = await this.prisma.biddingWindow.findMany({
      where: {
        orderIds: { has: orderId },
        status: 'OPEN',
      },
    });

    if (windows.length === 0) {
      logger.debug('No active bidding windows for cancelled order', { orderId });
      return;
    }

    // Cancel all active bidding windows
    const now = new Date();

    for (const window of windows) {
      await this.prisma.$transaction([
        // Close window
        this.prisma.biddingWindow.update({
          where: { id: window.id },
          data: {
            status: 'CANCELLED',
            closedAt: now,
          },
        }),
        // Cancel all active bids
        this.prisma.bid.updateMany({
          where: {
            biddingWindowId: window.id,
            status: 'PLACED',
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            cancelReason: `Order ${orderId} was cancelled`,
          },
        }),
      ]);

      logger.info('Bidding window cancelled due to order cancellation', {
        windowId: window.id,
        orderId,
      });
    }
  }

  /**
   * Handle PorterSuspended event
   * Cancel all active bids from the suspended porter
   */
  private async handlePorterSuspended(event: any): Promise<void> {
    const { porterId, reason, correlationId } = event;

    logger.info('Handling PorterSuspended', { porterId, correlationId });

    // Cancel all active bids from this porter
    const result = await this.prisma.bid.updateMany({
      where: {
        porterId,
        status: 'PLACED',
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: `Porter suspended: ${reason}`,
      },
    });

    logger.info('Bids cancelled for suspended porter', {
      porterId,
      cancelledCount: result.count,
    });
  }

  /**
   * Handle OrderAssigned event
   * Close bidding windows for assigned orders (if not already closed)
   */
  private async handleOrderAssigned(event: any): Promise<void> {
    const { orderId, correlationId } = event;

    logger.info('Handling OrderAssigned', { orderId, correlationId });

    // Find and close bidding windows for this order
    const windows = await this.prisma.biddingWindow.findMany({
      where: {
        orderIds: { has: orderId },
        status: 'OPEN',
      },
    });

    if (windows.length === 0) {
      logger.debug('No active bidding windows for assigned order', { orderId });
      return;
    }

    const now = new Date();

    for (const window of windows) {
      await this.prisma.$transaction([
        this.prisma.biddingWindow.update({
          where: { id: window.id },
          data: {
            status: 'CLOSED',
            closedAt: now,
          },
        }),
        this.prisma.bid.updateMany({
          where: {
            biddingWindowId: window.id,
            status: 'PLACED',
          },
          data: {
            status: 'EXPIRED',
            expiredAt: now,
          },
        }),
      ]);

      logger.info('Bidding window closed due to order assignment', {
        windowId: window.id,
        orderId,
      });
    }
  }

  /**
   * Handle OrderCompleted event
   * Cleanup and archive bidding data if needed
   */
  private async handleOrderCompleted(event: any): Promise<void> {
    const { orderId, correlationId } = event;

    logger.debug('Handling OrderCompleted', { orderId, correlationId });

    // Optional: Trigger archival or cleanup tasks
    // For now, just log
  }
}

/**
 * Singleton instance
 */
export const eventConsumer = new EventConsumer();
