import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as trpcExpress from '@trpc/server/adapters/express';
import { config, validateConfig } from './config';
import { createContext } from './context';
import { appRouter } from './routers';
import { logger } from './lib/logger';
import { disconnectDatabase, checkDatabaseHealth } from './lib/db';
import { disconnectRedis, checkRedisHealth } from './lib/redis';

/**
 * Initialize Express application
 */
const app = express();

/**
 * Middleware
 */
app.use(helmet());
app.use(cors());
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabaseHealth();
  const redisHealthy = await checkRedisHealth();

  const healthy = dbHealthy && redisHealthy;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    service: config.serviceName,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealthy,
      redis: redisHealthy,
    },
  });
});

/**
 * Ready check endpoint (for Kubernetes)
 */
app.get('/ready', async (req, res) => {
  const dbHealthy = await checkDatabaseHealth();
  const ready = dbHealthy;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
  });
});

/**
 * tRPC endpoint
 */
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    service: config.serviceName,
    version: '1.0.0',
    description: 'MoveNow Pricing Service - Fare estimation and pricing snapshot management',
    endpoints: {
      health: '/health',
      ready: '/ready',
      trpc: '/trpc',
    },
  });
});

/**
 * Error handler
 */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

/**
 * Start server
 */
async function start() {
  try {
    // Validate configuration
    validateConfig();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Pricing Service started`, {
        port: config.port,
        environment: config.nodeEnv,
        mapsEnabled: config.mapsProviderEnabled,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await disconnectDatabase();
          await disconnectRedis();
          logger.info('All connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 30s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
start();
