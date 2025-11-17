import { TRPCError } from '@trpc/server';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

/**
 * Get or create Redis client for rate limiting
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected for rate limiting');
    });
  }

  return redisClient;
}

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
}

/**
 * Rate limit checker
 */
export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<void> {
  const {
    windowMs = config.RATE_LIMIT_WINDOW_MS,
    maxRequests = config.RATE_LIMIT_MAX_REQUESTS,
    keyPrefix = 'ratelimit',
  } = options;

  const redis = getRedisClient();
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Use Redis sorted set to track requests in a sliding window
    const multi = redis.multi();

    // Remove old entries outside the window
    multi.zremrangebyscore(key, 0, windowStart);

    // Add current request
    multi.zadd(key, now, `${now}`);

    // Count requests in current window
    multi.zcard(key);

    // Set expiry on the key
    multi.expire(key, Math.ceil(windowMs / 1000));

    const results = await multi.exec();

    if (!results) {
      throw new Error('Redis transaction failed');
    }

    // Get the count from the third command (index 2)
    const count = results[2][1] as number;

    if (count > maxRequests) {
      logger.warn('Rate limit exceeded', {
        identifier,
        count,
        maxRequests,
      });

      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests, please try again later',
      });
    }

    logger.debug('Rate limit check passed', {
      identifier,
      count,
      maxRequests,
    });
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    logger.error('Rate limit check failed', { error });
    // In case of Redis failure, allow the request to proceed
    // This prevents service disruption due to Redis issues
  }
}

/**
 * Get rate limit status
 */
export async function getRateLimitStatus(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<{
  count: number;
  limit: number;
  remaining: number;
  resetAt: Date;
}> {
  const {
    windowMs = config.RATE_LIMIT_WINDOW_MS,
    maxRequests = config.RATE_LIMIT_MAX_REQUESTS,
    keyPrefix = 'ratelimit',
  } = options;

  const redis = getRedisClient();
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const count = await redis.zcount(key, windowStart, now);
  const remaining = Math.max(0, maxRequests - count);
  const resetAt = new Date(now + windowMs);

  return {
    count,
    limit: maxRequests,
    remaining,
    resetAt,
  };
}

/**
 * Cleanup function to close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}
