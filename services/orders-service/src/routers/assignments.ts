import { router, publicProcedure } from '../trpc';
import { prisma } from '../lib/prisma';
import { getKafkaClient } from '../lib/kafka';
import { requireAuth, requirePorter } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import {
  AssignPortersInputSchema,
  AcceptOfferInputSchema,
  RejectOfferInputSchema,
} from '@movenow/common';
import {
  OrderAssignedEvent,
  PorterOfferedEvent,
  OrderEventType,
} from '@movenow/common';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  OrderNotFoundError,
  AssignmentNotFoundError,
  OfferExpiredError,
  OfferAlreadyAcceptedError,
} from '../lib/errors';
import { porterAssignmentCounter, porterOfferAcceptanceTime } from '../lib/metrics';
import { addMinutes } from 'date-fns';

export const assignmentsRouter = router({
  /**
   * Assign porters to an order
   */
  assignPorters: publicProcedure
    .use(requireAuth)
    .use(idempotency)
    .input(AssignPortersInputSchema)
    .mutation(async ({ input, ctx }) => {
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
      });

      if (!order) {
        throw new OrderNotFoundError(input.orderId);
      }

      const expiresAt = addMinutes(new Date(), input.offerExpiryMinutes);

      const assignments = await prisma.$transaction(async (tx) => {
        const created = [];

        if (input.strategy === 'direct' && input.porterIds) {
          // Direct assignment - immediately assign to specified porters
          for (const porterId of input.porterIds) {
            const assignment = await tx.orderAssignment.create({
              data: {
                orderId: input.orderId,
                porterId,
                status: input.autoAssign ? 'ACCEPTED' : 'TENTATIVE',
                offeredAt: new Date(),
                acceptedAt: input.autoAssign ? new Date() : null,
                expiresAt: null, // Direct assignments don't expire
              },
            });
            created.push(assignment);
          }

          // Update order status
          await tx.order.update({
            where: { id: input.orderId },
            data: {
              status: input.autoAssign ? 'ACCEPTED' : 'TENTATIVELY_ASSIGNED',
              porterCountAssigned: input.porterIds.length,
            },
          });
        } else if (input.strategy === 'offer' && input.porterIds) {
          // Offer to multiple porters - first to accept wins
          for (const porterId of input.porterIds) {
            const assignment = await tx.orderAssignment.create({
              data: {
                orderId: input.orderId,
                porterId,
                status: 'OFFERED',
                offeredAt: new Date(),
                expiresAt,
              },
            });
            created.push(assignment);

            // Publish PorterOffered event for each porter
            const offerEvent: PorterOfferedEvent = {
              type: OrderEventType.PORTER_OFFERED,
              eventId: nanoid(),
              timestamp: new Date().toISOString(),
              correlationId: ctx.correlationId,
              orderId: input.orderId,
              porterId,
              offeredAt: new Date().toISOString(),
              expiresAt: expiresAt.toISOString(),
            };

            const kafka = getKafkaClient();
            await kafka.publishEvent(offerEvent);
          }

          // Update order status
          await tx.order.update({
            where: { id: input.orderId },
            data: {
              status: 'TENTATIVELY_ASSIGNED',
            },
          });
        }

        // Record assignment event
        await tx.orderEvent.create({
          data: {
            orderId: input.orderId,
            eventType: 'OFFER_SENT',
            payload: {
              strategy: input.strategy,
              porterIds: input.porterIds,
              expiresAt: expiresAt.toISOString(),
            },
            actorId: ctx.user?.userId,
            actorType: ctx.user?.role || 'system',
            correlationId: ctx.correlationId,
          },
        });

        return created;
      });

      // Publish OrderAssigned event
      const assignedEvent: OrderAssignedEvent = {
        type: OrderEventType.ORDER_ASSIGNED,
        eventId: nanoid(),
        timestamp: new Date().toISOString(),
        correlationId: ctx.correlationId,
        orderId: input.orderId,
        customerId: order.customerId,
        assignments: assignments.map((a) => ({
          porterId: a.porterId,
          status: a.status as any,
          assignedAt: a.offeredAt.toISOString(),
        })),
        porterCountAssigned: assignments.length,
      };

      const kafka = getKafkaClient();
      await kafka.publishEvent(assignedEvent);

      // Update metrics
      porterAssignmentCounter.inc({
        status: input.autoAssign ? 'ACCEPTED' : 'OFFERED',
        strategy: input.strategy,
      });

      return {
        orderId: input.orderId,
        assignments: assignments.map((a) => ({
          porterId: a.porterId,
          status: a.status,
          offeredAt: a.offeredAt.toISOString(),
          expiresAt: a.expiresAt?.toISOString(),
        })),
        message: `Successfully ${input.strategy === 'direct' ? 'assigned' : 'offered'} to ${assignments.length} porter(s)`,
      };
    }),

  /**
   * Porter accepts an offer
   */
  acceptOffer: publicProcedure
    .use(requirePorter)
    .use(idempotency)
    .input(AcceptOfferInputSchema)
    .mutation(async ({ input, ctx }) => {
      const assignment = await prisma.orderAssignment.findUnique({
        where: {
          orderId_porterId: {
            orderId: input.orderId,
            porterId: input.porterId,
          },
        },
        include: {
          order: true,
        },
      });

      if (!assignment) {
        throw new AssignmentNotFoundError(input.orderId, input.porterId);
      }

      // Check if offer has expired
      if (assignment.expiresAt && assignment.expiresAt < new Date()) {
        throw new OfferExpiredError(input.orderId, input.porterId);
      }

      // Check if already accepted by someone else
      const existingAcceptance = await prisma.orderAssignment.findFirst({
        where: {
          orderId: input.orderId,
          status: 'ACCEPTED',
        },
      });

      if (existingAcceptance && existingAcceptance.porterId !== input.porterId) {
        throw new OfferAlreadyAcceptedError(input.orderId);
      }

      const offerTime = Date.now() - assignment.offeredAt.getTime();

      const result = await prisma.$transaction(async (tx) => {
        // Accept this assignment
        const accepted = await tx.orderAssignment.update({
          where: {
            orderId_porterId: {
              orderId: input.orderId,
              porterId: input.porterId,
            },
          },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
            deviceId: input.deviceId,
            sessionId: input.sessionId,
          },
        });

        // Revoke other pending offers for this order
        await tx.orderAssignment.updateMany({
          where: {
            orderId: input.orderId,
            porterId: { not: input.porterId },
            status: 'OFFERED',
          },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
          },
        });

        // Update order status
        await tx.order.update({
          where: { id: input.orderId },
          data: {
            status: 'ACCEPTED',
            porterCountAssigned: 1,
          },
        });

        // Record acceptance event
        await tx.orderEvent.create({
          data: {
            orderId: input.orderId,
            eventType: 'ACCEPTED',
            payload: {
              porterId: input.porterId,
              acceptanceTimeMs: offerTime,
            },
            actorId: input.porterId,
            actorType: 'porter',
            correlationId: ctx.correlationId,
          },
        });

        return accepted;
      });

      // Update metrics
      porterOfferAcceptanceTime.observe(offerTime / 1000);

      return {
        orderId: input.orderId,
        porterId: input.porterId,
        status: 'ACCEPTED',
        acceptedAt: result.acceptedAt!.toISOString(),
        message: 'Offer accepted successfully',
      };
    }),

  /**
   * Porter rejects an offer
   */
  rejectOffer: publicProcedure
    .use(requirePorter)
    .use(idempotency)
    .input(RejectOfferInputSchema)
    .mutation(async ({ input, ctx }) => {
      const assignment = await prisma.orderAssignment.findUnique({
        where: {
          orderId_porterId: {
            orderId: input.orderId,
            porterId: input.porterId,
          },
        },
      });

      if (!assignment) {
        throw new AssignmentNotFoundError(input.orderId, input.porterId);
      }

      await prisma.$transaction(async (tx) => {
        // Reject this assignment
        await tx.orderAssignment.update({
          where: {
            orderId_porterId: {
              orderId: input.orderId,
              porterId: input.porterId,
            },
          },
          data: {
            status: 'REJECTED',
            rejectedAt: new Date(),
            rejectionReason: input.reason,
          },
        });

        // Record rejection event
        await tx.orderEvent.create({
          data: {
            orderId: input.orderId,
            eventType: 'REJECTED',
            payload: {
              porterId: input.porterId,
              reason: input.reason,
            },
            actorId: input.porterId,
            actorType: 'porter',
            correlationId: ctx.correlationId,
          },
        });
      });

      return {
        orderId: input.orderId,
        porterId: input.porterId,
        status: 'REJECTED',
        message: 'Offer rejected',
      };
    }),

  /**
   * Get assignments for an order
   */
  getOrderAssignments: publicProcedure
    .use(requireAuth)
    .input(z.object({ orderId: z.string() }))
    .query(async ({ input }) => {
      const assignments = await prisma.orderAssignment.findMany({
        where: { orderId: input.orderId },
        orderBy: { offeredAt: 'desc' },
      });

      return {
        orderId: input.orderId,
        assignments: assignments.map((a) => ({
          porterId: a.porterId,
          status: a.status,
          offeredAt: a.offeredAt.toISOString(),
          acceptedAt: a.acceptedAt?.toISOString(),
          rejectedAt: a.rejectedAt?.toISOString(),
          revokedAt: a.revokedAt?.toISOString(),
          expiresAt: a.expiresAt?.toISOString(),
          rejectionReason: a.rejectionReason,
          earningsCents: a.earningsCents,
        })),
      };
    }),
});
