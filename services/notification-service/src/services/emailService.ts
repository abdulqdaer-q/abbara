import nodemailer, { Transporter } from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';
import { config } from '../config';
import { DeliveryError } from '../lib/errors';
import { NotificationPayload } from './notificationDeliveryService';

export class EmailService {
  private transporter: Transporter | null = null;

  constructor(
    private db: PrismaClient,
    private logger: Logger
  ) {
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter(): void {
    if (!config.emailEnabled) {
      this.logger.info('Email service is disabled');
      return;
    }

    if (!config.smtpHost || !config.smtpPort || !config.smtpUser || !config.smtpPass) {
      this.logger.warn('SMTP credentials not configured, email service will be disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });

      this.logger.info('Email transporter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize email transporter:', error);
      this.transporter = null;
    }
  }

  /**
   * Send email notification to user
   */
  async sendEmail(recipientId: string, payload: NotificationPayload): Promise<void> {
    if (!this.transporter) {
      throw new DeliveryError('email', 'Email service not initialized');
    }

    try {
      // Get user email from user preferences or a user service
      const userEmail = await this.getUserEmail(recipientId);

      if (!userEmail) {
        throw new DeliveryError('email', 'User email not found');
      }

      // Prepare email content
      const { subject, html, text } = this.prepareEmailContent(payload);

      // Send email
      const info = await this.transporter.sendMail({
        from: config.emailFrom,
        to: userEmail,
        subject,
        text,
        html,
      });

      this.logger.info(`Email sent to ${userEmail}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to user ${recipientId}:`, error);
      throw new DeliveryError(
        'email',
        error instanceof Error ? error.message : 'Unknown error',
        error
      );
    }
  }

  /**
   * Get user email address
   */
  private async getUserEmail(userId: string): Promise<string | null> {
    // In a real implementation, this would call a user service or query a user table
    // For now, we'll return a placeholder
    // You could also store email in UserPreferences if needed
    const preferences = await this.db.userPreferences.findUnique({
      where: { userId },
    });

    // For demo purposes, we're assuming email is stored in metadata
    if (preferences?.metadata && typeof preferences.metadata === 'object') {
      const metadata = preferences.metadata as Record<string, unknown>;
      if (metadata.email && typeof metadata.email === 'string') {
        return metadata.email;
      }
    }

    return null;
  }

  /**
   * Prepare email content based on message type
   */
  private prepareEmailContent(payload: NotificationPayload): {
    subject: string;
    html: string;
    text: string;
  } {
    const { subject, body } = this.getEmailTemplate(payload);

    // Replace variables in template
    const processedSubject = this.replaceVariables(subject, payload.payload);
    const processedBody = this.replaceVariables(body, payload.payload);

    // Create HTML version
    const html = this.createHtmlEmail(processedSubject, processedBody);

    return {
      subject: processedSubject,
      html,
      text: processedBody,
    };
  }

  /**
   * Get email template based on message type
   */
  private getEmailTemplate(payload: NotificationPayload): { subject: string; body: string } {
    const templates: Record<string, { subject: string; body: string }> = {
      order_created: {
        subject: 'Order Created - MoveNow',
        body: 'Your order has been created successfully. We will notify you when a porter accepts your request.',
      },
      order_confirmed: {
        subject: 'Order Confirmed - MoveNow',
        body: 'Your order has been confirmed and is being processed.',
      },
      order_assigned: {
        subject: 'Porter Assigned - MoveNow',
        body: 'A porter has been assigned to your order. They will arrive shortly.',
      },
      order_completed: {
        subject: 'Order Completed - MoveNow',
        body: 'Your order has been completed. Thank you for using MoveNow!',
      },
      payment_completed: {
        subject: 'Payment Successful - MoveNow',
        body: 'Your payment has been processed successfully.',
      },
    };

    return (
      templates[payload.messageType] || {
        subject: 'Notification - MoveNow',
        body: 'You have a new notification.',
      }
    );
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

  /**
   * Create HTML email template
   */
  private createHtmlEmail(subject: string, body: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #007bff;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 5px 5px;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>MoveNow</h1>
  </div>
  <div class="content">
    <h2>${subject}</h2>
    <p>${body}</p>
  </div>
  <div class="footer">
    <p>This is an automated message from MoveNow. Please do not reply to this email.</p>
    <p>&copy; ${new Date().getFullYear()} MoveNow. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }
}
