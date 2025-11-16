import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authenticatedProcedure, adminProcedure, publicProcedure } from '../trpc/trpc';
import { UserRoleSchema } from '@movenow/common';
import { requireSelfOrAdmin } from '../middleware/rbac';
import { createUserUpdatedEvent } from '../events/helpers';
import { logger } from '../utils/logger';

export const usersRouter = router({
  /**
   * Get authenticated user's profile
   */
  getProfile: authenticatedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.user.userId;

    const user = await ctx.repositories.users.findById(userId);

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    logger.debug('User profile retrieved', {
      userId,
      correlationId: ctx.correlationId,
    });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }),

  /**
   * Update user profile
   */
  updateProfile: authenticatedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(100).optional(),
        avatarUrl: z.string().url().optional(),
        email: z.string().email().optional(),
        phone: z.string().min(10).max(15).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.auth.user.userId;

      // If email or phone is being changed, check uniqueness
      if (input.email) {
        const existing = await ctx.repositories.users.findByEmail(input.email);
        if (existing && existing.id !== userId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Email already in use',
          });
        }
      }

      if (input.phone) {
        const existing = await ctx.repositories.users.findByPhone(input.phone);
        if (existing && existing.id !== userId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Phone number already in use',
          });
        }
      }

      // Update user
      const updatedUser = await ctx.repositories.users.update(userId, {
        ...input,
        // Reset verification if email/phone changed
        ...(input.email ? { emailVerified: false } : {}),
        ...(input.phone ? { phoneVerified: false } : {}),
      });

      logger.info('User profile updated', {
        userId,
        updatedFields: Object.keys(input),
        correlationId: ctx.correlationId,
      });

      // Publish UserUpdated event
      await ctx.eventPublisher.publish(
        createUserUpdatedEvent({
          userId,
          updatedFields: Object.keys(input),
          updatedAt: updatedUser.updatedAt,
          correlationId: ctx.correlationId,
        })
      );

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        phone: updatedUser.phone,
        displayName: updatedUser.displayName,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
        emailVerified: updatedUser.emailVerified,
        phoneVerified: updatedUser.phoneVerified,
      };
    }),

  /**
   * Get public profile (minimal info)
   */
  getPublicProfile: publicProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const user = await ctx.repositories.users.findById(input.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      logger.debug('Public profile retrieved', {
        userId: input.userId,
        correlationId: ctx.correlationId,
      });

      // Return only public information
      return {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
      };
    }),

  /**
   * Search users (admin or authenticated with limited results)
   */
  search: authenticatedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const { query, limit } = input;
      const isAdmin = ctx.auth.user.role === 'ADMIN';

      // Non-admins get limited results
      const maxLimit = isAdmin ? limit : Math.min(limit, 10);

      const users = await ctx.repositories.users.search(query, maxLimit);

      logger.debug('User search performed', {
        query,
        resultCount: users.length,
        isAdmin,
        correlationId: ctx.correlationId,
      });

      // Return limited info for non-admins
      return users.map((user) => ({
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        ...(isAdmin
          ? {
              email: user.email,
              phone: user.phone,
              emailVerified: user.emailVerified,
              phoneVerified: user.phoneVerified,
              createdAt: user.createdAt,
            }
          : {}),
      }));
    }),

  /**
   * Get user by ID (admin only)
   */
  getUserById: adminProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const user = await ctx.repositories.users.findById(input.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      logger.debug('User retrieved by admin', {
        userId: input.userId,
        adminId: ctx.auth.user.userId,
        correlationId: ctx.correlationId,
      });

      return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    }),

  /**
   * Update user role (admin only)
   */
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: UserRoleSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId, role } = input;

      const user = await ctx.repositories.users.findById(userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const updatedUser = await ctx.repositories.users.update(userId, { role });

      logger.info('User role updated', {
        userId,
        oldRole: user.role,
        newRole: role,
        adminId: ctx.auth.user.userId,
        correlationId: ctx.correlationId,
      });

      // Publish UserUpdated event
      await ctx.eventPublisher.publish(
        createUserUpdatedEvent({
          userId,
          updatedFields: ['role'],
          updatedAt: updatedUser.updatedAt,
          correlationId: ctx.correlationId,
        })
      );

      return {
        id: updatedUser.id,
        role: updatedUser.role,
      };
    }),

  /**
   * List users by role (admin only)
   */
  listByRole: adminProcedure
    .input(
      z.object({
        role: UserRoleSchema,
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const { role, skip, take } = input;

      const users = await ctx.repositories.users.listByRole(role, skip, take);

      logger.debug('Users listed by role', {
        role,
        count: users.length,
        adminId: ctx.auth.user.userId,
        correlationId: ctx.correlationId,
      });

      return users.map((user) => ({
        id: user.id,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
      }));
    }),
});
