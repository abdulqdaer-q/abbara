import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';
import { NotificationDeliveryService } from '../../services/notificationDeliveryService';
import { PushNotificationService } from '../../services/pushNotificationService';
import { EmailService } from '../../services/emailService';
import { SmsService } from '../../services/smsService';
import { EventType } from '@movenow/common';

/**
 * Handle porter-related events and send appropriate notifications
 */
export async function handlePorterEvent(
  event: { type: string; [key: string]: unknown },
  db: PrismaClient,
  logger: Logger
): Promise<void> {
  logger.info('Handling porter event', { type: event.type, porterId: event.porterId });

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
      case EventType.PORTER_LOCATION_UPDATED:
        await handlePorterLocationUpdated(event, deliveryService);
        break;

      case 'PORTER_VERIFIED':
        await handlePorterVerified(event, deliveryService);
        break;

      case 'PORTER_ARRIVED':
        await handlePorterArrived(event, deliveryService);
        break;

      default:
        logger.warn('Unknown porter event type', { type: event.type });
    }
  } catch (error) {
    logger.error('Error handling porter event:', error);
    throw error;
  }
}

async function handlePorterLocationUpdated(
  _event: { [key: string]: unknown },
  _deliveryService: NotificationDeliveryService
): Promise<void> {
  // Location updates are typically handled via WebSocket/realtime service
  // Not sending push notifications for every location update to avoid spam
  // This is just a placeholder in case we want to send specific location-based notifications
}

async function handlePorterVerified(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const porterId = event.porterId as string;
  const correlationId = event.correlationId as string;

  await deliveryService.sendNotification({
    recipientIds: [porterId],
    channels: ['push', 'email'],
    messageType: 'system_announcement',
    payload: {
      title: 'Account Verified',
      body: 'Congratulations! Your porter account has been verified. You can now start accepting orders.',
    },
    priority: 2,
    correlationId,
  });
}

async function handlePorterArrived(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const customerId = event.customerId as string;
  const porterId = event.porterId as string;
  const orderId = event.orderId as string;
  const location = event.location as string | undefined;
  const correlationId = event.correlationId as string;

  await deliveryService.sendNotification({
    recipientIds: [customerId],
    channels: ['push', 'sms'],
    messageType: 'porter_arrived',
    payload: {
      orderId,
      porterId,
      location,
      title: 'Porter Arrived',
      body: 'Your porter has arrived at the pickup location.',
    },
    priority: 3,
    correlationId,
  });
}
