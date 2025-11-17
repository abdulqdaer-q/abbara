import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { redisService } from '../services/redis.service';
import { metricsService } from '../services/metrics.service';
import { config } from '../config';
import { logger } from '../lib/logger';
import { AuthenticatedSocket } from '../types';

export class RateLimiter {
  private globalLimiter: RateLimiterRedis | RateLimiterMemory;
  private locationLimiter: RateLimiterRedis | RateLimiterMemory;
  private chatLimiter: RateLimiterRedis | RateLimiterMemory;

  constructor() {
    const redisClient = redisService.getClients().client;

    // Global rate limiter
    this.globalLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:global',
      points: config.rateLimit.points,
      duration: config.rateLimit.duration,
    });

    // Location updates rate limiter (higher limit)
    this.locationLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:location',
      points: config.rateLimit.location.points,
      duration: config.rateLimit.location.duration,
    });

    // Chat messages rate limiter
    this.chatLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:chat',
      points: config.rateLimit.chat.points,
      duration: config.rateLimit.chat.duration,
    });
  }

  /**
   * Check global rate limit
   */
  async checkGlobal(socket: AuthenticatedSocket): Promise<boolean> {
    try {
      await this.globalLimiter.consume(socket.userId);
      return true;
    } catch (error) {
      logger.warn('Global rate limit exceeded', {
        userId: socket.userId,
        socketId: socket.id,
      });
      metricsService.recordRateLimited('global', 'general');
      return false;
    }
  }

  /**
   * Check location update rate limit
   */
  async checkLocation(socket: AuthenticatedSocket): Promise<boolean> {
    try {
      await this.locationLimiter.consume(socket.userId);
      return true;
    } catch (error) {
      logger.warn('Location rate limit exceeded', {
        userId: socket.userId,
        socketId: socket.id,
      });
      metricsService.recordRateLimited('porter', 'location');
      return false;
    }
  }

  /**
   * Check chat message rate limit
   */
  async checkChat(socket: AuthenticatedSocket): Promise<boolean> {
    try {
      await this.chatLimiter.consume(socket.userId);
      return true;
    } catch (error) {
      logger.warn('Chat rate limit exceeded', {
        userId: socket.userId,
        socketId: socket.id,
      });
      metricsService.recordRateLimited('chat', 'message');
      return false;
    }
  }
}

export const rateLimiter = new RateLimiter();
