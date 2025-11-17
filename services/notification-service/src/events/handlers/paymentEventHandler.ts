import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';
import { NotificationDeliveryService } from '../../services/notificationDeliveryService';
import { PushNotificationService } from '../../services/pushNotificationService';
import { EmailService } from '../../services/emailService';
import { SmsService } from '../../services/smsService';
import { EventType } from '@movenow/common';

/**
 * Handle payment-related events and send appropriate notifications
 */
export async function handlePaymentEvent(
  event: { type: string; [key: string]: unknown },
  db: PrismaClient,
  logger: Logger
): Promise<void> {
  logger.info('Handling payment event', { type: event.type, paymentId: event.paymentId });

  // Initialize services
  const pushService = new PushNotificationService(db, logger);
  const emailService = new EmailService(db, logger);
  const smsService = new SmsService(db, logger);
  const deliveryService = new NotificationDeliveryService(
    db,
    logger,
    pushService,
    emailService,
    smsService
  );

  try {
    switch (event.type) {
      case EventType.PAYMENT_COMPLETED:
        await handlePaymentCompleted(event, deliveryService);
        break;

      case 'PAYMENT_FAILED':
        await handlePaymentFailed(event, deliveryService);
        break;

      default:
        logger.warn('Unknown payment event type', { type: event.type });
    }
  } catch (error) {
    logger.error('Error handling payment event:', error);
    throw error;
  }
}

async function handlePaymentCompleted(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const userId = event.userId as string;
  const orderId = event.orderId as string;
  const amount = event.amount as number;
  const paymentMethod = event.paymentMethod as string;
  const correlationId = event.correlationId as string;

  await deliveryService.sendNotification({
    recipientIds: [userId],
    channels: ['push', 'email'],
    messageType: 'payment_completed',
    payload: {
      orderId,
      amount,
      paymentMethod,
      title: 'Payment Successful',
      body: `Your payment of $${(amount / 100).toFixed(2)} has been processed successfully.`,
    },
    priority: 1,
    correlationId,
  });
}

async function handlePaymentFailed(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const userId = event.userId as string;
  const orderId = event.orderId as string;
  const reason = event.reason as string | undefined;
  const correlationId = event.correlationId as string;

  await deliveryService.sendNotification({
    recipientIds: [userId],
    channels: ['push', 'email'],
    messageType: 'payment_completed',
    payload: {
      orderId,
      reason,
      title: 'Payment Failed',
      body: reason
        ? `Your payment failed. Reason: ${reason}. Please try again.`
        : 'Your payment failed. Please try again.',
    },
    priority: 3,
    correlationId,
  });
}
