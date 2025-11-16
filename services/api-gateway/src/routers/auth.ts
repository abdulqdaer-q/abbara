import { router, publicProcedure, protectedProcedure } from '../trpc';
import {
  LoginInputSchema,
  RefreshTokenInputSchema,
  LogoutInputSchema,
} from '../types/zodSchemas';
import { wrapDownstreamError } from '../lib/errors';

/**
 * Authentication router
 * Delegates to auth-service for actual authentication logic
 */
export const authRouter = router({
  /**
   * Login with email and password
   * Returns access token and refresh token
   */
  login: publicProcedure
    .input(LoginInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        ctx.logger.info('Login attempt', { email: input.email });

        const result = await ctx.services.auth.login.mutate({
          email: input.email,
          password: input.password,
        });

        ctx.logger.info('Login successful', {
          email: input.email,
          userId: result.user.id
        });

        return {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
          },
        };
      } catch (error) {
        ctx.logger.error('Login failed', {
          email: input.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw wrapDownstreamError(error, 'auth-service', ctx.correlationId);
      }
    }),

  /**
   * Refresh access token using refresh token
   */
  refresh: publicProcedure
    .input(RefreshTokenInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        ctx.logger.info('Token refresh attempt');

        const result = await ctx.services.auth.refresh.mutate({
          refreshToken: input.refreshToken,
        });

        ctx.logger.info('Token refresh successful');

        return {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        };
      } catch (error) {
        ctx.logger.error('Token refresh failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw wrapDownstreamError(error, 'auth-service', ctx.correlationId);
      }
    }),

  /**
   * Logout (invalidate refresh token)
   */
  logout: protectedProcedure
    .input(LogoutInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        ctx.logger.info('Logout attempt', { userId: ctx.user.id });

        const result = await ctx.services.auth.logout.mutate({
          refreshToken: input.refreshToken,
        });

        ctx.logger.info('Logout successful', { userId: ctx.user.id });

        return {
          success: result.success,
        };
      } catch (error) {
        ctx.logger.error('Logout failed', {
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw wrapDownstreamError(error, 'auth-service', ctx.correlationId);
      }
    }),

  /**
   * Get current user information
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    ctx.logger.info('Get current user', { userId: ctx.user.id });

    return {
      id: ctx.user.id,
      email: ctx.user.email,
      role: ctx.user.role,
    };
  }),
});
