import { prisma } from '../../src/lib/prisma';
import { getKafkaClient } from '../../src/lib/kafka';
import { OrderStatus, AssignmentStatus } from '@prisma/client';
import { addMinutes } from 'date-fns';

jest.mock('../../src/lib/kafka');

const mockKafka = {
  publishEvent: jest.fn().mockResolvedValue(undefined),
};

(getKafkaClient as jest.Mock).mockReturnValue(mockKafka);

describe('Assignment Workflows Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Direct Assignment', () => {
    it('should directly assign porter to order', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      const assignment = await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-456',
          status: AssignmentStatus.ACCEPTED,
          offeredAt: new Date(),
          acceptedAt: new Date(),
        },
      });

      expect(assignment.status).toBe(AssignmentStatus.ACCEPTED);
      expect(assignment.porterId).toBe('porter-456');
      expect(assignment.acceptedAt).toBeDefined();
    });

    it('should update order status to ACCEPTED after assignment', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-456',
          status: AssignmentStatus.ACCEPTED,
          offeredAt: new Date(),
          acceptedAt: new Date(),
        },
      });

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.ACCEPTED,
          porterCountAssigned: 1,
        },
      });

      expect(updated.status).toBe(OrderStatus.ACCEPTED);
      expect(updated.porterCountAssigned).toBe(1);
    });
  });

  describe('Offer-based Assignment', () => {
    it('should create offer for porter', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      const expiresAt = addMinutes(new Date(), 5);

      const offer = await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-789',
          status: AssignmentStatus.OFFERED,
          offeredAt: new Date(),
          expiresAt,
        },
      });

      expect(offer.status).toBe(AssignmentStatus.OFFERED);
      expect(offer.expiresAt).toBeDefined();
    });

    it('should accept offer and revoke others', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.TENTATIVELY_ASSIGNED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      // Create multiple offers
      await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-111',
          status: AssignmentStatus.OFFERED,
          offeredAt: new Date(),
          expiresAt: addMinutes(new Date(), 5),
        },
      });

      await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-222',
          status: AssignmentStatus.OFFERED,
          offeredAt: new Date(),
          expiresAt: addMinutes(new Date(), 5),
        },
      });

      // Porter 1 accepts
      await prisma.orderAssignment.update({
        where: {
          orderId_porterId: {
            orderId: order.id,
            porterId: 'porter-111',
          },
        },
        data: {
          status: AssignmentStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      // Revoke other offers
      await prisma.orderAssignment.updateMany({
        where: {
          orderId: order.id,
          porterId: { not: 'porter-111' },
          status: AssignmentStatus.OFFERED,
        },
        data: {
          status: AssignmentStatus.REVOKED,
          revokedAt: new Date(),
        },
      });

      const assignments = await prisma.orderAssignment.findMany({
        where: { orderId: order.id },
      });

      const acceptedAssignment = assignments.find((a) => a.porterId === 'porter-111');
      const revokedAssignment = assignments.find((a) => a.porterId === 'porter-222');

      expect(acceptedAssignment?.status).toBe(AssignmentStatus.ACCEPTED);
      expect(revokedAssignment?.status).toBe(AssignmentStatus.REVOKED);
    });

    it('should handle offer rejection', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.TENTATIVELY_ASSIGNED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-333',
          status: AssignmentStatus.OFFERED,
          offeredAt: new Date(),
          expiresAt: addMinutes(new Date(), 5),
        },
      });

      const rejected = await prisma.orderAssignment.update({
        where: {
          orderId_porterId: {
            orderId: order.id,
            porterId: 'porter-333',
          },
        },
        data: {
          status: AssignmentStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: 'Too far away',
        },
      });

      expect(rejected.status).toBe(AssignmentStatus.REJECTED);
      expect(rejected.rejectionReason).toBe('Too far away');
      expect(rejected.rejectedAt).toBeDefined();
    });

    it('should handle expired offers', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.TENTATIVELY_ASSIGNED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      // Create expired offer
      const pastTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const offer = await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-444',
          status: AssignmentStatus.OFFERED,
          offeredAt: new Date(),
          expiresAt: pastTime,
        },
      });

      // Check if offer is expired
      const now = new Date();
      const isExpired = offer.expiresAt && offer.expiresAt < now;

      expect(isExpired).toBe(true);
    });
  });

  describe('Multi-Porter Assignment', () => {
    it('should assign multiple porters to order', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 8000,
          currency: 'USD',
          porterCountRequested: 2,
          vehicleType: 'truck',
        },
      });

      await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-555',
          status: AssignmentStatus.ACCEPTED,
          offeredAt: new Date(),
          acceptedAt: new Date(),
        },
      });

      await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-666',
          status: AssignmentStatus.ACCEPTED,
          offeredAt: new Date(),
          acceptedAt: new Date(),
        },
      });

      const assignments = await prisma.orderAssignment.findMany({
        where: {
          orderId: order.id,
          status: AssignmentStatus.ACCEPTED,
        },
      });

      expect(assignments).toHaveLength(2);
    });
  });

  describe('Assignment Race Conditions', () => {
    it('should ensure unique porter per order', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      // First assignment should succeed
      const assignment1 = await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-777',
          status: AssignmentStatus.ACCEPTED,
          offeredAt: new Date(),
          acceptedAt: new Date(),
        },
      });

      expect(assignment1).toBeDefined();

      // Duplicate assignment for same porter should fail due to unique constraint
      await expect(
        prisma.orderAssignment.create({
          data: {
            orderId: order.id,
            porterId: 'porter-777',
            status: AssignmentStatus.OFFERED,
            offeredAt: new Date(),
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Assignment Earnings', () => {
    it('should store earnings breakdown for porter', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      const assignment = await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-888',
          status: AssignmentStatus.ACCEPTED,
          offeredAt: new Date(),
          acceptedAt: new Date(),
          earningsCents: 4000,
          earningsBreakdown: {
            baseFare: 3000,
            distanceFee: 800,
            timeFee: 200,
            tips: 0,
          },
        },
      });

      expect(assignment.earningsCents).toBe(4000);
      expect(assignment.earningsBreakdown).toMatchObject({
        baseFare: 3000,
        distanceFee: 800,
      });
    });
  });

  describe('Assignment with Device Tracking', () => {
    it('should store device and session info for porter', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      const assignment = await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-999',
          status: AssignmentStatus.ACCEPTED,
          offeredAt: new Date(),
          acceptedAt: new Date(),
          deviceId: 'device-abc123',
          sessionId: 'session-xyz789',
        },
      });

      expect(assignment.deviceId).toBe('device-abc123');
      expect(assignment.sessionId).toBe('session-xyz789');
    });
  });
});
