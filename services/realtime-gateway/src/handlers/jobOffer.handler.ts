import { Server } from 'socket.io';
import {
  SocketEvent,
  JobOfferPayload,
  JobOfferResponsePayload,
  JobOfferResponsePayloadSchema,
} from '@movenow/common';
import { AuthenticatedSocket, JobOffer } from '../types';
import { redisService } from '../services/redis.service';
import { kafkaService } from '../services/kafka.service';
import { metricsService } from '../services/metrics.service';
import { createLogger } from '../lib/logger';
import { config } from '../config';

export class JobOfferHandler {
  constructor(private io: Server) {}

  /**
   * Send job offer to porter
   */
  async sendJobOffer(porterId: string, offer: JobOfferPayload): Promise<void> {
    const log = createLogger({ correlationId: offer.orderId });

    try {
      // Store offer in Redis
      const jobOffer: JobOffer = {
        offerId: offer.offerId,
        orderId: offer.orderId,
        porterId: porterId,
        createdAt: Date.now(),
        expiresAt: offer.expiresAt,
        status: 'pending',
      };

      await redisService.storeJobOffer(offer.offerId, jobOffer);

      // Get porter's socket IDs
      const sockets = await redisService.getUserSockets(porterId);

      if (sockets.length === 0) {
        log.warn('Porter not online for job offer', { porterId });
        metricsService.recordDeliveryFailure(SocketEvent.JOB_OFFER_RECEIVED);
        return;
      }

      // Send offer to all porter's sockets
      for (const socketId of sockets) {
        this.io.to(socketId).emit(SocketEvent.JOB_OFFER_RECEIVED, offer);
      }

      log.info('Job offer sent to porter', {
        porterId,
        offerId: offer.offerId,
        orderId: offer.orderId,
      });

      metricsService.recordJobOffer('sent');
      metricsService.recordMessageSent('porter', SocketEvent.JOB_OFFER_RECEIVED);

      // Schedule expiration check
      this.scheduleOfferExpiration(offer.offerId, offer.expiresAt);
    } catch (error) {
      log.error('Error sending job offer', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      metricsService.recordDeliveryFailure(SocketEvent.JOB_OFFER_RECEIVED);
    }
  }

  /**
   * Handle job offer acceptance
   */
  async handleAcceptOffer(
    socket: AuthenticatedSocket,
    payload: JobOfferResponsePayload
  ): Promise<void> {
    const log = createLogger({
      correlationId: socket.correlationId,
      socketId: socket.id,
      userId: socket.userId,
    });

    try {
      // Validate role
      if (socket.role !== 'PORTER') {
        socket.emit(SocketEvent.JOB_OFFER_ERROR, {
          error: 'FORBIDDEN',
          message: 'Only porters can accept job offers',
        });
        return;
      }

      // Validate payload
      const result = JobOfferResponsePayloadSchema.safeParse(payload);
      if (!result.success) {
        socket.emit(SocketEvent.JOB_OFFER_ERROR, {
          error: 'INVALID_PAYLOAD',
          message: result.error.message,
        });
        return;
      }

      const { offerId, orderId } = result.data;

      // Get offer from Redis
      const offer = await redisService.getJobOffer(offerId);

      if (!offer) {
        socket.emit(SocketEvent.JOB_OFFER_ERROR, {
          error: 'OFFER_NOT_FOUND',
          message: 'Job offer not found or expired',
        });
        return;
      }

      // Verify porter is the intended recipient
      if (offer.porterId !== socket.userId) {
        socket.emit(SocketEvent.JOB_OFFER_ERROR, {
          error: 'FORBIDDEN',
          message: 'This offer is not for you',
        });
        return;
      }

      // Check if already accepted/rejected
      if (offer.status !== 'pending') {
        socket.emit(SocketEvent.JOB_OFFER_ERROR, {
          error: 'OFFER_ALREADY_PROCESSED',
          message: `Offer already ${offer.status}`,
        });
        return;
      }

      // Check expiration
      if (Date.now() > offer.expiresAt) {
        socket.emit(SocketEvent.JOB_OFFER_ERROR, {
          error: 'OFFER_EXPIRED',
          message: 'Job offer has expired',
        });
        await redisService.removeJobOffer(offerId);
        return;
      }

      // Update offer status
      offer.status = 'accepted';
      await redisService.storeJobOffer(offerId, offer);

      // Publish acceptance to Kafka for order assignment
      await kafkaService.publish(config.topics.porterEvents, {
        type: 'job.offer.accepted',
        timestamp: Date.now(),
        correlationId: socket.correlationId,
        payload: {
          offerId,
          orderId,
          porterId: socket.userId,
          acceptedAt: Date.now(),
        },
      });

      log.info('Job offer accepted', {
        offerId,
        orderId,
      });

      // Acknowledge acceptance
      socket.emit(SocketEvent.JOB_OFFER_ACCEPTED, {
        success: true,
        offerId,
        orderId,
      });

      metricsService.recordJobOffer('accepted');
    } catch (error) {
      log.error('Error handling job offer acceptance', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      socket.emit(SocketEvent.JOB_OFFER_ERROR, {
        error: 'INTERNAL_ERROR',
        message: 'Failed to accept job offer',
      });
    }
  }

  /**
   * Handle job offer rejection
   */
  async handleRejectOffer(
    socket: AuthenticatedSocket,
    payload: JobOfferResponsePayload
  ): Promise<void> {
    const log = createLogger({
      correlationId: socket.correlationId,
      socketId: socket.id,
      userId: socket.userId,
    });

    try {
      // Validate role
      if (socket.role !== 'PORTER') {
        socket.emit(SocketEvent.JOB_OFFER_ERROR, {
          error: 'FORBIDDEN',
          message: 'Only porters can reject job offers',
        });
        return;
      }

      // Validate payload
      const result = JobOfferResponsePayloadSchema.safeParse(payload);
      if (!result.success) {
        socket.emit(SocketEvent.JOB_OFFER_ERROR, {
          error: 'INVALID_PAYLOAD',
          message: result.error.message,
        });
        return;
      }

      const { offerId, orderId } = result.data;

      // Get offer from Redis
      const offer = await redisService.getJobOffer(offerId);

      if (!offer) {
        socket.emit(SocketEvent.JOB_OFFER_ERROR, {
          error: 'OFFER_NOT_FOUND',
          message: 'Job offer not found or expired',
        });
        return;
      }

      // Verify porter is the intended recipient
      if (offer.porterId !== socket.userId) {
        socket.emit(SocketEvent.JOB_OFFER_ERROR, {
          error: 'FORBIDDEN',
          message: 'This offer is not for you',
        });
        return;
      }

      // Update offer status
      offer.status = 'rejected';
      await redisService.storeJobOffer(offerId, offer);

      // Publish rejection to Kafka
      await kafkaService.publish(config.topics.porterEvents, {
        type: 'job.offer.rejected',
        timestamp: Date.now(),
        correlationId: socket.correlationId,
        payload: {
          offerId,
          orderId,
          porterId: socket.userId,
          rejectedAt: Date.now(),
        },
      });

      log.info('Job offer rejected', {
        offerId,
        orderId,
      });

      // Acknowledge rejection
      socket.emit(SocketEvent.JOB_OFFER_REJECTED, {
        success: true,
        offerId,
        orderId,
      });

      metricsService.recordJobOffer('rejected');

      // Clean up offer
      await redisService.removeJobOffer(offerId);
    } catch (error) {
      log.error('Error handling job offer rejection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      socket.emit(SocketEvent.JOB_OFFER_ERROR, {
        error: 'INTERNAL_ERROR',
        message: 'Failed to reject job offer',
      });
    }
  }

  /**
   * Schedule offer expiration check
   */
  private scheduleOfferExpiration(offerId: string, expiresAt: number): void {
    const delay = expiresAt - Date.now();

    if (delay <= 0) {
      return;
    }

    setTimeout(async () => {
      try {
        const offer = await redisService.getJobOffer(offerId);

        if (offer && offer.status === 'pending') {
          offer.status = 'expired';
          await redisService.storeJobOffer(offerId, offer);

          // Publish expiration event
          await kafkaService.publish(config.topics.porterEvents, {
            type: 'job.offer.expired',
            timestamp: Date.now(),
            correlationId: offerId,
            payload: {
              offerId,
              orderId: offer.orderId,
              porterId: offer.porterId,
            },
          });

          metricsService.recordJobOffer('expired');
        }
      } catch (error) {
        createLogger({ correlationId: offerId }).error('Error handling offer expiration', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, delay);
  }
}
