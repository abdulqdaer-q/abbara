import { Server, Socket } from 'socket.io';
import { SocketEvent } from '@movenow/common';
import { AuthenticatedSocket, SocketUserData } from '../types';
import { redisService } from '../services/redis.service';
import { metricsService } from '../services/metrics.service';
import { logger, createLogger } from '../lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export class AuthHandler {
  constructor(private io: Server) {}

  /**
   * Handle socket connection
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const log = createLogger({
      correlationId: socket.correlationId,
      socketId: socket.id,
      userId: socket.userId,
    });

    try {
      // Store socket-user mapping in Redis
      const userData: SocketUserData = {
        socketId: socket.id,
        userId: socket.userId,
        role: socket.role,
        connectedAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      await redisService.storeSocketUser(socket.id, userData);
      await redisService.addUserSocket(socket.userId, socket.id);

      log.info('User connected', {
        role: socket.role,
        namespace: socket.nsp.name,
      });

      // Send authenticated confirmation
      socket.emit(SocketEvent.AUTHENTICATED, {
        success: true,
        userId: socket.userId,
        role: socket.role,
      });

      // Record metrics
      metricsService.recordConnection(socket.nsp.name);

      // Publish presence event if porter
      if (socket.role === 'PORTER') {
        socket.to('admin').emit(SocketEvent.PORTER_ONLINE, {
          porterId: socket.userId,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      log.error('Error handling connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle socket disconnection
   */
  async handleDisconnection(socket: AuthenticatedSocket, reason: string): Promise<void> {
    const log = createLogger({
      correlationId: socket.correlationId,
      socketId: socket.id,
      userId: socket.userId,
    });

    try {
      log.info('User disconnected', {
        reason,
        role: socket.role,
        namespace: socket.nsp.name,
      });

      // Generate reconnect token for the user
      const reconnectToken = uuidv4();
      const userData = await redisService.getSocketUser(socket.id);
      if (userData) {
        await redisService.storeReconnectToken(reconnectToken, userData);
      }

      // Clean up Redis
      await redisService.removeSocketUser(socket.id);
      await redisService.removeUserSocket(socket.userId, socket.id);

      // Record metrics
      metricsService.recordDisconnection(socket.nsp.name, reason);

      // Publish presence event if porter
      if (socket.role === 'PORTER') {
        const remainingSockets = await redisService.getUserSockets(socket.userId);
        if (remainingSockets.length === 0) {
          socket.to('admin').emit(SocketEvent.PORTER_OFFLINE, {
            porterId: socket.userId,
            timestamp: Date.now(),
          });
        }
      }

      // Send reconnect token before disconnect
      socket.emit(SocketEvent.DISCONNECT_REASON, {
        reason,
        reconnectToken,
      });
    } catch (error) {
      log.error('Error handling disconnection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle reconnection with token
   */
  async handleReconnect(socket: AuthenticatedSocket, payload: any): Promise<void> {
    const log = createLogger({
      correlationId: socket.correlationId,
      socketId: socket.id,
      userId: socket.userId,
    });

    try {
      const { reconnectToken } = payload;

      if (!reconnectToken) {
        socket.emit(SocketEvent.AUTH_ERROR, {
          error: 'INVALID_RECONNECT_TOKEN',
          message: 'Reconnect token is required',
        });
        return;
      }

      const userData = await redisService.getReconnectToken(reconnectToken);

      if (!userData) {
        socket.emit(SocketEvent.AUTH_ERROR, {
          error: 'EXPIRED_RECONNECT_TOKEN',
          message: 'Reconnect token has expired',
        });
        return;
      }

      log.info('User reconnected', {
        previousSocketId: userData.socketId,
      });

      // Record metrics
      metricsService.recordReconnection(socket.nsp.name);

      // TODO: Restore subscriptions and replay missed events
      // This would require storing subscription state and recent events
    } catch (error) {
      log.error('Error handling reconnect', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      socket.emit(SocketEvent.AUTH_ERROR, {
        error: 'RECONNECT_FAILED',
        message: 'Failed to reconnect',
      });
    }
  }

  /**
   * Handle heartbeat
   */
  async handleHeartbeat(socket: AuthenticatedSocket, payload: any): Promise<void> {
    // Update last activity timestamp
    try {
      const userData = await redisService.getSocketUser(socket.id);
      if (userData) {
        userData.lastActivityAt = Date.now();
        await redisService.storeSocketUser(socket.id, userData);
      }

      // Echo heartbeat back
      socket.emit(SocketEvent.HEARTBEAT, {
        timestamp: Date.now(),
      });
    } catch (error) {
      // Silent fail for heartbeat
    }
  }
}
