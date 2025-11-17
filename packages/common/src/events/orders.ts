import { z } from 'zod';
import { OrderStatusSchema, AssignmentStatusSchema, WaypointStatusSchema, EvidenceTypeSchema, CancellationReasonSchema } from '../types/orders';

/**
 * Base Event Schema - all events extend this
 */
export const BaseEventSchema = z.object({
  eventId: z.string(),
  timestamp: z.string().datetime(),
  correlationId: z.string(),
  version: z.string().default('1.0'),
});

/**
 * Location subset for events
 */
const EventLocationSchema = z.object({
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
});

/**
 * OrderCreated Event
 */
export const OrderCreatedEventSchema = BaseEventSchema.extend({
  type: z.literal('order.created'),
  orderId: z.string(),
  customerId: z.string(),
  pickupSummary: EventLocationSchema,
  dropoffSummary: EventLocationSchema,
  priceCents: z.number(),
  currency: z.string(),
  porterCountRequested: z.number(),
  vehicleType: z.string(),
  scheduledAt: z.string().datetime().optional(),
  isBusinessOrder: z.boolean(),
  isRecurring: z.boolean(),
});
export type OrderCreatedEvent = z.infer<typeof OrderCreatedEventSchema>;

/**
 * OrderUpdated Event
 */
export const OrderUpdatedEventSchema = BaseEventSchema.extend({
  type: z.literal('order.updated'),
  orderId: z.string(),
  customerId: z.string(),
  changedFields: z.array(z.string()),
  previousValues: z.record(z.any()).optional(),
  newValues: z.record(z.any()),
});
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEventSchema>;

/**
 * OrderAssigned Event
 */
export const OrderAssignedEventSchema = BaseEventSchema.extend({
  type: z.literal('order.assigned'),
  orderId: z.string(),
  customerId: z.string(),
  assignments: z.array(z.object({
    porterId: z.string(),
    status: AssignmentStatusSchema,
    assignedAt: z.string().datetime(),
  })),
  porterCountAssigned: z.number(),
});
export type OrderAssignedEvent = z.infer<typeof OrderAssignedEventSchema>;

/**
 * PorterOffered Event
 */
export const PorterOfferedEventSchema = BaseEventSchema.extend({
  type: z.literal('porter.offered'),
  orderId: z.string(),
  porterId: z.string(),
  offeredAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  earningsCents: z.number().optional(),
});
export type PorterOfferedEvent = z.infer<typeof PorterOfferedEventSchema>;

/**
 * PorterOfferExpired Event
 */
export const PorterOfferExpiredEventSchema = BaseEventSchema.extend({
  type: z.literal('porter.offer.expired'),
  orderId: z.string(),
  porterId: z.string(),
  expiredAt: z.string().datetime(),
});
export type PorterOfferExpiredEvent = z.infer<typeof PorterOfferExpiredEventSchema>;

/**
 * OrderStatusChanged Event
 */
export const OrderStatusChangedEventSchema = BaseEventSchema.extend({
  type: z.literal('order.status.changed'),
  orderId: z.string(),
  customerId: z.string(),
  previousStatus: OrderStatusSchema,
  newStatus: OrderStatusSchema,
  actorId: z.string().optional(),
  actorType: z.enum(['customer', 'porter', 'admin', 'system']),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
});
export type OrderStatusChangedEvent = z.infer<typeof OrderStatusChangedEventSchema>;

/**
 * OrderCancelled Event
 */
export const OrderCancelledEventSchema = BaseEventSchema.extend({
  type: z.literal('order.cancelled'),
  orderId: z.string(),
  customerId: z.string(),
  cancelledBy: z.string(),
  cancelledByType: z.enum(['customer', 'porter', 'admin', 'system']),
  reason: CancellationReasonSchema,
  reasonText: z.string().optional(),
  cancelledAt: z.string().datetime(),
  cancellationFeeCents: z.number().optional(),
  refundCents: z.number().optional(),
});
export type OrderCancelledEvent = z.infer<typeof OrderCancelledEventSchema>;

/**
 * OrderCompleted Event
 */
export const OrderCompletedEventSchema = BaseEventSchema.extend({
  type: z.literal('order.completed'),
  orderId: z.string(),
  customerId: z.string(),
  porterIds: z.array(z.string()),
  completedAt: z.string().datetime(),
  finalPriceCents: z.number(),
  durationMinutes: z.number().optional(),
  distanceKm: z.number().optional(),
});
export type OrderCompletedEvent = z.infer<typeof OrderCompletedEventSchema>;

/**
 * WaypointStatusChanged Event
 */
export const WaypointStatusChangedEventSchema = BaseEventSchema.extend({
  type: z.literal('waypoint.status.changed'),
  orderId: z.string(),
  waypointId: z.string(),
  waypointSequence: z.number(),
  previousStatus: WaypointStatusSchema,
  newStatus: WaypointStatusSchema,
  timestamp: z.string().datetime(),
  porterId: z.string().optional(),
});
export type WaypointStatusChangedEvent = z.infer<typeof WaypointStatusChangedEventSchema>;

/**
 * EvidenceUploaded Event
 */
export const EvidenceUploadedEventSchema = BaseEventSchema.extend({
  type: z.literal('evidence.uploaded'),
  orderId: z.string(),
  evidenceId: z.string(),
  evidenceType: EvidenceTypeSchema,
  url: z.string(),
  checksum: z.string().optional(),
  uploadedBy: z.string(),
  uploadedAt: z.string().datetime(),
});
export type EvidenceUploadedEvent = z.infer<typeof EvidenceUploadedEventSchema>;

/**
 * Union type of all order events
 */
export type OrderEvent =
  | OrderCreatedEvent
  | OrderUpdatedEvent
  | OrderAssignedEvent
  | PorterOfferedEvent
  | PorterOfferExpiredEvent
  | OrderStatusChangedEvent
  | OrderCancelledEvent
  | OrderCompletedEvent
  | WaypointStatusChangedEvent
  | EvidenceUploadedEvent;

/**
 * Event type enum for type checking
 */
export enum OrderEventType {
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_ASSIGNED = 'order.assigned',
  PORTER_OFFERED = 'porter.offered',
  PORTER_OFFER_EXPIRED = 'porter.offer.expired',
  ORDER_STATUS_CHANGED = 'order.status.changed',
  ORDER_CANCELLED = 'order.cancelled',
  ORDER_COMPLETED = 'order.completed',
  WAYPOINT_STATUS_CHANGED = 'waypoint.status.changed',
  EVIDENCE_UPLOADED = 'evidence.uploaded',
}
