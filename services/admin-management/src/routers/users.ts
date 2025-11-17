import { router, protectedProcedure } from '../trpc';
import {
  ListUsersInputSchema,
  GetUserInputSchema,
  UpdateUserStatusInputSchema,
  UserSummarySchema,
  UserDetailSchema,
  PaginationMetaSchema,
} from '../types/schemas';
import { requirePermission, Permission } from '../middleware/rbac';
import { prisma } from '../lib/prisma';
import { auditService } from '../services/auditService';
import { eventBus } from '../lib/eventBus';
import { AdminEventType } from '../types/events';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';

export const usersRouter = router({
  /**
   * List users with filters and pagination
   */
  list: protectedProcedure
    .input(ListUsersInputSchema)
    .output(
      z.object({
        users: z.array(UserSummarySchema),
        pagination: PaginationMetaSchema,
      })
    )
    .query(async ({ input, ctx }) => {
      // Check permissions
      requirePermission(ctx.admin.role, Permission.VIEW_USERS);

      const {
        role,
        status,
        verificationStatus,
        searchQuery,
        registrationDateFrom,
        registrationDateTo,
        page,
        limit,
      } = input;

      // Build where clause
      const where: any = {};

      if (role) where.role = role;
      if (status) where.status = status;
      if (verificationStatus) where.verificationStatus = verificationStatus;

      if (searchQuery) {
        where.OR = [
          { email: { contains: searchQuery, mode: 'insensitive' } },
          { name: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      if (registrationDateFrom || registrationDateTo) {
        where.createdAt = {};
        if (registrationDateFrom) where.createdAt.gte = registrationDateFrom;
        if (registrationDateTo) where.createdAt.lte = registrationDateTo;
      }

      // Fetch users and total count
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            verificationStatus: true,
            createdAt: true,
            lastActiveAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      return {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    }),

  /**
   * Get detailed user information
   */
  get: protectedProcedure
    .input(GetUserInputSchema)
    .output(UserDetailSchema)
    .query(async ({ input, ctx }) => {
      // Check permissions
      requirePermission(ctx.admin.role, Permission.VIEW_USERS);

      const user = await prisma.user.findUnique({
        where: { id: input.userId },
      });

      if (!user) {
        throw new NotFoundError('User', input.userId);
      }

      // Get additional stats (mocked for now - would integrate with Order service)
      const totalOrders = await prisma.order.count({
        where: { userId: input.userId },
      });

      const completedOrders = await prisma.order.findMany({
        where: {
          userId: input.userId,
          status: 'COMPLETED',
        },
        select: { priceCents: true },
      });

      const totalSpent = completedOrders.reduce((sum, order) => sum + order.priceCents, 0);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        verificationStatus: user.verificationStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastActiveAt: user.lastActiveAt,
        walletBalance: user.walletBalance,
        totalOrders,
        totalSpent,
        averageRating: null, // Would be calculated from ratings
      };
    }),

  /**
   * Update user status
   */
  updateStatus: protectedProcedure
    .input(UpdateUserStatusInputSchema)
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Check permissions
      requirePermission(ctx.admin.role, Permission.UPDATE_USER_STATUS);

      const { userId, newStatus, reason } = input;

      // Get current user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundError('User', userId);
      }

      const oldStatus = user.status;

      // Update user status
      await prisma.user.update({
        where: { id: userId },
        data: { status: newStatus },
      });

      // Create audit log
      await auditService.createAuditLog({
        actorId: ctx.admin.userId,
        targetEntityType: 'User',
        targetEntityId: userId,
        action: 'UPDATE_STATUS',
        oldValue: { status: oldStatus },
        newValue: { status: newStatus, reason },
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      // Publish event
      await eventBus.publish({
        type: AdminEventType.USER_STATUS_UPDATED,
        timestamp: new Date(),
        correlationId: ctx.correlationId,
        actorId: ctx.admin.userId,
        userId,
        oldStatus,
        newStatus,
        reason,
      });

      return {
        success: true,
        message: `User status updated from ${oldStatus} to ${newStatus}`,
      };
    }),
});
