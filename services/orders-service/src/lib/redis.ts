import Redis from 'ioredis';
import { logger } from './logger';

class RedisClient {
  private client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', { error });
    });

    this.client.on('close', () => {
      logger.info('Redis client disconnected');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis', { error });
      throw new Error('Redis connection failed');
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Store idempotency key with response
   */
  async setIdempotency(
    key: string,
    response: any,
    ttlSeconds: number
  ): Promise<void> {
    await this.client.setex(
      `idempotency:${key}`,
      ttlSeconds,
      JSON.stringify(response)
    );
  }

  /**
   * Get idempotency key response
   */
  async getIdempotency(key: string): Promise<any | null> {
    const value = await this.client.get(`idempotency:${key}`);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Generic set with TTL
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Generic get
   */
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  /**
   * Delete key
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  /**
   * Set expiry on a key
   */
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  /**
   * Health check
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get the raw client (for advanced operations)
   */
  getClient(): Redis {
    return this.client;
  }
}

// Singleton instance
let redisClient: RedisClient | null = null;

export const initRedis = (url: string): RedisClient => {
  if (!redisClient) {
    redisClient = new RedisClient(url);
  }
  return redisClient;
};

export const getRedisClient = (): RedisClient => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initRedis first.');
  }
  return redisClient;
};

export { RedisClient };
