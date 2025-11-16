import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../lib/logger';
import { UserRole } from '@movenow/common';

export interface TokenPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export class AuthService {
  /**
   * Verify access token (standard JWT)
   */
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const payload = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
      return payload;
    } catch (error) {
      logger.debug('Access token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Verify socket token (can be different from access token)
   */
  verifySocketToken(token: string): TokenPayload | null {
    try {
      const payload = jwt.verify(token, config.jwt.socketSecret) as TokenPayload;
      return payload;
    } catch (error) {
      logger.debug('Socket token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Verify any supported token type
   */
  verifyToken(token: string): TokenPayload | null {
    // Try socket token first (most common for socket connections)
    let payload = this.verifySocketToken(token);
    if (payload) return payload;

    // Fallback to access token
    payload = this.verifyAccessToken(token);
    if (payload) return payload;

    return null;
  }

  /**
   * Generate a socket token for authenticated users
   */
  generateSocketToken(userId: string, role: UserRole): string {
    const payload: TokenPayload = {
      userId,
      role,
    };

    return jwt.sign(payload, config.jwt.socketSecret, {
      expiresIn: config.jwt.socketExpiry,
    });
  }

  /**
   * Extract token from authorization header or query param
   */
  extractToken(auth: any): string | null {
    if (!auth) return null;

    // Check query params (for WebSocket connection)
    if (typeof auth.token === 'string') {
      return auth.token;
    }

    // Check authorization header
    if (typeof auth.authorization === 'string') {
      const parts = auth.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        return parts[1];
      }
    }

    return null;
  }
}

export const authService = new AuthService();
