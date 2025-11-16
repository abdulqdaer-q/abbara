import { getKafkaClient } from '../lib/kafka';
import { EventType, OrderAssignedEvent, OrderCompletedEvent, PaymentPayoutProcessedEvent } from '@movenow/common';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import earningsService from '../services/earningsService';
import { EarningType, EarningStatus } from '@prisma/client';

/**
 * Initialize all event consumers
 */
export async function initEventConsumers() {
  const kafka = getKafkaClient();
  const groupId = process.env.KAFKA_GROUP_ID || 'porters-service-group';

  logger.info('Initializing event consumers');

  /**
   * Consumer: Order Assigned
   * Purpose: Create job offers for the assigned order (if applicable)
   */
  await kafka.subscribe<OrderAssignedEvent>(
    [EventType.ORDER_ASSIGNED],
    `${groupId}-order-assigned`,
    async (event) => {
      logger.info('Processing OrderAssigned event', {
        orderId: event.orderId,
        porterId: event.porterId,
      });

      // Here you could update porter stats, send notifications, etc.
      // The actual offer should have been created before assignment
      // This is just to acknowledge the assignment

      try {
        await prisma.porterProfile.update({
          where: { id: event.porterId },
          data: {
            completedJobsCount: {
              increment: 0, // Will be incremented on completion
            },
          },
        });
      } catch (error) {
        logger.error('Error processing OrderAssigned event', { error, event });
      }
    }
  );

  /**
   * Consumer: Order Completed
   * Purpose: Record earnings for the porter
   */
  await kafka.subscribe<OrderCompletedEvent>(
    [EventType.ORDER_COMPLETED],
    `${groupId}-order-completed`,
    async (event) => {
      logger.info('Processing OrderCompleted event', {
        orderId: event.orderId,
        porterId: event.porterId,
      });

      try {
        // Find the accepted offer for this order
        const offer = await prisma.jobOffer.findFirst({
          where: {
            orderId: event.orderId,
            porterId: event.porterId,
            offerStatus: 'ACCEPTED',
          },
        });

        if (!offer) {
          logger.warn('No accepted offer found for completed order', {
            orderId: event.orderId,
            porterId: event.porterId,
          });
          return;
        }

        // TODO: Get actual earnings amount from payment/pricing service
        // For now, using a placeholder
        const earningsAmount = BigInt(1000); // $10.00

        // Record earnings
        await earningsService.recordEarnings(
          event.porterId,
          EarningType.JOB_PAYMENT,
          earningsAmount,
          event.orderId,
          'Job completion payment',
          {
            offerId: offer.id,
            completedAt: event.completedAt,
          }
        );

        // Update porter's completed jobs count
        await prisma.porterProfile.update({
          where: { id: event.porterId },
          data: {
            completedJobsCount: {
              increment: 1,
            },
          },
        });

        logger.info('Earnings recorded for completed order', {
          orderId: event.orderId,
          porterId: event.porterId,
          earningsAmount: earningsAmount.toString(),
        });
      } catch (error) {
        logger.error('Error processing OrderCompleted event', { error, event });
      }
    }
  );

  /**
   * Consumer: Payment Payout Processed
   * Purpose: Update withdrawal/payout status
   */
  await kafka.subscribe<PaymentPayoutProcessedEvent>(
    [EventType.PAYMENT_PAYOUT_PROCESSED],
    `${groupId}-payout-processed`,
    async (event) => {
      logger.info('Processing PaymentPayoutProcessed event', {
        payoutId: event.payoutId,
        porterId: event.porterId,
        status: event.status,
      });

      try {
        // Find earnings record with this payout ID
        const earnings = await prisma.porterEarnings.findMany({
          where: {
            payoutId: event.payoutId,
          },
        });

        if (earnings.length === 0) {
          logger.warn('No earnings found for payout', {
            payoutId: event.payoutId,
          });
          return;
        }

        // Update earnings status
        const newStatus =
          event.status === 'completed' ? EarningStatus.PAID_OUT : EarningStatus.PENDING;

        await prisma.porterEarnings.updateMany({
          where: {
            payoutId: event.payoutId,
          },
          data: {
            payoutStatus: event.status,
            status: newStatus,
            ...(event.status === 'completed' && { payoutAt: new Date() }),
          },
        });

        logger.info('Payout status updated', {
          payoutId: event.payoutId,
          count: earnings.length,
          status: event.status,
        });
      } catch (error) {
        logger.error('Error processing PaymentPayoutProcessed event', { error, event });
      }
    }
  );

  logger.info('Event consumers initialized');
}

export default initEventConsumers;
