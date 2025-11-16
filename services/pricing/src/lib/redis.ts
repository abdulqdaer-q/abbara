import Redis from 'ioredis';
import { config } from '../config';
import { logger, logCacheEvent } from './logger';

/**
 * Redis client for caching
 */
export const redis = new Redis(config.redisUrl, {
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn('Redis retry attempt', { times, delay });
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('error', (error) => {
  logger.error('Redis error', { error: error.message });
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('ready', () => {
  logger.info('Redis ready');
});

/**
 * Get cached value
 */
export async function getCached<T>(
  key: string,
  correlationId: string
): Promise<T | null> {
  try {
    const value = await redis.get(key);
    const hit = value !== null;

    logCacheEvent({
      correlationId,
      cacheKey: key,
      hit,
    });

    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Cache get error', { key, error });
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number,
  correlationId: string
): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));

    logCacheEvent({
      correlationId,
      cacheKey: key,
      hit: false,
      ttlSeconds,
    });
  } catch (error) {
    logger.error('Cache set error', { key, error });
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(
  key: string,
  correlationId: string
): Promise<void> {
  try {
    await redis.del(key);
    logger.debug('Cache deleted', { key, correlationId });
  } catch (error) {
    logger.error('Cache delete error', { key, error });
  }
}

/**
 * Delete cached values by pattern
 */
export async function deleteCachedByPattern(
  pattern: string,
  correlationId: string
): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info('Cache pattern deleted', { pattern, count: keys.length, correlationId });
    }
  } catch (error) {
    logger.error('Cache pattern delete error', { pattern, error });
  }
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed', { error });
    return false;
  }
}

/**
 * Gracefully disconnect from Redis
 */
export async function disconnectRedis() {
  await redis.quit();
  logger.info('Redis disconnected');
}
