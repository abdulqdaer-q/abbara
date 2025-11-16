import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import {
  recordOfferCreated,
  recordOfferAccepted,
  recordOfferRejected,
  recordOfferExpired,
  recordRaceCondition,
} from '../lib/metrics';
import { getKafkaClient } from '../lib/kafka';
import {
  EventType,
  PorterOfferCreatedEvent,
  PorterAcceptedJobEvent,
  PorterRejectedJobEvent,
} from '@movenow/common';
import { getCorrelationId } from '../lib/correlation';
import { throwConflict, throwNotFound } from '../lib/errors';
import { withIdempotency } from '../lib/idempotency';
import { OfferStatus, AssignmentStatus } from '@prisma/client';

export class JobOfferService {
  private offerTimeoutSeconds: number;
  private maxConcurrentOffers: number;

  constructor() {
    this.offerTimeoutSeconds = parseInt(process.env.JOB_OFFER_TIMEOUT_SECONDS || '30');
    this.maxConcurrentOffers = parseInt(process.env.MAX_CONCURRENT_OFFERS_PER_PORTER || '3');
  }

  /**
   * Create a new job offer for a porter
   */
  async createOffer(
    orderId: string,
    porterId: string,
    userId: string,
    metadata?: Record<string, unknown>
  ) {
    // Check concurrent offers limit
    const pendingOffers = await prisma.jobOffer.count({
      where: {
        porterId,
        offerStatus: OfferStatus.PENDING,
      },
    });

    if (pendingOffers >= this.maxConcurrentOffers) {
      logger.warn('Porter has too many pending offers', {
        porterId,
        pendingOffers,
        maxConcurrentOffers: this.maxConcurrentOffers,
      });
      throwConflict('Porter has too many pending offers');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.offerTimeoutSeconds * 1000);

    const offer = await prisma.jobOffer.create({
      data: {
        orderId,
        porterId,
        offerStatus: OfferStatus.PENDING,
        assignmentStatus: AssignmentStatus.PENDING,
        offeredAt: now,
        expiresAt,
        correlationId: getCorrelationId(),
        metadata: metadata as any,
      },
    });

    recordOfferCreated();

    logger.info('Job offer created', {
      offerId: offer.id,
      orderId,
      porterId,
      expiresAt,
    });

    // Publish event
    await this.publishOfferCreatedEvent(offer.id, orderId, porterId, expiresAt);

    return offer;
  }

  /**
   * Accept a job offer (race-safe with optimistic locking)
   */
  async acceptOffer(
    offerId: string,
    porterId: string,
    userId: string,
    idempotencyKey?: string
  ) {
    return await withIdempotency(
      idempotencyKey,
      userId,
      porterId,
      'acceptJob',
      async () => {
        // Use transaction with optimistic locking to handle race conditions
        const result = await prisma.$transaction(async (tx) => {
          // Lock the offer for update
          const offer = await tx.jobOffer.findUnique({
            where: { id: offerId },
          });

          if (!offer) {
            throwNotFound('Job offer', offerId);
          }

          // Verify the offer belongs to this porter
          if (offer.porterId !== porterId) {
            throwConflict('Offer does not belong to this porter');
          }

          // Check if offer is still pending
          if (offer.offerStatus !== OfferStatus.PENDING) {
            logger.warn('Offer already processed', {
              offerId,
              currentStatus: offer.offerStatus,
            });

            recordRaceCondition('lost');

            throwConflict(`Offer already ${offer.offerStatus.toLowerCase()}`, {
              currentStatus: offer.offerStatus,
            });
          }

          // Check if offer has expired
          if (offer.expiresAt < new Date()) {
            // Mark as expired
            await tx.jobOffer.update({
              where: { id: offerId },
              data: {
                offerStatus: OfferStatus.EXPIRED,
                expiredAt: new Date(),
              },
            });

            recordOfferExpired();
            throwConflict('Offer has expired');
          }

          // Check if order is already assigned to another porter
          const existingAssignment = await tx.jobOffer.findFirst({
            where: {
              orderId: offer.orderId,
              offerStatus: OfferStatus.ACCEPTED,
              assignmentStatus: AssignmentStatus.CONFIRMED,
            },
          });

          if (existingAssignment) {
            logger.warn('Order already assigned to another porter', {
              offerId,
              orderId: offer.orderId,
              assignedPorterId: existingAssignment.porterId,
            });

            // Revoke this offer
            await tx.jobOffer.update({
              where: { id: offerId },
              data: {
                offerStatus: OfferStatus.REVOKED,
                revokedAt: new Date(),
                revokeReason: 'Order assigned to another porter',
              },
            });

            recordRaceCondition('lost');

            throwConflict('Order already assigned to another porter');
          }

          // All checks passed - accept the offer atomically
          const updatedOffer = await tx.jobOffer.update({
            where: { id: offerId },
            data: {
              offerStatus: OfferStatus.ACCEPTED,
              acceptedAt: new Date(),
              assignmentStatus: AssignmentStatus.CONFIRMED,
              assignedAt: new Date(),
              confirmedAt: new Date(),
            },
          });

          recordOfferAccepted();
          recordRaceCondition('won');

          logger.info('Job offer accepted', {
            offerId,
            orderId: offer.orderId,
            porterId,
          });

          return updatedOffer;
        });

        // Publish acceptance event
        await this.publishOfferAcceptedEvent(result.id, result.orderId, porterId, userId);

        // Revoke other pending offers for this order
        await this.revokeOtherOffers(result.orderId, offerId);

        return result;
      }
    );
  }

