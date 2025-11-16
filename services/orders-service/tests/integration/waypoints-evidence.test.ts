import { prisma } from '../../src/lib/prisma';
import { getKafkaClient } from '../../src/lib/kafka';
import { OrderStatus, WaypointStatus, EvidenceType } from '@prisma/client';

jest.mock('../../src/lib/kafka');

const mockKafka = {
  publishEvent: jest.fn().mockResolvedValue(undefined),
};

(getKafkaClient as jest.Mock).mockReturnValue(mockKafka);

describe('Waypoints and Evidence Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Waypoint Management', () => {
    it('should create order with multiple waypoints', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 8000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'van',
          stops: {
            createMany: {
              data: [
                {
                  sequence: 0,
                  address: '123 Main St',
                  lat: 40.7128,
                  lng: -74.0060,
                  stopType: 'pickup',
                  status: WaypointStatus.PENDING,
                },
                {
                  sequence: 1,
                  address: '456 Oak Ave',
                  lat: 40.7589,
                  lng: -73.9851,
                  stopType: 'dropoff',
                  status: WaypointStatus.PENDING,
                },
                {
                  sequence: 2,
                  address: '789 Pine Rd',
                  lat: 40.7489,
                  lng: -73.9680,
                  stopType: 'pickup',
                  status: WaypointStatus.PENDING,
                },
                {
                  sequence: 3,
                  address: '321 Elm St',
                  lat: 40.7280,
                  lng: -73.9950,
                  stopType: 'dropoff',
                  status: WaypointStatus.PENDING,
                },
              ],
            },
          },
        },
        include: {
          stops: { orderBy: { sequence: 'asc' } },
        },
      });

      expect(order.stops).toHaveLength(4);
      expect(order.stops[0].sequence).toBe(0);
      expect(order.stops[3].sequence).toBe(3);
    });

    it('should update waypoint status to ARRIVED', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.ACCEPTED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
          stops: {
            create: {
              sequence: 0,
              address: '123 Main St',
              lat: 40.7128,
              lng: -74.0060,
              stopType: 'pickup',
              status: WaypointStatus.PENDING,
            },
          },
        },
        include: { stops: true },
      });

      const waypoint = order.stops[0];
      const arrivalTime = new Date();

      const updated = await prisma.orderStop.update({
        where: { id: waypoint.id },
        data: {
          status: WaypointStatus.ARRIVED,
          arrivalTimestamp: arrivalTime,
        },
      });

      expect(updated.status).toBe(WaypointStatus.ARRIVED);
      expect(updated.arrivalTimestamp).toBeDefined();
      expect(updated.arrivalTimestamp?.getTime()).toBeCloseTo(arrivalTime.getTime(), -2);
    });

    it('should complete waypoint and record departure time', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.LOADED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
          stops: {
            create: {
              sequence: 0,
              address: '123 Main St',
              lat: 40.7128,
              lng: -74.0060,
              stopType: 'pickup',
              status: WaypointStatus.ARRIVED,
              arrivalTimestamp: new Date(),
            },
          },
        },
        include: { stops: true },
      });

      const waypoint = order.stops[0];
      const departureTime = new Date();

      const completed = await prisma.orderStop.update({
        where: { id: waypoint.id },
        data: {
          status: WaypointStatus.COMPLETED,
          departureTimestamp: departureTime,
        },
      });

      expect(completed.status).toBe(WaypointStatus.COMPLETED);
      expect(completed.departureTimestamp).toBeDefined();
    });

    it('should track waypoint contact information', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
          stops: {
            create: {
              sequence: 0,
              address: '123 Main St',
              lat: 40.7128,
              lng: -74.0060,
              stopType: 'pickup',
              contactName: 'John Doe',
              contactPhone: '+1234567890',
              instructions: 'Ring doorbell',
            },
          },
        },
        include: { stops: true },
      });

      const waypoint = order.stops[0];

      expect(waypoint.contactName).toBe('John Doe');
      expect(waypoint.contactPhone).toBe('+1234567890');
      expect(waypoint.instructions).toBe('Ring doorbell');
    });

    it('should handle skipped waypoint', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.ACCEPTED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
          stops: {
            create: {
              sequence: 1,
              address: '456 Oak Ave',
              lat: 40.7589,
              lng: -73.9851,
              stopType: 'dropoff',
              status: WaypointStatus.PENDING,
            },
          },
        },
        include: { stops: true },
      });

      const waypoint = order.stops[0];

      const skipped = await prisma.orderStop.update({
        where: { id: waypoint.id },
        data: {
          status: WaypointStatus.SKIPPED,
        },
      });

      expect(skipped.status).toBe(WaypointStatus.SKIPPED);
    });
  });

  describe('Evidence Management', () => {
    it('should upload pre-move evidence', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.ACCEPTED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      const evidence = await prisma.orderEvidence.create({
        data: {
          orderId: order.id,
          type: EvidenceType.PRE_MOVE,
          url: 'https://storage.example.com/pre-move/photo1.jpg',
          checksum: 'sha256-abc123',
          mimeType: 'image/jpeg',
          sizeBytes: 1024000,
          uploadedBy: 'porter-456',
          description: 'Furniture before loading',
        },
      });

      expect(evidence.type).toBe(EvidenceType.PRE_MOVE);
      expect(evidence.url).toContain('pre-move');
      expect(evidence.uploadedBy).toBe('porter-456');
    });

    it('should upload post-move evidence', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.DELIVERED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      const evidence = await prisma.orderEvidence.create({
        data: {
          orderId: order.id,
          type: EvidenceType.POST_MOVE,
          url: 'https://storage.example.com/post-move/photo1.jpg',
          checksum: 'sha256-def456',
          mimeType: 'image/jpeg',
          sizeBytes: 950000,
          uploadedBy: 'porter-456',
          description: 'Furniture after delivery',
        },
      });

      expect(evidence.type).toBe(EvidenceType.POST_MOVE);
      expect(evidence.uploadedBy).toBe('porter-456');
    });

    it('should upload damage evidence', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.DELIVERED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      const evidence = await prisma.orderEvidence.create({
        data: {
          orderId: order.id,
          type: EvidenceType.DAMAGE,
          url: 'https://storage.example.com/damage/photo1.jpg',
          checksum: 'sha256-ghi789',
          mimeType: 'image/jpeg',
          sizeBytes: 800000,
          uploadedBy: 'customer-123',
          description: 'Scratch on furniture',
        },
      });

      expect(evidence.type).toBe(EvidenceType.DAMAGE);
      expect(evidence.description).toBe('Scratch on furniture');
    });

    it('should upload signature evidence', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.DELIVERED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      const evidence = await prisma.orderEvidence.create({
        data: {
          orderId: order.id,
          type: EvidenceType.SIGNATURE,
          url: 'https://storage.example.com/signatures/sig1.png',
          checksum: 'sha256-jkl012',
          mimeType: 'image/png',
          sizeBytes: 50000,
          uploadedBy: 'porter-456',
          description: 'Customer signature',
        },
      });

      expect(evidence.type).toBe(EvidenceType.SIGNATURE);
    });

    it('should upload multiple evidence files for single order', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.DELIVERED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      const evidence1 = await prisma.orderEvidence.create({
        data: {
          orderId: order.id,
          type: EvidenceType.PRE_MOVE,
          url: 'https://storage.example.com/photo1.jpg',
          uploadedBy: 'porter-456',
        },
      });

      const evidence2 = await prisma.orderEvidence.create({
        data: {
          orderId: order.id,
          type: EvidenceType.POST_MOVE,
          url: 'https://storage.example.com/photo2.jpg',
          uploadedBy: 'porter-456',
        },
      });

      const evidence3 = await prisma.orderEvidence.create({
        data: {
          orderId: order.id,
          type: EvidenceType.SIGNATURE,
          url: 'https://storage.example.com/signature.png',
          uploadedBy: 'porter-456',
        },
      });

      const allEvidence = await prisma.orderEvidence.findMany({
        where: { orderId: order.id },
      });

      expect(allEvidence).toHaveLength(3);
      expect(allEvidence.map((e) => e.type)).toContain(EvidenceType.PRE_MOVE);
      expect(allEvidence.map((e) => e.type)).toContain(EvidenceType.POST_MOVE);
      expect(allEvidence.map((e) => e.type)).toContain(EvidenceType.SIGNATURE);
    });

    it('should store evidence metadata', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.ACCEPTED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
        },
      });

      const evidence = await prisma.orderEvidence.create({
        data: {
          orderId: order.id,
          type: EvidenceType.PRE_MOVE,
          url: 'https://storage.example.com/photo.jpg',
          uploadedBy: 'porter-456',
          metadata: {
            camera: 'iPhone 13',
            location: { lat: 40.7128, lng: -74.006 },
            timestamp: new Date().toISOString(),
          },
        },
      });

      expect(evidence.metadata).toBeDefined();
      expect(evidence.metadata).toHaveProperty('camera');
      expect(evidence.metadata).toHaveProperty('location');
    });
  });

  describe('Complete Order Flow with Waypoints and Evidence', () => {
    it('should track complete order lifecycle with waypoints and evidence', async () => {
      // Create order
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
          stops: {
            createMany: {
              data: [
                {
                  sequence: 0,
                  address: '123 Main St',
                  lat: 40.7128,
                  lng: -74.0060,
                  stopType: 'pickup',
                },
                {
                  sequence: 1,
                  address: '456 Oak Ave',
                  lat: 40.7589,
                  lng: -73.9851,
                  stopType: 'dropoff',
                },
              ],
            },
          },
        },
        include: { stops: true },
      });

      // Assign porter
      await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          porterId: 'porter-456',
          status: 'ACCEPTED',
          offeredAt: new Date(),
          acceptedAt: new Date(),
        },
      });

      // Update order to ACCEPTED
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.ACCEPTED },
      });

      // Porter arrives at pickup
      const pickupStop = order.stops[0];
      await prisma.orderStop.update({
        where: { id: pickupStop.id },
        data: {
          status: WaypointStatus.ARRIVED,
          arrivalTimestamp: new Date(),
        },
      });

      // Upload pre-move evidence
      await prisma.orderEvidence.create({
        data: {
          orderId: order.id,
          type: EvidenceType.PRE_MOVE,
          url: 'https://storage.example.com/pre-move.jpg',
          uploadedBy: 'porter-456',
        },
      });

      // Complete pickup
      await prisma.orderStop.update({
        where: { id: pickupStop.id },
        data: {
          status: WaypointStatus.COMPLETED,
          departureTimestamp: new Date(),
        },
      });

      // Arrive at dropoff
      const dropoffStop = order.stops[1];
      await prisma.orderStop.update({
        where: { id: dropoffStop.id },
        data: {
          status: WaypointStatus.ARRIVED,
          arrivalTimestamp: new Date(),
        },
      });

      // Upload post-move evidence
      await prisma.orderEvidence.create({
        data: {
          orderId: order.id,
          type: EvidenceType.POST_MOVE,
          url: 'https://storage.example.com/post-move.jpg',
          uploadedBy: 'porter-456',
        },
      });

      // Get signature
      await prisma.orderEvidence.create({
        data: {
          orderId: order.id,
          type: EvidenceType.SIGNATURE,
          url: 'https://storage.example.com/signature.png',
          uploadedBy: 'porter-456',
        },
      });

      // Complete delivery
      await prisma.orderStop.update({
        where: { id: dropoffStop.id },
        data: {
          status: WaypointStatus.COMPLETED,
          departureTimestamp: new Date(),
        },
      });

      // Complete order
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.COMPLETED },
      });

      // Verify final state
      const finalOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          stops: true,
          evidences: true,
          assignments: true,
        },
      });

      expect(finalOrder?.status).toBe(OrderStatus.COMPLETED);
      expect(finalOrder?.stops.every((s) => s.status === WaypointStatus.COMPLETED)).toBe(true);
      expect(finalOrder?.evidences).toHaveLength(3);
      expect(finalOrder?.assignments).toHaveLength(1);
    });
  });
});
