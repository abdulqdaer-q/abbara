import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { config } from './config';
import { createContext } from './context';
import { appRouter } from './routers';
import { logger } from './lib/logger';
import { connectDatabase, checkDatabaseHealth } from './lib/prisma';
import { initKafka, getKafkaClient } from './lib/kafka';
import { initRedis, getRedisClient } from './lib/redis';
import { register } from './lib/metrics';

/**
 * Initialize all external services
 */
async function initializeServices() {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize and connect Kafka
    const kafka = initKafka({
      brokers: config.kafka.brokers,
      clientId: config.kafka.clientId,
      groupId: config.kafka.groupId,
    });
    await kafka.connect();

    // Initialize and connect Redis
    const redis = initRedis(config.redis.url);
    await redis.connect();

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', { error });
    throw error;
  }
}

/**
 * Create and configure Express app
 */
function createApp() {
  const app = express();

  // Security and parsing middleware
  app.use(helmet());
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json());

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    try {
      const dbHealthy = await checkDatabaseHealth();
      const redisHealthy = await getRedisClient().ping();
      const kafkaHealthy = getKafkaClient().isConnected();

      const healthy = dbHealthy && redisHealthy && kafkaHealthy;

      res.status(healthy ? 200 : 503).json({
        status: healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealthy ? 'up' : 'down',
          redis: redisHealthy ? 'up' : 'down',
          kafka: kafkaHealthy ? 'up' : 'down',
        },
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Readiness check endpoint
  app.get('/ready', async (_req, res) => {
    try {
      const dbHealthy = await checkDatabaseHealth();
      if (dbHealthy) {
        res.status(200).json({ status: 'ready' });
      } else {
        res.status(503).json({ status: 'not ready' });
      }
    } catch (error) {
      res.status(503).json({ status: 'not ready' });
    }
  });

  // Metrics endpoint
  app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(500).end(error);
    }
  });

  // tRPC middleware
  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ path, error, ctx }) {
        logger.error('tRPC error', {
          path,
          error: error.message,
          code: error.code,
          correlationId: ctx?.correlationId,
        });
      },
    })
  );

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      service: 'orders-service',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        trpc: '/trpc',
        health: '/health',
        ready: '/ready',
        metrics: '/metrics',
      },
    });
  });

  return app;
}

/**
 * Start the server
 */
async function start() {
  try {
    // Initialize services
    await initializeServices();

    // Create Express app
    const app = createApp();

    // Start listening
    app.listen(config.port, () => {
      logger.info(`Orders Service started`, {
        port: config.port,
        nodeEnv: config.nodeEnv,
        endpoints: {
          trpc: `http://localhost:${config.port}/trpc`,
          health: `http://localhost:${config.port}/health`,
          metrics: `http://localhost:${config.port}/metrics`,
        },
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown`);

  try {
    // Disconnect from services
    await getKafkaClient().disconnect();
    await getRedisClient().disconnect();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start the application
start();
