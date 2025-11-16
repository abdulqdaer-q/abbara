import { router, protectedProcedure } from '../trpc';
import { SubscribeToNamespaceInputSchema } from '../types/zodSchemas';
import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * Realtime router
 * Handles WebSocket authentication and connection setup
 */
export const realtimeRouter = router({
  /**
   * Subscribe to realtime namespace
   * Generates a signed token for WebSocket authentication
   * Client uses this token to connect to realtime-service
   */
  subscribeToNamespace: protectedProcedure
    .input(SubscribeToNamespaceInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        ctx.logger.info('Generating realtime subscription token', {
          namespace: input.namespace,
          userId: ctx.user.id,
        });

        // Verify user has access to requested namespace
        if (input.namespace === 'porter' && ctx.user.role !== 'porter' && ctx.user.role !== 'admin') {
          throw new Error('Only porters can access porter namespace');
        }

        if (input.namespace === 'client' && ctx.user.role !== 'client' && ctx.user.role !== 'admin') {
          throw new Error('Only clients can access client namespace');
        }

        // Generate signed token for socket authentication
        // This token is separate from the access token and used specifically for socket.io
        const socketToken = jwt.sign(
          {
            userId: ctx.user.id,
            email: ctx.user.email,
            role: ctx.user.role,
            namespace: input.namespace,
            correlationId: ctx.correlationId,
          },
          config.jwt.accessSecret, // In production, use separate socket secret
          { expiresIn: '1h' }
        );

        const socketInfo = {
          url: config.services.realtime,
          token: socketToken,
          namespace: input.namespace,
          userId: ctx.user.id,
          expiresIn: 3600, // 1 hour in seconds
        };

        ctx.logger.info('Realtime subscription token generated', {
          namespace: input.namespace,
          userId: ctx.user.id,
        });

        return socketInfo;
      } catch (error) {
        ctx.logger.error('Failed to generate realtime subscription token', {
          namespace: input.namespace,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      }
    }),

  /**
   * Refresh realtime token
   * Allows clients to refresh their socket token before expiry
   */
  refreshSocketToken: protectedProcedure
    .mutation(async ({ ctx }) => {
      ctx.logger.info('Refreshing socket token', { userId: ctx.user.id });

      const socketToken = jwt.sign(
        {
          userId: ctx.user.id,
          email: ctx.user.email,
          role: ctx.user.role,
          correlationId: ctx.correlationId,
        },
        config.jwt.accessSecret,
        { expiresIn: '1h' }
      );

      return {
        token: socketToken,
        expiresIn: 3600,
      };
    }),
});
