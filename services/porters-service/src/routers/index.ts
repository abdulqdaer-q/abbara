import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
// @ts-expect-error - superjson types in pnpm workspace
import superjson from 'superjson';
import { Context } from '../context';
import { requirePorter, requireAdmin, requireOwnPorterProfile } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import availabilityService from '../services/availabilityService';
import locationService from '../services/locationService';
import jobOfferService from '../services/jobOfferService';
import earningsService from '../services/earningsService';
import deviceSessionService from '../services/deviceSessionService';
import { locationUpdateLimiter } from '../middleware/rateLimiter';
import { getKafkaClient } from '../lib/kafka';
import {
  EventType,
  PorterRegisteredEvent,
  PorterVerificationRequestedEvent,
  PorterVerifiedEvent,
  PorterVerificationRejectedEvent,
  PorterSuspendedEvent,
  PorterUnsuspendedEvent,
  VehicleTypeSchema,
} from '@movenow/common';
import { getCorrelationId } from '../lib/correlation';
import { recordRpcRequest } from '../lib/metrics';
import { VehicleType, VerificationStatus } from '@prisma/client';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

/**
 * Middleware to require authentication
 */
const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Middleware to track RPC metrics
 */
const metricsMiddleware = t.middleware(async ({ path, next }) => {
  const start = Date.now();
  try {
    const result = await next();
    const duration = (Date.now() - start) / 1000;
    recordRpcRequest(path, 'success', duration);
    return result;
  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    recordRpcRequest(path, 'error', duration);
    throw error;
  }
});

const router = t.router;
const publicProcedure = t.procedure.use(metricsMiddleware);
const protectedProcedure = publicProcedure.use(requireAuth);

/**
 * Porter Service Router
 */
