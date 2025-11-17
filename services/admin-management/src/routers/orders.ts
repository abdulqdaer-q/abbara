import { router, protectedProcedure } from '../trpc';
import { ViewOrdersInputSchema, UpdateOrderAdminInputSchema, OrderSummarySchema } from '../types/schemas';
import { requirePermission, Permission } from '../middleware/rbac';
import { prisma } from '../lib/prisma';
import { auditService } from '../services/auditService';
import { eventBus } from '../lib/eventBus';
import { AdminEventType } from '../types/events';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';

export const ordersRouter = router({
  /**
   * View orders with filters
   */
  list: protectedProcedure
    .input(ViewOrdersInputSchema)
    .query(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.VIEW_ORDERS);

      const { status, customerId, porterId, dateFrom, dateTo, page, limit } = input;

      const where: any = {};

      if (status) where.status = status;
      if (customerId) where.userId = customerId;
      if (porterId) where.assignedPorters = { has: porterId };

      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = dateFrom;
        if (dateTo) where.createdAt.lte = dateTo;
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);

      return {
        orders,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    }),

  /**
   * Get order details
   */
  get: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .output(OrderSummarySchema)
    .query(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.VIEW_ORDERS);

      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
      });

      if (!order) {
        throw new NotFoundError('Order', input.orderId);
      }

      return order;
    }),

  /**
   * Update order (admin intervention)
   */
  update: protectedProcedure
    .input(UpdateOrderAdminInputSchema)
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.UPDATE_ORDER);

      const { orderId, status, assignedPorters, specialInstructions, reason } = input;

      // Get current order
      const current = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!current) {
        throw new NotFoundError('Order', orderId);
      }

      // Build update data
      const updateData: any = {};
      if (status) updateData.status = status;
      if (assignedPorters) updateData.assignedPorters = assignedPorters;

      // Update order
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: updateData,
      });

      // Create audit log
      await auditService.createAuditLog({
        actorId: ctx.admin.userId,
        targetEntityType: 'Order',
        targetEntityId: orderId,
        action: 'ADMIN_UPDATE',
        oldValue: current,
        newValue: { ...updated, reason, specialInstructions },
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      // Publish event
      await eventBus.publish({
        type: AdminEventType.ORDER_UPDATED,
        timestamp: new Date(),
        correlationId: ctx.correlationId,
        actorId: ctx.admin.userId,
        orderId,
        userId: current.userId,
        changes: updateData,
        reason,
      });

      return {
        success: true,
        message: `Order updated successfully`,
      };
    }),
});
