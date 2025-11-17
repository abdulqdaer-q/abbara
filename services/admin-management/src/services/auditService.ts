import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { config } from '../lib/config';

export interface AuditLogData {
  actorId: string;
  targetEntityType: string;
  targetEntityId: string;
  action: string;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Create an audit log entry
   */
  async createAuditLog(data: AuditLogData): Promise<void> {
    if (!config.features.auditLogs) {
      logger.debug('Audit logs disabled, skipping', { data });
      return;
    }

    try {
      await prisma.auditLog.create({
        data: {
          actorId: data.actorId,
          targetEntityType: data.targetEntityType,
          targetEntityId: data.targetEntityId,
          action: data.action,
          oldValue: data.oldValue || null,
          newValue: data.newValue || null,
          correlationId: data.correlationId,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
        },
      });

      logger.info('Audit log created', {
        actorId: data.actorId,
        targetEntityType: data.targetEntityType,
        targetEntityId: data.targetEntityId,
        action: data.action,
        correlationId: data.correlationId,
      });
    } catch (error) {
      // Log error but don't fail the operation
      logger.error('Failed to create audit log', {
        error,
        data,
      });
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getAuditLogs(params: {
    targetEntityType?: string;
    targetEntityId?: string;
    actorId?: string;
    action?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      targetEntityType,
      targetEntityId,
      actorId,
      action,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
    } = params;

    const where: any = {};

    if (targetEntityType) where.targetEntityType = targetEntityType;
    if (targetEntityId) where.targetEntityId = targetEntityId;
    if (actorId) where.actorId = actorId;
    if (action) where.action = action;

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = dateFrom;
      if (dateTo) where.timestamp.lte = dateTo;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    };
  }

  /**
   * Batch create audit logs (for bulk operations)
   */
  async createBulkAuditLogs(logs: AuditLogData[]): Promise<void> {
    if (!config.features.auditLogs || logs.length === 0) {
      return;
    }

    try {
      await prisma.auditLog.createMany({
        data: logs.map(log => ({
          actorId: log.actorId,
          targetEntityType: log.targetEntityType,
          targetEntityId: log.targetEntityId,
          action: log.action,
          oldValue: log.oldValue || null,
          newValue: log.newValue || null,
          correlationId: log.correlationId,
          ipAddress: log.ipAddress || null,
          userAgent: log.userAgent || null,
        })),
      });

      logger.info('Bulk audit logs created', { count: logs.length });
    } catch (error) {
      logger.error('Failed to create bulk audit logs', { error, count: logs.length });
    }
  }
}

// Singleton instance
export const auditService = new AuditService();
