import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { authService } from '../services/auth.service';
import { metricsService } from '../services/metrics.service';
import { logger } from '../lib/logger';
import { getOrCreateCorrelationId } from '../lib/correlation';
import { AuthenticatedSocket } from '../types';

/**
 * Socket authentication middleware
 * Verifies JWT token and attaches user context to socket
 */
export const authMiddleware = async (
  socket: Socket,
  next: (err?: ExtendedError) => void
): Promise<void> => {
  const correlationId = getOrCreateCorrelationId(socket.handshake.headers);

  try {
    // Extract token from handshake
    const token = authService.extractToken(socket.handshake.auth) ||
                  authService.extractToken(socket.handshake.query);

    if (!token) {
      logger.warn('No token provided', {
        correlationId,
        socketId: socket.id,
      });
      metricsService.recordAuthError('no_token');
      return next(new Error('Authentication required'));
    }

    // Verify token
    const payload = authService.verifyToken(token);

    if (!payload) {
      logger.warn('Invalid token', {
        correlationId,
        socketId: socket.id,
      });
      metricsService.recordAuthError('invalid_token');
      return next(new Error('Invalid token'));
    }

    // Attach user context to socket
    const authSocket = socket as AuthenticatedSocket;
    authSocket.userId = payload.userId;
    authSocket.role = payload.role;
    authSocket.correlationId = correlationId;
    authSocket.authenticated = true;

    logger.info('Socket authenticated', {
      correlationId,
      socketId: socket.id,
      userId: payload.userId,
      role: payload.role,
    });

    // Record authentication latency
    metricsService.timeAuthentication();

    next();
  } catch (error) {
    logger.error('Authentication error', {
      correlationId,
      socketId: socket.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    metricsService.recordAuthError('error');
    next(new Error('Authentication failed'));
  }
};
