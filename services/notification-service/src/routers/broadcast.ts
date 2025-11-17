import { router, adminProcedure } from '../trpc';
import { SendBroadcastInputSchema } from '../types/zodSchemas';
import { NotificationDeliveryService } from '../services/notificationDeliveryService';
import { PushNotificationService } from '../services/pushNotificationService';
import { EmailService } from '../services/emailService';
import { SmsService } from '../services/smsService';

export const broadcastRouter = router({
  /**
   * Send a broadcast notification to filtered users
   * Only accessible to admins
   */
  send: adminProcedure.input(SendBroadcastInputSchema).mutation(async ({ input, ctx }) => {
    ctx.logger.info('Sending broadcast notification', {
      adminId: ctx.user.id,
      filters: input.filters,
    });

    // Get recipient IDs based on filters
    const recipientIds = await getFilteredUserIds(ctx.db, input.filters, ctx.logger);

    if (recipientIds.length === 0) {
      ctx.logger.warn('No recipients found for broadcast', { filters: input.filters });
      return {
        success: true,
        recipientCount: 0,
        notifications: [],
      };
    }

    ctx.logger.info(`Broadcasting to ${recipientIds.length} recipients`);

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

    // Send notification to all recipients
    const results = await deliveryService.sendNotification({
      recipientIds,
      channels: input.channels,
      messageType: 'system_announcement',
      payload: {
        title: input.messageContent.title,
        body: input.messageContent.body,
        ...input.metadata,
      },
      priority: input.priority || 1,
      metadata: {
        broadcast: true,
        adminId: ctx.user.id,
        filters: input.filters,
        ...input.metadata,
      },
      correlationId: ctx.correlationId,
    });

    ctx.logger.info('Broadcast notification sent successfully', {
      recipientCount: recipientIds.length,
      successCount: results.length,
      correlationId: ctx.correlationId,
    });

    return {
      success: true,
      recipientCount: recipientIds.length,
      notifications: results,
    };
  }),

  /**
   * Get broadcast notification statistics
   * Only accessible to admins
   */
  getStats: adminProcedure.query(async ({ ctx }) => {
    ctx.logger.info('Getting broadcast statistics', { adminId: ctx.user.id });

    // Get broadcast notifications (identified by metadata.broadcast = true)
    const broadcasts = await ctx.db.notification.findMany({
      where: {
        messageType: 'system_announcement',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Group by correlation ID to get unique broadcasts
    const broadcastMap = new Map<string, typeof broadcasts>();

    broadcasts.forEach((notification) => {
      const correlationId = notification.correlationId || '';
      if (!broadcastMap.has(correlationId)) {
        broadcastMap.set(correlationId, []);
      }
      broadcastMap.get(correlationId)?.push(notification);
    });

    const broadcastStats = Array.from(broadcastMap.entries()).map(
      ([correlationId, notifications]) => {
        const sentCount = notifications.filter((n) => n.status === 'sent').length;
        const failedCount = notifications.filter((n) => n.status === 'failed').length;
        const readCount = notifications.filter((n) => n.status === 'read').length;

        return {
          correlationId,
          totalRecipients: notifications.length,
          sentCount,
          failedCount,
          readCount,
          createdAt: notifications[0]?.createdAt,
          payload: notifications[0]?.payload,
          metadata: notifications[0]?.metadata,
        };
      }
    );

    return {
      broadcasts: broadcastStats,
    };
  }),
});

/**
 * Helper function to get user IDs based on filters
 */
async function getFilteredUserIds(
  db: any,
  filters: {
    roles?: string[];
    locations?: string[];
    userIds?: string[];
  } | undefined,
  logger: any
): Promise<string[]> {
  // If specific user IDs provided, return them
  if (filters?.userIds && filters.userIds.length > 0) {
    return filters.userIds;
  }

  // If no filters, get all users with notification preferences
  if (!filters || (!filters.roles && !filters.locations)) {
    const allPreferences = await db.userPreferences.findMany({
      where: {
        pushEnabled: true, // Only include users who have push enabled
      },
      select: {
        userId: true,
      },
    });

    logger.info(`Found ${allPreferences.length} users with push notifications enabled`);
    return allPreferences.map((pref: any) => pref.userId);
  }

  // In a real implementation, you would query a user service or user table
  // to filter by roles and locations. For now, we'll return users based on
  // preferences only.

  // This is a placeholder implementation
  // You would typically call a user service here with the filters
  const allPreferences = await db.userPreferences.findMany({
    where: {
      pushEnabled: true,
    },
    select: {
      userId: true,
      metadata: true,
    },
  });

  // Filter by role if provided (assuming role is in metadata)
  let filteredUsers = allPreferences;

  if (filters.roles && filters.roles.length > 0) {
    filteredUsers = filteredUsers.filter((pref: any) => {
      const metadata = pref.metadata as Record<string, unknown>;
      const userRole = metadata?.role as string | undefined;
      return userRole && filters.roles!.includes(userRole);
    });
  }

  // Filter by location if provided (assuming location is in metadata)
  if (filters.locations && filters.locations.length > 0) {
    filteredUsers = filteredUsers.filter((pref: any) => {
      const metadata = pref.metadata as Record<string, unknown>;
      const userLocation = metadata?.location as string | undefined;
      return userLocation && filters.locations!.includes(userLocation);
    });
  }

  const userIds = filteredUsers.map((pref: any) => pref.userId);
  logger.info(`Found ${userIds.length} users matching filters`, { filters });

  return userIds;
}
