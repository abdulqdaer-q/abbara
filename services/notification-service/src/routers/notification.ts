import { router, protectedProcedure } from '../trpc';
import {
  SendNotificationInputSchema,
  GetNotificationHistoryInputSchema,
  MarkNotificationsReadInputSchema,
  GetNotificationByIdInputSchema,
} from '../types/zodSchemas';
import { NotificationDeliveryService } from '../services/notificationDeliveryService';
import { PushNotificationService } from '../services/pushNotificationService';
import { EmailService } from '../services/emailService';
import { SmsService } from '../services/smsService';
import { NotFoundError } from '../lib/errors';

export const notificationRouter = router({
  /**
   * Send a notification to one or more recipients
   */
  send: protectedProcedure
    .input(SendNotificationInputSchema)
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Sending notification', { input, userId: ctx.user.id });

      // Initialize services
      const pushService = new PushNotificationService(ctx.db, ctx.logger);
      const emailService = new EmailService(ctx.db, ctx.logger);
      const smsService = new SmsService(ctx.db, ctx.logger);
      const deliveryService = new NotificationDeliveryService(
        ctx.db,
        ctx.logger,
        pushService,
        emailService,
        smsService
      );

      // Prepare recipient IDs
      const recipientIds = input.recipientId
        ? [input.recipientId]
        : input.recipientIds || [];

      // Send notification
      const results = await deliveryService.sendNotification({
        recipientIds,
        channels: input.channels,
        messageType: input.messageType,
        payload: input.payload,
        priority: input.priority || 1,
        metadata: input.metadata,
        idempotencyKey: input.idempotencyKey,
        correlationId: ctx.correlationId,
      });

      ctx.logger.info('Notification sent successfully', {
        results,
        correlationId: ctx.correlationId,
      });

      return {
        success: true,
        notifications: results,
      };
    }),

  /**
   * Get notification history for the current user
   */
  getHistory: protectedProcedure
    .input(GetNotificationHistoryInputSchema)
    .query(async ({ input, ctx }) => {
      ctx.logger.info('Getting notification history', { input, userId: ctx.user.id });

      // Ensure user can only view their own notifications
      // unless they have admin role
      const userId = ctx.user.role === 'admin' || ctx.user.role === 'superadmin'
        ? input.userId
        : ctx.user.id;

      const where: {
        recipientId: string;
        messageType?: string;
        status?: string;
        createdAt?: {
          gte?: Date;
          lte?: Date;
        };
      } = {
        recipientId: userId,
      };

      if (input.messageType) {
        where.messageType = input.messageType;
      }

      if (input.status) {
        where.status = input.status;
      }

      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) {
          where.createdAt.gte = input.startDate;
        }
        if (input.endDate) {
          where.createdAt.lte = input.endDate;
        }
      }

      const [notifications, total] = await Promise.all([
        ctx.db.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          skip: input.offset,
          select: {
            id: true,
            messageType: true,
            payload: true,
            priority: true,
            status: true,
            createdAt: true,
            sentAt: true,
            deliveredAt: true,
            readAt: true,
            channels: true,
          },
        }),
        ctx.db.notification.count({ where }),
      ]);

      return {
        notifications,
        total,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /**
   * Mark notifications as read
   */
  markAsRead: protectedProcedure
    .input(MarkNotificationsReadInputSchema)
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Marking notifications as read', {
        notificationIds: input.notificationIds,
        userId: ctx.user.id,
      });

      // Update notifications to mark as read
      // Only allow users to mark their own notifications as read
      const result = await ctx.db.notification.updateMany({
        where: {
          id: { in: input.notificationIds },
          recipientId: ctx.user.id,
        },
        data: {
          status: 'read',
          readAt: new Date(),
        },
      });

      ctx.logger.info('Notifications marked as read', {
        count: result.count,
        correlationId: ctx.correlationId,
      });

      return {
        success: true,
        updatedCount: result.count,
      };
    }),

  /**
   * Get a specific notification by ID
   */
  getById: protectedProcedure
    .input(GetNotificationByIdInputSchema)
    .query(async ({ input, ctx }) => {
      ctx.logger.info('Getting notification by ID', {
        notificationId: input.notificationId,
        userId: ctx.user.id,
      });

      const notification = await ctx.db.notification.findUnique({
        where: { id: input.notificationId },
        include: {
          deliveryAudits: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!notification) {
        throw new NotFoundError('Notification', input.notificationId);
      }

      // Ensure user can only view their own notifications
      // unless they have admin role
      if (
        notification.recipientId !== ctx.user.id &&
        ctx.user.role !== 'admin' &&
        ctx.user.role !== 'superadmin'
      ) {
        throw new NotFoundError('Notification', input.notificationId);
      }

      return notification;
    }),

  /**
   * Get unread notification count for current user
   */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    ctx.logger.info('Getting unread notification count', { userId: ctx.user.id });

    const count = await ctx.db.notification.count({
      where: {
        recipientId: ctx.user.id,
        status: { not: 'read' },
      },
    });

    return { count };
  }),
});
