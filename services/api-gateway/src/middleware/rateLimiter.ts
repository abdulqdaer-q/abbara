import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { Request } from 'express';

/**
 * IP-based rate limiter for public endpoints
 */
export const ipRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use X-Forwarded-For if behind proxy, otherwise use IP
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    }
    return req.ip || 'unknown';
  },
});

/**
 * User-based rate limiter for authenticated endpoints
 * More lenient than IP-based limiter
 */
export const userRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests * 2, // 2x the IP limit for authenticated users
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting if no auth header (will be caught by auth middleware)
    return !req.headers.authorization;
  },
  keyGenerator: (req: Request) => {
    // Extract user ID from JWT if available
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return 'unauthenticated';
    }

    try {
      // Simple extraction without full verification (already done in context)
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );
      return `user:${payload.userId}`;
    } catch {
      return 'invalid-token';
    }
  },
});

/**
 * Stricter rate limiter for sensitive operations (login, signup, password reset)
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});
