import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';
import { NotificationDeliveryService } from '../../services/notificationDeliveryService';
import { PushNotificationService } from '../../services/pushNotificationService';
import { EmailService } from '../../services/emailService';
import { SmsService } from '../../services/smsService';
import { EventType } from '@movenow/common';

/**
 * Handle order-related events and send appropriate notifications
 */
export async function handleOrderEvent(
  event: { type: string; [key: string]: unknown },
  db: PrismaClient,
  logger: Logger
): Promise<void> {
  logger.info('Handling order event', { type: event.type, orderId: event.orderId });

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
      case EventType.ORDER_CREATED:
        await handleOrderCreated(event, deliveryService);
        break;

      case EventType.ORDER_CONFIRMED:
        await handleOrderConfirmed(event, deliveryService);
        break;

      case EventType.ORDER_ASSIGNED:
        await handleOrderAssigned(event, deliveryService);
        break;

      case EventType.ORDER_STARTED:
        await handleOrderStarted(event, deliveryService);
        break;

      case EventType.ORDER_COMPLETED:
        await handleOrderCompleted(event, deliveryService);
        break;

      case EventType.ORDER_CANCELLED:
        await handleOrderCancelled(event, deliveryService);
        break;

      default:
        logger.warn('Unknown order event type', { type: event.type });
    }
  } catch (error) {
    logger.error('Error handling order event:', error);
    throw error;
  }
}

async function handleOrderCreated(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const userId = event.userId as string;
  const orderId = event.orderId as string;
  const correlationId = event.correlationId as string;

  await deliveryService.sendNotification({
    recipientIds: [userId],
    channels: ['push', 'email'],
    messageType: 'order_created',
    payload: {
      orderId,
      title: 'Order Created',
      body: 'Your order has been created successfully. We are finding porters for you.',
    },
    priority: 1,
    correlationId,
  });
}

async function handleOrderConfirmed(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const userId = event.userId as string;
  const orderId = event.orderId as string;
  const correlationId = event.correlationId as string;

  await deliveryService.sendNotification({
    recipientIds: [userId],
    channels: ['push'],
    messageType: 'order_confirmed',
    payload: {
      orderId,
      title: 'Order Confirmed',
      body: 'Your order has been confirmed and is being processed.',
    },
    priority: 1,
    correlationId,
  });
}

async function handleOrderAssigned(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const userId = event.userId as string;
  const orderId = event.orderId as string;
  const porterId = event.porterId as string;
  const correlationId = event.correlationId as string;

  // Notify customer
  await deliveryService.sendNotification({
    recipientIds: [userId],
    channels: ['push', 'sms'],
    messageType: 'order_assigned',
    payload: {
      orderId,
      porterId,
      title: 'Porter Assigned',
      body: 'A porter has been assigned to your order. They will arrive shortly.',
    },
    priority: 2,
    correlationId,
  });

  // Also notify porter
  await deliveryService.sendNotification({
    recipientIds: [porterId],
    channels: ['push'],
    messageType: 'order_assigned',
    payload: {
      orderId,
      userId,
      title: 'New Order Assigned',
      body: 'You have been assigned to a new order. Please proceed to pickup location.',
    },
    priority: 2,
    correlationId,
  });
}

async function handleOrderStarted(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const userId = event.userId as string;
  const orderId = event.orderId as string;
  const correlationId = event.correlationId as string;

  await deliveryService.sendNotification({
    recipientIds: [userId],
    channels: ['push'],
    messageType: 'order_started',
    payload: {
      orderId,
      title: 'Order Started',
      body: 'Your porter is on the way to the pickup location.',
    },
    priority: 2,
    correlationId,
  });
}

async function handleOrderCompleted(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const userId = event.userId as string;
  const orderId = event.orderId as string;
  const porterId = event.porterId as string | undefined;
  const correlationId = event.correlationId as string;

  // Notify customer
  await deliveryService.sendNotification({
    recipientIds: [userId],
    channels: ['push', 'email'],
    messageType: 'order_completed',
    payload: {
      orderId,
      title: 'Order Completed',
      body: 'Your order has been completed successfully. Thank you for using MoveNow!',
    },
    priority: 1,
    correlationId,
  });

  // Notify porter if assigned
  if (porterId) {
    await deliveryService.sendNotification({
      recipientIds: [porterId],
      channels: ['push'],
      messageType: 'order_completed',
      payload: {
        orderId,
        title: 'Order Completed',
        body: 'You have successfully completed the order. Great job!',
      },
      priority: 1,
      correlationId,
    });
  }
}

async function handleOrderCancelled(
  event: { [key: string]: unknown },
  deliveryService: NotificationDeliveryService
): Promise<void> {
  const userId = event.userId as string;
  const orderId = event.orderId as string;
  const porterId = event.porterId as string | undefined;
  const correlationId = event.correlationId as string;
  const reason = event.reason as string | undefined;

  // Notify customer
  await deliveryService.sendNotification({
    recipientIds: [userId],
    channels: ['push', 'email'],
    messageType: 'order_cancelled',
    payload: {
      orderId,
      reason,
      title: 'Order Cancelled',
      body: reason
        ? `Your order has been cancelled. Reason: ${reason}`
        : 'Your order has been cancelled.',
    },
    priority: 2,
    correlationId,
  });

  // Notify porter if assigned
  if (porterId) {
    await deliveryService.sendNotification({
      recipientIds: [porterId],
      channels: ['push'],
      messageType: 'order_cancelled',
      payload: {
        orderId,
        reason,
        title: 'Order Cancelled',
        body: 'The order you were assigned to has been cancelled.',
      },
      priority: 2,
      correlationId,
    });
  }
}
