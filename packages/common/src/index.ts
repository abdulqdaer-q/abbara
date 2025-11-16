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
export const VehicleTypeSchema = z.enum(['sedan', 'suv', 'van', 'truck', 'motorcycle', 'bicycle']);
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
 * Verification Status
 */
export const VerificationStatusSchema = z.enum([
  'pending',
  'under_review',
  'verified',
  'rejected',
  'resubmit_required',
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

/**
 * Porter Profile Schema
 */
export const PorterProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  email: z.string(),
  vehicleType: VehicleTypeSchema,
  verificationStatus: VerificationStatusSchema,
  rating: z.number().min(0).max(5),
  completedJobsCount: z.number().int().min(0),
  isActive: z.boolean(),
  isSuspended: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PorterProfile = z.infer<typeof PorterProfileSchema>;

/**
 * Events
 */
export enum EventType {
  // Order events
  ORDER_CREATED = 'order.created',
  ORDER_CONFIRMED = 'order.confirmed',
  ORDER_ASSIGNED = 'order.assigned',
  ORDER_STARTED = 'order.started',
  ORDER_COMPLETED = 'order.completed',
  ORDER_CANCELLED = 'order.cancelled',

  // Payment events
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_PAYOUT_PROCESSED = 'payment.payout.processed',

  // Porter events
  PORTER_REGISTERED = 'porter.registered',
  PORTER_VERIFICATION_REQUESTED = 'porter.verification.requested',
  PORTER_VERIFIED = 'porter.verified',
  PORTER_VERIFICATION_REJECTED = 'porter.verification.rejected',
  PORTER_ONLINE = 'porter.online',
  PORTER_OFFLINE = 'porter.offline',
  PORTER_LOCATION_UPDATED = 'porter.location.updated',
  PORTER_OFFER_CREATED = 'porter.offer.created',
  PORTER_OFFER_EXPIRED = 'porter.offer.expired',
  PORTER_ACCEPTED_JOB = 'porter.accepted.job',
  PORTER_REJECTED_JOB = 'porter.rejected.job',
  PORTER_COMPLETED_JOB = 'porter.completed.job',
  PORTER_SUSPENDED = 'porter.suspended',
  PORTER_UNSUSPENDED = 'porter.unsuspended',
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

export interface PaymentPayoutProcessedEvent extends BaseEvent {
  type: EventType.PAYMENT_PAYOUT_PROCESSED;
  payoutId: string;
  porterId: string;
  amountCents: number;
  status: 'completed' | 'failed';
}

/**
 * Porter Events
 */
export interface PorterRegisteredEvent extends BaseEvent {
  type: EventType.PORTER_REGISTERED;
  porterId: string;
  userId: string;
  vehicleType: VehicleType;
}

export interface PorterVerificationRequestedEvent extends BaseEvent {
  type: EventType.PORTER_VERIFICATION_REQUESTED;
  porterId: string;
  userId: string;
}

export interface PorterVerifiedEvent extends BaseEvent {
  type: EventType.PORTER_VERIFIED;
  porterId: string;
  userId: string;
  verifiedBy: string;
}

export interface PorterVerificationRejectedEvent extends BaseEvent {
  type: EventType.PORTER_VERIFICATION_REJECTED;
  porterId: string;
  userId: string;
  reason: string;
}

export interface PorterOnlineEvent extends BaseEvent {
  type: EventType.PORTER_ONLINE;
  porterId: string;
  userId: string;
  location?: { lat: number; lng: number };
}

export interface PorterOfflineEvent extends BaseEvent {
  type: EventType.PORTER_OFFLINE;
  porterId: string;
  userId: string;
}

export interface PorterLocationUpdatedEvent extends BaseEvent {
  type: EventType.PORTER_LOCATION_UPDATED;
  porterId: string;
  userId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  orderId?: string;
}

export interface PorterOfferCreatedEvent extends BaseEvent {
  type: EventType.PORTER_OFFER_CREATED;
  offerId: string;
  orderId: string;
  porterId: string;
  expiresAt: Date;
}

export interface PorterOfferExpiredEvent extends BaseEvent {
  type: EventType.PORTER_OFFER_EXPIRED;
  offerId: string;
  orderId: string;
  porterId: string;
}

export interface PorterAcceptedJobEvent extends BaseEvent {
  type: EventType.PORTER_ACCEPTED_JOB;
  offerId: string;
  orderId: string;
  porterId: string;
  userId: string;
}

export interface PorterRejectedJobEvent extends BaseEvent {
  type: EventType.PORTER_REJECTED_JOB;
  offerId: string;
  orderId: string;
  porterId: string;
  reason?: string;
}

export interface PorterCompletedJobEvent extends BaseEvent {
  type: EventType.PORTER_COMPLETED_JOB;
  orderId: string;
  porterId: string;
  userId: string;
  earningsCents: number;
}

export interface PorterSuspendedEvent extends BaseEvent {
  type: EventType.PORTER_SUSPENDED;
  porterId: string;
  userId: string;
  suspendedBy: string;
  reason: string;
}

export interface PorterUnsuspendedEvent extends BaseEvent {
  type: EventType.PORTER_UNSUSPENDED;
  porterId: string;
  userId: string;
  unsuspendedBy: string;
}

/**
 * Event union type
 */
export type DomainEvent =
  | OrderCreatedEvent
  | OrderAssignedEvent
  | OrderCompletedEvent
  | PaymentCompletedEvent
  | PaymentPayoutProcessedEvent
  | PorterRegisteredEvent
  | PorterVerificationRequestedEvent
  | PorterVerifiedEvent
  | PorterVerificationRejectedEvent
  | PorterOnlineEvent
  | PorterOfflineEvent
  | PorterLocationUpdatedEvent
  | PorterOfferCreatedEvent
  | PorterOfferExpiredEvent
  | PorterAcceptedJobEvent
  | PorterRejectedJobEvent
  | PorterCompletedJobEvent
  | PorterSuspendedEvent
  | PorterUnsuspendedEvent;
