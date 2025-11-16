import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { config } from './config';
import { logger } from './lib/logger';
import { appRouter } from './routers';
import { createContext } from './context';
import { getPrismaClient } from './lib/db';
import { getRedisClient, closeRedis } from './lib/redis';
import { EventConsumer } from './events/eventConsumer';
import cron from 'node-cron';
import { getNotificationsReadyForRetry } from './lib/redis';
import { NotificationDeliveryService } from './services/notificationDeliveryService';
import { PushNotificationService } from './services/pushNotificationService';
import { EmailService } from './services/emailService';
import { SmsService } from './services/smsService';

const app = express();

// Security middleware
app.use(helmet());

// CORS middleware
app.use(
  cors({
    origin: config.corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  })
);

// Body parser middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'notification-service' });
});

// Readiness check endpoint
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    const db = getPrismaClient();
    await db.$queryRaw`SELECT 1`;

    // Check Redis connection
    const redis = getRedisClient();
    await redis.ping();

    res.status(200).json({
      status: 'ready',
      service: 'notification-service',
      database: 'connected',
      redis: 'connected',
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      service: 'notification-service',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// tRPC endpoint
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize event consumer
const db = getPrismaClient();
const eventConsumer = new EventConsumer(db, logger);

// Setup retry processor
// Runs every minute to process notifications that are ready for retry
cron.schedule('* * * * *', async () => {
  try {
    const notificationIds = await getNotificationsReadyForRetry();

    if (notificationIds.length > 0) {
      logger.info(`Processing ${notificationIds.length} notifications for retry`);

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

      for (const notificationId of notificationIds) {
        try {
          await deliveryService.retryNotification(notificationId);
        } catch (error) {
          logger.error(`Failed to retry notification ${notificationId}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error('Error in retry processor:', error);
  }
});

// Start server
const server = app.listen(config.port, async () => {
  logger.info(`Notification service listening on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`tRPC endpoint: http://localhost:${config.port}/trpc`);

  // Connect to event bus
  try {
    await eventConsumer.connect();
    logger.info('Event consumer started');
  } catch (error) {
    logger.error('Failed to start event consumer:', error);
  }
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);

  // Close server
  server.close(async () => {
    logger.info('HTTP server closed');

    // Disconnect from event bus
    try {
      await eventConsumer.disconnect();
      logger.info('Event consumer stopped');
    } catch (error) {
      logger.error('Error stopping event consumer:', error);
    }

    // Close Redis connection
    try {
      await closeRedis();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }

    // Close database connection
    try {
      await db.$disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  void shutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  void shutdown('UNHANDLED_REJECTION');
});

export { app, server };
