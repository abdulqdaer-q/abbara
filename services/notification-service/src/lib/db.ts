import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

let prisma: PrismaClient | null = null;

/**
 * Get or create Prisma client singleton
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    prisma.$on('warn', (e) => {
      logger.warn('Prisma warning:', e);
    });

    prisma.$on('error', (e) => {
      logger.error('Prisma error:', e);
    });
  }

  return prisma;
}

/**
 * Disconnect Prisma client
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
