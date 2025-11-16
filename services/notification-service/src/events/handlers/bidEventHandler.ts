import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';
import { NotificationDeliveryService } from '../../services/notificationDeliveryService';
import { PushNotificationService } from '../../services/pushNotificationService';
import { EmailService } from '../../services/emailService';
import { SmsService } from '../../services/smsService';

/**
 * Handle bid-related events and send appropriate notifications
 */
export async function handleBidEvent(
  event: { type: string; [key: string]: unknown },
  db: PrismaClient,
  logger: Logger
): Promise<void> {
  logger.info('Handling bid event', { type: event.type, bidId: event.bidId });

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
      case 'BID_RECEIVED':
        await handleBidReceived(event, deliveryService);
        break;

      case 'BID_ACCEPTED':
        await handleBidAccepted(event, deliveryService);
        break;

      case 'BID_REJECTED':
        await handleBidRejected(event, deliveryService);
        break;

      default:
        logger.warn('Unknown bid event type', { type: event.type });
    }
  } catch (error) {
    logger.error('Error handling bid event:', error);
    throw error;
  }
}

async function handleBidReceived(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const customerId = event.customerId as string;
  const porterId = event.porterId as string;
  const bidId = event.bidId as string;
  const orderId = event.orderId as string;
  const bidAmount = event.bidAmount as number;
  const correlationId = event.correlationId as string;

  // Notify customer about new bid
  await deliveryService.sendNotification({
    recipientIds: [customerId],
    channels: ['push'],
    messageType: 'bid_received',
    payload: {
      bidId,
      orderId,
      porterId,
      bidAmount,
      title: 'New Bid Received',
      body: `You received a new bid of $${(bidAmount / 100).toFixed(2)} for your order.`,
    },
    priority: 2,
    correlationId,
  });
}

async function handleBidAccepted(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const porterId = event.porterId as string;
  const bidId = event.bidId as string;
  const orderId = event.orderId as string;
  const correlationId = event.correlationId as string;

  // Notify porter that their bid was accepted
  await deliveryService.sendNotification({
    recipientIds: [porterId],
    channels: ['push', 'sms'],
    messageType: 'bid_accepted',
    payload: {
      bidId,
      orderId,
      title: 'Bid Accepted',
      body: 'Congratulations! Your bid has been accepted. Please proceed to pickup location.',
    },
    priority: 3,
    correlationId,
  });
}

async function handleBidRejected(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const porterId = event.porterId as string;
  const bidId = event.bidId as string;
  const orderId = event.orderId as string;
  const correlationId = event.correlationId as string;

  // Notify porter that their bid was rejected
  await deliveryService.sendNotification({
    recipientIds: [porterId],
    channels: ['push'],
    messageType: 'bid_rejected',
    payload: {
      bidId,
      orderId,
      title: 'Bid Not Accepted',
      body: 'Your bid was not accepted. Check out other available orders.',
    },
    priority: 1,
    correlationId,
  });
}
