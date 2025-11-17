import { router, protectedProcedure } from '../trpc';
import {
  CreateVehicleTypeInputSchema,
  UpdateVehicleTypeInputSchema,
  DeleteVehicleTypeInputSchema,
  VehicleTypeSchema,
} from '../types/schemas';
import { requirePermission, Permission } from '../middleware/rbac';
import { prisma } from '../lib/prisma';
import { auditService } from '../services/auditService';
import { eventBus } from '../lib/eventBus';
import { AdminEventType } from '../types/events';
import { NotFoundError, ConflictError, OptimisticLockError } from '../lib/errors';
import { z } from 'zod';

export const vehicleTypesRouter = router({
  /**
   * List all vehicle types
   */
  list: protectedProcedure
    .output(z.array(VehicleTypeSchema))
    .query(async () => {
      const vehicleTypes = await prisma.vehicleType.findMany({
        orderBy: { name: 'asc' },
      });

      return vehicleTypes;
    }),

  /**
   * Create a new vehicle type
   */
  create: protectedProcedure
    .input(CreateVehicleTypeInputSchema)
    .output(VehicleTypeSchema)
    .mutation(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.CREATE_VEHICLE_TYPE);

      const { name, description, maxLoadKg, pricingMultiplier } = input;

      // Check if vehicle type already exists
      const existing = await prisma.vehicleType.findUnique({
        where: { name },
      });

      if (existing) {
        throw new ConflictError(`Vehicle type '${name}' already exists`);
      }

      // Create vehicle type
      const vehicleType = await prisma.vehicleType.create({
        data: {
          name,
          description,
          maxLoadKg,
          pricingMultiplier,
          status: 'ACTIVE',
        },
      });

      // Create audit log
      await auditService.createAuditLog({
        actorId: ctx.admin.userId,
        targetEntityType: 'VehicleType',
        targetEntityId: vehicleType.id,
        action: 'CREATE',
        newValue: vehicleType,
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      // Publish event
      await eventBus.publish({
        type: AdminEventType.VEHICLE_TYPE_CREATED,
        timestamp: new Date(),
        correlationId: ctx.correlationId,
        actorId: ctx.admin.userId,
        vehicleTypeId: vehicleType.id,
        name: vehicleType.name,
        maxLoadKg: vehicleType.maxLoadKg,
        pricingMultiplier: vehicleType.pricingMultiplier,
      });

      return vehicleType;
    }),

  /**
   * Update vehicle type
   */
  update: protectedProcedure
    .input(UpdateVehicleTypeInputSchema)
    .output(VehicleTypeSchema)
    .mutation(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.UPDATE_VEHICLE_TYPE);

      const { vehicleTypeId, version, ...updates } = input;

      // Get current vehicle type
      const current = await prisma.vehicleType.findUnique({
        where: { id: vehicleTypeId },
      });

      if (!current) {
        throw new NotFoundError('Vehicle Type', vehicleTypeId);
      }

      // Optimistic locking check
      if (current.version !== version) {
        throw new OptimisticLockError('Vehicle Type');
      }

      // Update vehicle type
      const updated = await prisma.vehicleType.update({
        where: { id: vehicleTypeId },
        data: {
          ...updates,
          version: { increment: 1 },
        },
      });

      // Create audit log
      await auditService.createAuditLog({
        actorId: ctx.admin.userId,
        targetEntityType: 'VehicleType',
        targetEntityId: vehicleTypeId,
        action: 'UPDATE',
        oldValue: current,
        newValue: updated,
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      // Publish event
      await eventBus.publish({
        type: AdminEventType.VEHICLE_TYPE_UPDATED,
        timestamp: new Date(),
        correlationId: ctx.correlationId,
        actorId: ctx.admin.userId,
        vehicleTypeId: updated.id,
        name: updated.name,
        changes: updates,
      });

      return updated;
    }),

  /**
   * Delete vehicle type
   */
  delete: protectedProcedure
    .input(DeleteVehicleTypeInputSchema)
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.DELETE_VEHICLE_TYPE);

      const { vehicleTypeId } = input;

      // Get vehicle type
      const vehicleType = await prisma.vehicleType.findUnique({
        where: { id: vehicleTypeId },
      });

      if (!vehicleType) {
        throw new NotFoundError('Vehicle Type', vehicleTypeId);
      }

      // Soft delete by setting status to DEPRECATED
      await prisma.vehicleType.update({
        where: { id: vehicleTypeId },
        data: { status: 'DEPRECATED' },
      });

      // Create audit log
      await auditService.createAuditLog({
        actorId: ctx.admin.userId,
        targetEntityType: 'VehicleType',
        targetEntityId: vehicleTypeId,
        action: 'DELETE',
        oldValue: vehicleType,
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      // Publish event
      await eventBus.publish({
        type: AdminEventType.VEHICLE_TYPE_DELETED,
        timestamp: new Date(),
        correlationId: ctx.correlationId,
        actorId: ctx.admin.userId,
        vehicleTypeId,
        name: vehicleType.name,
      });

      return {
        success: true,
        message: `Vehicle type '${vehicleType.name}' deleted successfully`,
      };
    }),
});
