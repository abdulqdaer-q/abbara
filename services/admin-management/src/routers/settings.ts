import { router, protectedProcedure } from '../trpc';
import { UpdatePlatformSettingInputSchema, PlatformSettingSchema } from '../types/schemas';
import { requirePermission, Permission } from '../middleware/rbac';
import { prisma } from '../lib/prisma';
import { auditService } from '../services/auditService';
import { eventBus } from '../lib/eventBus';
import { AdminEventType } from '../types/events';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';

export const settingsRouter = router({
  /**
   * List all platform settings
   */
  list: protectedProcedure
    .output(z.array(PlatformSettingSchema))
    .query(async () => {
      const settings = await prisma.platformSetting.findMany({
        orderBy: { key: 'asc' },
      });

      return settings;
    }),

  /**
   * Get a specific platform setting
   */
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .output(PlatformSettingSchema)
    .query(async ({ input }) => {
      const setting = await prisma.platformSetting.findUnique({
        where: { key: input.key },
      });

      if (!setting) {
        throw new NotFoundError('Platform Setting', input.key);
      }

      return setting;
    }),

  /**
   * Update platform setting
   */
  update: protectedProcedure
    .input(UpdatePlatformSettingInputSchema)
    .output(PlatformSettingSchema)
    .mutation(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.UPDATE_PLATFORM_SETTINGS);

      const { settingKey, value, description } = input;

      // Get current setting
      const current = await prisma.platformSetting.findUnique({
        where: { key: settingKey },
      });

      if (!current) {
        // Create new setting if it doesn't exist
        const newSetting = await prisma.platformSetting.create({
          data: {
            key: settingKey,
            value,
            description: description || null,
            updatedBy: ctx.admin.userId,
          },
        });

        // Create audit log
        await auditService.createAuditLog({
          actorId: ctx.admin.userId,
          targetEntityType: 'PlatformSetting',
          targetEntityId: newSetting.id,
          action: 'CREATE',
          newValue: newSetting,
          correlationId: ctx.correlationId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });

        // Publish event
        await eventBus.publish({
          type: AdminEventType.PLATFORM_SETTING_UPDATED,
          timestamp: new Date(),
          correlationId: ctx.correlationId,
          actorId: ctx.admin.userId,
          settingKey,
          oldValue: '',
          newValue: value,
        });

        return newSetting;
      }

      const oldValue = current.value;

      // Update setting
      const updated = await prisma.platformSetting.update({
        where: { key: settingKey },
        data: {
          value,
          description: description || current.description,
          updatedBy: ctx.admin.userId,
          version: { increment: 1 },
        },
      });

      // Create audit log
      await auditService.createAuditLog({
        actorId: ctx.admin.userId,
        targetEntityType: 'PlatformSetting',
        targetEntityId: updated.id,
        action: 'UPDATE',
        oldValue: current,
        newValue: updated,
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      // Publish event
      await eventBus.publish({
        type: AdminEventType.PLATFORM_SETTING_UPDATED,
        timestamp: new Date(),
        correlationId: ctx.correlationId,
        actorId: ctx.admin.userId,
        settingKey,
        oldValue,
        newValue: value,
      });

      return updated;
    }),
});