  /**
   * Reject a job offer
   */
  async rejectOffer(
    offerId: string,
    porterId: string,
    reason?: string
  ) {
    const offer = await prisma.jobOffer.findUnique({
      where: { id: offerId },
    });

    if (!offer) {
      throwNotFound('Job offer', offerId);
    }

    if (offer.porterId !== porterId) {
      throwConflict('Offer does not belong to this porter');
    }

    if (offer.offerStatus !== OfferStatus.PENDING) {
      throwConflict(`Offer already ${offer.offerStatus.toLowerCase()}`);
    }

    const updatedOffer = await prisma.jobOffer.update({
      where: { id: offerId },
      data: {
        offerStatus: OfferStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    recordOfferRejected();

    logger.info('Job offer rejected', {
      offerId,
      porterId,
      reason,
    });

    // Publish rejection event
    await this.publishOfferRejectedEvent(offer.id, offer.orderId, porterId, reason);

    return updatedOffer;
  }

  /**
   * Expire offers that have passed their expiration time
   */
  async expireOffers(): Promise<number> {
    const expiredOffers = await prisma.jobOffer.updateMany({
      where: {
        offerStatus: OfferStatus.PENDING,
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        offerStatus: OfferStatus.EXPIRED,
        expiredAt: new Date(),
      },
    });

    if (expiredOffers.count > 0) {
      logger.info('Expired offers', { count: expiredOffers.count });
      recordOfferExpired();

      // TODO: Publish expiration events for each offer
    }

    return expiredOffers.count;
  }

  /**
   * Get offer by ID
   */
  async getOffer(offerId: string) {
    return await prisma.jobOffer.findUnique({
      where: { id: offerId },
    });
  }

  /**
   * Get offers for a porter
   */
  async getPorterOffers(porterId: string, status?: OfferStatus) {
    return await prisma.jobOffer.findMany({
      where: {
        porterId,
        ...(status && { offerStatus: status }),
      },
      orderBy: { offeredAt: 'desc' },
    });
  }

  /**
   * Get offers for an order
   */
  async getOrderOffers(orderId: string) {
    return await prisma.jobOffer.findMany({
      where: { orderId },
      orderBy: { offeredAt: 'desc' },
    });
  }

  /**
   * Revoke other pending offers for an order (after one is accepted)
   */
  private async revokeOtherOffers(orderId: string, acceptedOfferId: string): Promise<void> {
    await prisma.jobOffer.updateMany({
      where: {
        orderId,
        id: { not: acceptedOfferId },
        offerStatus: OfferStatus.PENDING,
      },
      data: {
        offerStatus: OfferStatus.REVOKED,
        revokedAt: new Date(),
        revokeReason: 'Order accepted by another porter',
      },
    });

    logger.info('Revoked other pending offers', { orderId, acceptedOfferId });
  }

  /**
   * Event publishing methods
   */
  private async publishOfferCreatedEvent(
    offerId: string,
    orderId: string,
    porterId: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      const kafka = getKafkaClient();
      const event: PorterOfferCreatedEvent = {
        type: EventType.PORTER_OFFER_CREATED,
        timestamp: new Date(),
        correlationId: getCorrelationId(),
        offerId,
        orderId,
        porterId,
        expiresAt,
      };
      await kafka.publishEvent(event);
    } catch (error) {
      logger.error('Failed to publish offer created event', { error, offerId });
    }
  }

  private async publishOfferAcceptedEvent(
    offerId: string,
    orderId: string,
    porterId: string,
    userId: string
  ): Promise<void> {
    try {
      const kafka = getKafkaClient();
      const event: PorterAcceptedJobEvent = {
        type: EventType.PORTER_ACCEPTED_JOB,
        timestamp: new Date(),
        correlationId: getCorrelationId(),
        userId,
        offerId,
        orderId,
        porterId,
      };
      await kafka.publishEvent(event);
    } catch (error) {
      logger.error('Failed to publish offer accepted event', { error, offerId });
    }
  }

  private async publishOfferRejectedEvent(
    offerId: string,
    orderId: string,
    porterId: string,
    reason?: string
  ): Promise<void> {
    try {
      const kafka = getKafkaClient();
      const event: PorterRejectedJobEvent = {
        type: EventType.PORTER_REJECTED_JOB,
        timestamp: new Date(),
        correlationId: getCorrelationId(),
        offerId,
        orderId,
        porterId,
        reason,
      };
      await kafka.publishEvent(event);
    } catch (error) {
      logger.error('Failed to publish offer rejected event', { error, offerId });
    }
  }
}

export default new JobOfferService();
