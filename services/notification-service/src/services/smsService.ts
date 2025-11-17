import twilio from 'twilio';
import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';
import { config } from '../config';
import { DeliveryError } from '../lib/errors';
import { NotificationPayload } from './notificationDeliveryService';

export class SmsService {
  private client: twilio.Twilio | null = null;

  constructor(
    private db: PrismaClient,
    private logger: Logger
  ) {
    this.initializeTwilio();
  }

  /**
   * Initialize Twilio client
   */
  private initializeTwilio(): void {
    if (!config.smsEnabled) {
      this.logger.info('SMS service is disabled');
      return;
    }

    if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioPhoneNumber) {
      this.logger.warn('Twilio credentials not configured, SMS service will be disabled');
      return;
    }

    try {
      this.client = twilio(config.twilioAccountSid, config.twilioAuthToken);
      this.logger.info('Twilio client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Twilio client:', error);
      this.client = null;
    }
  }

  /**
   * Send SMS notification to user
   */
  async sendSms(recipientId: string, payload: NotificationPayload): Promise<void> {
    if (!this.client) {
      throw new DeliveryError('sms', 'SMS service not initialized');
    }

    if (!config.twilioPhoneNumber) {
      throw new DeliveryError('sms', 'Twilio phone number not configured');
    }

    try {
      // Get user phone number
      const phoneNumber = await this.getUserPhoneNumber(recipientId);

      if (!phoneNumber) {
        throw new DeliveryError('sms', 'User phone number not found');
      }

      // Prepare SMS content
      const messageBody = this.prepareSmsContent(payload);

      // Send SMS
      const message = await this.client.messages.create({
        body: messageBody,
        from: config.twilioPhoneNumber,
        to: phoneNumber,
      });

      this.logger.info(`SMS sent to ${phoneNumber}: ${message.sid}`);
    } catch (error) {
      this.logger.error(`Failed to send SMS to user ${recipientId}:`, error);
      throw new DeliveryError(
        'sms',
        error instanceof Error ? error.message : 'Unknown error',
        error
      );
    }
  }

  /**
   * Get user phone number
   */
  private async getUserPhoneNumber(userId: string): Promise<string | null> {
    // In a real implementation, this would call a user service or query a user table
    // For now, we'll check user preferences metadata
    const preferences = await this.db.userPreferences.findUnique({
      where: { userId },
    });

    // For demo purposes, we're assuming phone number is stored in metadata
    if (preferences?.metadata && typeof preferences.metadata === 'object') {
      const metadata = preferences.metadata as Record<string, unknown>;
      if (metadata.phoneNumber && typeof metadata.phoneNumber === 'string') {
        return metadata.phoneNumber;
      }
    }

    return null;
  }

  /**
   * Prepare SMS content based on message type
   */
  private prepareSmsContent(payload: NotificationPayload): string {
    const templates: Record<string, string> = {
      order_created: 'MoveNow: Your order has been created successfully.',
      order_confirmed: 'MoveNow: Your order has been confirmed.',
      order_assigned: 'MoveNow: A porter has been assigned to your order.',
      order_started: 'MoveNow: Your porter is on the way.',
      order_completed: 'MoveNow: Your order has been completed. Thank you!',
      bid_received: 'MoveNow: You received a new bid on your order.',
      payment_completed: 'MoveNow: Your payment has been processed successfully.',
    };

    const template =
      templates[payload.messageType] || 'MoveNow: You have a new notification.';

    // Replace variables in template
    return this.replaceVariables(template, payload.payload);
  }

  /**
   * Replace variables in template
   */
  private replaceVariables(template: string, variables: Record<string, unknown>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(`{${key}}`, String(value));
    });
    return result;
  }
}
