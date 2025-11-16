import { z } from 'zod';

/**
 * Location schema
 */
export const LocationSchema = z.object({
  address: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type Location = z.infer<typeof LocationSchema>;

/**
 * Vehicle types
 */
export const VehicleTypeSchema = z.enum(['sedan', 'suv', 'van', 'truck']);
export type VehicleType = z.infer<typeof VehicleTypeSchema>;

/**
 * Order status
 */
export const OrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/**
 * Payment method
 */
export const PaymentMethodSchema = z.enum(['card', 'wallet', 'cash']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

/**
 * User role
 */
export const UserRoleSchema = z.enum(['client', 'porter', 'admin', 'superadmin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Create Order Input Schema
 */
export const CreateOrderInput = z.object({
  pickup: LocationSchema,
  dropoff: LocationSchema,
  vehicleType: VehicleTypeSchema,
  porterCount: z.number().int().min(0).max(10),
  scheduledAt: z.date().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateOrderInputType = z.infer<typeof CreateOrderInput>;

/**
 * Order detail schema
 */
export const OrderDetailSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: OrderStatusSchema,
  pickup: LocationSchema,
  dropoff: LocationSchema,
  vehicleType: VehicleTypeSchema,
  porterCount: z.number(),
  priceCents: z.number(),
  scheduledAt: z.date().optional(),
  notes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type OrderDetail = z.infer<typeof OrderDetailSchema>;

/**
 * Porter summary schema
 */
export const PorterSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  vehicleType: VehicleTypeSchema,
  rating: z.number().min(0).max(5),
  distanceMeters: z.number(),
});

export type PorterSummary = z.infer<typeof PorterSummarySchema>;

/**
 * Events
 */
export enum EventType {
  ORDER_CREATED = 'order.created',
  ORDER_CONFIRMED = 'order.confirmed',
  ORDER_ASSIGNED = 'order.assigned',
  ORDER_STARTED = 'order.started',
  ORDER_COMPLETED = 'order.completed',
  ORDER_CANCELLED = 'order.cancelled',
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  PORTER_LOCATION_UPDATED = 'porter.location.updated',
}

export interface BaseEvent {
  type: EventType;
  timestamp: Date;
  correlationId: string;
  userId?: string;
}

export interface OrderCreatedEvent extends BaseEvent {
  type: EventType.ORDER_CREATED;
  orderId: string;
  userId: string;
  pickup: Location;
  dropoff: Location;
  vehicleType: VehicleType;
  porterCount: number;
  priceCents: number;
}

export interface OrderAssignedEvent extends BaseEvent {
  type: EventType.ORDER_ASSIGNED;
  orderId: string;
  porterId: string;
  userId: string;
}

export interface OrderCompletedEvent extends BaseEvent {
  type: EventType.ORDER_COMPLETED;
  orderId: string;
  userId: string;
  porterId: string;
  completedAt: Date;
}

export interface PaymentCompletedEvent extends BaseEvent {
  type: EventType.PAYMENT_COMPLETED;
  orderId: string;
  userId: string;
  amountCents: number;
  method: PaymentMethod;
  transactionId: string;
}

/**
 * Event union type
 */
export type DomainEvent =
  | OrderCreatedEvent
  | OrderAssignedEvent
  | OrderCompletedEvent
  | PaymentCompletedEvent;

/**
 * ========================================
 * SOCKET EVENT TYPES AND SCHEMAS
 * ========================================
 */

/**
 * Socket event names (directions indicated by suffix)
 * C2S = Client to Server
 * S2C = Server to Client
 */
export enum SocketEvent {
  // Connection & Authentication
  AUTHENTICATE = 'auth:authenticate',
  AUTHENTICATED = 'auth:authenticated',
  AUTH_ERROR = 'auth:error',

  // Order Subscriptions
  SUBSCRIBE_ORDER = 'order:subscribe',
  UNSUBSCRIBE_ORDER = 'order:unsubscribe',
  SUBSCRIPTION_CONFIRMED = 'order:subscription:confirmed',
  SUBSCRIPTION_ERROR = 'order:subscription:error',

  // Order Status Updates (S2C)
  ORDER_STATUS_CHANGED = 'order:status:changed',
  ORDER_TIMELINE_UPDATED = 'order:timeline:updated',

  // Location Updates
  LOCATION_UPDATE = 'location:update',
  LOCATION_UPDATED = 'location:updated',
  LOCATION_ERROR = 'location:error',

  // Job Offers (Porter)
  JOB_OFFER_RECEIVED = 'job:offer:received',
  JOB_OFFER_ACCEPT = 'job:offer:accept',
  JOB_OFFER_REJECT = 'job:offer:reject',
  JOB_OFFER_ACCEPTED = 'job:offer:accepted',
  JOB_OFFER_REJECTED = 'job:offer:rejected',
  JOB_OFFER_ERROR = 'job:offer:error',

  // Chat Messages
  CHAT_MESSAGE_SEND = 'chat:message:send',
  CHAT_MESSAGE_RECEIVED = 'chat:message:received',
  CHAT_MESSAGE_ERROR = 'chat:message:error',
  CHAT_TYPING_START = 'chat:typing:start',
  CHAT_TYPING_STOP = 'chat:typing:stop',

  // Notifications
  NOTIFICATION_RECEIVED = 'notification:received',

  // Presence
  PORTER_ONLINE = 'porter:online',
  PORTER_OFFLINE = 'porter:offline',

  // Connection Lifecycle
  HEARTBEAT = 'heartbeat',
  RECONNECT = 'reconnect',
  DISCONNECT_REASON = 'disconnect:reason',
}

/**
 * Socket Authentication Payload
 */
export const SocketAuthPayloadSchema = z.object({
  token: z.string().min(1),
});

export type SocketAuthPayload = z.infer<typeof SocketAuthPayloadSchema>;

/**
 * Socket Authentication Response
 */
export const SocketAuthResponseSchema = z.object({
  success: z.boolean(),
  userId: z.string().optional(),
  role: UserRoleSchema.optional(),
  message: z.string().optional(),
});

export type SocketAuthResponse = z.infer<typeof SocketAuthResponseSchema>;

/**
 * Order Subscription Payload
 */
export const OrderSubscriptionPayloadSchema = z.object({
  orderId: z.string().uuid(),
});

export type OrderSubscriptionPayload = z.infer<typeof OrderSubscriptionPayloadSchema>;

/**
 * Order Subscription Response
 */
export const OrderSubscriptionResponseSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  message: z.string().optional(),
});

export type OrderSubscriptionResponse = z.infer<typeof OrderSubscriptionResponseSchema>;

/**
 * Location Update Payload (C2S from Porter)
 */
export const LocationUpdatePayloadSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  timestamp: z.number(),
});

export type LocationUpdatePayload = z.infer<typeof LocationUpdatePayloadSchema>;

/**
 * Location Update Event (S2C to subscribed clients)
 */
export const LocationUpdateEventSchema = z.object({
  orderId: z.string().uuid(),
  porterId: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number().optional(),
  heading: z.number().optional(),
  speed: z.number().optional(),
  timestamp: z.number(),
});

export type LocationUpdateEvent = z.infer<typeof LocationUpdateEventSchema>;

/**
 * Job Offer Payload (S2C)
 */
export const JobOfferPayloadSchema = z.object({
  offerId: z.string().uuid(),
  orderId: z.string().uuid(),
  pickup: LocationSchema,
  dropoff: LocationSchema,
  vehicleType: VehicleTypeSchema,
  porterCount: z.number(),
  priceCents: z.number(),
  estimatedDistanceMeters: z.number(),
  expiresAt: z.number(),
});

export type JobOfferPayload = z.infer<typeof JobOfferPayloadSchema>;

/**
 * Job Offer Response Payload (C2S)
 */
export const JobOfferResponsePayloadSchema = z.object({
  offerId: z.string().uuid(),
  orderId: z.string().uuid(),
});

export type JobOfferResponsePayload = z.infer<typeof JobOfferResponsePayloadSchema>;

/**
 * Chat Message Payload (C2S)
 */
export const ChatMessageSendPayloadSchema = z.object({
  orderId: z.string().uuid(),
  message: z.string().min(1).max(1000),
  tempId: z.string().optional(),
});

export type ChatMessageSendPayload = z.infer<typeof ChatMessageSendPayloadSchema>;

/**
 * Chat Message Event (S2C)
 */
export const ChatMessageEventSchema = z.object({
  messageId: z.string().uuid(),
  orderId: z.string().uuid(),
  senderId: z.string().uuid(),
  senderRole: UserRoleSchema,
  message: z.string(),
  timestamp: z.number(),
  tempId: z.string().optional(),
});

export type ChatMessageEvent = z.infer<typeof ChatMessageEventSchema>;

/**
 * Typing Indicator Payload
 */
export const TypingIndicatorPayloadSchema = z.object({
  orderId: z.string().uuid(),
});

export type TypingIndicatorPayload = z.infer<typeof TypingIndicatorPayloadSchema>;

/**
 * Order Status Change Event (S2C)
 */
export const OrderStatusChangeEventSchema = z.object({
  orderId: z.string().uuid(),
  status: OrderStatusSchema,
  previousStatus: OrderStatusSchema.optional(),
  timestamp: z.number(),
  metadata: z.record(z.any()).optional(),
});

export type OrderStatusChangeEvent = z.infer<typeof OrderStatusChangeEventSchema>;

/**
 * Notification Event (S2C)
 */
export const NotificationEventSchema = z.object({
  notificationId: z.string().uuid(),
  type: z.enum(['info', 'warning', 'error', 'success']),
  title: z.string(),
  message: z.string(),
  timestamp: z.number(),
  data: z.record(z.any()).optional(),
});

export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

/**
 * Heartbeat Payload
 */
export const HeartbeatPayloadSchema = z.object({
  timestamp: z.number(),
});

export type HeartbeatPayload = z.infer<typeof HeartbeatPayloadSchema>;

/**
 * Reconnect Payload
 */
export const ReconnectPayloadSchema = z.object({
  reconnectToken: z.string(),
  lastEventId: z.string().optional(),
});

export type ReconnectPayload = z.infer<typeof ReconnectPayloadSchema>;

/**
 * Error Response
 */
export const SocketErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  code: z.string().optional(),
});

export type SocketErrorResponse = z.infer<typeof SocketErrorResponseSchema>;
