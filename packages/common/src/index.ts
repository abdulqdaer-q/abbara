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
 * Currency schema
 */
export const CurrencySchema = z.enum(['USD', 'EUR', 'GBP']);
export type Currency = z.infer<typeof CurrencySchema>;

/**
 * Customer type schema
 */
export const CustomerTypeSchema = z.enum(['consumer', 'business', 'enterprise']);
export type CustomerType = z.infer<typeof CustomerTypeSchema>;

/**
 * Item schema for pricing
 */
export const ItemSchema = z.object({
  description: z.string(),
  quantity: z.number().int().min(1),
  weightKg: z.number().min(0).optional(),
  lengthCm: z.number().min(0).optional(),
  widthCm: z.number().min(0).optional(),
  heightCm: z.number().min(0).optional(),
});

export type Item = z.infer<typeof ItemSchema>;

/**
 * Pricing estimate input schema
 */
export const PricingEstimateInputSchema = z.object({
  pickup: LocationSchema,
  dropoff: LocationSchema,
  additionalStops: z.array(LocationSchema).optional(),
  vehicleType: VehicleTypeSchema,
  porterCount: z.number().int().min(0).max(10),
  items: z.array(ItemSchema).optional(),
  scheduledAt: z.date().optional(),
  promoCode: z.string().optional(),
  customerType: CustomerTypeSchema.optional().default('consumer'),
  distanceMeters: z.number().int().min(0).optional(),
  durationSeconds: z.number().int().min(0).optional(),
});

export type PricingEstimateInput = z.infer<typeof PricingEstimateInputSchema>;

/**
 * Price breakdown line item
 */
export const PriceBreakdownItemSchema = z.object({
  type: z.string(),
  ruleId: z.string().optional(),
  amountCents: z.number().int(),
  description: z.string(),
});

export type PriceBreakdownItem = z.infer<typeof PriceBreakdownItemSchema>;

/**
 * Applied rule reference
 */
export const AppliedRuleSchema = z.object({
  ruleId: z.string(),
  ruleVersion: z.number().int(),
  ruleName: z.string(),
  ruleType: z.string(),
});

export type AppliedRule = z.infer<typeof AppliedRuleSchema>;

/**
 * Pricing estimate output schema
 */
export const PricingEstimateOutputSchema = z.object({
  // Breakdown in cents
  baseFareCents: z.number().int().min(0),
  distanceFareCents: z.number().int().min(0),
  timeFareCents: z.number().int().min(0),
  porterFeesCents: z.number().int().min(0),
  surchargesCents: z.number().int().min(0),
  subtotalCents: z.number().int().min(0),
  discountCents: z.number().int().min(0),
  taxCents: z.number().int().min(0),
  serviceFeesCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
  currency: CurrencySchema,

  // Detailed breakdown
  breakdown: z.array(PriceBreakdownItemSchema),

  // Rules applied
  rulesApplied: z.array(AppliedRuleSchema),

  // ETA and distance
  estimatedDistanceMeters: z.number().int().min(0),
  estimatedDurationSeconds: z.number().int().min(0),
  estimatedArrivalTime: z.date().optional(),
});

export type PricingEstimateOutput = z.infer<typeof PricingEstimateOutputSchema>;

/**
 * Pricing snapshot schema
 */
export const PricingSnapshotSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  estimate: PricingEstimateOutputSchema,
  capturedAt: z.date(),
  rulesApplied: z.array(AppliedRuleSchema),
});

export type PricingSnapshot = z.infer<typeof PricingSnapshotSchema>;

/**
 * Pricing-related events
 */
export enum PricingEventType {
  PRICING_RULES_CHANGED = 'pricing.rules.changed',
  PRICE_SNAPSHOT_PERSISTED = 'pricing.snapshot.persisted',
  PRICE_ESTIMATE_REQUESTED = 'pricing.estimate.requested',
}

export interface PricingRulesChangedEvent extends BaseEvent {
  type: EventType.ORDER_CREATED;
  ruleIds: string[];
  changedBy: string;
  changeType: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated';
  effectiveAt: Date;
}

export interface PriceSnapshotPersistedEvent extends BaseEvent {
  type: EventType.ORDER_CREATED;
  snapshotId: string;
  orderId: string;
  totalCents: number;
  currency: Currency;
  vehicleType: VehicleType;
}

export interface PriceEstimateRequestedEvent extends BaseEvent {
  type: EventType.ORDER_CREATED;
  estimateId: string;
  vehicleType: VehicleType;
  distanceMeters: number;
  totalCents: number;
}

/**
 * Event union type
 */
export type DomainEvent =
  | OrderCreatedEvent
  | OrderAssignedEvent
  | OrderCompletedEvent
  | PaymentCompletedEvent
  | PricingRulesChangedEvent
  | PriceSnapshotPersistedEvent
  | PriceEstimateRequestedEvent;
