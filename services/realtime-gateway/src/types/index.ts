import { UserRole } from '@movenow/common';
import { Socket } from 'socket.io';

/**
 * Authenticated socket with user context
 */
export interface AuthenticatedSocket extends Socket {
  userId: string;
  role: UserRole;
  correlationId: string;
  authenticated: boolean;
}

/**
 * Socket user data stored in Redis
 */
export interface SocketUserData {
  socketId: string;
  userId: string;
  role: UserRole;
  connectedAt: number;
  lastActivityAt: number;
}

/**
 * Order subscription data
 */
export interface OrderSubscription {
  orderId: string;
  userId: string;
  role: UserRole;
  subscribedAt: number;
}

/**
 * Porter location data
 */
export interface PorterLocation {
  porterId: string;
  orderId?: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

/**
 * Job offer data
 */
export interface JobOffer {
  offerId: string;
  orderId: string;
  porterId: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

/**
 * Chat message for persistence
 */
export interface ChatMessage {
  messageId: string;
  orderId: string;
  senderId: string;
  senderRole: UserRole;
  message: string;
  timestamp: number;
}

/**
 * Kafka message envelope
 */
export interface KafkaMessage<T = any> {
  type: string;
  timestamp: number;
  correlationId: string;
  payload: T;
}

/**
 * Metrics data
 */
export interface MetricsData {
  activeConnections: number;
  activeConnectionsByNamespace: Record<string, number>;
  messagesPerSecond: number;
  locationUpdatesPerSecond: number;
  chatMessagesPerSecond: number;
  averageFanoutLatency: number;
  reconnectionsPerMinute: number;
  failedDeliveries: number;
  redisHitRate: number;
  redisMissRate: number;
}

/**
 * Socket namespaces
 */
export enum SocketNamespace {
  CLIENT = '/client',
  PORTER = '/porter',
  ADMIN = '/admin',
  NOTIFICATIONS = '/notifications',
}

/**
 * Redis key patterns
 */
export enum RedisKey {
  SOCKET_USER = 'socket:user',
  USER_SOCKET = 'user:socket',
  ORDER_SUBSCRIPTION = 'order:subscription',
  PORTER_LOCATION = 'porter:location',
  JOB_OFFER = 'job:offer',
  RECONNECT_TOKEN = 'reconnect:token',
  RATE_LIMIT = 'rate:limit',
}
