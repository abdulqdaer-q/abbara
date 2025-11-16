import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../lib/logger';
import {
  SocketUserData,
  OrderSubscription,
  PorterLocation,
  JobOffer,
  RedisKey,
} from '../types';

export class RedisService {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  constructor() {
    const redisConfig = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      keyPrefix: config.redis.keyPrefix,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    this.client = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    this.publisher = new Redis(redisConfig);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    this.subscriber.on('error', (err) => {
      logger.error('Redis subscriber error', { error: err.message });
    });

    this.publisher.on('error', (err) => {
      logger.error('Redis publisher error', { error: err.message });
    });
  }

  /**
   * Get Redis clients for Socket.IO adapter
   */
  getClients() {
    return {
      client: this.client,
      subscriber: this.subscriber,
      publisher: this.publisher,
    };
  }

  /**
   * Store socket-to-user mapping
   */
  async storeSocketUser(socketId: string, userData: SocketUserData): Promise<void> {
    const key = `${RedisKey.SOCKET_USER}:${socketId}`;
    await this.client.setex(key, config.session.ttl, JSON.stringify(userData));
  }

  /**
   * Get user data by socket ID
   */
  async getSocketUser(socketId: string): Promise<SocketUserData | null> {
    const key = `${RedisKey.SOCKET_USER}:${socketId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Remove socket-to-user mapping
   */
  async removeSocketUser(socketId: string): Promise<void> {
    const key = `${RedisKey.SOCKET_USER}:${socketId}`;
    await this.client.del(key);
  }

  /**
   * Store user-to-socket mapping (supports multiple sockets per user)
   */
  async addUserSocket(userId: string, socketId: string): Promise<void> {
    const key = `${RedisKey.USER_SOCKET}:${userId}`;
    await this.client.sadd(key, socketId);
    await this.client.expire(key, config.session.ttl);
  }

  /**
   * Remove user-to-socket mapping
   */
  async removeUserSocket(userId: string, socketId: string): Promise<void> {
    const key = `${RedisKey.USER_SOCKET}:${userId}`;
    await this.client.srem(key, socketId);
  }

  /**
   * Get all socket IDs for a user
   */
  async getUserSockets(userId: string): Promise<string[]> {
    const key = `${RedisKey.USER_SOCKET}:${userId}`;
    return await this.client.smembers(key);
  }

  /**
   * Subscribe to an order
   */
  async subscribeToOrder(orderId: string, subscription: OrderSubscription): Promise<void> {
    const key = `${RedisKey.ORDER_SUBSCRIPTION}:${orderId}`;
    await this.client.sadd(key, JSON.stringify(subscription));
    await this.client.expire(key, config.session.subscriptionTtl);
  }

  /**
   * Unsubscribe from an order
   */
  async unsubscribeFromOrder(orderId: string, userId: string): Promise<void> {
    const key = `${RedisKey.ORDER_SUBSCRIPTION}:${orderId}`;
    const members = await this.client.smembers(key);

    for (const member of members) {
      const subscription: OrderSubscription = JSON.parse(member);
      if (subscription.userId === userId) {
        await this.client.srem(key, member);
      }
    }
  }

  /**
   * Get all subscriptions for an order
   */
  async getOrderSubscriptions(orderId: string): Promise<OrderSubscription[]> {
    const key = `${RedisKey.ORDER_SUBSCRIPTION}:${orderId}`;
    const members = await this.client.smembers(key);
    return members.map((m) => JSON.parse(m));
  }

  /**
   * Store porter location
   */
  async storePorterLocation(porterId: string, location: PorterLocation): Promise<void> {
    const key = `${RedisKey.PORTER_LOCATION}:${porterId}`;
    await this.client.setex(key, config.location.ttl, JSON.stringify(location));
  }

  /**
   * Get porter location
   */
  async getPorterLocation(porterId: string): Promise<PorterLocation | null> {
    const key = `${RedisKey.PORTER_LOCATION}:${porterId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Store job offer
   */
  async storeJobOffer(offerId: string, offer: JobOffer): Promise<void> {
    const key = `${RedisKey.JOB_OFFER}:${offerId}`;
    const ttl = Math.ceil((offer.expiresAt - Date.now()) / 1000);
    await this.client.setex(key, ttl > 0 ? ttl : 60, JSON.stringify(offer));
  }

  /**
   * Get job offer
   */
  async getJobOffer(offerId: string): Promise<JobOffer | null> {
    const key = `${RedisKey.JOB_OFFER}:${offerId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Remove job offer
   */
  async removeJobOffer(offerId: string): Promise<void> {
    const key = `${RedisKey.JOB_OFFER}:${offerId}`;
    await this.client.del(key);
  }

  /**
   * Store reconnect token
   */
  async storeReconnectToken(token: string, socketData: SocketUserData): Promise<void> {
    const key = `${RedisKey.RECONNECT_TOKEN}:${token}`;
    await this.client.setex(key, 3600, JSON.stringify(socketData)); // 1 hour
  }

  /**
   * Get reconnect token data
   */
  async getReconnectToken(token: string): Promise<SocketUserData | null> {
    const key = `${RedisKey.RECONNECT_TOKEN}:${token}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const key = `${RedisKey.USER_SOCKET}:${userId}`;
    const count = await this.client.scard(key);
    return count > 0;
  }

  /**
   * Get active connections count
   */
  async getActiveConnectionsCount(): Promise<number> {
    const pattern = `${config.redis.keyPrefix}${RedisKey.SOCKET_USER}:*`;
    const keys = await this.client.keys(pattern);
    return keys.length;
  }

  /**
   * Publish a message to a channel (for cross-instance communication)
   */
  async publish(channel: string, message: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  /**
   * Subscribe to a channel (for cross-instance communication)
   */
  async subscribe(channel: string, handler: (message: any) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        handler(JSON.parse(msg));
      }
    });
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
    await this.subscriber.quit();
    await this.publisher.quit();
    logger.info('Redis connections closed');
  }
}

export const redisService = new RedisService();
