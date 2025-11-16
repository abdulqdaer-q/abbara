import { router, protectedProcedure } from '../trpc';
import {
  CreatePaymentIntentInputSchema,
  ConfirmPaymentInputSchema,
} from '../types/zodSchemas';
import { wrapDownstreamError } from '../lib/errors';

/**
 * Payments router
 * Orchestrates payment operations with payments-service
 */
export const paymentsRouter = router({
  /**
   * Create a payment intent for an order
   * Supports card, wallet, and cash payment methods
   */
  createPaymentIntent: protectedProcedure
    .input(CreatePaymentIntentInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { idempotencyKey, ...paymentData } = input;

      try {
        ctx.logger.info('Creating payment intent', {
          orderId: paymentData.orderId,
          method: paymentData.method,
          userId: ctx.user.id,
          idempotencyKey,
        });

        // First, verify the order exists and belongs to the user
        const order = await ctx.services.orders.getOrder.query(paymentData.orderId);

        if (order.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new Error('You do not have access to this order');
        }

        // Create payment intent with the order amount
        const paymentIntent = await ctx.services.payments.createPaymentIntent.mutate({
          orderId: paymentData.orderId,
          amountCents: order.priceCents,
          method: paymentData.method,
          userId: ctx.user.id,
        });

        ctx.logger.info('Payment intent created', {
          paymentIntentId: paymentIntent.paymentIntentId,
          orderId: paymentData.orderId,
          method: paymentData.method,
        });

        return {
          paymentIntentId: paymentIntent.paymentIntentId,
          clientSecret: paymentIntent.clientSecret,
          walletHoldId: paymentIntent.walletHoldId,
          status: paymentIntent.status,
          amountCents: order.priceCents,
        };
      } catch (error) {
        ctx.logger.error('Failed to create payment intent', {
          orderId: paymentData.orderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        if (error instanceof Error && error.message.includes('access')) {
          throw wrapDownstreamError(error, 'orders-service', ctx.correlationId);
        }

        throw wrapDownstreamError(error, 'payments-service', ctx.correlationId);
      }
    }),

  /**
   * Confirm a payment
   * Called after client completes payment flow
   */
  confirmPayment: protectedProcedure
    .input(ConfirmPaymentInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        ctx.logger.info('Confirming payment', {
          paymentIntentId: input.paymentIntentId,
          userId: ctx.user.id,
        });

        const result = await ctx.services.payments.confirmPayment.mutate({
          paymentIntentId: input.paymentIntentId,
        });

        ctx.logger.info('Payment confirmed', {
          paymentIntentId: input.paymentIntentId,
          transactionId: result.transactionId,
        });

        return {
          success: result.success,
          transactionId: result.transactionId,
        };
      } catch (error) {
        ctx.logger.error('Failed to confirm payment', {
          paymentIntentId: input.paymentIntentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw wrapDownstreamError(error, 'payments-service', ctx.correlationId);
      }
    }),
});
