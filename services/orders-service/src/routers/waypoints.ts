import { router, publicProcedure } from '../trpc';
import { prisma } from '../lib/prisma';
import { getKafkaClient } from '../lib/kafka';
import { requireAuth } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { UpdateWaypointStatusInputSchema, CreateEvidenceInputSchema } from '@movenow/common';
import { WaypointStatusChangedEvent, EvidenceUploadedEvent, OrderEventType } from '@movenow/common';
import { nanoid } from 'nanoid';
import { OrderNotFoundError } from '../lib/errors';

export const waypointsRouter = router({
  /**
   * Update waypoint status
   */
  updateStatus: publicProcedure
    .use(requireAuth)
    .use(idempotency)
    .input(UpdateWaypointStatusInputSchema)
    .mutation(async ({ input, ctx }) => {
      const waypoint = await prisma.orderStop.findUnique({
        where: { id: input.waypointId },
        include: { order: true },
      });

      if (!waypoint) {
        throw new Error(`Waypoint not found: ${input.waypointId}`);
      }

      const previousStatus = waypoint.status;
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        // Update waypoint status
        const updateData: any = {
          status: input.newStatus,
        };

        if (input.newStatus === 'ARRIVED') {
          updateData.arrivalTimestamp = now;
        } else if (input.newStatus === 'COMPLETED') {
          updateData.departureTimestamp = now;
        }

        await tx.orderStop.update({
          where: { id: input.waypointId },
          data: updateData,
        });

        // Record event
        await tx.orderEvent.create({
          data: {
            orderId: waypoint.orderId,
            eventType: 'WAYPOINT_UPDATED',
            payload: {
              waypointId: input.waypointId,
              waypointSequence: waypoint.sequence,
              previousStatus,
              newStatus: input.newStatus,
            },
            actorId: input.porterId,
            actorType: 'porter',
            correlationId: ctx.correlationId,
          },
        });
      });

      // Publish WaypointStatusChanged event
      const event: WaypointStatusChangedEvent = {
        type: OrderEventType.WAYPOINT_STATUS_CHANGED,
        eventId: nanoid(),
        timestamp: input.timestamp || new Date().toISOString(),
        correlationId: ctx.correlationId,
        orderId: waypoint.orderId,
        waypointId: input.waypointId,
        waypointSequence: waypoint.sequence,
        previousStatus: previousStatus as any,
        newStatus: input.newStatus as any,
        porterId: input.porterId,
      };

      const kafka = getKafkaClient();
      await kafka.publishEvent(event);

      return {
        waypointId: input.waypointId,
        orderId: waypoint.orderId,
        status: input.newStatus,
        timestamp: now.toISOString(),
      };
    }),
});

export const evidenceRouter = router({
  /**
   * Create evidence (upload photo/document)
   */
  create: publicProcedure
    .use(requireAuth)
    .use(idempotency)
    .input(CreateEvidenceInputSchema)
    .mutation(async ({ input, ctx }) => {
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
      });

      if (!order) {
        throw new OrderNotFoundError(input.orderId);
      }

      const evidence = await prisma.$transaction(async (tx) => {
        const created = await tx.orderEvidence.create({
          data: {
            orderId: input.orderId,
            type: input.type,
            url: input.url,
            checksum: input.checksum,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            description: input.description,
            uploadedBy: input.uploadedBy,
            metadata: input.metadata || {},
          },
        });

        // Record event
        await tx.orderEvent.create({
          data: {
            orderId: input.orderId,
            eventType: 'EVIDENCE_UPLOADED',
            payload: {
              evidenceId: created.id,
              type: input.type,
            },
            actorId: input.uploadedBy,
            actorType: 'porter', // Typically porters upload evidence
            correlationId: ctx.correlationId,
          },
        });

        return created;
      });

      // Publish EvidenceUploaded event
      const event: EvidenceUploadedEvent = {
        type: OrderEventType.EVIDENCE_UPLOADED,
        eventId: nanoid(),
        timestamp: new Date().toISOString(),
        correlationId: ctx.correlationId,
        orderId: input.orderId,
        evidenceId: evidence.id,
        evidenceType: input.type,
        url: input.url,
        checksum: input.checksum,
        uploadedBy: input.uploadedBy,
        uploadedAt: evidence.uploadedAt.toISOString(),
      };

      const kafka = getKafkaClient();
      await kafka.publishEvent(event);

      return {
        evidenceId: evidence.id,
        orderId: input.orderId,
        type: input.type,
        uploadedAt: evidence.uploadedAt.toISOString(),
      };
    }),
});
