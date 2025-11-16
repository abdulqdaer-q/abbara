import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { getPrismaClient } from '../lib/db';

/**
 * Strategy router for managing bid evaluation strategies
 */
export const strategyRouter = router({
  /**
   * List all strategies
   */
  list: protectedProcedure
    .input(
      z.object({
        activeOnly: z.boolean().default(true),
      })
    )
    .query(async ({ input }) => {
      const prisma = getPrismaClient();

      return await prisma.bidStrategy.findMany({
        where: input.activeOnly ? { isActive: true } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
      });
    }),

  /**
   * Get strategy by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const prisma = getPrismaClient();

      return await prisma.bidStrategy.findUnique({
        where: { id: input.id },
      });
    }),

  /**
   * Create a new strategy (admin only)
   */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(500),
        parameters: z.object({
          priceWeight: z.number().min(0).max(1),
          etaWeight: z.number().min(0).max(1),
          ratingWeight: z.number().min(0).max(1),
          reliabilityWeight: z.number().min(0).max(1),
          distanceWeight: z.number().min(0).max(1),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const prisma = getPrismaClient();

      // Validate weights sum to approximately 1.0
      const totalWeight =
        input.parameters.priceWeight +
        input.parameters.etaWeight +
        input.parameters.ratingWeight +
        input.parameters.reliabilityWeight +
        input.parameters.distanceWeight;

      if (Math.abs(totalWeight - 1.0) > 0.01) {
        throw new Error('Strategy parameter weights must sum to 1.0');
      }

      return await prisma.bidStrategy.create({
        data: {
          name: input.name,
          description: input.description,
          parameters: input.parameters,
        },
      });
    }),

  /**
   * Update strategy (admin only)
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().min(1).max(500).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const prisma = getPrismaClient();

      const { id, ...updateData } = input;

      return await prisma.bidStrategy.update({
        where: { id },
        data: updateData,
      });
    }),

  /**
   * Deprecate strategy (admin only)
   */
  deprecate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const prisma = getPrismaClient();

      return await prisma.bidStrategy.update({
        where: { id: input.id },
        data: {
          isActive: false,
          deprecatedAt: new Date(),
        },
      });
    }),
});
