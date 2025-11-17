import { prisma } from '../lib/prisma';
import { getKafkaClient } from '../lib/kafka';
import { OrderStatus } from '@prisma/client';
import {
  OrderNotFoundError,
  InvalidOrderStatusTransitionError,
  ConcurrencyError,
  UnauthorizedOrderAccessError,
} from '../lib/errors';
import {
  OrderStatusChangedEvent,
  OrderEventType,
} from '@movenow/common';
import { nanoid } from 'nanoid';
import {
  orderStatusChangedCounter,
  eventPublishedCounter,
} from '../lib/metrics';

/**
 * Status transition rules
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['TENTATIVELY_ASSIGNED', 'ASSIGNED', 'CANCELLED'],
  TENTATIVELY_ASSIGNED: ['ASSIGNED', 'ACCEPTED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['LOADED', 'CANCELLED'],
  LOADED: ['EN_ROUTE'],
  EN_ROUTE: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
  FAILED: [],
};

/**
 * Check if status transition is allowed
 */
export const isStatusTransitionAllowed = (
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean => {
  return ALLOWED_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
};

/**
 * Verify user can access order
 */
export const verifyOrderAccess = async (
  orderId: string,
  userId: string,
  userRole: 'customer' | 'porter' | 'admin'
): Promise<boolean> => {
  if (userRole === 'admin') {
    return true;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      assignments: userRole === 'porter',
    },
  });

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  if (userRole === 'customer') {
    if (order.customerId !== userId) {
      throw new UnauthorizedOrderAccessError(orderId, userId);
    }
    return true;
  }

  if (userRole === 'porter') {
    const hasAssignment = order.assignments?.some(
      (assignment) => assignment.porterId === userId
    );
    if (!hasAssignment) {
      throw new UnauthorizedOrderAccessError(orderId, userId);
    }
    return true;
  }

  return false;
};

/**
 * Change order status with validation and event publishing
 */
export const changeOrderStatus = async (
  orderId: string,
  newStatus: OrderStatus,
  actorId: string,
  actorType: 'customer' | 'porter' | 'admin' | 'system',
  correlationId: string,
  location?: { lat: number; lng: number },
  notes?: string
): Promise<void> => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  // Check if transition is allowed
  if (!isStatusTransitionAllowed(order.status, newStatus)) {
    throw new InvalidOrderStatusTransitionError(orderId, order.status, newStatus);
  }

  const previousStatus = order.status;

  try {
    // Update order with optimistic concurrency control
    await prisma.order.update({
      where: {
        id: orderId,
        version: order.version, // Optimistic locking
      },
      data: {
        status: newStatus,
        version: order.version + 1,
      },
    });

    // Record event in audit trail
    await prisma.orderEvent.create({
      data: {
        orderId,
        eventType: 'UPDATED',
        payload: {
          field: 'status',
          previousValue: previousStatus,
          newValue: newStatus,
          notes,
        },
        actorId,
        actorType,
        lat: location?.lat,
        lng: location?.lng,
        correlationId,
      },
    });

    // Publish event to Kafka
    const event: OrderStatusChangedEvent = {
      type: OrderEventType.ORDER_STATUS_CHANGED,
      eventId: nanoid(),
      timestamp: new Date().toISOString(),
      correlationId,
      version: '1.0',
      orderId,
      customerId: order.customerId,
      previousStatus: previousStatus as any,
      newStatus: newStatus as any,
      actorId,
      actorType,
      location,
    };

    const kafka = getKafkaClient();
    await kafka.publishEvent(event);

    // Update metrics
    orderStatusChangedCounter.inc({
      fromStatus: previousStatus,
      toStatus: newStatus,
    });

    eventPublishedCounter.inc({
      eventType: OrderEventType.ORDER_STATUS_CHANGED,
      status: 'success',
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      // Prisma record not found or version mismatch
      throw new ConcurrencyError(orderId);
    }
    throw error;
  }
};

/**
 * Get order summary for listing
 */
export const getOrderSummary = (order: any) => {
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status,
    priceCents: order.priceCents,
    currency: order.currency,
    vehicleType: order.vehicleType,
    porterCountRequested: order.porterCountRequested,
    porterCountAssigned: order.porterCountAssigned,
    scheduledAt: order.scheduledAt?.toISOString(),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
};

/**
 * Get full order details
 */
export const getOrderDetails = (order: any) => {
  return {
    ...getOrderSummary(order),
    stops: order.stops?.map((stop: any) => ({
      id: stop.id,
      sequence: stop.sequence,
      address: stop.address,
      lat: Number(stop.lat),
      lng: Number(stop.lng),
      stopType: stop.stopType,
      status: stop.status,
      arrivalTimestamp: stop.arrivalTimestamp?.toISOString(),
      departureTimestamp: stop.departureTimestamp?.toISOString(),
      contactName: stop.contactName,
      contactPhone: stop.contactPhone,
      instructions: stop.instructions,
    })),
    items: order.items?.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      lengthCm: item.lengthCm ? Number(item.lengthCm) : undefined,
      widthCm: item.widthCm ? Number(item.widthCm) : undefined,
      heightCm: item.heightCm ? Number(item.heightCm) : undefined,
      weightKg: item.weightKg ? Number(item.weightKg) : undefined,
      photos: item.photos,
      isFragile: item.isFragile,
      isHeavy: item.isHeavy,
    })),
    assignments: order.assignments?.map((assignment: any) => ({
      porterId: assignment.porterId,
      status: assignment.status,
      offeredAt: assignment.offeredAt.toISOString(),
      acceptedAt: assignment.acceptedAt?.toISOString(),
      rejectedAt: assignment.rejectedAt?.toISOString(),
      earningsCents: assignment.earningsCents,
    })),
    pricing: order.pricing
      ? {
          baseFareCents: order.pricing.baseFareCents,
          distanceFareCents: order.pricing.distanceFareCents,
          timeFareCents: order.pricing.timeFareCents,
          porterFeesCents: order.pricing.porterFeesCents,
          surgeMultiplier: Number(order.pricing.surgeMultiplier),
          taxCents: order.pricing.taxCents,
          discountCents: order.pricing.discountCents,
          totalCents: order.pricing.totalCents,
          estimatedDistanceKm: order.pricing.estimatedDistanceKm
            ? Number(order.pricing.estimatedDistanceKm)
            : undefined,
          estimatedTimeMinutes: order.pricing.estimatedTimeMinutes,
        }
      : undefined,
    specialInstructions: order.specialInstructions,
    isBusinessOrder: order.isBusinessOrder,
    isRecurring: order.isRecurring,
    metadata: order.metadata,
  };
};
