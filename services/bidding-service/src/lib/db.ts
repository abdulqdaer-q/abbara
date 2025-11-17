import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

/**
 * Prisma client singleton
 */
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    // Log warnings and errors
    prisma.$on('warn' as never, (e: any) => {
      logger.warn('Prisma warning', { event: e });
    });

    prisma.$on('error' as never, (e: any) => {
      logger.error('Prisma error', { event: e });
    });

    logger.info('Prisma client initialized');
  }

  return prisma;
}

/**
 * Gracefully disconnect Prisma
 */
export async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Prisma client disconnected');
  }
}
