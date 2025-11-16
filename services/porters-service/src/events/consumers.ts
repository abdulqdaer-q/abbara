import { getKafkaClient } from '../lib/kafka';
import { EventType, PaymentPayoutProcessedEvent } from '@movenow/common';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { EarningStatus } from '@prisma/client';

/**
 * Initialize all event consumers
 */
export async function initEventConsumers() {
  const kafka = getKafkaClient();
  const groupId = process.env.KAFKA_GROUP_ID || 'porters-service-group';

  logger.info('Initializing event consumers');

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
