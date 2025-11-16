import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

/**
 * Redis client singleton
 */
let redisClient: Redis;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      password: config.redisPassword,
      db: config.redisDb,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection retry attempt ${times}`, { delay });
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    redisClient.on('close', () => {
      logger.warn('Redis client connection closed');
    });
  }

  return redisClient;
}

/**
 * Gracefully disconnect Redis
 */
export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis client disconnected');
  }
}

/**
 * Redis lock implementation for distributed locking
 */
export class RedisLock {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Acquire lock with automatic expiry
   * Returns lock token if successful, null otherwise
   */
  async acquire(
    key: string,
    ttlSeconds: number = 30
  ): Promise<string | null> {
    const lockToken = `lock:${Date.now()}:${Math.random()}`;
    const result = await this.redis.set(
      `lock:${key}`,
      lockToken,
      'EX',
      ttlSeconds,
      'NX'
    );

    return result === 'OK' ? lockToken : null;
  }

  /**
   * Release lock if token matches
   */
  async release(key: string, token: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, `lock:${key}`, token);
    return result === 1;
  }

  /**
   * Execute function with lock
   */
  async withLock<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>
  ): Promise<T> {
    const token = await this.acquire(key, ttlSeconds);
    if (!token) {
      throw new Error(`Failed to acquire lock for key: ${key}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }
}

export function getRedisLock(): RedisLock {
  return new RedisLock(getRedisClient());
}
