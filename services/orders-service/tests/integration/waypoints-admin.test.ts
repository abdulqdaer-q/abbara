import { appRouter } from '../../src/routers';
import { prisma } from '../../src/lib/prisma';
import { getKafkaClient } from '../../src/lib/kafka';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    orderStop: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    orderEvidence: {
      create: jest.fn(),
    },
    orderEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      return callback({
        orderStop: {
          update: jest.fn(),
        },
        order: {
          update: jest.fn(),
        },
        orderEvidence: {
          create: jest.fn(),
        },
        orderEvent: {
          create: jest.fn(),
        },
      });
    }),
  },
}));

jest.mock('../../src/lib/kafka', () => ({
  getKafkaClient: jest.fn(() => ({
    publishEvent: jest.fn(),
  })),
}));

jest.mock('../../src/lib/logger');

describe('Waypoints Router Tests', () => {
  let mockContext: any;
  let caller: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      correlationId: 'test-correlation-id',
      auth: {
        userId: 'porter-1',
        role: 'porter',
      },
    };

    caller = appRouter.createCaller(mockContext);
  });

  describe('updateStatus', () => {
    it('should update waypoint status to ARRIVED', async () => {
      const mockWaypoint = {
        id: 'waypoint-1',
        orderId: 'order-1',
        sequence: 1,
        status: 'PENDING',
        arrivalTimestamp: null,
        departureTimestamp: null,
        order: {
          id: 'order-1',
          status: 'IN_PROGRESS',
        },
      };

      (prisma.orderStop.findUnique as jest.Mock).mockResolvedValue(mockWaypoint);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          orderStop: {
            update: jest.fn().mockResolvedValue({
              ...mockWaypoint,
              status: 'ARRIVED',
              arrivalTimestamp: new Date(),
            }),
          },
          orderEvent: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await caller.waypoints.updateStatus({
        waypointId: 'waypoint-1',
        porterId: 'porter-1',
        newStatus: 'ARRIVED',
      });

      expect(result).toHaveProperty('waypointId', 'waypoint-1');
      expect(result).toHaveProperty('orderId', 'order-1');
      expect(result).toHaveProperty('status', 'ARRIVED');
      expect(result).toHaveProperty('timestamp');
      expect(getKafkaClient().publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waypoint.status.changed',
          waypointId: 'waypoint-1',
          orderId: 'order-1',
          newStatus: 'ARRIVED',
        })
      );
    });

    it('should update waypoint status to COMPLETED', async () => {
      const mockWaypoint = {
        id: 'waypoint-1',
        orderId: 'order-1',
        sequence: 1,
        status: 'ARRIVED',
        arrivalTimestamp: new Date(),
        departureTimestamp: null,
        order: {
          id: 'order-1',
          status: 'IN_PROGRESS',
        },
      };

      (prisma.orderStop.findUnique as jest.Mock).mockResolvedValue(mockWaypoint);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          orderStop: {
            update: jest.fn().mockResolvedValue({
              ...mockWaypoint,
              status: 'COMPLETED',
              departureTimestamp: new Date(),
            }),
          },
          orderEvent: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await caller.waypoints.updateStatus({
        waypointId: 'waypoint-1',
        porterId: 'porter-1',
        newStatus: 'COMPLETED',
      });

      expect(result).toHaveProperty('status', 'COMPLETED');
    });

    it('should throw error for non-existent waypoint', async () => {
      (prisma.orderStop.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        caller.waypoints.updateStatus({
          waypointId: 'nonexistent',
          porterId: 'porter-1',
          newStatus: 'ARRIVED',
        })
      ).rejects.toThrow('Waypoint not found');
    });

    it('should record waypoint status change in order events', async () => {
      const mockWaypoint = {
        id: 'waypoint-1',
        orderId: 'order-1',
        sequence: 2,
        status: 'PENDING',
        order: {
          id: 'order-1',
          status: 'IN_PROGRESS',
        },
      };

      (prisma.orderStop.findUnique as jest.Mock).mockResolvedValue(mockWaypoint);

      const mockEventCreate = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          orderStop: {
            update: jest.fn(),
          },
          orderEvent: {
            create: mockEventCreate,
          },
        };
        return callback(tx);
      });

      await caller.waypoints.updateStatus({
        waypointId: 'waypoint-1',
        porterId: 'porter-1',
        newStatus: 'ARRIVED',
      });

      expect(mockEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-1',
          eventType: 'WAYPOINT_UPDATED',
          actorId: 'porter-1',
          actorType: 'porter',
          payload: expect.objectContaining({
            waypointId: 'waypoint-1',
            waypointSequence: 2,
            previousStatus: 'PENDING',
            newStatus: 'ARRIVED',
          }),
        }),
      });
    });
  });
});

