import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';
import { config } from '../config';
import {
  checkDuplicateNotification,
  markNotificationProcessed,
  checkRateLimit,
  queueNotificationForRetry,
} from '../lib/redis';
import {
  DuplicateNotificationError,
  RateLimitError,
  DeliveryError,
} from '../lib/errors';
import { PushNotificationService } from './pushNotificationService';
import { EmailService } from './emailService';
import { SmsService } from './smsService';

export interface NotificationPayload {
  recipientIds: string[];
  channels: string[];
  messageType: string;
  payload: Record<string, unknown>;
  priority: number;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  correlationId: string;
}

export interface NotificationResult {
  notificationId: string;
  status: string;
}

export class NotificationDeliveryService {
  constructor(
    private db: PrismaClient,
    private logger: Logger,
    private pushService: PushNotificationService,
    private emailService: EmailService,
    private smsService: SmsService
  ) {}

  /**
   * Send notification to multiple recipients via specified channels
   */
  async sendNotification(payload: NotificationPayload): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    // Check for duplicate if idempotency key is provided
    if (payload.idempotencyKey) {
      const isDuplicate = await checkDuplicateNotification(payload.idempotencyKey);
      if (isDuplicate) {
        throw new DuplicateNotificationError(payload.idempotencyKey);
      }
    }

    for (const recipientId of payload.recipientIds) {
      try {
        // Check user preferences
        const preferences = await this.getUserPreferences(recipientId);

        // Filter channels based on preferences
        const allowedChannels = this.filterChannelsByPreferences(
          payload.channels,
          payload.messageType,
          preferences
        );

        if (allowedChannels.length === 0) {
          this.logger.info(`No allowed channels for user ${recipientId}, skipping notification`);
          continue;
        }

        // Check rate limits for each channel
        for (const channel of allowedChannels) {
          const rateLimitCheck = await checkRateLimit(recipientId, channel);
          if (!rateLimitCheck.allowed) {
            throw new RateLimitError(
              `Rate limit exceeded for user ${recipientId} on channel ${channel}`
            );
          }
        }

        // Create notification record
        const notification = await this.db.notification.create({
          data: {
            recipientId,
            channels: allowedChannels,
            messageType: payload.messageType,
            payload: payload.payload,
            priority: payload.priority,
            metadata: payload.metadata || {},
            idempotencyKey: payload.idempotencyKey,
            correlationId: payload.correlationId,
            status: 'queued',
          },
        });

        // Mark as processed if idempotency key is provided
        if (payload.idempotencyKey) {
          await markNotificationProcessed(payload.idempotencyKey, notification.id);
        }

        // Attempt delivery via each channel
        await this.deliverNotification(notification.id, allowedChannels, recipientId, payload);

        results.push({
          notificationId: notification.id,
          status: 'queued',
        });
      } catch (error) {
        this.logger.error(`Failed to send notification to ${recipientId}:`, error);
        // Continue processing other recipients
      }
    }

