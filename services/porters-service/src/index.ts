import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { logger } from './lib/logger';
import { initRedis } from './lib/redis';
import { initKafka } from './lib/kafka';
import { appRouter } from './routers';
import { createContext } from './context';
import { register as metricsRegister } from './lib/metrics';
import { schedulePeriodicJobs, closeJobs } from './jobs/expiryJobs';
import initEventConsumers from './events/consumers';

const PORT = process.env.PORT || 4002;
const METRICS_PORT = process.env.METRICS_PORT || 9090;

async function main() {
  logger.info('Starting Porters Service...');

  // Initialize infrastructure
  try {
    await initRedis();
    await initKafka();
    logger.info('Infrastructure initialized');
  } catch (error) {
    logger.error('Failed to initialize infrastructure', { error });
    process.exit(1);
  }

  // Initialize event consumers
  try {
    await initEventConsumers();
  } catch (error) {
    logger.error('Failed to initialize event consumers', { error });
    // Don't exit - service can still function without consumers
  }

  // Schedule background jobs
  try {
    await schedulePeriodicJobs();
  } catch (error) {
    logger.error('Failed to schedule background jobs', { error });
    // Don't exit - service can still function without background jobs
  }

  // Create Express app
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    })
  );
  app.use(express.json());

  // Health check endpoints
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'porters-service' });
  });

  app.get('/health/ready', async (_req, res) => {
    // Check if all dependencies are ready
    try {
      // Could add more checks here (DB, Redis, Kafka)
      res.json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: String(error) });
    }
  });

  app.get('/health/live', (_req, res) => {
    res.json({ status: 'alive' });
  });

  // Metrics endpoint
  app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', metricsRegister.contentType);
    const metrics = await metricsRegister.metrics();
    res.send(metrics);
  });

  // tRPC middleware
  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, type, path }) {
        logger.error('tRPC error', {
          type,
          path,
          code: error.code,
          message: error.message,
          stack: error.stack,
        });
      },
    })
  );

  // Start server
  const server = app.listen(PORT, () => {
    logger.info(`Porters Service listening on port ${PORT}`);
    logger.info(`tRPC endpoint: http://localhost:${PORT}/trpc`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
    logger.info(`Metrics: http://localhost:${METRICS_PORT}/metrics`);
  });

  // Start metrics server on separate port
  if (METRICS_PORT !== PORT) {
    const metricsApp = express();
    metricsApp.get('/metrics', async (req, res) => {
      res.setHeader('Content-Type', metricsRegister.contentType);
      const metrics = await metricsRegister.metrics();
      res.send(metrics);
    });
    metricsApp.listen(METRICS_PORT, () => {
      logger.info(`Metrics server listening on port ${METRICS_PORT}`);
    });
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await closeJobs();
        logger.info('Background jobs closed');
      } catch (error) {
        logger.error('Error closing background jobs', { error });
      }

      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start the service
main().catch((error) => {
  logger.error('Fatal error starting service', { error });
  process.exit(1);
});
