import { inferAsyncReturnType } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { PrismaClient } from '@prisma/client';
import { Repositories } from '../repositories';
import { getEventPublisher } from '../events/publisher';
import { extractToken } from '../middleware/auth';
import { getOrCreateCorrelationId } from '../middleware/correlationId';
import { logger } from '../utils/logger';

// Initialize Prisma client
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Initialize repositories
const repositories = new Repositories(prisma);

// Initialize event publisher
const eventPublisher = getEventPublisher();

/**
 * Create context for tRPC
 */
export async function createContext({ req, res }: CreateExpressContextOptions) {
  // Extract authorization token
  const token = extractToken(req.headers.authorization);

  // Get or create correlation ID for request tracing
  const correlationId = getOrCreateCorrelationId(req.headers['x-correlation-id'] as string);

  // Extract client metadata
  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  logger.debug('Creating tRPC context', {
    correlationId,
    hasToken: !!token,
    ipAddress,
  });

  return {
    req,
    res,
    token,
    correlationId,
    ipAddress,
    userAgent,
    repositories,
    eventPublisher,
    prisma,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;

/**
 * Cleanup function to disconnect services
 */
export async function cleanup() {
  await prisma.$disconnect();
  await eventPublisher.disconnect();
  logger.info('Services disconnected');
}
