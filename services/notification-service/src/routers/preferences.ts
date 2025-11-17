import { router, protectedProcedure } from '../trpc';
import {
  UpdatePreferencesInputSchema,
  RegisterDeviceTokenInputSchema,
  UnregisterDeviceTokenInputSchema,
} from '../types/zodSchemas';
import { cacheUserPreferences, invalidateUserPreferencesCache } from '../lib/redis';

export const preferencesRouter = router({
  /**
   * Get current user's notification preferences
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    ctx.logger.info('Getting user preferences', { userId: ctx.user.id });

    let preferences = await ctx.db.userPreferences.findUnique({
      where: { userId: ctx.user.id },
    });

    // Create default preferences if not found
    if (!preferences) {
      preferences = await ctx.db.userPreferences.create({
        data: { userId: ctx.user.id },
      });
    }

    return preferences;
  }),

  /**
   * Update current user's notification preferences
   */
  update: protectedProcedure
    .input(UpdatePreferencesInputSchema)
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Updating user preferences', { userId: ctx.user.id, input });

      // Find or create preferences
      let preferences = await ctx.db.userPreferences.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!preferences) {
        preferences = await ctx.db.userPreferences.create({
          data: {
            userId: ctx.user.id,
            ...input,
          },
        });
      } else {
        preferences = await ctx.db.userPreferences.update({
          where: { userId: ctx.user.id },
          data: input,
        });
      }

      // Invalidate cache
      await invalidateUserPreferencesCache(ctx.user.id);

      // Cache updated preferences
      await cacheUserPreferences(ctx.user.id, preferences);

      ctx.logger.info('User preferences updated successfully', {
        userId: ctx.user.id,
        correlationId: ctx.correlationId,
      });

      return {
        success: true,
        preferences,
      };
    }),

  /**
   * Register a device token for push notifications
   */
  registerDeviceToken: protectedProcedure
    .input(RegisterDeviceTokenInputSchema)
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Registering device token', {
        userId: ctx.user.id,
        platform: input.platform,
      });

      // Check if token already exists
      const existingToken = await ctx.db.deviceToken.findUnique({
        where: { token: input.token },
      });

      let deviceToken;

      if (existingToken) {
        // Update existing token
        deviceToken = await ctx.db.deviceToken.update({
          where: { token: input.token },
          data: {
            userId: ctx.user.id,
            platform: input.platform,
            deviceInfo: input.deviceInfo,
            isActive: true,
            lastUsedAt: new Date(),
          },
        });
      } else {
        // Create new token
        deviceToken = await ctx.db.deviceToken.create({
          data: {
            userId: ctx.user.id,
            token: input.token,
            platform: input.platform,
            deviceInfo: input.deviceInfo,
          },
        });
      }

      // Also update user preferences to include this token
      const preferences = await ctx.db.userPreferences.findUnique({
        where: { userId: ctx.user.id },
      });

      if (preferences) {
        const tokens =
          input.platform === 'ios' || input.platform === 'android'
            ? preferences.fcmTokens
            : [];

        if (!tokens.includes(input.token)) {
          await ctx.db.userPreferences.update({
            where: { userId: ctx.user.id },
            data: {
              fcmTokens: [...tokens, input.token],
            },
          });

          // Invalidate cache
          await invalidateUserPreferencesCache(ctx.user.id);
        }
      }

      ctx.logger.info('Device token registered successfully', {
        userId: ctx.user.id,
        tokenId: deviceToken.id,
        correlationId: ctx.correlationId,
      });

      return {
        success: true,
        deviceToken,
      };
    }),

  /**
   * Unregister a device token
   */
  unregisterDeviceToken: protectedProcedure
    .input(UnregisterDeviceTokenInputSchema)
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Unregistering device token', {
        userId: ctx.user.id,
        token: input.token.substring(0, 10) + '...',
      });

      // Deactivate the token
      await ctx.db.deviceToken.updateMany({
        where: {
          token: input.token,
          userId: ctx.user.id,
        },
        data: {
          isActive: false,
        },
      });

      // Remove from user preferences
      const preferences = await ctx.db.userPreferences.findUnique({
        where: { userId: ctx.user.id },
      });

      if (preferences) {
        const updatedFcmTokens = preferences.fcmTokens.filter((t) => t !== input.token);
        const updatedApnsTokens = preferences.apnsTokens.filter((t) => t !== input.token);

        await ctx.db.userPreferences.update({
          where: { userId: ctx.user.id },
          data: {
            fcmTokens: updatedFcmTokens,
            apnsTokens: updatedApnsTokens,
          },
        });

        // Invalidate cache
        await invalidateUserPreferencesCache(ctx.user.id);
      }

      ctx.logger.info('Device token unregistered successfully', {
        userId: ctx.user.id,
        correlationId: ctx.correlationId,
      });

      return {
        success: true,
      };
    }),

  /**
   * Get list of registered device tokens for current user
   */
  listDeviceTokens: protectedProcedure.query(async ({ ctx }) => {
    ctx.logger.info('Listing device tokens', { userId: ctx.user.id });

    const tokens = await ctx.db.deviceToken.findMany({
      where: {
        userId: ctx.user.id,
        isActive: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return { tokens };
  }),
});