describe('Evidence Router Tests', () => {
  let mockContext: any;
  let caller: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      correlationId: 'test-correlation-id',
      auth: {
        userId: 'porter-1',
        role: 'porter',
      },
    };

    caller = appRouter.createCaller(mockContext);
  });

  describe('create', () => {
    it('should create evidence for order', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'IN_PROGRESS',
      };

      const mockEvidence = {
        id: 'evidence-1',
        orderId: 'order-1',
        type: 'PHOTO',
        url: 'https://example.com/photo.jpg',
        checksum: 'abc123',
        uploadedBy: 'porter-1',
        uploadedAt: new Date(),
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          orderEvidence: {
            create: jest.fn().mockResolvedValue(mockEvidence),
          },
          orderEvent: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await caller.evidence.create({
        orderId: 'order-1',
        type: 'PHOTO',
        url: 'https://example.com/photo.jpg',
        checksum: 'abc123',
        mimeType: 'image/jpeg',
        sizeBytes: 1024000,
        uploadedBy: 'porter-1',
      });

      expect(result).toHaveProperty('evidenceId', 'evidence-1');
      expect(result).toHaveProperty('orderId', 'order-1');
      expect(result).toHaveProperty('type', 'PHOTO');
      expect(result).toHaveProperty('uploadedAt');
      expect(getKafkaClient().publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'evidence.uploaded',
          orderId: 'order-1',
          evidenceId: 'evidence-1',
          evidenceType: 'PHOTO',
        })
      );
    });

    it('should create evidence with description', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'IN_PROGRESS',
      };

      const mockEvidence = {
        id: 'evidence-2',
        orderId: 'order-1',
        type: 'SIGNATURE',
        url: 'https://example.com/signature.png',
        checksum: 'def456',
        description: 'Customer signature',
        uploadedBy: 'porter-1',
        uploadedAt: new Date(),
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          orderEvidence: {
            create: jest.fn().mockResolvedValue(mockEvidence),
          },
          orderEvent: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await caller.evidence.create({
        orderId: 'order-1',
        type: 'SIGNATURE',
        url: 'https://example.com/signature.png',
        checksum: 'def456',
        mimeType: 'image/png',
        sizeBytes: 512000,
        description: 'Customer signature',
        uploadedBy: 'porter-1',
      });

      expect(result).toHaveProperty('evidenceId', 'evidence-2');
      expect(result).toHaveProperty('type', 'SIGNATURE');
    });

    it('should throw error for non-existent order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        caller.evidence.create({
          orderId: 'nonexistent',
          type: 'PHOTO',
          url: 'https://example.com/photo.jpg',
          checksum: 'abc123',
          mimeType: 'image/jpeg',
          sizeBytes: 1024000,
          uploadedBy: 'porter-1',
        })
      ).rejects.toThrow('Order not found');
    });

    it('should record evidence upload in order events', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'IN_PROGRESS',
      };

      const mockEvidence = {
        id: 'evidence-1',
        orderId: 'order-1',
        type: 'PHOTO',
        uploadedAt: new Date(),
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const mockEventCreate = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          orderEvidence: {
            create: jest.fn().mockResolvedValue(mockEvidence),
          },
          orderEvent: {
            create: mockEventCreate,
          },
        };
        return callback(tx);
      });

      await caller.evidence.create({
        orderId: 'order-1',
        type: 'PHOTO',
        url: 'https://example.com/photo.jpg',
        checksum: 'abc123',
        mimeType: 'image/jpeg',
        sizeBytes: 1024000,
        uploadedBy: 'porter-1',
      });

      expect(mockEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-1',
          eventType: 'EVIDENCE_UPLOADED',
          actorId: 'porter-1',
          actorType: 'porter',
          payload: expect.objectContaining({
            evidenceId: 'evidence-1',
            type: 'PHOTO',
          }),
        }),
      });
    });
  });
});

