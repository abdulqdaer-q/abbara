import { middleware } from '../trpc';
import { getRedisClient } from '../lib/redis';
import { config } from '../config';
import { logger } from '../lib/logger';
import { idempotencyHitCounter } from '../lib/metrics';
import crypto from 'crypto';

/**
 * Middleware to enforce idempotency for mutating procedures
 * Uses Redis to store idempotency keys and their responses
 */
export const idempotency = middleware(async ({ ctx, next, path, rawInput }) => {
  const input = rawInput as any;

  // Skip if no idempotency key provided (for queries)
  if (!input?.idempotencyKey) {
    return next();
  }

  const idempotencyKey = input.idempotencyKey as string;
  const redis = getRedisClient();

  try {
    // Check if we've seen this idempotency key before
    const cachedResponse = await redis.getIdempotency(idempotencyKey);

    if (cachedResponse) {
      // Return cached response
      logger.info('Idempotency key hit', {
        idempotencyKey,
        procedure: path,
        correlationId: ctx.correlationId,
      });

      idempotencyHitCounter.inc({ procedure: path });

      return cachedResponse;
    }

    // Execute the procedure
    const result = await next();

    // Store the result with the idempotency key
    // Hash the input to detect if same key is used with different inputs
    const inputHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');

    await redis.setIdempotency(
      idempotencyKey,
      {
        result,
        inputHash,
        timestamp: new Date().toISOString(),
      },
      config.idempotency.ttlSeconds
    );

    logger.info('Idempotency key stored', {
      idempotencyKey,
      procedure: path,
      correlationId: ctx.correlationId,
    });

    return result;
  } catch (error) {
    logger.error('Idempotency middleware error', {
      error,
      idempotencyKey,
      procedure: path,
    });
    throw error;
  }
});
