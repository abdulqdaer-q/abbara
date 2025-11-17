import { z } from 'zod';
import {
  OrderStatusSchema,
  OrderItemInputSchema,
  OrderStopInputSchema,
  CancellationReasonSchema,
  EvidenceTypeSchema,
  ActorTypeSchema,
} from '../types/orders';

/**
 * CreateOrder Input Schema
 */
export const CreateOrderInputSchema = z.object({
  customerId: z.string(),
  stops: z.array(OrderStopInputSchema).min(2), // At least pickup and dropoff
  items: z.array(OrderItemInputSchema).min(1),
  specialInstructions: z.string().max(1000).optional(),
  vehicleType: z.string(),
  porterCountRequested: z.number().int().min(0).max(10).default(1),
  scheduledAt: z.string().datetime().optional(),
  paymentMethodHint: z.string().optional(),
  isBusinessOrder: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  recurringPattern: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

/**
 * CreateOrder Output Schema
 */
export const CreateOrderOutputSchema = z.object({
  orderId: z.string(),
  status: OrderStatusSchema,
  priceCents: z.number(),
  currency: z.string(),
  scheduledAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type CreateOrderOutput = z.infer<typeof CreateOrderOutputSchema>;

/**
 * GetOrder Input Schema
 */
export const GetOrderInputSchema = z.object({
  orderId: z.string(),
  requestingUserId: z.string(),
  requestingUserRole: z.enum(['customer', 'porter', 'admin']),
});
export type GetOrderInput = z.infer<typeof GetOrderInputSchema>;

/**
 * ListOrders Input Schema
 */
export const ListOrdersInputSchema = z.object({
  customerId: z.string().optional(),
  porterId: z.string().optional(),
  status: OrderStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'scheduledAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ListOrdersInput = z.infer<typeof ListOrdersInputSchema>;

/**
 * UpdateOrder Input Schema
 */
export const UpdateOrderInputSchema = z.object({
  orderId: z.string(),
  specialInstructions: z.string().max(1000).optional(),
  items: z.array(OrderItemInputSchema).optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string(),
});
export type UpdateOrderInput = z.infer<typeof UpdateOrderInputSchema>;

/**
 * CancelOrder Input Schema
 */
export const CancelOrderInputSchema = z.object({
  orderId: z.string(),
  cancelledBy: z.string(),
  cancelledByType: ActorTypeSchema,
  reason: CancellationReasonSchema,
  reasonText: z.string().max(500).optional(),
  idempotencyKey: z.string(),
});
export type CancelOrderInput = z.infer<typeof CancelOrderInputSchema>;

/**
 * CancelOrder Output Schema
 */
export const CancelOrderOutputSchema = z.object({
  orderId: z.string(),
  status: OrderStatusSchema,
  cancelledAt: z.string().datetime(),
  cancellationFeeCents: z.number(),
  refundCents: z.number(),
  refundPolicy: z.string(),
});
export type CancelOrderOutput = z.infer<typeof CancelOrderOutputSchema>;

/**
 * ChangeStatus Input Schema
 */
export const ChangeStatusInputSchema = z.object({
  orderId: z.string(),
  newStatus: OrderStatusSchema,
  actorId: z.string(),
  actorType: ActorTypeSchema,
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string(),
});
export type ChangeStatusInput = z.infer<typeof ChangeStatusInputSchema>;

/**
 * AssignPorters Input Schema
 */
export const AssignPortersInputSchema = z.object({
  orderId: z.string(),
  strategy: z.enum(['direct', 'offer', 'bidding']).default('offer'),
  porterIds: z.array(z.string()).optional(),
  autoAssign: z.boolean().default(false),
  offerExpiryMinutes: z.number().int().min(1).max(60).default(5),
  idempotencyKey: z.string(),
});
export type AssignPortersInput = z.infer<typeof AssignPortersInputSchema>;

/**
 * AssignPorters Output Schema
 */
export const AssignPortersOutputSchema = z.object({
  orderId: z.string(),
  assignments: z.array(z.object({
    porterId: z.string(),
    status: z.string(),
    offeredAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
  })),
  message: z.string(),
});
export type AssignPortersOutput = z.infer<typeof AssignPortersOutputSchema>;

/**
 * AcceptOffer Input Schema (porter accepts an offer)
 */
export const AcceptOfferInputSchema = z.object({
  orderId: z.string(),
  porterId: z.string(),
  deviceId: z.string().optional(),
  sessionId: z.string().optional(),
  idempotencyKey: z.string(),
});
export type AcceptOfferInput = z.infer<typeof AcceptOfferInputSchema>;

/**
 * RejectOffer Input Schema (porter rejects an offer)
 */
export const RejectOfferInputSchema = z.object({
  orderId: z.string(),
  porterId: z.string(),
  reason: z.string().max(200).optional(),
  idempotencyKey: z.string(),
});
export type RejectOfferInput = z.infer<typeof RejectOfferInputSchema>;

/**
 * UpdateWaypointStatus Input Schema
 */
export const UpdateWaypointStatusInputSchema = z.object({
  orderId: z.string(),
  waypointId: z.string(),
  newStatus: z.enum(['PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED']),
  porterId: z.string(),
  timestamp: z.string().datetime().optional(),
  idempotencyKey: z.string(),
});
export type UpdateWaypointStatusInput = z.infer<typeof UpdateWaypointStatusInputSchema>;

/**
 * CreateEvidence Input Schema
 */
export const CreateEvidenceInputSchema = z.object({
  orderId: z.string(),
  type: EvidenceTypeSchema,
  url: z.string().url(),
  checksum: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
  description: z.string().max(500).optional(),
  uploadedBy: z.string(),
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string(),
});
export type CreateEvidenceInput = z.infer<typeof CreateEvidenceInputSchema>;

/**
 * CreateEvidence Output Schema
 */
export const CreateEvidenceOutputSchema = z.object({
  evidenceId: z.string(),
  orderId: z.string(),
  type: EvidenceTypeSchema,
  uploadedAt: z.string().datetime(),
});
export type CreateEvidenceOutput = z.infer<typeof CreateEvidenceOutputSchema>;

/**
 * Admin Override Order Input Schema
 */
export const AdminOverrideOrderInputSchema = z.object({
  orderId: z.string(),
  adminId: z.string(),
  action: z.enum(['force_complete', 'force_cancel', 'reassign', 'resolve_dispute']),
  reason: z.string().max(1000),
  newData: z.record(z.any()).optional(),
  idempotencyKey: z.string(),
});
export type AdminOverrideOrderInput = z.infer<typeof AdminOverrideOrderInputSchema>;
