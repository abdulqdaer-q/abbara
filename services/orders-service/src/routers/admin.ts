import { router, publicProcedure } from '../trpc';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { AdminOverrideOrderInputSchema } from '@movenow/common';
import { z } from 'zod';
import { OrderNotFoundError } from '../lib/errors';

export const adminRouter = router({
  /**
   * Admin override order (force complete, force cancel, etc.)
   */
  overrideOrder: publicProcedure
    .use(requireAdmin)
    .use(idempotency)
    .input(AdminOverrideOrderInputSchema)
    .mutation(async ({ input, ctx }) => {
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
      });

      if (!order) {
        throw new OrderNotFoundError(input.orderId);
      }

      const result = await prisma.$transaction(async (tx) => {
        let updateData: any = {};

        switch (input.action) {
          case 'force_complete':
            updateData = {
              status: 'COMPLETED',
            };
            break;
          case 'force_cancel':
            updateData = {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancelledBy: input.adminId,
              cancellationReason: 'OTHER',
            };
            break;
          case 'reassign':
            // Handled separately
            break;
          case 'resolve_dispute':
            updateData = {
              isDisputed: false,
            };
            break;
        }

        const updated = await tx.order.update({
          where: { id: input.orderId },
          data: {
            ...updateData,
            version: order.version + 1,
          },
        });

        // Record admin action in audit trail
        await tx.orderEvent.create({
          data: {
            orderId: input.orderId,
            eventType: 'UPDATED',
            payload: {
              adminAction: input.action,
              reason: input.reason,
              newData: input.newData,
            },
            actorId: input.adminId,
            actorType: 'admin',
            correlationId: ctx.correlationId,
          },
        });

        return updated;
      });

      return {
        orderId: result.id,
        status: result.status,
        message: `Admin action '${input.action}' applied successfully`,
      };
    }),

  /**
   * Get order audit trail
   */
  getAuditTrail: publicProcedure
    .use(requireAdmin)
    .input(
      z.object({
        orderId: z.string(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input }) => {
      const events = await prisma.orderEvent.findMany({
        where: { orderId: input.orderId },
        orderBy: { createdAt: 'asc' },
        take: input.limit,
      });

      return {
        orderId: input.orderId,
        events: events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          payload: e.payload,
          actorId: e.actorId,
          actorType: e.actorType,
          correlationId: e.correlationId,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    }),

  /**
   * Get order statistics
   */
  getStatistics: publicProcedure
    .use(requireAdmin)
    .input(
      z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
    )
    .query(async ({ input }) => {
      const where: any = {};

      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) {
          where.createdAt.gte = new Date(input.startDate);
        }
        if (input.endDate) {
          where.createdAt.lte = new Date(input.endDate);
        }
      }

      const [total, byStatus, cancelled, completed] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        prisma.order.count({
          where: { ...where, status: 'CANCELLED' },
        }),
        prisma.order.count({
          where: { ...where, status: 'COMPLETED' },
        }),
      ]);

      return {
        total,
        byStatus: Object.fromEntries(
          byStatus.map((s) => [s.status, s._count])
        ),
        cancelled,
        completed,
        completionRate: total > 0 ? (completed / total) * 100 : 0,
        cancellationRate: total > 0 ? (cancelled / total) * 100 : 0,
      };
    }),
});
