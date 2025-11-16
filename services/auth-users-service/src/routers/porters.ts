import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authenticatedProcedure, porterProcedure, adminProcedure } from '../trpc/trpc';
import { VerificationStatusSchema } from '@movenow/common';
import {
  createPorterVerificationRequestedEvent,
  createPorterVerifiedEvent,
} from '../events/helpers';
import { logger } from '../utils/logger';

export const portersRouter = router({
  /**
   * Submit porter verification documents
   */
  submitVerification: porterProcedure
    .input(
      z.object({
        documents: z.array(
          z.object({
            type: z.string(),
            url: z.string().url(),
            uploadedAt: z.string().datetime().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.auth.user.userId;

      // Check if porter profile exists
      let porterProfile = await ctx.repositories.porterProfiles.findByUserId(userId);

      const documentsMetadata = input.documents.map((doc) => ({
        ...doc,
        uploadedAt: doc.uploadedAt || new Date().toISOString(),
      }));

      if (!porterProfile) {
        // Create porter profile
        porterProfile = await ctx.repositories.porterProfiles.create({
          userId,
          documentsMetadata,
        });

        // Update user role to PORTER
        await ctx.repositories.users.update(userId, { role: 'PORTER' });
      } else {
        // Update existing profile
        porterProfile = await ctx.repositories.porterProfiles.update(userId, {
          documentsMetadata,
          verificationStatus: 'PENDING',
          verificationRequestedAt: new Date(),
        });
      }

      logger.info('Porter verification submitted', {
        userId,
        porterId: porterProfile.id,
        documentCount: input.documents.length,
        correlationId: ctx.correlationId,
      });

      // Publish verification requested event
      await ctx.eventPublisher.publish(
        createPorterVerificationRequestedEvent({
          userId,
          porterId: porterProfile.id,
          documentTypes: input.documents.map((d) => d.type),
          requestedAt: new Date(),
          correlationId: ctx.correlationId,
        })
      );

      return {
        id: porterProfile.id,
        verificationStatus: porterProfile.verificationStatus,
        message: 'Verification documents submitted successfully',
      };
    }),

  /**
   * Get verification status
   */
  getVerificationStatus: authenticatedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.user.userId;

    const porterProfile = await ctx.repositories.porterProfiles.findByUserId(userId);

    if (!porterProfile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Porter profile not found',
      });
    }

    logger.debug('Porter verification status retrieved', {
      userId,
      porterId: porterProfile.id,
      status: porterProfile.verificationStatus,
      correlationId: ctx.correlationId,
    });

    return {
      id: porterProfile.id,
      verificationStatus: porterProfile.verificationStatus,
      documentsMetadata: porterProfile.documentsMetadata,
      rating: porterProfile.rating,
      totalRatings: porterProfile.totalRatings,
      verificationRequestedAt: porterProfile.verificationRequestedAt,
      verifiedAt: porterProfile.verifiedAt,
      rejectedAt: porterProfile.rejectedAt,
      rejectionReason: porterProfile.rejectionReason,
    };
  }),

  /**
   * Get porter profile by user ID
   */
  getPorterProfile: authenticatedProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const porterProfile = await ctx.repositories.porterProfiles.findByUserId(input.userId);

      if (!porterProfile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Porter profile not found',
        });
      }

      const isOwner = ctx.auth.user.userId === input.userId;
      const isAdmin = ctx.auth.user.role === 'ADMIN';

      logger.debug('Porter profile retrieved', {
        userId: input.userId,
        porterId: porterProfile.id,
        requesterId: ctx.auth.user.userId,
        correlationId: ctx.correlationId,
      });

      // Return full info for owner and admin, limited for others
      return {
        id: porterProfile.id,
        userId: porterProfile.userId,
        verificationStatus: porterProfile.verificationStatus,
        rating: porterProfile.rating,
        totalRatings: porterProfile.totalRatings,
        ...(isOwner || isAdmin
          ? {
              documentsMetadata: porterProfile.documentsMetadata,
              verificationRequestedAt: porterProfile.verificationRequestedAt,
              verifiedAt: porterProfile.verifiedAt,
              rejectedAt: porterProfile.rejectedAt,
              rejectionReason: porterProfile.rejectionReason,
            }
          : {}),
      };
    }),

  /**
   * List porter profiles by status (admin only)
   */
  listByStatus: adminProcedure
    .input(
      z.object({
        status: VerificationStatusSchema,
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const { status, skip, take } = input;

      const porterProfiles = await ctx.repositories.porterProfiles.listByStatus(
        status,
        skip,
        take
      );

      logger.debug('Porter profiles listed by status', {
        status,
        count: porterProfiles.length,
        adminId: ctx.auth.user.userId,
        correlationId: ctx.correlationId,
      });

      return porterProfiles.map((profile) => ({
        id: profile.id,
        userId: profile.userId,
        user: {
          displayName: profile.user.displayName,
          email: profile.user.email,
          phone: profile.user.phone,
        },
        verificationStatus: profile.verificationStatus,
        documentsMetadata: profile.documentsMetadata,
        rating: profile.rating,
        totalRatings: profile.totalRatings,
        verificationRequestedAt: profile.verificationRequestedAt,
        createdAt: profile.createdAt,
      }));
    }),

  /**
   * Update verification status (admin only)
   */
  updateVerificationStatus: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        status: VerificationStatusSchema,
        rejectionReason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId, status, rejectionReason } = input;

      const porterProfile = await ctx.repositories.porterProfiles.findByUserId(userId);

      if (!porterProfile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Porter profile not found',
        });
      }

      const updatedProfile = await ctx.repositories.porterProfiles.updateVerificationStatus(
        userId,
        status,
        rejectionReason
      );

      logger.info('Porter verification status updated', {
        userId,
        porterId: porterProfile.id,
        oldStatus: porterProfile.verificationStatus,
        newStatus: status,
        adminId: ctx.auth.user.userId,
        correlationId: ctx.correlationId,
      });

      // Publish verification event
      await ctx.eventPublisher.publish(
        createPorterVerifiedEvent({
          userId,
          porterId: porterProfile.id,
          verificationStatus: status,
          verifiedAt: new Date(),
          correlationId: ctx.correlationId,
        })
      );

      return {
        id: updatedProfile.id,
        verificationStatus: updatedProfile.verificationStatus,
        verifiedAt: updatedProfile.verifiedAt,
        rejectedAt: updatedProfile.rejectedAt,
        rejectionReason: updatedProfile.rejectionReason,
      };
    }),

  /**
   * Update porter rating
   */
  updateRating: authenticatedProcedure
    .input(
      z.object({
        porterId: z.string(),
        rating: z.number().min(0).max(5),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { porterId, rating } = input;

      // Find porter profile by ID
      const porterProfile = await ctx.repositories.porterProfiles.findById(porterId);

      if (!porterProfile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Porter profile not found',
        });
      }

      const updatedProfile = await ctx.repositories.porterProfiles.updateRating(
        porterProfile.userId,
        rating
      );

      logger.info('Porter rating updated', {
        porterId,
        newRating: updatedProfile.rating,
        totalRatings: updatedProfile.totalRatings,
        ratedBy: ctx.auth.user.userId,
        correlationId: ctx.correlationId,
      });

      return {
        id: updatedProfile.id,
        rating: updatedProfile.rating,
        totalRatings: updatedProfile.totalRatings,
      };
    }),

  /**
   * Search verified porters
   */
  searchVerified: authenticatedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(100).default(20),
        minRating: z.number().min(0).max(5).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take, minRating } = input;

      const porterProfiles = await ctx.repositories.porterProfiles.searchVerified(
        skip,
        take,
        minRating
      );

      logger.debug('Verified porters searched', {
        count: porterProfiles.length,
        minRating,
        correlationId: ctx.correlationId,
      });

      return porterProfiles.map((profile) => ({
        id: profile.id,
        userId: profile.userId,
        user: {
          displayName: profile.user.displayName,
          avatarUrl: profile.user.avatarUrl,
        },
        rating: profile.rating,
        totalRatings: profile.totalRatings,
        verifiedAt: profile.verifiedAt,
      }));
    }),
});
