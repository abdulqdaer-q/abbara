import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../lib/db';
import { logger, logPricingEstimate, logSnapshotPersisted } from '../lib/logger';
import { pricingEngine } from '../services/pricingEngine';
import { getDistanceAndTime, getMultiStopDistance } from '../services/mapsProvider';
import { eventPublisher } from '../lib/events';
import {
  PricingEstimateInputSchema,
  PricingEstimateOutputSchema,
  PricingSnapshotSchema,
} from '@movenow/common';

/**
 * Pricing router with core procedures
 */
export const pricingRouter = router({
  /**
   * Estimate price for an order
   */
  estimatePrice: publicProcedure
    .input(PricingEstimateInputSchema)
    .output(PricingEstimateOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();

      try {
        logger.info('Price estimate requested', {
          correlationId: ctx.correlationId,
          vehicleType: input.vehicleType,
          porterCount: input.porterCount,
        });

        // Get distance and time
        let distanceMeters: number;
        let durationSeconds: number;

        if (input.distanceMeters !== undefined && input.durationSeconds !== undefined) {
          // Use provided values if available
          distanceMeters = input.distanceMeters;
          durationSeconds = input.durationSeconds;
        } else {
          // Calculate distance and time
          if (input.additionalStops && input.additionalStops.length > 0) {
            // Multi-stop route
            const waypoints = [
              { lat: input.pickup.lat, lng: input.pickup.lng },
              ...input.additionalStops.map(stop => ({ lat: stop.lat, lng: stop.lng })),
              { lat: input.dropoff.lat, lng: input.dropoff.lng },
            ];

            const result = await getMultiStopDistance(waypoints, ctx.correlationId);
            distanceMeters = result.distanceMeters;
            durationSeconds = result.durationSeconds;
          } else {
            // Single route
            const result = await getDistanceAndTime(
              input.pickup.lat,
              input.pickup.lng,
              input.dropoff.lat,
              input.dropoff.lng,
              ctx.correlationId
            );
            distanceMeters = result.distanceMeters;
            durationSeconds = result.durationSeconds;
          }
        }

        // Calculate pricing
        const estimate = await pricingEngine.calculateEstimate(
          input,
          distanceMeters,
          durationSeconds,
          ctx.correlationId
        );

        // Log estimate
        const durationMs = Date.now() - startTime;
        logPricingEstimate({
          correlationId: ctx.correlationId,
          vehicleType: input.vehicleType,
          distanceMeters,
          totalCents: estimate.totalCents,
          durationMs,
        });

        // Publish event (async, fire and forget)
        eventPublisher
          .publishPriceEstimateRequested({
            estimateId: ctx.correlationId,
            vehicleType: input.vehicleType,
            distanceMeters,
            totalCents: estimate.totalCents,
            correlationId: ctx.correlationId,
          })
          .catch(err => logger.error('Failed to publish estimate event', { error: err }));

        return estimate;
      } catch (error) {
        logger.error('Price estimation failed', {
          correlationId: ctx.correlationId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to estimate price',
          cause: error,
        });
      }
    }),

  /**
   * Persist price snapshot for an order
   */
  persistPriceSnapshot: publicProcedure
    .input(
      z.object({
        orderId: z.string(),
        estimate: PricingEstimateInputSchema,
        idempotencyKey: z.string().optional(),
      })
    )
    .output(
      z.object({
        snapshotId: z.string(),
        success: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Check for existing snapshot (idempotency)
        if (input.idempotencyKey) {
          const existing = await prisma.pricingSnapshot.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
          });

          if (existing) {
            logger.info('Returning existing snapshot (idempotent)', {
              correlationId: ctx.correlationId,
              snapshotId: existing.id,
            });

            return {
              snapshotId: existing.id,
              success: true,
            };
          }
        }

        // Check if snapshot already exists for this order
        const existingForOrder = await prisma.pricingSnapshot.findUnique({
          where: { orderId: input.orderId },
        });

        if (existingForOrder) {
          logger.warn('Snapshot already exists for order', {
            correlationId: ctx.correlationId,
            orderId: input.orderId,
            snapshotId: existingForOrder.id,
          });

          return {
            snapshotId: existingForOrder.id,
            success: true,
          };
        }

        // Get fresh pricing estimate
        const estimateResult = await pricingEngine.calculateEstimate(
          input.estimate,
          input.estimate.distanceMeters || 0,
          input.estimate.durationSeconds || 0,
          ctx.correlationId
        );

        // Map vehicle type to DB enum
        const vehicleTypeMap: Record<string, 'SEDAN' | 'SUV' | 'VAN' | 'TRUCK'> = {
          sedan: 'SEDAN',
          suv: 'SUV',
          van: 'VAN',
          truck: 'TRUCK',
        };

        // Persist snapshot
        const snapshot = await prisma.pricingSnapshot.create({
          data: {
            orderId: input.orderId,
            idempotencyKey: input.idempotencyKey,
            pickupLat: input.estimate.pickup.lat,
            pickupLng: input.estimate.pickup.lng,
            pickupAddress: input.estimate.pickup.address,
            dropoffLat: input.estimate.dropoff.lat,
            dropoffLng: input.estimate.dropoff.lng,
            dropoffAddress: input.estimate.dropoff.address,
            vehicleType: vehicleTypeMap[input.estimate.vehicleType],
            porterCount: input.estimate.porterCount,
            scheduledAt: input.estimate.scheduledAt,
            distanceMeters: estimateResult.estimatedDistanceMeters,
            durationSeconds: estimateResult.estimatedDurationSeconds,
            baseFareCents: estimateResult.baseFareCents,
            distanceFareCents: estimateResult.distanceFareCents,
            timeFareCents: estimateResult.timeFareCents,
            porterFeesCents: estimateResult.porterFeesCents,
            surchargesCents: estimateResult.surchargesCents,
            subtotalCents: estimateResult.subtotalCents,
            discountCents: estimateResult.discountCents,
            taxCents: estimateResult.taxCents,
            serviceFeesCents: estimateResult.serviceFeesCents,
            totalCents: estimateResult.totalCents,
            currency: estimateResult.currency,
            breakdown: estimateResult.breakdown as any,
            rulesApplied: estimateResult.rulesApplied as any,
            customerType: (input.estimate.customerType?.toUpperCase() || 'CONSUMER') as any,
            promoCode: input.estimate.promoCode,
          },
        });

        logSnapshotPersisted({
          correlationId: ctx.correlationId,
          snapshotId: snapshot.id,
          orderId: input.orderId,
          totalCents: snapshot.totalCents,
        });

        // Publish event
        eventPublisher
          .publishPriceSnapshotPersisted({
            snapshotId: snapshot.id,
            orderId: input.orderId,
            totalCents: snapshot.totalCents,
            currency: estimateResult.currency,
            vehicleType: input.estimate.vehicleType,
            correlationId: ctx.correlationId,
          })
          .catch(err => logger.error('Failed to publish snapshot event', { error: err }));

        return {
          snapshotId: snapshot.id,
          success: true,
        };
      } catch (error) {
        logger.error('Failed to persist price snapshot', {
          correlationId: ctx.correlationId,
          orderId: input.orderId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to persist price snapshot',
          cause: error,
        });
      }
    }),

  /**
   * Get price snapshot by order ID
   */
  getPriceSnapshot: publicProcedure
    .input(
      z.object({
        orderId: z.string().optional(),
        snapshotId: z.string().optional(),
      })
    )
    .output(
      z.object({
        id: z.string(),
        orderId: z.string(),
        totalCents: z.number(),
        currency: z.string(),
        breakdown: z.any(),
        rulesApplied: z.any(),
        estimatedAt: z.date(),
        capturedAt: z.date().nullable(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        if (!input.orderId && !input.snapshotId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Either orderId or snapshotId must be provided',
          });
        }

        const snapshot = await prisma.pricingSnapshot.findFirst({
          where: {
            ...(input.orderId && { orderId: input.orderId }),
            ...(input.snapshotId && { id: input.snapshotId }),
          },
        });

        if (!snapshot) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Price snapshot not found',
          });
        }

        return {
          id: snapshot.id,
          orderId: snapshot.orderId,
          totalCents: snapshot.totalCents,
          currency: snapshot.currency,
          breakdown: snapshot.breakdown,
          rulesApplied: snapshot.rulesApplied,
          estimatedAt: snapshot.estimatedAt,
          capturedAt: snapshot.capturedAt,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        logger.error('Failed to get price snapshot', {
          correlationId: ctx.correlationId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get price snapshot',
          cause: error,
        });
      }
    }),

  /**
   * Preview price change for order modification
   */
  previewPriceChange: publicProcedure
    .input(
      z.object({
        orderId: z.string(),
        changedFields: PricingEstimateInputSchema.partial(),
      })
    )
    .output(
      z.object({
        originalTotalCents: z.number(),
        newTotalCents: z.number(),
        deltaCents: z.number(),
        requiresConfirmation: z.boolean(),
        newBreakdown: z.any(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get original snapshot
        const snapshot = await prisma.pricingSnapshot.findUnique({
          where: { orderId: input.orderId },
        });

        if (!snapshot) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Original price snapshot not found',
          });
        }

        // Reconstruct original input
        const originalInput: any = {
          pickup: {
            lat: snapshot.pickupLat,
            lng: snapshot.pickupLng,
            address: snapshot.pickupAddress,
          },
          dropoff: {
            lat: snapshot.dropoffLat,
            lng: snapshot.dropoffLng,
            address: snapshot.dropoffAddress,
          },
          vehicleType: snapshot.vehicleType.toLowerCase(),
          porterCount: snapshot.porterCount,
          scheduledAt: snapshot.scheduledAt,
          distanceMeters: snapshot.distanceMeters,
          durationSeconds: snapshot.durationSeconds,
        };

        // Merge with changed fields
        const newInput = { ...originalInput, ...input.changedFields };

        // Calculate new price
        const newEstimate = await pricingEngine.calculateEstimate(
          newInput,
          newInput.distanceMeters,
          newInput.durationSeconds,
          ctx.correlationId
        );

        const deltaCents = newEstimate.totalCents - snapshot.totalCents;
        const requiresConfirmation = Math.abs(deltaCents) > 100; // > $1.00 change

        return {
          originalTotalCents: snapshot.totalCents,
          newTotalCents: newEstimate.totalCents,
          deltaCents,
          requiresConfirmation,
          newBreakdown: newEstimate.breakdown,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        logger.error('Failed to preview price change', {
          correlationId: ctx.correlationId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to preview price change',
          cause: error,
        });
      }
    }),
});