export const appRouter = router({
  /**
   * Health check
   */
  health: publicProcedure.query(() => {
    return { status: 'ok', service: 'porters-service' };
  }),

  /**
   * 1. Register Porter Profile
   */
  registerPorterProfile: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phone: z.string().min(10),
        email: z.string().email(),
        vehicleType: VehicleTypeSchema,
        vehicleModel: z.string().optional(),
        vehiclePlate: z.string().optional(),
        vehicleColor: z.string().optional(),
        vehicleCapacity: z.number().int().min(1).max(10).default(2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a porter
      if (ctx.user.role !== 'porter') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only porters can register porter profiles',
        });
      }

      // Check if profile already exists
      const existing = await prisma.porterProfile.findUnique({
        where: { userId: ctx.user.userId },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Porter profile already exists',
        });
      }

      const profile = await prisma.porterProfile.create({
        data: {
          userId: ctx.user.userId,
          ...input,
          vehicleType: input.vehicleType.toUpperCase() as VehicleType,
          verificationStatus: VerificationStatus.PENDING,
        },
      });

      logger.info('Porter profile registered', {
        porterId: profile.id,
        userId: ctx.user.userId,
      });

      // Publish event
      const kafka = getKafkaClient();
      const event: PorterRegisteredEvent = {
        type: EventType.PORTER_REGISTERED,
        timestamp: new Date(),
        correlationId: getCorrelationId(),
        userId: ctx.user.userId,
        porterId: profile.id,
        vehicleType: input.vehicleType,
      };
      await kafka.publishEvent(event);

      return profile;
    }),

  /**
   * 2. Submit Verification Documents
   */
  submitVerificationDocuments: protectedProcedure
    .input(
      z.object({
        porterId: z.string(),
        documents: z.array(
          z.object({
            type: z.string(), // 'license', 'registration', 'insurance', etc.
            url: z.string().url(),
            hash: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnPorterProfile(ctx.user.userId, input.porterId);

      const profile = await prisma.porterProfile.update({
        where: { id: input.porterId },
        data: {
          documents: input.documents as any,
          verificationStatus: VerificationStatus.UNDER_REVIEW,
        },
      });

      // Create verification history entry
      await prisma.verificationHistory.create({
        data: {
          porterId: input.porterId,
          status: VerificationStatus.UNDER_REVIEW,
          changedBy: ctx.user.userId,
          documents: input.documents as any,
        },
      });

      logger.info('Verification documents submitted', {
        porterId: input.porterId,
        documentCount: input.documents.length,
      });

      // Publish event
      const kafka = getKafkaClient();
      const event: PorterVerificationRequestedEvent = {
        type: EventType.PORTER_VERIFICATION_REQUESTED,
        timestamp: new Date(),
        correlationId: getCorrelationId(),
        userId: ctx.user.userId,
        porterId: input.porterId,
      };
      await kafka.publishEvent(event);

      return profile;
    }),

  /**
   * 3. Get Verification Status
   */
  getVerificationStatus: protectedProcedure
    .input(z.object({ porterId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireOwnPorterProfile(ctx.user.userId, input.porterId);

      const profile = await prisma.porterProfile.findUnique({
        where: { id: input.porterId },
        select: {
          verificationStatus: true,
          verifiedAt: true,
          rejectedAt: true,
          rejectionReason: true,
        },
      });

      const history = await prisma.verificationHistory.findMany({
        where: { porterId: input.porterId },
        orderBy: { createdAt: 'desc' },
      });

      return {
        currentStatus: profile?.verificationStatus,
        verifiedAt: profile?.verifiedAt,
        rejectedAt: profile?.rejectedAt,
        rejectionReason: profile?.rejectionReason,
        history,
      };
    }),

  /**
   * 4. Set Availability
   */
  setAvailability: protectedProcedure
    .input(
      z.object({
        porterId: z.string(),
        online: z.boolean(),
        location: z
          .object({
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnPorterProfile(ctx.user.userId, input.porterId);
      requirePorter(ctx.user);

      await availabilityService.setAvailability(
        input.porterId,
        ctx.user.userId,
        input.online,
        input.location
      );

      return { success: true, online: input.online };
    }),

  /**
   * 5. Get Availability
   */
  getAvailability: protectedProcedure
    .input(z.object({ porterId: z.string() }))
    .query(async ({ input }) => {
      const availability = await availabilityService.getAvailability(input.porterId);
      return availability;
    }),

  /**
   * 6. List Nearby Porters
   */
  listNearbyPorters: protectedProcedure
    .input(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusMeters: z.number().int().min(100).max(50000).default(5000),
        onlineOnly: z.boolean().default(true),
      })
    )
    .query(async ({ input }) => {
      const nearby = await locationService.findNearbyPorters(
        input.lat,
        input.lng,
        input.radiusMeters,
        input.onlineOnly
      );

      // Enrich with porter profiles
      const porterIds = nearby.map((n) => n.porterId);
      const profiles = await prisma.porterProfile.findMany({
        where: {
          id: { in: porterIds },
          isActive: true,
          isSuspended: false,
          verificationStatus: VerificationStatus.VERIFIED,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          vehicleType: true,
          rating: true,
        },
      });

      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      return nearby
        .filter((n) => profileMap.has(n.porterId))
        .map((n) => {
          const profile = profileMap.get(n.porterId)!;
          return {
            porterId: n.porterId,
            name: `${profile.firstName} ${profile.lastName}`,
            vehicleType: profile.vehicleType,
            rating: profile.rating,
            distance: n.distance,
            location: {
              lat: n.location.lat,
              lng: n.location.lng,
            },
          };
        });
    }),

  /**
   * 7. Accept Job
   */
  acceptJob: protectedProcedure
    .input(
      z.object({
        offerId: z.string(),
        porterId: z.string(),
        idempotencyKey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnPorterProfile(ctx.user.userId, input.porterId);
      requirePorter(ctx.user);

      const result = await jobOfferService.acceptOffer(
        input.offerId,
        input.porterId,
        ctx.user.userId,
        input.idempotencyKey
      );

      return result;
    }),

  /**
   * 8. Reject Job
   */
  rejectJob: protectedProcedure
    .input(
      z.object({
        offerId: z.string(),
        porterId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnPorterProfile(ctx.user.userId, input.porterId);
      requirePorter(ctx.user);

      const result = await jobOfferService.rejectOffer(
        input.offerId,
        input.porterId,
        input.reason
      );

      return result;
    }),

  /**
   * 9. Update Location
   */
  updateLocation: protectedProcedure
    .input(
      z.object({
        porterId: z.string(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracy: z.number().optional(),
        orderId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnPorterProfile(ctx.user.userId, input.porterId);

      // Rate limiting
      await locationUpdateLimiter.checkLimit(`location:${input.porterId}`);

      await locationService.updateLocation(
        input.porterId,
        ctx.user.userId,
        input.lat,
        input.lng,
        input.accuracy,
        input.orderId
      );

      return { success: true };
    }),

  /**
   * 10. Get Earnings Summary
   */
  getEarningsSummary: protectedProcedure
    .input(z.object({ porterId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireOwnPorterProfile(ctx.user.userId, input.porterId);

      const summary = await earningsService.getEarningsSummary(input.porterId);
      const recentEarnings = await earningsService.getRecentEarnings(input.porterId, 20);

      return {
        ...summary,
        recentTransactions: recentEarnings,
      };
    }),

  /**
   * 11. Request Withdrawal
   */
  requestWithdrawal: protectedProcedure
    .input(
      z.object({
        porterId: z.string(),
        amountCents: z.bigint().or(z.number().transform(BigInt)),
        idempotencyKey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnPorterProfile(ctx.user.userId, input.porterId);
      requirePorter(ctx.user);

      const withdrawal = await earningsService.requestWithdrawal(
        input.porterId,
        BigInt(input.amountCents),
        input.idempotencyKey
      );

      return withdrawal;
    }),

  /**
   * 12. Get Porter Profile
   */
  getPorterProfile: protectedProcedure
    .input(z.object({ porterId: z.string() }))
    .query(async ({ input }) => {
      const profile = await prisma.porterProfile.findUnique({
        where: { id: input.porterId },
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          vehicleType: true,
          vehicleModel: true,
          vehicleColor: true,
          vehicleCapacity: true,
          verificationStatus: true,
          rating: true,
          completedJobsCount: true,
          isActive: true,
          isSuspended: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!profile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Porter profile not found',
        });
      }

      return profile;
    }),

  /**
   * 13. Admin: Suspend Porter
   */
  adminSuspendPorter: protectedProcedure
    .input(
      z.object({
        porterId: z.string(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user);

      const profile = await prisma.porterProfile.update({
        where: { id: input.porterId },
        data: {
          isSuspended: true,
          suspendedAt: new Date(),
          suspendedBy: ctx.user.userId,
          suspensionReason: input.reason,
        },
      });

      logger.info('Porter suspended', {
        porterId: input.porterId,
        suspendedBy: ctx.user.userId,
        reason: input.reason,
      });

      // Publish event
      const kafka = getKafkaClient();
      const event: PorterSuspendedEvent = {
        type: EventType.PORTER_SUSPENDED,
        timestamp: new Date(),
        correlationId: getCorrelationId(),
        userId: profile.userId,
        porterId: input.porterId,
        suspendedBy: ctx.user.userId,
        reason: input.reason,
      };
      await kafka.publishEvent(event);

      return profile;
    }),

  /**
   * 14. Admin: Unsuspend Porter
   */
  adminUnsuspendPorter: protectedProcedure
    .input(z.object({ porterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user);

      const profile = await prisma.porterProfile.update({
        where: { id: input.porterId },
        data: {
          isSuspended: false,
          suspendedAt: null,
          suspendedBy: null,
          suspensionReason: null,
        },
      });

      logger.info('Porter unsuspended', {
        porterId: input.porterId,
        unsuspendedBy: ctx.user.userId,
      });

      // Publish event
      const kafka = getKafkaClient();
      const event: PorterUnsuspendedEvent = {
        type: EventType.PORTER_UNSUSPENDED,
        timestamp: new Date(),
        correlationId: getCorrelationId(),
        userId: profile.userId,
        porterId: input.porterId,
        unsuspendedBy: ctx.user.userId,
      };
      await kafka.publishEvent(event);

      return profile;
    }),

  /**
   * 15. Admin: Verify Porter
   */
  adminVerifyPorter: protectedProcedure
    .input(
      z.object({
        porterId: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user);

      const profile = await prisma.porterProfile.update({
        where: { id: input.porterId },
        data: {
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedAt: new Date(),
          verifiedBy: ctx.user.userId,
        },
      });

      // Create verification history entry
      await prisma.verificationHistory.create({
        data: {
          porterId: input.porterId,
          status: VerificationStatus.VERIFIED,
          changedBy: ctx.user.userId,
          notes: input.notes,
        },
      });

      logger.info('Porter verified', {
        porterId: input.porterId,
        verifiedBy: ctx.user.userId,
      });

      // Publish event
      const kafka = getKafkaClient();
      const event: PorterVerifiedEvent = {
        type: EventType.PORTER_VERIFIED,
        timestamp: new Date(),
        correlationId: getCorrelationId(),
        userId: profile.userId,
        porterId: input.porterId,
        verifiedBy: ctx.user.userId,
      };
      await kafka.publishEvent(event);

      return profile;
    }),

  /**
   * 16. Admin: Reject Verification
   */
  adminRejectVerification: protectedProcedure
    .input(
      z.object({
        porterId: z.string(),
        reason: z.string().min(1),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user);

      const profile = await prisma.porterProfile.update({
        where: { id: input.porterId },
        data: {
          verificationStatus: VerificationStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: input.reason,
        },
      });

      // Create verification history entry
      await prisma.verificationHistory.create({
        data: {
          porterId: input.porterId,
          status: VerificationStatus.REJECTED,
          changedBy: ctx.user.userId,
          reason: input.reason,
          notes: input.notes,
        },
      });

      logger.info('Porter verification rejected', {
        porterId: input.porterId,
        rejectedBy: ctx.user.userId,
        reason: input.reason,
      });

      // Publish event
      const kafka = getKafkaClient();
      const event: PorterVerificationRejectedEvent = {
        type: EventType.PORTER_VERIFICATION_REJECTED,
        timestamp: new Date(),
        correlationId: getCorrelationId(),
        userId: profile.userId,
        porterId: input.porterId,
        reason: input.reason,
      };
      await kafka.publishEvent(event);

      return profile;
    }),

  /**
   * Additional helper procedures
   */

  // Get porter's active job offers
  getMyOffers: protectedProcedure
    .input(z.object({ porterId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireOwnPorterProfile(ctx.user.userId, input.porterId);

      return await jobOfferService.getPorterOffers(input.porterId);
    }),

  // Get porter's device sessions
  getMyDevices: protectedProcedure
    .input(z.object({ porterId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireOwnPorterProfile(ctx.user.userId, input.porterId);

      return await deviceSessionService.getPorterDevices(input.porterId);
    }),

  // Register device
  registerDevice: protectedProcedure
    .input(
      z.object({
        porterId: z.string(),
        deviceId: z.string(),
        deviceName: z.string().optional(),
        deviceType: z.string().optional(),
        pushToken: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnPorterProfile(ctx.user.userId, input.porterId);

      return await deviceSessionService.registerDevice(
        input.porterId,
        input.deviceId,
        input.deviceName,
        input.deviceType,
        input.pushToken
      );
    }),
});

export type AppRouter = typeof appRouter;
