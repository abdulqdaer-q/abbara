import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

let redisClient: Redis | null = null;

/**
 * Get or create Redis client singleton
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: false,
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis client error:', error);
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });
  }

  return redisClient;
}

/**
 * Check if a notification with the given idempotency key has already been processed
 */
export async function checkDuplicateNotification(idempotencyKey: string): Promise<boolean> {
  const client = getRedisClient();
  const key = `notification:idempotency:${idempotencyKey}`;
  const exists = await client.exists(key);
  return exists === 1;
}

/**
 * Mark a notification as processed with the given idempotency key
 */
export async function markNotificationProcessed(idempotencyKey: string, notificationId: string): Promise<void> {
  const client = getRedisClient();
  const key = `notification:idempotency:${idempotencyKey}`;
  // Store for deduplication window
  await client.setex(key, config.deduplicationWindowSeconds, notificationId);
}

/**
 * Check if user has exceeded rate limit for notifications
 */
export async function checkRateLimit(userId: string, channel: string): Promise<{ allowed: boolean; remaining: number }> {
  const client = getRedisClient();
  const key = `ratelimit:${userId}:${channel}`;
  const windowSeconds = 60; // 1 minute window

  const multi = client.multi();
  multi.incr(key);
  multi.expire(key, windowSeconds);
  const results = await multi.exec();

  if (!results || !results[0] || !results[0][1]) {
    return { allowed: true, remaining: config.rateLimitPerUserPerMinute - 1 };
  }

  const count = results[0][1] as number;
  const allowed = count <= config.rateLimitPerUserPerMinute;
  const remaining = Math.max(0, config.rateLimitPerUserPerMinute - count);

  return { allowed, remaining };
}

/**
 * Cache user preferences for quick access
 */
export async function cacheUserPreferences(userId: string, preferences: unknown): Promise<void> {
  const client = getRedisClient();
  const key = `user:preferences:${userId}`;
  await client.setex(key, 3600, JSON.stringify(preferences)); // Cache for 1 hour
}

/**
 * Get cached user preferences
 */
export async function getCachedUserPreferences(userId: string): Promise<unknown | null> {
  const client = getRedisClient();
  const key = `user:preferences:${userId}`;
  const cached = await client.get(key);

  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached);
  } catch (error) {
    logger.error('Failed to parse cached user preferences:', error);
    return null;
  }
}

/**
 * Invalidate cached user preferences
 */
export async function invalidateUserPreferencesCache(userId: string): Promise<void> {
  const client = getRedisClient();
  const key = `user:preferences:${userId}`;
  await client.del(key);
}

/**
 * Store failed notification for retry processing
 */
export async function queueNotificationForRetry(notificationId: string, retryAt: Date): Promise<void> {
  const client = getRedisClient();
  const key = 'notification:retry:queue';
  const score = retryAt.getTime();
  await client.zadd(key, score, notificationId);
}

/**
 * Get notifications that are ready for retry
 */
export async function getNotificationsReadyForRetry(limit: number = 100): Promise<string[]> {
  const client = getRedisClient();
  const key = 'notification:retry:queue';
  const now = Date.now();

  // Get notifications with score (timestamp) <= now
  const notificationIds = await client.zrangebyscore(key, 0, now, 'LIMIT', 0, limit);

  // Remove them from the queue
  if (notificationIds.length > 0) {
    await client.zrem(key, ...notificationIds);
  }

  return notificationIds;
}

/**
 * Track active conversation for real-time updates
 */
export async function trackActiveConversation(userId: string, conversationId: string): Promise<void> {
  const client = getRedisClient();
  const key = `user:active:conversation:${userId}`;
  await client.setex(key, 3600, conversationId); // Active for 1 hour
}

/**
 * Get user's active conversation
 */
export async function getActiveConversation(userId: string): Promise<string | null> {
  const client = getRedisClient();
  const key = `user:active:conversation:${userId}`;
  return await client.get(key);
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
