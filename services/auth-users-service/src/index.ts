import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { config } from './config';
import { createContext, cleanup } from './trpc/context';
import { appRouter } from './routers';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: config.SERVICE_NAME });
});

// Readiness check endpoint
app.get('/ready', async (req, res) => {
  try {
    // Check database connection
    const { repositories } = await createContext({ req, res } as any);
    await repositories.getPrisma().$queryRaw`SELECT 1`;

    res.json({ status: 'ready' });
  } catch (error) {
    logger.error('Readiness check failed', { error });
    res.status(503).json({ status: 'not ready' });
  }
});

// tRPC endpoint
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      logger.error('tRPC error', {
        path,
        code: error.code,
        message: error.message,
      });
    },
  })
);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(config.PORT, () => {
  logger.info('Server started', {
    port: config.PORT,
    env: config.NODE_ENV,
    service: config.SERVICE_NAME,
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info('Shutdown signal received', { signal });

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await cleanup();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

export { app, appRouter };
