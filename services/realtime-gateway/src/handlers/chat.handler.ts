import { Server } from 'socket.io';
import {
  SocketEvent,
  ChatMessageSendPayload,
  ChatMessageSendPayloadSchema,
  ChatMessageEvent,
  TypingIndicatorPayload,
  TypingIndicatorPayloadSchema,
} from '@movenow/common';
import { AuthenticatedSocket, ChatMessage } from '../types';
import { kafkaService } from '../services/kafka.service';
import { metricsService } from '../services/metrics.service';
import { rateLimiter } from '../middleware/rateLimiter';
import { createLogger } from '../lib/logger';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export class ChatHandler {
  constructor(private io: Server) {}

  /**
   * Handle chat message from client
   */
  async handleChatMessage(
    socket: AuthenticatedSocket,
    payload: ChatMessageSendPayload
  ): Promise<void> {
    const log = createLogger({
      correlationId: socket.correlationId,
      socketId: socket.id,
      userId: socket.userId,
    });

    const endTimer = metricsService.timeMessageProcessing(SocketEvent.CHAT_MESSAGE_SEND);

    try {
      // Validate role
      if (socket.role !== 'CUSTOMER' && socket.role !== 'PORTER') {
        socket.emit(SocketEvent.CHAT_MESSAGE_ERROR, {
          error: 'FORBIDDEN',
          message: 'Only customers and porters can send chat messages',
        });
        return;
      }

      // Check rate limit
      const allowed = await rateLimiter.checkChat(socket);
      if (!allowed) {
        socket.emit(SocketEvent.CHAT_MESSAGE_ERROR, {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many chat messages',
        });
        return;
      }

      // Validate payload
      const result = ChatMessageSendPayloadSchema.safeParse(payload);
      if (!result.success) {
        socket.emit(SocketEvent.CHAT_MESSAGE_ERROR, {
          error: 'INVALID_PAYLOAD',
          message: result.error.message,
        });
        return;
      }

      const { orderId, message, tempId } = result.data;

      // TODO: Verify that the user is part of this order (customer or assigned porter)
      // For now, we trust the authorization middleware

      // Create message
      const messageId = uuidv4();
      const chatMessage: ChatMessage = {
        messageId,
        orderId,
        senderId: socket.userId,
        senderRole: socket.role,
        message,
        timestamp: Date.now(),
      };

      // Persist to Kafka for storage
      await kafkaService.publish(config.topics.chatEvents, {
        type: 'chat.message.sent',
        timestamp: Date.now(),
        correlationId: socket.correlationId,
        payload: chatMessage,
      });

      // Create event for subscribers
      const chatEvent: ChatMessageEvent = {
        messageId,
        orderId,
        senderId: socket.userId,
        senderRole: socket.role,
        message,
        timestamp: chatMessage.timestamp,
        tempId,
      };

      // Send to all subscribed users (in order room)
      this.io.to(`order:${orderId}`).emit(SocketEvent.CHAT_MESSAGE_RECEIVED, chatEvent);

      log.info('Chat message sent', {
        messageId,
        orderId,
        messageLength: message.length,
      });

      metricsService.recordChatMessage('inbound');
      metricsService.recordChatMessage('outbound');
    } catch (error) {
      log.error('Error handling chat message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      socket.emit(SocketEvent.CHAT_MESSAGE_ERROR, {
        error: 'INTERNAL_ERROR',
        message: 'Failed to send chat message',
      });
      metricsService.recordMessageError(SocketEvent.CHAT_MESSAGE_SEND, 'internal');
    } finally {
      endTimer();
    }
  }

  /**
   * Handle typing indicator
   */
  async handleTypingStart(
    socket: AuthenticatedSocket,
    payload: TypingIndicatorPayload
  ): Promise<void> {
    const log = createLogger({
      correlationId: socket.correlationId,
      socketId: socket.id,
      userId: socket.userId,
    });

    try {
      // Validate payload
      const result = TypingIndicatorPayloadSchema.safeParse(payload);
      if (!result.success) {
        return; // Silent fail for typing indicators
      }

      const { orderId } = result.data;

      // Broadcast to other users in the order room
      socket.to(`order:${orderId}`).emit(SocketEvent.CHAT_TYPING_START, {
        orderId,
        userId: socket.userId,
        role: socket.role,
      });

      log.debug('Typing indicator sent', { orderId });
    } catch (error) {
      // Silent fail for typing indicators
      log.debug('Error handling typing indicator', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle typing stop indicator
   */
  async handleTypingStop(
    socket: AuthenticatedSocket,
    payload: TypingIndicatorPayload
  ): Promise<void> {
    const log = createLogger({
      correlationId: socket.correlationId,
      socketId: socket.id,
      userId: socket.userId,
    });

    try {
      // Validate payload
      const result = TypingIndicatorPayloadSchema.safeParse(payload);
      if (!result.success) {
        return; // Silent fail for typing indicators
      }

      const { orderId } = result.data;

      // Broadcast to other users in the order room
      socket.to(`order:${orderId}`).emit(SocketEvent.CHAT_TYPING_STOP, {
        orderId,
        userId: socket.userId,
        role: socket.role,
      });

      log.debug('Typing stop sent', { orderId });
    } catch (error) {
      // Silent fail for typing indicators
      log.debug('Error handling typing stop', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Deliver a chat message from external source (Kafka or API)
   */
  async deliverChatMessage(chatEvent: ChatMessageEvent): Promise<void> {
    const log = createLogger({ correlationId: chatEvent.orderId });

    try {
      // Send to all subscribed users in order room
      this.io.to(`order:${chatEvent.orderId}`).emit(
        SocketEvent.CHAT_MESSAGE_RECEIVED,
        chatEvent
      );

      log.info('Chat message delivered', {
        messageId: chatEvent.messageId,
        orderId: chatEvent.orderId,
      });

      metricsService.recordChatMessage('outbound');
      metricsService.recordMessageSent('chat', SocketEvent.CHAT_MESSAGE_RECEIVED);
    } catch (error) {
      log.error('Error delivering chat message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      metricsService.recordDeliveryFailure(SocketEvent.CHAT_MESSAGE_RECEIVED);
    }
  }
}
