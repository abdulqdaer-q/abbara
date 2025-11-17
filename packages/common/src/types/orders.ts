import { z } from 'zod';

/**
 * Order Status - Complete lifecycle states
 */
export const OrderStatusSchema = z.enum([
  'CREATED',
  'TENTATIVELY_ASSIGNED',
  'ASSIGNED',
  'ACCEPTED',
  'ARRIVED',
  'LOADED',
  'EN_ROUTE',
  'DELIVERED',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
  'FAILED',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/**
 * Assignment Status
 */
export const AssignmentStatusSchema = z.enum([
  'OFFERED',
  'TENTATIVE',
  'ACCEPTED',
  'REJECTED',
  'REVOKED',
  'EXPIRED',
]);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

/**
 * Waypoint Status
 */
export const WaypointStatusSchema = z.enum([
  'PENDING',
  'ARRIVED',
  'COMPLETED',
  'SKIPPED',
]);
export type WaypointStatus = z.infer<typeof WaypointStatusSchema>;

/**
 * Evidence Type
 */
export const EvidenceTypeSchema = z.enum([
  'PRE_MOVE',
  'POST_MOVE',
  'DAMAGE',
  'SIGNATURE',
  'OTHER',
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

/**
 * Cancellation Reason
 */
export const CancellationReasonSchema = z.enum([
  'CUSTOMER_REQUEST',
  'PORTER_UNAVAILABLE',
  'PRICING_ISSUE',
  'FRAUD_DETECTED',
  'DUPLICATE_ORDER',
  'CUSTOMER_NO_SHOW',
  'WEATHER',
  'VEHICLE_ISSUE',
  'OTHER',
]);
export type CancellationReason = z.infer<typeof CancellationReasonSchema>;

/**
 * Stop Type
 */
export const StopTypeSchema = z.enum(['pickup', 'dropoff']);
export type StopType = z.infer<typeof StopTypeSchema>;

/**
 * Actor Type
 */
export const ActorTypeSchema = z.enum(['customer', 'porter', 'admin', 'system']);
export type ActorType = z.infer<typeof ActorTypeSchema>;

/**
 * Order Item Schema
 */
export const OrderItemInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  quantity: z.number().int().min(1).max(100).default(1),
  lengthCm: z.number().positive().optional(),
  widthCm: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  weightKg: z.number().positive().optional(),
  photos: z.array(z.object({
    url: z.string().url(),
    checksum: z.string().optional(),
    uploadedAt: z.string().datetime().optional(),
  })).optional(),
  isFragile: z.boolean().default(false),
  isHeavy: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});
export type OrderItemInput = z.infer<typeof OrderItemInputSchema>;

/**
 * Order Stop Schema
 */
export const OrderStopInputSchema = z.object({
  sequence: z.number().int().min(0),
  address: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  stopType: StopTypeSchema,
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  instructions: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
});
export type OrderStopInput = z.infer<typeof OrderStopInputSchema>;

/**
 * Pricing Breakdown Schema
 */
export const PricingBreakdownSchema = z.object({
  baseFareCents: z.number().int().min(0),
  distanceFareCents: z.number().int().min(0),
  timeFareCents: z.number().int().min(0),
  porterFeesCents: z.number().int().min(0),
  surgeMultiplier: z.number().min(1).default(1),
  taxCents: z.number().int().min(0),
  discountCents: z.number().int().min(0).default(0),
  totalCents: z.number().int().min(0),
  estimatedDistanceKm: z.number().positive().optional(),
  estimatedTimeMinutes: z.number().int().positive().optional(),
  pricingVersion: z.string().optional(),
  breakdown: z.record(z.any()).optional(),
});
export type PricingBreakdown = z.infer<typeof PricingBreakdownSchema>;
