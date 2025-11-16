import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, authenticatedProcedure } from '../trpc/trpc';
import { UserRoleSchema } from '@movenow/common';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { generateTokenPair, hashToken } from '../utils/token';
import { checkRateLimit } from '../middleware/rateLimit';
import { createUserCreatedEvent } from '../events/helpers';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Calculate token expiry based on config
 */
function getRefreshTokenExpiry(): Date {
  const expiryMs = config.JWT_REFRESH_EXPIRY.includes('d')
    ? parseInt(config.JWT_REFRESH_EXPIRY) * 24 * 60 * 60 * 1000
    : parseInt(config.JWT_REFRESH_EXPIRY) * 60 * 60 * 1000;

  return new Date(Date.now() + expiryMs);
}

export const authRouter = router({
  /**
   * Register a new user
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        phone: z.string().min(10).max(15).optional(),
        password: z.string().min(8),
        displayName: z.string().min(1).max(100),
        role: UserRoleSchema.optional(),
        idempotencyKey: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { email, phone, password, displayName, role } = input;

      // Validate that at least email or phone is provided
      if (!email && !phone) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Either email or phone must be provided',
        });
      }

      // Rate limiting
      const identifier = email || phone || ctx.ipAddress || 'unknown';
      await checkRateLimit(identifier, { keyPrefix: 'register' });

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: passwordValidation.errors.join(', '),
        });
      }

      // Check if user already exists
      const existingUser = await ctx.repositories.users.findByEmailOrPhone(email, phone);
      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User already exists with this email or phone',
        });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const user = await ctx.repositories.users.create({
        email,
        phone,
        passwordHash,
        displayName,
        role: role || 'CUSTOMER',
      });

      logger.info('User registered', {
        userId: user.id,
        role: user.role,
        correlationId: ctx.correlationId,
      });

      // Generate tokens
      const { token: refreshToken, hash: refreshTokenHash } = generateTokenPair();

      // Store refresh token
      await ctx.repositories.refreshTokens.create({
        tokenHash: refreshTokenHash,
        userId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        expiresAt: getRefreshTokenExpiry(),
      });

      const accessToken = signAccessToken({
        userId: user.id,
        email: user.email || undefined,
        phone: user.phone || undefined,
        role: user.role,
      });

      const refreshTokenJWT = signRefreshToken({
        userId: user.id,
        tokenId: refreshTokenHash,
      });

      // Publish UserCreated event
      await ctx.eventPublisher.publish(
        createUserCreatedEvent({
          userId: user.id,
          email: user.email || undefined,
          phone: user.phone || undefined,
          role: user.role,
          createdAt: user.createdAt,
          correlationId: ctx.correlationId,
        })
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          displayName: user.displayName,
          role: user.role,
        },
        accessToken,
        refreshToken: refreshTokenJWT,
      };
    }),

  /**
   * Login
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { email, phone, password } = input;

      // Validate that either email or phone is provided
      if (!email && !phone) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Either email or phone must be provided',
        });
      }

      // Rate limiting
      const identifier = email || phone || ctx.ipAddress || 'unknown';
      await checkRateLimit(identifier, { keyPrefix: 'login' });

      // Find user
      const user = await ctx.repositories.users.findByEmailOrPhone(email, phone);
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      // Verify password
      const valid = await verifyPassword(user.passwordHash, password);
      if (!valid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      logger.info('User logged in', {
        userId: user.id,
        correlationId: ctx.correlationId,
      });

      // Generate tokens
      const { token: refreshToken, hash: refreshTokenHash } = generateTokenPair();

      // Store refresh token
      await ctx.repositories.refreshTokens.create({
        tokenHash: refreshTokenHash,
        userId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        expiresAt: getRefreshTokenExpiry(),
      });

      const accessToken = signAccessToken({
        userId: user.id,
        email: user.email || undefined,
        phone: user.phone || undefined,
        role: user.role,
      });

      const refreshTokenJWT = signRefreshToken({
        userId: user.id,
        tokenId: refreshTokenHash,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: user.role,
        },
        accessToken,
        refreshToken: refreshTokenJWT,
      };
    }),

  /**
   * Refresh access token
   */
  refresh: publicProcedure
    .input(
      z.object({
        refreshToken: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify refresh token JWT
        const payload = verifyRefreshToken(input.refreshToken);

        // Check if refresh token exists and is valid
        const storedToken = await ctx.repositories.refreshTokens.findByHash(payload.tokenId);

        if (!storedToken) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid refresh token',
          });
        }

        if (storedToken.revoked) {
          // Token reuse detected - revoke all tokens for this user
          logger.warn('Refresh token reuse detected', {
            userId: storedToken.userId,
            correlationId: ctx.correlationId,
          });

          await ctx.repositories.refreshTokens.revokeAllForUser(storedToken.userId);

          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Token reuse detected. All sessions revoked.',
          });
        }

        if (storedToken.expiresAt < new Date()) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Refresh token expired',
          });
        }

        // Revoke old token (rotation)
        await ctx.repositories.refreshTokens.revoke(payload.tokenId);

        // Get user
        const user = await ctx.repositories.users.findById(storedToken.userId);
        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not found',
          });
        }

        logger.info('Refresh token rotated', {
          userId: user.id,
          correlationId: ctx.correlationId,
        });

        // Generate new tokens
        const { token: newRefreshToken, hash: newRefreshTokenHash } = generateTokenPair();

        await ctx.repositories.refreshTokens.create({
          tokenHash: newRefreshTokenHash,
          userId: user.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          expiresAt: getRefreshTokenExpiry(),
        });

        const accessToken = signAccessToken({
          userId: user.id,
          email: user.email || undefined,
          phone: user.phone || undefined,
          role: user.role,
        });

        const refreshTokenJWT = signRefreshToken({
          userId: user.id,
          tokenId: newRefreshTokenHash,
        });

        return {
          accessToken,
          refreshToken: refreshTokenJWT,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error('Token refresh failed', { error, correlationId: ctx.correlationId });

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid refresh token',
        });
      }
    }),

  /**
   * Logout - revoke refresh token
   */
  logout: authenticatedProcedure
    .input(
      z.object({
        refreshToken: z.string().optional(),
        revokeAll: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.auth.user.userId;

      if (input.revokeAll) {
        // Revoke all tokens for user
        const count = await ctx.repositories.refreshTokens.revokeAllForUser(userId);

        logger.info('All refresh tokens revoked', {
          userId,
          count,
          correlationId: ctx.correlationId,
        });

        return { message: 'All sessions logged out', count };
      }

      if (input.refreshToken) {
        try {
          const payload = verifyRefreshToken(input.refreshToken);
          await ctx.repositories.refreshTokens.revoke(payload.tokenId);

          logger.info('Refresh token revoked', {
            userId,
            correlationId: ctx.correlationId,
          });

          return { message: 'Logged out successfully' };
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid refresh token',
          });
        }
      }

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Either refreshToken or revokeAll must be provided',
      });
    }),

  /**
   * Request password reset
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { email, phone } = input;

      if (!email && !phone) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Either email or phone must be provided',
        });
      }

      // Rate limiting
      const identifier = email || phone || ctx.ipAddress || 'unknown';
      await checkRateLimit(identifier, { keyPrefix: 'password-reset', maxRequests: 3 });

      // Find user
      const user = await ctx.repositories.users.findByEmailOrPhone(email, phone);

      // Always return success even if user not found (security)
      if (!user) {
        logger.info('Password reset requested for non-existent user', { email, phone });
        return { message: 'If the user exists, a password reset link will be sent' };
      }

      // Generate reset token
      const { token, hash } = generateTokenPair();

      // Calculate expiry
      const expiryMs = parseInt(config.PASSWORD_RESET_TOKEN_EXPIRY) * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + expiryMs);

      // Store token
      await ctx.repositories.passwordResets.create({
        userId: user.id,
        tokenHash: hash,
        expiresAt,
      });

      logger.info('Password reset token created', {
        userId: user.id,
        correlationId: ctx.correlationId,
      });

      // In production, send email/SMS with reset link
      // For now, just log it (remove in production)
      logger.debug('Password reset token', { token, userId: user.id });

      return { message: 'If the user exists, a password reset link will be sent' };
    }),

  /**
   * Confirm password reset
   */
  confirmPasswordReset: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { token, newPassword } = input;

      // Validate password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: passwordValidation.errors.join(', '),
        });
      }

      // Hash token
      const tokenHash = hashToken(token);

      // Find and validate token
      const resetToken = await ctx.repositories.passwordResets.findByHash(tokenHash);

      if (!resetToken) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired reset token',
        });
      }

      if (resetToken.used) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Reset token already used',
        });
      }

      if (resetToken.expiresAt < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Reset token expired',
        });
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Update user password
      await ctx.repositories.users.update(resetToken.userId, { passwordHash });

      // Mark token as used
      await ctx.repositories.passwordResets.markAsUsed(tokenHash);

      // Revoke all refresh tokens for security
      await ctx.repositories.refreshTokens.revokeAllForUser(resetToken.userId);

      logger.info('Password reset successful', {
        userId: resetToken.userId,
        correlationId: ctx.correlationId,
      });

      return { message: 'Password reset successful. Please log in with your new password.' };
    }),
});
