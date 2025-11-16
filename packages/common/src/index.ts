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
  // Bidding events
  BID_OPENED = 'bid.opened',
  BID_PLACED = 'bid.placed',
  BID_ACCEPTED = 'bid.accepted',
  BID_WINNER_SELECTED = 'bid.winner.selected',
  BID_EXPIRED = 'bid.expired',
  BID_CLOSED = 'bid.closed',
  BID_CANCELLED = 'bid.cancelled',
  PORTER_SUSPENDED = 'porter.suspended',
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
 * Bidding-related events
 */
export interface BidOpenedEvent extends BaseEvent {
  type: EventType.BID_OPENED;
  biddingWindowId: string;
  orderIds: string[];
  expiresAt: Date;
  strategyId: string;
  configuration: {
    minBidCents?: number;
    reservePriceCents?: number;
    allowedPorterFilters?: Record<string, any>;
  };
}

export interface BidPlacedEvent extends BaseEvent {
  type: EventType.BID_PLACED;
  bidId: string;
  biddingWindowId: string;
  porterId: string;
  amountCents: number;
  estimatedArrivalMinutes: number;
  placedAt: Date;
}

export interface BidAcceptedEvent extends BaseEvent {
  type: EventType.BID_ACCEPTED;
  bidId: string;
  biddingWindowId: string;
  porterId: string;
  amountCents: number;
  acceptedAt: Date;
  acceptedBy: string; // actor (customer/admin/system)
}

export interface BidWinnerSelectedEvent extends BaseEvent {
  type: EventType.BID_WINNER_SELECTED;
  biddingWindowId: string;
  bidId: string;
  orderIds: string[];
  winnerPorterId: string;
  winningAmountCents: number;
  selectedAt: Date;
}

export interface BidExpiredEvent extends BaseEvent {
  type: EventType.BID_EXPIRED;
  biddingWindowId: string;
  orderIds: string[];
  totalBids: number;
  expiredAt: Date;
}

export interface BidClosedEvent extends BaseEvent {
  type: EventType.BID_CLOSED;
  biddingWindowId: string;
  orderIds: string[];
  closedAt: Date;
  outcome: 'winner_selected' | 'expired' | 'cancelled' | 'no_bids';
  winningBidId?: string;
}

export interface BidCancelledEvent extends BaseEvent {
  type: EventType.BID_CANCELLED;
  bidId: string;
  biddingWindowId: string;
  porterId: string;
  cancelledAt: Date;
  reason: string;
}

export interface PorterSuspendedEvent extends BaseEvent {
  type: EventType.PORTER_SUSPENDED;
  porterId: string;
  suspendedAt: Date;
  reason: string;
}

export interface OrderCancelledEvent extends BaseEvent {
  type: EventType.ORDER_CANCELLED;
  orderId: string;
  cancelledAt: Date;
  reason: string;
}

/**
 * Event union type
 */
export type DomainEvent =
  | OrderCreatedEvent
  | OrderAssignedEvent
  | OrderCompletedEvent
  | PaymentCompletedEvent
  | BidOpenedEvent
  | BidPlacedEvent
  | BidAcceptedEvent
  | BidWinnerSelectedEvent
  | BidExpiredEvent
  | BidClosedEvent
  | BidCancelledEvent
  | PorterSuspendedEvent
  | OrderCancelledEvent;
