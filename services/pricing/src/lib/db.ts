import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

/**
 * Prisma client instance for database access
 */
export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

// Log database queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug('Database query', {
      query: e.query,
      duration: e.duration,
    });
  });
}

prisma.$on('error' as never, (e: any) => {
  logger.error('Database error', {
    error: e.message,
  });
});

/**
 * Gracefully disconnect from database
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

/**
 * Health check for database
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
}
