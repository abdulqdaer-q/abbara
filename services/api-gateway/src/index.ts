import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers';
import { createContext } from './context';
import { config } from './config';
import { logger } from './lib/logger';
import { correlationMiddleware } from './lib/correlation';
import { ipRateLimiter, strictRateLimiter } from './middleware/rateLimiter';

/**
 * Bootstrap the API Gateway server
 */
async function bootstrap() {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: config.server.env === 'production',
  }));

  // CORS configuration
  app.use(cors({
    origin: config.server.corsOrigin,
    credentials: true,
  }));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Add correlation ID to all requests
  app.use(correlationMiddleware);

  // Health check endpoint (no rate limiting)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: config.serviceName,
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe (checks if service can connect to dependencies)
  app.get('/ready', async (_req, res) => {
    // In production, check connectivity to downstream services
    try {
      res.json({
        status: 'ready',
        service: config.serviceName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Apply global rate limiting
  app.use('/trpc', ipRateLimiter);

  // Apply stricter rate limiting for auth endpoints
  app.use('/trpc/auth.login', strictRateLimiter);
  app.use('/trpc/auth.refresh', strictRateLimiter);

  // tRPC middleware
  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, type, path, input, ctx }) {
        const correlationId = ctx?.correlationId || 'unknown';

        logger.error('tRPC Error', {
          correlationId,
          type,
          path,
          code: error.code,
          message: error.message,
          input: config.server.env === 'development' ? input : undefined,
          stack: config.server.env === 'development' ? error.stack : undefined,
        });
      },
    })
  );

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
      availableRoutes: [
        'GET /health',
        'GET /ready',
        'POST /trpc/*',
      ],
    });
  });

  // Global error handler
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: config.server.env === 'development' ? err.message : 'An unexpected error occurred',
    });
  });

  // Start server
  app.listen(config.server.port, config.server.host, () => {
    logger.info('API Gateway started', {
      env: config.server.env,
      host: config.server.host,
      port: config.server.port,
      corsOrigin: config.server.corsOrigin,
    });

    logger.info('Available routes', {
      health: `http://${config.server.host}:${config.server.port}/health`,
      ready: `http://${config.server.host}:${config.server.port}/ready`,
      trpc: `http://${config.server.host}:${config.server.port}/trpc`,
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
}

// Start the server
bootstrap().catch((error) => {
  logger.error('Failed to start server', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
