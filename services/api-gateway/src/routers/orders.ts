import { router, protectedProcedure } from '../trpc';
import {
  CreateOrderInputSchema,
  GetOrderInputSchema,
  ListOrdersInputSchema,
  CancelOrderInputSchema,
} from '../types/zodSchemas';
import { wrapDownstreamError } from '../lib/errors';
import { TRPCError } from '@trpc/server';

/**
 * Orders router
 * Orchestrates order operations across pricing-service and orders-service
 */
export const ordersRouter = router({
  /**
   * Create a new order
   * Orchestration flow:
   * 1. Get price estimate from pricing-service (sync)
   * 2. Create order in orders-service with price (sync)
   * 3. orders-service publishes OrderCreated event (async)
   * 4. Return orderId to client
   */
  create: protectedProcedure
    .input(CreateOrderInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { idempotencyKey, ...orderData } = input;

      try {
        ctx.logger.info('Creating order', {
          userId: ctx.user.id,
          idempotencyKey,
          pickup: orderData.pickup.address,
          dropoff: orderData.dropoff.address,
        });

        // Step 1: Get price estimate from pricing-service
        ctx.logger.info('Fetching price estimate from pricing-service');
        const estimate = await ctx.services.pricing.estimate.query({
          pickup: { lat: orderData.pickup.lat, lng: orderData.pickup.lng },
          dropoff: { lat: orderData.dropoff.lat, lng: orderData.dropoff.lng },
          vehicleType: orderData.vehicleType,
          porterCount: orderData.porterCount,
        });

        ctx.logger.info('Price estimate received', {
          totalCents: estimate.totalCents,
          distanceMeters: estimate.distanceMeters,
        });

        // Step 2: Create order in orders-service with calculated price
        ctx.logger.info('Creating order in orders-service');
        const { orderId } = await ctx.services.orders.createOrder.mutate({
          userId: ctx.user.id,
          pickup: orderData.pickup,
          dropoff: orderData.dropoff,
          vehicleType: orderData.vehicleType,
          porterCount: orderData.porterCount,
          scheduledAt: orderData.scheduledAt,
          notes: orderData.notes,
          priceCents: estimate.totalCents,
        });

        ctx.logger.info('Order created successfully', {
          orderId,
          userId: ctx.user.id,
          priceCents: estimate.totalCents,
        });

        // Step 3: OrderCreated event is published by orders-service
        // Notifications, Realtime Gateway, and Analytics will consume it asynchronously

        return {
          orderId,
          priceCents: estimate.totalCents,
          estimatedDuration: estimate.estimatedDuration,
        };
      } catch (error) {
        ctx.logger.error('Order creation failed', {
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Determine which service failed for better error reporting
        if (error instanceof Error && error.message.includes('pricing')) {
          throw wrapDownstreamError(error, 'pricing-service', ctx.correlationId);
        }

        throw wrapDownstreamError(error, 'orders-service', ctx.correlationId);
      }
    }),

  /**
   * Get order details
   * Aggregates data from orders-service and optionally porters-service
   */
  get: protectedProcedure
    .input(GetOrderInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        ctx.logger.info('Fetching order', {
          orderId: input,
          userId: ctx.user.id,
        });

        const order = await ctx.services.orders.getOrder.query(input);

        // Verify user has access to this order
        if (order.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this order',
            cause: { correlationId: ctx.correlationId },
          });
        }

        ctx.logger.info('Order fetched successfully', { orderId: input });

        return order;
      } catch (error) {
        ctx.logger.error('Failed to fetch order', {
          orderId: input,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw wrapDownstreamError(error, 'orders-service', ctx.correlationId);
      }
    }),

  /**
   * List user's orders with optional filters
   */
  list: protectedProcedure
    .input(ListOrdersInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        ctx.logger.info('Listing orders', {
          userId: ctx.user.id,
          filters: input,
        });

        const result = await ctx.services.orders.listOrders.query({
          userId: ctx.user.id,
          status: input.status,
          limit: input.limit,
          offset: input.offset,
        });

        ctx.logger.info('Orders listed successfully', {
          count: result.orders.length,
          total: result.total,
        });

        return result;
      } catch (error) {
        ctx.logger.error('Failed to list orders', {
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw wrapDownstreamError(error, 'orders-service', ctx.correlationId);
      }
    }),

  /**
   * Cancel an order
   */
  cancel: protectedProcedure
    .input(CancelOrderInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        ctx.logger.info('Cancelling order', {
          orderId: input.orderId,
          userId: ctx.user.id,
          reason: input.reason,
        });

        const result = await ctx.services.orders.cancelOrder.mutate({
          orderId: input.orderId,
          userId: ctx.user.id,
          reason: input.reason,
        });

        ctx.logger.info('Order cancelled successfully', {
          orderId: input.orderId,
          refundCents: result.refundCents,
        });

        return result;
      } catch (error) {
        ctx.logger.error('Failed to cancel order', {
          orderId: input.orderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw wrapDownstreamError(error, 'orders-service', ctx.correlationId);
      }
    }),
});