    return results;
  }

  /**
   * Deliver notification via specified channels
   */
  private async deliverNotification(
    notificationId: string,
    channels: string[],
    recipientId: string,
    payload: NotificationPayload
  ): Promise<void> {
    const deliveryPromises = channels.map(async (channel) => {
      try {
        await this.deliverViaChannel(channel, recipientId, payload);

        // Record successful delivery audit
        await this.db.deliveryAudit.create({
          data: {
            notificationId,
            deliveryStatus: 'sent',
            channel,
            correlationId: payload.correlationId,
            attemptNumber: 1,
          },
        });

        return { channel, success: true };
      } catch (error) {
        this.logger.error(`Failed to deliver via ${channel}:`, error);

        // Record failed delivery audit
        await this.db.deliveryAudit.create({
          data: {
            notificationId,
            deliveryStatus: 'failed',
            channel,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            correlationId: payload.correlationId,
            attemptNumber: 1,
          },
        });

        return { channel, success: false, error };
      }
    });

    const results = await Promise.allSettled(deliveryPromises);

    // Check if all channels failed
    const allFailed = results.every(
      (result) => result.status === 'rejected' || !result.value.success
    );

    if (allFailed) {
      // Update notification status to failed and queue for retry
      await this.db.notification.update({
        where: { id: notificationId },
        data: {
          status: 'failed',
          retryCount: 1,
        },
      });

      // Queue for retry
      const retryAt = this.calculateRetryTime(1);
      await queueNotificationForRetry(notificationId, retryAt);
    } else {
      // At least one channel succeeded, mark as sent
      await this.db.notification.update({
        where: { id: notificationId },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });
    }
  }

  /**
   * Deliver notification via specific channel
   */
  private async deliverViaChannel(
    channel: string,
    recipientId: string,
    payload: NotificationPayload
  ): Promise<void> {
    switch (channel) {
      case 'push':
        await this.pushService.sendPushNotification(recipientId, payload);
        break;
      case 'email':
        await this.emailService.sendEmail(recipientId, payload);
        break;
      case 'sms':
        await this.smsService.sendSms(recipientId, payload);
        break;
      case 'in_app':
        // In-app notifications are handled separately via messaging router
        break;
      default:
        throw new DeliveryError(channel, 'Unsupported channel');
    }
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(userId: string) {
    let preferences = await this.db.userPreferences.findUnique({
      where: { userId },
    });

    // Create default preferences if not found
    if (!preferences) {
      preferences = await this.db.userPreferences.create({
        data: { userId },
      });
    }

    return preferences;
  }

  /**
   * Filter channels based on user preferences
   */
  private filterChannelsByPreferences(
    requestedChannels: string[],
    messageType: string,
    preferences: {
      pushEnabled: boolean;
      emailEnabled: boolean;
      smsEnabled: boolean;
      orderUpdatesEnabled: boolean;
      bidUpdatesEnabled: boolean;
      chatMessagesEnabled: boolean;
      promotionsEnabled: boolean;
      systemAlertsEnabled: boolean;
    }
  ): string[] {
    // Check message type preferences
    const messageTypeEnabled = this.isMessageTypeEnabled(messageType, preferences);
    if (!messageTypeEnabled) {
      return [];
    }

    // Filter channels based on preferences
    return requestedChannels.filter((channel) => {
      switch (channel) {
        case 'push':
          return preferences.pushEnabled;
        case 'email':
          return preferences.emailEnabled;
        case 'sms':
          return preferences.smsEnabled;
        default:
          return true;
      }
    });
  }

  /**
   * Check if message type is enabled for user
   */
  private isMessageTypeEnabled(
    messageType: string,
    preferences: {
      orderUpdatesEnabled: boolean;
      bidUpdatesEnabled: boolean;
      chatMessagesEnabled: boolean;
      promotionsEnabled: boolean;
      systemAlertsEnabled: boolean;
    }
  ): boolean {
    if (messageType.startsWith('order_')) {
      return preferences.orderUpdatesEnabled;
    } else if (messageType.startsWith('bid_')) {
      return preferences.bidUpdatesEnabled;
    } else if (messageType === 'chat_message') {
      return preferences.chatMessagesEnabled;
    } else if (messageType === 'promo_code_created') {
      return preferences.promotionsEnabled;
    } else if (messageType === 'system_announcement') {
      return preferences.systemAlertsEnabled;
    }
    return true;
  }

  /**
   * Calculate retry time based on retry count (exponential backoff)
   */
  private calculateRetryTime(retryCount: number): Date {
    const backoffMs = config.retryBackoffMs * Math.pow(2, retryCount - 1);
    return new Date(Date.now() + backoffMs);
  }

  /**
   * Retry failed notifications
   */
  async retryNotification(notificationId: string): Promise<void> {
    const notification = await this.db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      this.logger.error(`Notification ${notificationId} not found for retry`);
      return;
    }

    if (notification.retryCount >= config.maxRetryAttempts) {
      this.logger.warn(
        `Notification ${notificationId} exceeded max retry attempts (${config.maxRetryAttempts})`
      );
      await this.db.notification.update({
        where: { id: notificationId },
        data: {
          status: 'failed',
          failureReason: 'Max retry attempts exceeded',
        },
      });
      return;
    }

    try {
      const payload: NotificationPayload = {
        recipientIds: [notification.recipientId],
        channels: notification.channels,
        messageType: notification.messageType,
        payload: notification.payload as Record<string, unknown>,
        priority: notification.priority,
        metadata: notification.metadata as Record<string, unknown> | undefined,
        correlationId: notification.correlationId || 'retry',
      };

      await this.deliverNotification(
        notificationId,
        notification.channels,
        notification.recipientId,
        payload
      );

      await this.db.notification.update({
        where: { id: notificationId },
        data: {
          retryCount: notification.retryCount + 1,
          lastRetryAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Retry failed for notification ${notificationId}:`, error);

      await this.db.notification.update({
        where: { id: notificationId },
        data: {
          retryCount: notification.retryCount + 1,
          lastRetryAt: new Date(),
          status: 'failed',
        },
      });

      // Queue for another retry if not exceeded max attempts
      if (notification.retryCount + 1 < config.maxRetryAttempts) {
        const retryAt = this.calculateRetryTime(notification.retryCount + 1);
        await queueNotificationForRetry(notificationId, retryAt);
      }
    }
  }
}