describe('Admin Router Tests', () => {
  let mockContext: any;
  let caller: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      correlationId: 'test-correlation-id',
      auth: {
        userId: 'admin-1',
        role: 'admin',
      },
    };

    caller = appRouter.createCaller(mockContext);
  });

  describe('overrideOrder', () => {
    it('should force complete an order', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'IN_PROGRESS',
        version: 1,
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: 'COMPLETED',
        version: 2,
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          order: {
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          orderEvent: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await caller.admin.overrideOrder({
        orderId: 'order-1',
        action: 'force_complete',
        adminId: 'admin-1',
        reason: 'Customer confirmed delivery',
      });

      expect(result).toHaveProperty('orderId', 'order-1');
      expect(result).toHaveProperty('status', 'COMPLETED');
      expect(result.message).toContain('force_complete');
    });

    it('should force cancel an order', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'PENDING',
        version: 1,
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: 'CANCELLED',
        version: 2,
        cancelledAt: new Date(),
        cancelledBy: 'admin-1',
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          order: {
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          orderEvent: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await caller.admin.overrideOrder({
        orderId: 'order-1',
        action: 'force_cancel',
        adminId: 'admin-1',
        reason: 'Fraudulent order',
      });

      expect(result).toHaveProperty('status', 'CANCELLED');
    });

    it('should resolve dispute', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'COMPLETED',
        isDisputed: true,
        version: 3,
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        isDisputed: false,
        version: 4,
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          order: {
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          orderEvent: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await caller.admin.overrideOrder({
        orderId: 'order-1',
        action: 'resolve_dispute',
        adminId: 'admin-1',
        reason: 'Dispute resolved in favor of customer',
      });

      expect(result).toHaveProperty('orderId', 'order-1');
    });

    it('should throw error for non-existent order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        caller.admin.overrideOrder({
          orderId: 'nonexistent',
          action: 'force_complete',
          adminId: 'admin-1',
          reason: 'Test',
        })
      ).rejects.toThrow('Order not found');
    });
  });

  describe('getAuditTrail', () => {
    it('should get order audit trail', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          orderId: 'order-1',
          eventType: 'CREATED',
          payload: {},
          actorId: 'customer-1',
          actorType: 'customer',
          correlationId: 'corr-1',
          createdAt: new Date(),
        },
        {
          id: 'event-2',
          orderId: 'order-1',
          eventType: 'UPDATED',
          payload: {},
          actorId: 'porter-1',
          actorType: 'porter',
          correlationId: 'corr-2',
          createdAt: new Date(),
        },
      ];

      (prisma.orderEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);

      const result = await caller.admin.getAuditTrail({
        orderId: 'order-1',
      });

      expect(result).toHaveProperty('orderId', 'order-1');
      expect(result).toHaveProperty('events');
      expect(result.events).toHaveLength(2);
      expect(result.events[0]).toHaveProperty('eventType', 'CREATED');
      expect(result.events[1]).toHaveProperty('eventType', 'UPDATED');
    });

    it('should support custom limit', async () => {
      (prisma.orderEvent.findMany as jest.Mock).mockResolvedValue([]);

      await caller.admin.getAuditTrail({
        orderId: 'order-1',
        limit: 50,
      });

      expect(prisma.orderEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe('getStatistics', () => {
    it('should get order statistics', async () => {
      (prisma.order.count as jest.Mock).mockResolvedValue(100);
      (prisma.order.groupBy as jest.Mock).mockResolvedValue([
        { status: 'PENDING', _count: 10 },
        { status: 'IN_PROGRESS', _count: 30 },
        { status: 'COMPLETED', _count: 50 },
        { status: 'CANCELLED', _count: 10 },
      ]);

      const result = await caller.admin.getStatistics({});

      expect(result).toHaveProperty('total', 100);
      expect(result).toHaveProperty('byStatus');
      expect(result).toHaveProperty('completed');
      expect(result).toHaveProperty('cancelled');
      expect(result).toHaveProperty('completionRate');
      expect(result).toHaveProperty('cancellationRate');
      expect(result.completionRate).toBeGreaterThan(0);
    });

    it('should filter statistics by date range', async () => {
      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-12-31T23:59:59Z';

      (prisma.order.count as jest.Mock).mockResolvedValue(50);
      (prisma.order.groupBy as jest.Mock).mockResolvedValue([]);

      await caller.admin.getStatistics({
        startDate,
        endDate,
      });

      expect(prisma.order.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      });
    });

    it('should calculate completion rate correctly', async () => {
      (prisma.order.count as jest.Mock)
        .mockResolvedValueOnce(200) // total
        .mockResolvedValueOnce(20) // cancelled
        .mockResolvedValueOnce(150); // completed

      (prisma.order.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await caller.admin.getStatistics({});

      expect(result.completionRate).toBe(75);
      expect(result.cancellationRate).toBe(10);
    });

    it('should handle zero orders gracefully', async () => {
      (prisma.order.count as jest.Mock).mockResolvedValue(0);
      (prisma.order.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await caller.admin.getStatistics({});

      expect(result.total).toBe(0);
      expect(result.completionRate).toBe(0);
      expect(result.cancellationRate).toBe(0);
    });
  });
});
