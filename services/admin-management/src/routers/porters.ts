import { router, protectedProcedure } from '../trpc';
import { VerifyPorterDocumentInputSchema } from '../types/schemas';
import { requirePermission, Permission } from '../middleware/rbac';
import { prisma } from '../lib/prisma';
import { auditService } from '../services/auditService';
import { eventBus } from '../lib/eventBus';
import { AdminEventType } from '../types/events';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';

export const portersRouter = router({
  /**
   * Verify or reject porter document
   */
  verifyDocument: protectedProcedure
    .input(VerifyPorterDocumentInputSchema)
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { porterId, documentId, verificationStatus, reviewNotes } = input;

      // Check permissions
      if (verificationStatus === 'APPROVED') {
        requirePermission(ctx.admin.role, Permission.VERIFY_PORTER);
      } else {
        requirePermission(ctx.admin.role, Permission.REJECT_PORTER);
      }

      // Get document
      const document = await prisma.porterDocument.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new NotFoundError('Porter Document', documentId);
      }

      if (document.porterId !== porterId) {
        throw new Error('Document does not belong to the specified porter');
      }

      // Update document status
      await prisma.porterDocument.update({
        where: { id: documentId },
        data: {
          status: verificationStatus,
          reviewedBy: ctx.admin.userId,
          reviewNotes,
          reviewedAt: new Date(),
        },
      });

      // Create audit log
      await auditService.createAuditLog({
        actorId: ctx.admin.userId,
        targetEntityType: 'PorterDocument',
        targetEntityId: documentId,
        action: 'VERIFY_DOCUMENT',
        oldValue: { status: document.status },
        newValue: { status: verificationStatus, reviewNotes },
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      // Publish appropriate event
      if (verificationStatus === 'APPROVED') {
        await eventBus.publish({
          type: AdminEventType.PORTER_VERIFIED,
          timestamp: new Date(),
          correlationId: ctx.correlationId,
          actorId: ctx.admin.userId,
          porterId,
          documentId,
          documentType: document.documentType,
          reviewNotes,
        });
      } else {
        await eventBus.publish({
          type: AdminEventType.PORTER_VERIFICATION_REJECTED,
          timestamp: new Date(),
          correlationId: ctx.correlationId,
          actorId: ctx.admin.userId,
          porterId,
          documentId,
          documentType: document.documentType,
          reviewNotes,
        });
      }

      return {
        success: true,
        message: `Porter document ${verificationStatus.toLowerCase()}`,
      };
    }),

  /**
   * Get pending porter documents for review
   */
  getPendingDocuments: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.VERIFY_PORTER);

      const { page, limit } = input;

      const [documents, total] = await Promise.all([
        prisma.porterDocument.findMany({
          where: { status: 'PENDING' },
          orderBy: { submittedAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.porterDocument.count({ where: { status: 'PENDING' } }),
      ]);

      return {
        documents,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    }),
});
