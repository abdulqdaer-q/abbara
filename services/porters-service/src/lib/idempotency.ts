import { prisma } from './prisma';
import { logger } from './logger';

/**
 * Idempotency handler for mutating operations
 * Stores operation results to ensure exactly-once semantics
 */

export interface IdempotencyResult<T = unknown> {
  isCached: boolean;
  response: T;
  statusCode: number;
}

const DEFAULT_TTL_HOURS = 24;

/**
 * Check if an idempotency key has been used before
 * If yes, return the cached response
 * If no, return null to indicate operation should proceed
 */
export async function checkIdempotency<T = unknown>(
  idempotencyKey: string,
  userId: string,
  operation: string
): Promise<IdempotencyResult<T> | null> {
  try {
    const record = await prisma.idempotencyRecord.findUnique({
      where: { idempotencyKey },
    });

    if (!record) {
      return null; // No cached result, proceed with operation
    }

    // Check if expired
    if (record.expiresAt < new Date()) {
      // Expired, delete and allow re-execution
      await prisma.idempotencyRecord.delete({
        where: { idempotencyKey },
      });
      return null;
    }

    // Validate that the request is from the same user
    if (record.userId !== userId) {
      logger.warn('Idempotency key reused by different user', {
        idempotencyKey,
        originalUser: record.userId,
        requestUser: userId,
      });
      throw new Error('Idempotency key belongs to a different user');
    }

    // Validate operation type matches
    if (record.operation !== operation) {
      logger.warn('Idempotency key reused for different operation', {
        idempotencyKey,
        originalOperation: record.operation,
        requestOperation: operation,
      });
      throw new Error('Idempotency key used for different operation');
    }

    logger.info('Returning cached idempotent response', {
      idempotencyKey,
      operation,
      userId,
    });

    return {
      isCached: true,
      response: record.response as T,
      statusCode: record.statusCode,
    };
  } catch (error) {
    logger.error('Error checking idempotency', { error, idempotencyKey });
    throw error;
  }
}

/**
 * Store the result of an idempotent operation
 */
export async function storeIdempotencyResult<T = unknown>(
  idempotencyKey: string,
  userId: string,
  porterId: string | null,
  operation: string,
  response: T,
  statusCode = 200,
  ttlHours = DEFAULT_TTL_HOURS
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    await prisma.idempotencyRecord.create({
      data: {
        idempotencyKey,
        userId,
        porterId,
        operation,
        response: response as any,
        statusCode,
        expiresAt,
      },
    });

    logger.info('Stored idempotent response', {
      idempotencyKey,
      operation,
      userId,
    });
  } catch (error) {
    // Log but don't throw - idempotency storage failure shouldn't fail the operation
    logger.error('Error storing idempotency result', {
      error,
      idempotencyKey,
      operation,
    });
  }
}

/**
 * Execute an operation with idempotency protection
 */
export async function withIdempotency<T = unknown>(
  idempotencyKey: string | undefined,
  userId: string,
  porterId: string | null,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  // If no idempotency key provided, just execute the function
  if (!idempotencyKey) {
    return await fn();
  }

  // Check if we have a cached result
  const cached = await checkIdempotency<T>(idempotencyKey, userId, operation);
  if (cached) {
    return cached.response;
  }

  // Execute the operation
  const result = await fn();

  // Store the result for future requests
  await storeIdempotencyResult(
    idempotencyKey,
    userId,
    porterId,
    operation,
    result
  );

  return result;
}

/**
 * Clean up expired idempotency records
 * Should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredIdempotencyRecords(): Promise<number> {
  try {
    const result = await prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    logger.info('Cleaned up expired idempotency records', {
      count: result.count,
    });

    return result.count;
  } catch (error) {
    logger.error('Error cleaning up idempotency records', { error });
    return 0;
  }
}

export default {
  checkIdempotency,
  storeIdempotencyResult,
  withIdempotency,
  cleanupExpiredIdempotencyRecords,
};
