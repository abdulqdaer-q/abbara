import { router, protectedProcedure } from '../trpc';
import {
  CreatePromoCodeInputSchema,
  UpdatePromoCodeInputSchema,
  DeletePromoCodeInputSchema,
  PromoCodeSchema,
} from '../types/schemas';
import { requirePermission, Permission } from '../middleware/rbac';
import { prisma } from '../lib/prisma';
import { auditService } from '../services/auditService';
import { eventBus } from '../lib/eventBus';
import { AdminEventType } from '../types/events';
import { NotFoundError, ConflictError, OptimisticLockError } from '../lib/errors';
import { z } from 'zod';

export const promoCodesRouter = router({
  /**
   * List all promo codes
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const { status, page, limit } = input;

      const where: any = {};
      if (status) where.status = status;

      const [promoCodes, total] = await Promise.all([
        prisma.promoCode.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.promoCode.count({ where }),
      ]);

      return {
        promoCodes,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    }),

  /**
   * Create a new promo code
   */
  create: protectedProcedure
    .input(CreatePromoCodeInputSchema)
    .output(PromoCodeSchema)
    .mutation(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.CREATE_PROMO_CODE);

      // Check if promo code already exists
      const existing = await prisma.promoCode.findUnique({
        where: { code: input.code },
      });

      if (existing) {
        throw new ConflictError(`Promo code '${input.code}' already exists`);
      }

      // Create promo code
      const promoCode = await prisma.promoCode.create({
        data: {
          ...input,
          createdBy: ctx.admin.userId,
          status: 'ACTIVE',
        },
      });

      // Create audit log
      await auditService.createAuditLog({
        actorId: ctx.admin.userId,
        targetEntityType: 'PromoCode',
        targetEntityId: promoCode.id,
        action: 'CREATE',
        newValue: promoCode,
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      // Publish event
      await eventBus.publish({
        type: AdminEventType.PROMO_CODE_CREATED,
        timestamp: new Date(),
        correlationId: ctx.correlationId,
        actorId: ctx.admin.userId,
        promoCodeId: promoCode.id,
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        eligibleRoles: promoCode.eligibleRoles,
        startDate: promoCode.startDate,
        endDate: promoCode.endDate,
      });

      return promoCode;
    }),

  /**
   * Update promo code
   */
  update: protectedProcedure
    .input(UpdatePromoCodeInputSchema)
    .output(PromoCodeSchema)
    .mutation(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.UPDATE_PROMO_CODE);

      const { promoCodeId, version, ...updates } = input;

      // Get current promo code
      const current = await prisma.promoCode.findUnique({
        where: { id: promoCodeId },
      });

      if (!current) {
        throw new NotFoundError('Promo Code', promoCodeId);
      }

      // Optimistic locking check
      if (current.version !== version) {
        throw new OptimisticLockError('Promo Code');
      }

      // Update promo code
      const updated = await prisma.promoCode.update({
        where: { id: promoCodeId },
        data: {
          ...updates,
          version: { increment: 1 },
        },
      });

      // Create audit log
      await auditService.createAuditLog({
        actorId: ctx.admin.userId,
        targetEntityType: 'PromoCode',
        targetEntityId: promoCodeId,
        action: 'UPDATE',
        oldValue: current,
        newValue: updated,
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      // Publish event
      await eventBus.publish({
        type: AdminEventType.PROMO_CODE_UPDATED,
        timestamp: new Date(),
        correlationId: ctx.correlationId,
        actorId: ctx.admin.userId,
        promoCodeId: updated.id,
        code: updated.code,
        changes: updates,
      });

      return updated;
    }),

  /**
   * Disable promo code
   */
  disable: protectedProcedure
    .input(DeletePromoCodeInputSchema)
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.DELETE_PROMO_CODE);

      const { promoCodeId } = input;

      // Get promo code
      const promoCode = await prisma.promoCode.findUnique({
        where: { id: promoCodeId },
      });

      if (!promoCode) {
        throw new NotFoundError('Promo Code', promoCodeId);
      }

      // Disable promo code
      await prisma.promoCode.update({
        where: { id: promoCodeId },
        data: { status: 'INACTIVE' },
      });

      // Create audit log
      await auditService.createAuditLog({
        actorId: ctx.admin.userId,
        targetEntityType: 'PromoCode',
        targetEntityId: promoCodeId,
        action: 'DISABLE',
        oldValue: promoCode,
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      // Publish event
      await eventBus.publish({
        type: AdminEventType.PROMO_CODE_DISABLED,
        timestamp: new Date(),
        correlationId: ctx.correlationId,
        actorId: ctx.admin.userId,
        promoCodeId,
        code: promoCode.code,
      });

      return {
        success: true,
        message: `Promo code '${promoCode.code}' disabled successfully`,
      };
    }),
});
