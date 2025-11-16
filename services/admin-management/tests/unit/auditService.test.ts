import { auditService } from '../../src/services/auditService';
import { prisma } from '../../src/lib/prisma';

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAuditLog', () => {
    it('should create an audit log entry', async () => {
      const mockData = {
        actorId: 'admin-123',
        targetEntityType: 'User',
        targetEntityId: 'user-456',
        action: 'UPDATE_STATUS',
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'SUSPENDED' },
        correlationId: 'corr-123',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      };

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'audit-1',
        ...mockData,
      });

      await auditService.createAuditLog(mockData);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: mockData.actorId,
          targetEntityType: mockData.targetEntityType,
          targetEntityId: mockData.targetEntityId,
          action: mockData.action,
        }),
      });
    });

    it('should handle errors gracefully without throwing', async () => {
      const mockData = {
        actorId: 'admin-123',
        targetEntityType: 'User',
        targetEntityId: 'user-456',
        action: 'UPDATE',
        correlationId: 'corr-123',
      };

      (prisma.auditLog.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(auditService.createAuditLog(mockData)).resolves.not.toThrow();
    });
  });

  describe('getAuditLogs', () => {
    it('should fetch audit logs with pagination', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          actorId: 'admin-123',
          targetEntityType: 'User',
          targetEntityId: 'user-456',
          action: 'UPDATE',
          timestamp: new Date(),
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const result = await auditService.getAuditLogs({
        targetEntityType: 'User',
        page: 1,
        limit: 20,
      });

      expect(result.logs).toEqual(mockLogs);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        itemsPerPage: 20,
      });
    });
  });
});
