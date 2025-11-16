import { router, publicProcedure } from '../trpc';
import { prisma } from '../lib/prisma';
import { getKafkaClient } from '../lib/kafka';
import { requireAuth, requireCustomer } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import {
  CreateOrderInputSchema,
  GetOrderInputSchema,
  ListOrdersInputSchema,
  UpdateOrderInputSchema,
  CancelOrderInputSchema,
  ChangeStatusInputSchema,
} from '@movenow/common';
import {
  OrderCreatedEvent,
  OrderUpdatedEvent,
  OrderCancelledEvent,
  OrderEventType,
} from '@movenow/common';
import { nanoid } from 'nanoid';
import {
  OrderNotFoundError,
  OrderUpdateNotAllowedError,
  OrderAlreadyCancelledError,
} from '../lib/errors';
import { verifyOrderAccess, changeOrderStatus, getOrderDetails, getOrderSummary } from '../services/orderService';
import { orderCreatedCounter, orderCancelledCounter, eventPublishedCounter } from '../lib/metrics';

export const ordersRouter = router({
  /**
   * Create a new order
   */
  create: publicProcedure
    .use(requireCustomer)
    .use(idempotency)
    .input(CreateOrderInputSchema)
    .mutation(async ({ input, ctx }) => {
      const correlationId = ctx.correlationId;

      // TODO: Call Pricing Service to get price estimate
      // For now, use a mock pricing calculation
      const mockPriceCents = 5000; // $50.00

      // Create order with all related data in a transaction
      const order = await prisma.$transaction(async (tx) => {
        // Create order
        const newOrder = await tx.order.create({
          data: {
            customerId: input.customerId,
            status: 'CREATED',
            priceCents: mockPriceCents,
            currency: 'USD',
            porterCountRequested: input.porterCountRequested,
            vehicleType: input.vehicleType,
            scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
            specialInstructions: input.specialInstructions,
            paymentMethodHint: input.paymentMethodHint,
            isBusinessOrder: input.isBusinessOrder,
            isRecurring: input.isRecurring,
            recurringPattern: input.recurringPattern,
            metadata: input.metadata || {},
          },
        });

        // Create stops
        await tx.orderStop.createMany({
          data: input.stops.map((stop) => ({
            orderId: newOrder.id,
            sequence: stop.sequence,
            address: stop.address,
            lat: stop.lat,
            lng: stop.lng,
            stopType: stop.stopType,
            contactName: stop.contactName,
            contactPhone: stop.contactPhone,
            instructions: stop.instructions,
            metadata: stop.metadata || {},
          })),
        });

        // Create items
        await tx.orderItem.createMany({
          data: input.items.map((item) => ({
            orderId: newOrder.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            lengthCm: item.lengthCm,
            widthCm: item.widthCm,
            heightCm: item.heightCm,
            weightKg: item.weightKg,
            photos: item.photos || [],
            isFragile: item.isFragile,
            isHeavy: item.isHeavy,
            metadata: item.metadata || {},
          })),
        });

        // Create pricing snapshot
        await tx.orderPricingSnapshot.create({
          data: {
            orderId: newOrder.id,
            baseFareCents: 3000,
            distanceFareCents: 1500,
            timeFareCents: 500,
            porterFeesCents: 0,
            surgeMultiplier: 1.0,
            taxCents: 0,
            discountCents: 0,
            totalCents: mockPriceCents,
            pricingVersion: '1.0',
            breakdown: {},
          },
        });

        // Record creation event in audit trail
        await tx.orderEvent.create({
          data: {
            orderId: newOrder.id,
            eventType: 'CREATED',
            payload: {
              customerId: input.customerId,
              priceCents: mockPriceCents,
            },
            actorId: input.customerId,
            actorType: 'customer',
            correlationId,
          },
        });

        return newOrder;
      });

      // Publish OrderCreated event
      const pickupStop = input.stops.find((s) => s.stopType === 'pickup');
      const dropoffStop = input.stops.find((s) => s.stopType === 'dropoff');

      const event: OrderCreatedEvent = {
        type: OrderEventType.ORDER_CREATED,
        eventId: nanoid(),
        timestamp: new Date().toISOString(),
        correlationId,
        orderId: order.id,
        customerId: input.customerId,
        pickupSummary: {
          address: pickupStop?.address || '',
          lat: pickupStop?.lat || 0,
          lng: pickupStop?.lng || 0,
        },
        dropoffSummary: {
          address: dropoffStop?.address || '',
          lat: dropoffStop?.lat || 0,
          lng: dropoffStop?.lng || 0,
        },
        priceCents: mockPriceCents,
        currency: 'USD',
        porterCountRequested: input.porterCountRequested,
        vehicleType: input.vehicleType,
        scheduledAt: input.scheduledAt,
        isBusinessOrder: input.isBusinessOrder,
        isRecurring: input.isRecurring,
      };

      const kafka = getKafkaClient();
      await kafka.publishEvent(event);

      // Update metrics
      orderCreatedCounter.inc({
        status: 'CREATED',
        vehicleType: input.vehicleType,
      });

      eventPublishedCounter.inc({
        eventType: OrderEventType.ORDER_CREATED,
        status: 'success',
      });

      return {
        orderId: order.id,
        status: order.status,
        priceCents: order.priceCents,
        currency: order.currency,
        scheduledAt: order.scheduledAt?.toISOString(),
        createdAt: order.createdAt.toISOString(),
      };
    }),

  /**
   * Get order details
   */
  get: publicProcedure
    .use(requireAuth)
    .input(GetOrderInputSchema)
    .query(async ({ input }) => {
      // Verify access
      await verifyOrderAccess(
        input.orderId,
        input.requestingUserId,
        input.requestingUserRole
      );

      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        include: {
          stops: { orderBy: { sequence: 'asc' } },
          items: true,
          assignments: true,
          pricing: true,
          evidences: true,
        },
      });

      if (!order) {
        throw new OrderNotFoundError(input.orderId);
      }

      return getOrderDetails(order);
    }),

  /**
   * List orders with filters and pagination
   */
  list: publicProcedure
    .use(requireAuth)
    .input(ListOrdersInputSchema)
    .query(async ({ input }) => {
      const where: any = {};

      if (input.customerId) {
        where.customerId = input.customerId;
      }

      if (input.porterId) {
        where.assignments = {
          some: {
            porterId: input.porterId,
          },
        };
      }

      if (input.status) {
        where.status = input.status;
      }

      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) {
          where.createdAt.gte = new Date(input.startDate);
        }
        if (input.endDate) {
          where.createdAt.lte = new Date(input.endDate);
        }
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { [input.sortBy]: input.sortOrder },
          take: input.limit,
          skip: input.offset,
          include: {
            stops: { orderBy: { sequence: 'asc' } },
          },
        }),
        prisma.order.count({ where }),
      ]);

      return {
        orders: orders.map(getOrderSummary),
        total,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /**
   * Update order
   */
  update: publicProcedure
    .use(requireAuth)
    .use(idempotency)
    .input(UpdateOrderInputSchema)
    .mutation(async ({ input, ctx }) => {
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
      });

      if (!order) {
        throw new OrderNotFoundError(input.orderId);
      }

      // Only allow updates for orders in certain states
      if (!['CREATED', 'TENTATIVELY_ASSIGNED'].includes(order.status)) {
        throw new OrderUpdateNotAllowedError(
          input.orderId,
          `Cannot update order in ${order.status} status`
        );
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id: input.orderId },
          data: {
            specialInstructions: input.specialInstructions,
            scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
            metadata: input.metadata,
            version: order.version + 1,
          },
        });

        // If items are updated, replace them
        if (input.items) {
          await tx.orderItem.deleteMany({
            where: { orderId: input.orderId },
          });

          await tx.orderItem.createMany({
            data: input.items.map((item) => ({
              orderId: input.orderId,
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              lengthCm: item.lengthCm,
              widthCm: item.widthCm,
              heightCm: item.heightCm,
              weightKg: item.weightKg,
              photos: item.photos || [],
              isFragile: item.isFragile,
              isHeavy: item.isHeavy,
              metadata: item.metadata || {},
            })),
          });
        }

        // Record update event
        await tx.orderEvent.create({
          data: {
            orderId: input.orderId,
            eventType: 'UPDATED',
            payload: {
              updatedFields: Object.keys(input),
            },
            actorId: ctx.user?.userId,
            actorType: ctx.user?.role || 'customer',
            correlationId: ctx.correlationId,
          },
        });

        return updated;
      });

      // Publish OrderUpdated event
      const event: OrderUpdatedEvent = {
        type: OrderEventType.ORDER_UPDATED,
        eventId: nanoid(),
        timestamp: new Date().toISOString(),
        correlationId: ctx.correlationId,
        orderId: input.orderId,
        customerId: order.customerId,
        changedFields: Object.keys(input).filter((k) => k !== 'idempotencyKey'),
        newValues: input,
      };

      const kafka = getKafkaClient();
      await kafka.publishEvent(event);

      return {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        updatedAt: updatedOrder.updatedAt.toISOString(),
      };
    }),

  /**
   * Cancel order
   */
  cancel: publicProcedure
    .use(requireAuth)
    .use(idempotency)
    .input(CancelOrderInputSchema)
    .mutation(async ({ input, ctx }) => {
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        include: { pricing: true },
      });

      if (!order) {
        throw new OrderNotFoundError(input.orderId);
      }

      if (order.status === 'CANCELLED') {
        throw new OrderAlreadyCancelledError(input.orderId);
      }

      // Calculate cancellation fee (simplified logic)
      let cancellationFeeCents = 0;
      let refundCents = order.priceCents;

      if (['ACCEPTED', 'ARRIVED', 'LOADED'].includes(order.status)) {
        cancellationFeeCents = Math.floor(order.priceCents * 0.2); // 20% fee
        refundCents = order.priceCents - cancellationFeeCents;
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        const cancelled = await tx.order.update({
          where: { id: input.orderId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: input.cancelledBy,
            cancellationReason: input.reason,
            cancellationFeeCents,
            version: order.version + 1,
          },
        });

        // Record cancellation event
        await tx.orderEvent.create({
          data: {
            orderId: input.orderId,
            eventType: 'CANCELLED',
            payload: {
              reason: input.reason,
              reasonText: input.reasonText,
              cancellationFeeCents,
              refundCents,
            },
            actorId: input.cancelledBy,
            actorType: input.cancelledByType,
            correlationId: ctx.correlationId,
          },
        });

        return cancelled;
      });

      // Publish OrderCancelled event
      const event: OrderCancelledEvent = {
        type: OrderEventType.ORDER_CANCELLED,
        eventId: nanoid(),
        timestamp: new Date().toISOString(),
        correlationId: ctx.correlationId,
        orderId: input.orderId,
        customerId: order.customerId,
        cancelledBy: input.cancelledBy,
        cancelledByType: input.cancelledByType,
        reason: input.reason,
        reasonText: input.reasonText,
        cancelledAt: updatedOrder.cancelledAt!.toISOString(),
        cancellationFeeCents,
        refundCents,
      };

      const kafka = getKafkaClient();
      await kafka.publishEvent(event);

      // Update metrics
      orderCancelledCounter.inc({
        reason: input.reason,
        cancelledBy: input.cancelledByType,
      });

      return {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        cancelledAt: updatedOrder.cancelledAt!.toISOString(),
        cancellationFeeCents,
        refundCents,
        refundPolicy: cancellationFeeCents > 0 ? 'Partial refund with cancellation fee' : 'Full refund',
      };
    }),

  /**
   * Change order status
   */
  changeStatus: publicProcedure
    .use(requireAuth)
    .use(idempotency)
    .input(ChangeStatusInputSchema)
    .mutation(async ({ input, ctx }) => {
      await changeOrderStatus(
        input.orderId,
        input.newStatus as any,
        input.actorId,
        input.actorType,
        ctx.correlationId,
        input.location,
        input.notes
      );

      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        include: {
          events: {
            orderBy: { createdAt: 'asc' },
            take: 10,
          },
        },
      });

      return {
        orderId: input.orderId,
        status: order!.status,
        timeline: order!.events.map((e) => ({
          eventType: e.eventType,
          timestamp: e.createdAt.toISOString(),
          payload: e.payload,
        })),
      };
    }),
});
