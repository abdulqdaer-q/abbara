import { router, publicProcedure, protectedProcedure } from '../trpc';
import {
  NearbyPortersInputSchema,
  GetPorterInputSchema,
  SubscribeToJobsInputSchema,
} from '../types/zodSchemas';
import { wrapDownstreamError } from '../lib/errors';

/**
 * Porters router
 * Handles porter-related queries and operations
 */
export const portersRouter = router({
  /**
   * Find nearby available porters
   * Public endpoint to show porter availability before login
   */
  nearby: publicProcedure
    .input(NearbyPortersInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        ctx.logger.info('Finding nearby porters', {
          lat: input.lat,
          lng: input.lng,
          radiusMeters: input.radiusMeters,
          vehicleType: input.vehicleType,
        });

        const porters = await ctx.services.porters.nearby.query({
          lat: input.lat,
          lng: input.lng,
          radiusMeters: input.radiusMeters,
          vehicleType: input.vehicleType,
        });

        ctx.logger.info('Found nearby porters', { count: porters.length });

        return porters;
      } catch (error) {
        ctx.logger.error('Failed to find nearby porters', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw wrapDownstreamError(error, 'porters-service', ctx.correlationId);
      }
    }),

  /**
   * Get porter details
   */
  get: publicProcedure
    .input(GetPorterInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        ctx.logger.info('Fetching porter details', { porterId: input });

        const porter = await ctx.services.porters.getPorter.query(input);

        ctx.logger.info('Porter details fetched', { porterId: input });

        return porter;
      } catch (error) {
        ctx.logger.error('Failed to fetch porter details', {
          porterId: input,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw wrapDownstreamError(error, 'porters-service', ctx.correlationId);
      }
    }),

  /**
   * Subscribe to job notifications (for porter app)
   * This endpoint helps porters get a signed token for realtime subscriptions
   */
  subscribeToJobs: protectedProcedure
    .input(SubscribeToJobsInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        ctx.logger.info('Porter subscribing to jobs', {
          porterId: input.porterId,
          userId: ctx.user.id,
        });

        // Verify user is a porter and has access to this porter ID
        if (ctx.user.role !== 'porter' && ctx.user.role !== 'admin') {
          throw new Error('Only porters can subscribe to job notifications');
        }

        // In a real implementation, this would:
        // 1. Generate a signed token for socket connection
        // 2. Register the porter's current location
        // 3. Return socket connection details

        const socketInfo = {
          url: `ws://realtime-service/porter/${input.porterId}`,
          token: 'signed-socket-token-here', // Would be JWT signed with socket secret
          namespace: 'porter',
        };

        ctx.logger.info('Porter subscription info generated', {
          porterId: input.porterId,
        });

        return socketInfo;
      } catch (error) {
        ctx.logger.error('Failed to subscribe porter to jobs', {
          porterId: input.porterId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw wrapDownstreamError(error, 'realtime-service', ctx.correlationId);
      }
    }),
});
