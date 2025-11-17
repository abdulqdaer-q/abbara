import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';
import { config } from '../config';
import { DeliveryError } from '../lib/errors';
import { NotificationPayload } from './notificationDeliveryService';

export class PushNotificationService {
  private initialized: boolean = false;

  constructor(
    private db: PrismaClient,
    private logger: Logger
  ) {
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initializeFirebase(): void {
    try {
      if (!config.fcmProjectId || !config.fcmClientEmail || !config.fcmPrivateKey) {
        this.logger.warn('Firebase credentials not configured, push notifications will be disabled');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.fcmProjectId,
          clientEmail: config.fcmClientEmail,
          privateKey: config.fcmPrivateKey.replace(/\\n/g, '\n'),
        }),
      });

      this.initialized = true;
      this.logger.info('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error);
      this.initialized = false;
    }
  }

  /**
   * Send push notification to user
   */
  async sendPushNotification(recipientId: string, payload: NotificationPayload): Promise<void> {
    if (!this.initialized) {
      throw new DeliveryError('push', 'Push notification service not initialized');
    }

    try {
      // Get user's device tokens
      const tokens = await this.getUserDeviceTokens(recipientId);

      if (tokens.length === 0) {
        this.logger.warn(`No device tokens found for user ${recipientId}`);
        return;
      }

      // Prepare notification message
      const message = this.prepareMessage(payload, tokens);

      // Send to all devices
      const response = await admin.messaging().sendEachForMulticast(message);

      this.logger.info(
        `Push notification sent to ${response.successCount} devices for user ${recipientId}`
      );

      // Handle failed tokens
      if (response.failureCount > 0) {
        await this.handleFailedTokens(tokens, response.responses);
      }
    } catch (error) {
      this.logger.error(`Failed to send push notification to user ${recipientId}:`, error);
      throw new DeliveryError(
        'push',
        error instanceof Error ? error.message : 'Unknown error',
        error
      );
    }
  }

  /**
   * Get user's active device tokens
   */
  private async getUserDeviceTokens(userId: string): Promise<string[]> {
    const devices = await this.db.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        token: true,
      },
    });

    return devices.map((device) => device.token);
  }

  /**
   * Prepare FCM message
   */
  private prepareMessage(
    payload: NotificationPayload,
    tokens: string[]
  ): admin.messaging.MulticastMessage {
    const { title, body } = this.formatNotificationContent(payload);

    return {
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        messageType: payload.messageType,
        ...this.flattenPayload(payload.payload),
      },
      android: {
        priority: this.mapPriorityToAndroid(payload.priority),
        notification: {
          sound: 'default',
          priority: this.mapPriorityToAndroid(payload.priority) as
            | 'default'
            | 'min'
            | 'low'
            | 'high'
            | 'max',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
    };
  }

  /**
   * Format notification content based on message type
   */
  private formatNotificationContent(payload: NotificationPayload): { title: string; body: string } {
    // In a real implementation, this would use templates from the database
    // or a template service
    const messageTypeMap: Record<string, { title: string; body: string }> = {
      order_created: {
        title: 'Order Created',
        body: 'Your order has been created successfully',
      },
      order_confirmed: {
        title: 'Order Confirmed',
        body: 'Your order has been confirmed',
      },
      order_assigned: {
        title: 'Porter Assigned',
        body: 'A porter has been assigned to your order',
      },
      order_started: {
        title: 'Order Started',
        body: 'Your porter is on the way',
      },
      order_completed: {
        title: 'Order Completed',
        body: 'Your order has been completed',
      },
      bid_received: {
        title: 'New Bid',
        body: 'You received a new bid on your order',
      },
      payment_completed: {
        title: 'Payment Successful',
        body: 'Your payment has been processed successfully',
      },
    };

    const template = messageTypeMap[payload.messageType] || {
      title: 'Notification',
      body: 'You have a new notification',
    };

    // Replace variables in template with actual values
    return {
      title: this.replaceVariables(template.title, payload.payload),
      body: this.replaceVariables(template.body, payload.payload),
    };
  }

  /**
   * Replace variables in template string
   */
  private replaceVariables(template: string, variables: Record<string, unknown>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(`{${key}}`, String(value));
    });
    return result;
  }

  /**
   * Flatten payload for FCM data
   */
  private flattenPayload(payload: Record<string, unknown>): Record<string, string> {
    const flattened: Record<string, string> = {};
    Object.entries(payload).forEach(([key, value]) => {
      flattened[key] = typeof value === 'string' ? value : JSON.stringify(value);
    });
    return flattened;
  }

  /**
   * Map priority to Android priority
   */
  private mapPriorityToAndroid(priority: number): 'normal' | 'high' {
    return priority >= 2 ? 'high' : 'normal';
  }

  /**
   * Handle failed device tokens (remove invalid ones)
   */
  private async handleFailedTokens(
    tokens: string[],
    responses: admin.messaging.SendResponse[]
  ): Promise<void> {
    const tokensToDeactivate: string[] = [];

    responses.forEach((response, index) => {
      if (!response.success && response.error) {
        const errorCode = response.error.code;
        // Deactivate tokens that are invalid or unregistered
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          tokensToDeactivate.push(tokens[index]);
        }
      }
    });

    if (tokensToDeactivate.length > 0) {
      await this.db.deviceToken.updateMany({
        where: {
          token: {
            in: tokensToDeactivate,
          },
        },
        data: {
          isActive: false,
        },
      });

      this.logger.info(`Deactivated ${tokensToDeactivate.length} invalid device tokens`);
    }
  }
}
