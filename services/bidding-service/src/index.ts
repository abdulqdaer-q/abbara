import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { config } from './config';
import { createContext } from './context';
import { appRouter } from './routers';
import { authenticateJWT } from './middleware/auth';
import { logger } from './lib/logger';
import { getPrismaClient, disconnectPrisma } from './lib/db';
import { getRedisClient, disconnectRedis } from './lib/redis';
import { disconnectKafka } from './lib/kafka';
import { eventConsumer } from './services/eventConsumer';
import { expiryJob } from './jobs/expiryJob';
import { getMetrics } from './lib/metrics';

/**
 * Main application server
 */
class BiddingServer {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());
    this.app.use(cors());

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Authentication (extracts user from JWT)
    this.app.use(authenticateJWT);

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug('Incoming request', {
        method: req.method,
        path: req.path,
        userId: (req as any).user?.id,
      });
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'bidding-service',
      });
    });

    // Readiness check
    this.app.get('/ready', async (req, res) => {
      try {
        // Check database connection
        const prisma = getPrismaClient();
        await prisma.$queryRaw`SELECT 1`;

        // Check Redis connection
        const redis = getRedisClient();
        await redis.ping();

        res.json({
          status: 'ready',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Readiness check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        res.status(503).json({
          status: 'not ready',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Metrics endpoint (Prometheus format)
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } catch (error) {
        logger.error('Error generating metrics', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).send('Error generating metrics');
      }
    });

    // tRPC endpoint
    this.app.use(
      '/trpc',
      createExpressMiddleware({
        router: appRouter,
        createContext,
        onError({ error, path, type }) {
          logger.error('tRPC error', {
            path,
            type,
            code: error.code,
            message: error.message,
          });
        },
      })
    );

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
      });
    });

    // Error handler
    this.app.use(
      (
        err: Error,
        req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        logger.error('Unhandled error', {
          error: err.message,
          stack: err.stack,
          path: req.path,
        });

        res.status(500).json({
          error: 'Internal server error',
          message: config.nodeEnv === 'development' ? err.message : undefined,
        });
      }
    );
  }

  /**
   * Initialize infrastructure
   */
  private async initialize(): Promise<void> {
    logger.info('Initializing bidding service...');

    // Initialize database
    const prisma = getPrismaClient();
    await prisma.$connect();
    logger.info('Database connected');

    // Initialize Redis
    const redis = getRedisClient();
    await redis.ping();
    logger.info('Redis connected');

    // Start event consumer
    await eventConsumer.start();
    logger.info('Event consumer started');

    // Start expiry job
    expiryJob.start();
    logger.info('Expiry job started');
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      await this.initialize();

      this.app.listen(config.port, config.host, () => {
        logger.info('Bidding service started', {
          host: config.host,
          port: config.port,
          nodeEnv: config.nodeEnv,
        });
      });
    } catch (error) {
      logger.error('Failed to start server', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down bidding service...');

    try {
      // Stop expiry job
      expiryJob.stop();

      // Disconnect from infrastructure
      await Promise.all([
        disconnectPrisma(),
        disconnectRedis(),
        disconnectKafka(),
      ]);

      logger.info('Bidding service shut down successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  }
}

/**
 * Start server
 */
const server = new BiddingServer();

// Handle graceful shutdown
process.on('SIGTERM', () => server.shutdown());
process.on('SIGINT', () => server.shutdown());

// Start the server
server.start().catch((error) => {
  logger.error('Fatal error', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});
