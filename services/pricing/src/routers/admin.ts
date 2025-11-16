import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../lib/db';
import { logger, logRuleChange } from '../lib/logger';
import { eventPublisher } from '../lib/events';
import { deleteCachedByPattern } from '../lib/redis';

/**
 * Rule type enum for validation
 */
const RuleTypeSchema = z.enum([
  'BASE_FARE',
  'PER_KM',
  'PER_MINUTE',
  'PORTER_FEE',
  'ITEM_SIZE_SURCHARGE',
  'MINIMUM_FARE',
  'PEAK_MULTIPLIER',
  'GEO_MULTIPLIER',
  'PROMO_DISCOUNT',
  'SERVICE_FEE',
  'TAX',
  'MULTI_STOP_FEE',
  'CANCELLATION_FEE',
  'WAIT_FEE',
]);

const VehicleTypeSchema = z.enum(['SEDAN', 'SUV', 'VAN', 'TRUCK']);
const CustomerTypeSchema = z.enum(['CONSUMER', 'BUSINESS', 'ENTERPRISE']);

/**
 * Admin router for pricing rule management
 */
export const adminRouter = router({
  /**
   * Create a new pricing rule
   */
  createRule: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        ruleType: RuleTypeSchema,
        priority: z.number().int().default(0),
        enabled: z.boolean().default(true),
        vehicleTypes: z.array(VehicleTypeSchema).default(['SEDAN', 'SUV', 'VAN', 'TRUCK']),
        customerTypes: z.array(CustomerTypeSchema).default(['CONSUMER']),
        minOrderValue: z.number().int().optional(),
        maxOrderValue: z.number().int().optional(),
        effectiveFrom: z.date(),
        effectiveTo: z.date().optional(),
        config: z.any(), // Rule-specific configuration
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Validate config based on rule type
        validateRuleConfig(input.ruleType, input.config);

        const rule = await prisma.pricingRule.create({
          data: {
            name: input.name,
            description: input.description,
            ruleType: input.ruleType as any,
            priority: input.priority,
            enabled: input.enabled,
            status: 'ACTIVE',
            vehicleTypes: input.vehicleTypes as any,
            customerTypes: input.customerTypes as any,
            minOrderValue: input.minOrderValue,
            maxOrderValue: input.maxOrderValue,
            effectiveFrom: input.effectiveFrom,
            effectiveTo: input.effectiveTo,
            config: input.config,
            createdBy: ctx.userId || 'system',
            lastModifiedBy: ctx.userId || 'system',
          },
        });

        // Create audit log
        await prisma.ruleAuditLog.create({
          data: {
            pricingRuleId: rule.id,
            action: 'CREATED',
            changedBy: ctx.userId || 'system',
            changeData: { rule },
          },
        });

        logRuleChange({
          correlationId: ctx.correlationId,
          action: 'CREATED',
          ruleId: rule.id,
          changedBy: ctx.userId || 'system',
        });

        // Invalidate pricing cache
        await deleteCachedByPattern('pricing:*', ctx.correlationId);

        // Publish event
        eventPublisher
          .publishPricingRulesChanged({
            ruleIds: [rule.id],
            changedBy: ctx.userId || 'system',
            changeType: 'created',
            effectiveAt: input.effectiveFrom,
            correlationId: ctx.correlationId,
          })
          .catch(err => logger.error('Failed to publish rule change event', { error: err }));

        return {
          id: rule.id,
          success: true,
        };
      } catch (error) {
        logger.error('Failed to create pricing rule', {
          correlationId: ctx.correlationId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create pricing rule',
          cause: error,
        });
      }
    }),

  /**
   * Update existing pricing rule
   */
  updateRule: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        priority: z.number().int().optional(),
        enabled: z.boolean().optional(),
        effectiveTo: z.date().optional(),
        config: z.any().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, ...updates } = input;

        // Get current rule
        const currentRule = await prisma.pricingRule.findUnique({
          where: { id },
        });

        if (!currentRule) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Pricing rule not found',
          });
        }

        // Validate config if provided
        if (updates.config) {
          validateRuleConfig(currentRule.ruleType, updates.config);
        }

        // Create new version
        const updatedRule = await prisma.pricingRule.update({
          where: { id },
          data: {
            ...updates,
            version: { increment: 1 },
            lastModifiedBy: ctx.userId || 'system',
          },
        });

        // Create audit log
        await prisma.ruleAuditLog.create({
          data: {
            pricingRuleId: id,
            action: 'UPDATED',
            changedBy: ctx.userId || 'system',
            changeData: {
              before: currentRule,
              after: updatedRule,
              changes: updates,
            },
          },
        });

        logRuleChange({
          correlationId: ctx.correlationId,
          action: 'UPDATED',
          ruleId: id,
          changedBy: ctx.userId || 'system',
        });

        // Invalidate pricing cache
        await deleteCachedByPattern('pricing:*', ctx.correlationId);

        // Publish event
        eventPublisher
          .publishPricingRulesChanged({
            ruleIds: [id],
            changedBy: ctx.userId || 'system',
            changeType: 'updated',
            effectiveAt: new Date(),
            correlationId: ctx.correlationId,
          })
          .catch(err => logger.error('Failed to publish rule change event', { error: err }));

        return {
          id: updatedRule.id,
          version: updatedRule.version,
          success: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        logger.error('Failed to update pricing rule', {
          correlationId: ctx.correlationId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update pricing rule',
          cause: error,
        });
      }
    }),

  /**
   * Delete pricing rule
   */
  deleteRule: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const rule = await prisma.pricingRule.findUnique({
          where: { id: input.id },
        });

        if (!rule) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Pricing rule not found',
          });
        }

        // Soft delete by archiving
        await prisma.pricingRule.update({
          where: { id: input.id },
          data: {
            status: 'ARCHIVED',
            enabled: false,
            lastModifiedBy: ctx.userId || 'system',
          },
        });

        // Create audit log
        await prisma.ruleAuditLog.create({
          data: {
            pricingRuleId: input.id,
            action: 'DELETED',
            changedBy: ctx.userId || 'system',
            changeData: { rule },
          },
        });

        logRuleChange({
          correlationId: ctx.correlationId,
          action: 'DELETED',
          ruleId: input.id,
          changedBy: ctx.userId || 'system',
        });

        // Invalidate pricing cache
        await deleteCachedByPattern('pricing:*', ctx.correlationId);

        // Publish event
        eventPublisher
          .publishPricingRulesChanged({
            ruleIds: [input.id],
            changedBy: ctx.userId || 'system',
            changeType: 'deleted',
            effectiveAt: new Date(),
            correlationId: ctx.correlationId,
          })
          .catch(err => logger.error('Failed to publish rule change event', { error: err }));

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        logger.error('Failed to delete pricing rule', {
          correlationId: ctx.correlationId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete pricing rule',
          cause: error,
        });
      }
    }),

  /**
   * List all pricing rules
   */
  listRules: adminProcedure
    .input(
      z
        .object({
          ruleType: RuleTypeSchema.optional(),
          enabled: z.boolean().optional(),
          vehicleType: VehicleTypeSchema.optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      try {
        const rules = await prisma.pricingRule.findMany({
          where: {
            ...(input?.ruleType && { ruleType: input.ruleType as any }),
            ...(input?.enabled !== undefined && { enabled: input.enabled }),
            ...(input?.vehicleType && { vehicleTypes: { has: input.vehicleType as any } }),
            status: { not: 'ARCHIVED' },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          take: input?.limit || 50,
          skip: input?.offset || 0,
        });

        const total = await prisma.pricingRule.count({
          where: {
            ...(input?.ruleType && { ruleType: input.ruleType as any }),
            ...(input?.enabled !== undefined && { enabled: input.enabled }),
            status: { not: 'ARCHIVED' },
          },
        });

        return {
          rules,
          total,
          limit: input?.limit || 50,
          offset: input?.offset || 0,
        };
      } catch (error) {
        logger.error('Failed to list pricing rules', {
          correlationId: ctx.correlationId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list pricing rules',
          cause: error,
        });
      }
    }),

  /**
   * Get rule by ID
   */
  getRule: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const rule = await prisma.pricingRule.findUnique({
          where: { id: input.id },
          include: {
            timeWindows: true,
            geoZones: true,
            auditLogs: {
              orderBy: { timestamp: 'desc' },
              take: 10,
            },
          },
        });

        if (!rule) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Pricing rule not found',
          });
        }

        return rule;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        logger.error('Failed to get pricing rule', {
          correlationId: ctx.correlationId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get pricing rule',
          cause: error,
        });
      }
    }),

  /**
   * Toggle rule enabled status
   */
  toggleRule: adminProcedure
    .input(
      z.object({
        id: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await prisma.pricingRule.update({
          where: { id: input.id },
          data: {
            enabled: input.enabled,
            lastModifiedBy: ctx.userId || 'system',
          },
        });

        // Create audit log
        await prisma.ruleAuditLog.create({
          data: {
            pricingRuleId: input.id,
            action: input.enabled ? 'ACTIVATED' : 'DEACTIVATED',
            changedBy: ctx.userId || 'system',
            changeData: { enabled: input.enabled },
          },
        });

        logRuleChange({
          correlationId: ctx.correlationId,
          action: input.enabled ? 'ACTIVATED' : 'DEACTIVATED',
          ruleId: input.id,
          changedBy: ctx.userId || 'system',
        });

        // Invalidate cache
        await deleteCachedByPattern('pricing:*', ctx.correlationId);

        // Publish event
        eventPublisher
          .publishPricingRulesChanged({
            ruleIds: [input.id],
            changedBy: ctx.userId || 'system',
            changeType: input.enabled ? 'activated' : 'deactivated',
            effectiveAt: new Date(),
            correlationId: ctx.correlationId,
          })
          .catch(err => logger.error('Failed to publish rule change event', { error: err }));

        return { success: true };
      } catch (error) {
        logger.error('Failed to toggle pricing rule', {
          correlationId: ctx.correlationId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to toggle pricing rule',
          cause: error,
        });
      }
    }),
});

/**
 * Validate rule configuration based on rule type
 */
function validateRuleConfig(ruleType: string, config: any): void {
  // Add validation logic for each rule type
  switch (ruleType) {
    case 'BASE_FARE':
      if (typeof config.amountCents !== 'number' || config.amountCents < 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'BASE_FARE config must have amountCents >= 0',
        });
      }
      break;

    case 'PER_KM':
      if (typeof config.ratePerKm !== 'number' || config.ratePerKm < 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'PER_KM config must have ratePerKm >= 0',
        });
      }
      break;

    case 'PEAK_MULTIPLIER':
    case 'GEO_MULTIPLIER':
      if (typeof config.multiplier !== 'number' || config.multiplier < 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Multiplier config must have multiplier >= 1',
        });
      }
      break;

    // Add more validations as needed
  }
}
