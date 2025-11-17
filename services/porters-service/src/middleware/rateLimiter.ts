import { TRPCError } from '@trpc/server';
import { getSessionRedis } from '../lib/redis';
import { logger } from '../lib/logger';

/**
 * Simple rate limiter using Redis
 */
export class RateLimiter {
  private windowSeconds: number;
  private maxRequests: number;

  constructor(maxRequests: number, windowSeconds: number) {
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
  }

  async checkLimit(key: string): Promise<void> {
    const redis = getSessionRedis();
    const redisKey = `ratelimit:${key}`;

    const current = await redis.incr(redisKey);

    if (current === 1) {
      // First request in window, set expiration
      await redis.expire(redisKey, this.windowSeconds);
    }

    if (current > this.maxRequests) {
      logger.warn('Rate limit exceeded', { key, current, max: this.maxRequests });
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded',
      });
    }
  }

  async getRemainingRequests(key: string): Promise<number> {
    const redis = getSessionRedis();
    const redisKey = `ratelimit:${key}`;

    const current = await redis.get(redisKey);
    const currentCount = current ? parseInt(current) : 0;

    return Math.max(0, this.maxRequests - currentCount);
  }
}

// Create rate limiters for different operations
export const locationUpdateLimiter = new RateLimiter(
  parseInt(process.env.LOCATION_UPDATE_RATE_LIMIT || '10'),
  parseInt(process.env.LOCATION_UPDATE_WINDOW_SECONDS || '1')
);

export default RateLimiter;
