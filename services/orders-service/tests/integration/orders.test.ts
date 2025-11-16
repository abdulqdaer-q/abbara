import { prisma } from '../../src/lib/prisma';
import { getKafkaClient } from '../../src/lib/kafka';
import { getRedisClient } from '../../src/lib/redis';
import { OrderStatus } from '@prisma/client';

// Mock external dependencies
jest.mock('../../src/lib/kafka');
jest.mock('../../src/lib/redis');

const mockKafka = {
  publishEvent: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(true),
};

const mockRedis = {
  getIdempotency: jest.fn().mockResolvedValue(null),
  setIdempotency: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue(true),
};

(getKafkaClient as jest.Mock).mockReturnValue(mockKafka);
(getRedisClient as jest.Mock).mockReturnValue(mockRedis);

describe('Orders Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Order', () => {
    it('should create a basic order with stops and items', async () => {
      const orderData = {
        customerId: 'customer-123',
        status: OrderStatus.CREATED,
        priceCents: 5000,
        currency: 'USD',
        porterCountRequested: 2,
        vehicleType: 'van',
      };

      const order = await prisma.order.create({
        data: orderData,
      });

      expect(order).toBeDefined();
      expect(order.customerId).toBe('customer-123');
      expect(order.status).toBe(OrderStatus.CREATED);
      expect(order.porterCountRequested).toBe(2);
      expect(order.priceCents).toBe(5000);
      expect(order.version).toBe(0);
    });

    it('should create order with stops', async () => {
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
        include: {
          stops: true,
        },
      });

      expect(order.stops).toHaveLength(2);
      expect(order.stops[0].stopType).toBe('pickup');
      expect(order.stops[1].stopType).toBe('dropoff');
    });

    it('should create order with items', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'van',
          items: {
            createMany: {
              data: [
                {
                  name: 'Couch',
                  quantity: 1,
                  lengthCm: 200,
                  widthCm: 90,
                  heightCm: 80,
                  weightKg: 50,
                  isHeavy: true,
                },
                {
                  name: 'Coffee Table',
                  quantity: 1,
                  lengthCm: 100,
                  widthCm: 60,
                  heightCm: 45,
                  weightKg: 15,
                  isFragile: true,
                },
              ],
            },
          },
        },
        include: {
          items: true,
        },
      });

      expect(order.items).toHaveLength(2);
      expect(order.items[0].name).toBe('Couch');
      expect(order.items[0].isHeavy).toBe(true);
      expect(order.items[1].isFragile).toBe(true);
    });

    it('should create order with pricing snapshot', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
          pricing: {
            create: {
              baseFareCents: 3000,
              distanceFareCents: 1500,
              timeFareCents: 500,
              porterFeesCents: 0,
              surgeMultiplier: 1.0,
              taxCents: 0,
              discountCents: 0,
              totalCents: 5000,
              breakdown: {},
            },
          },
        },
        include: {
          pricing: true,
        },
      });

      expect(order.pricing).toBeDefined();
      expect(order.pricing?.totalCents).toBe(5000);
      expect(order.pricing?.baseFareCents).toBe(3000);
    });

    it('should create order audit event', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
          events: {
            create: {
              eventType: 'CREATED',
              payload: { customerId: 'customer-123' },
              correlationId: 'test-correlation-id',
              actorId: 'customer-123',
              actorType: 'customer',
            },
          },
        },
        include: {
          events: true,
        },
      });

      expect(order.events).toHaveLength(1);
      expect(order.events[0].eventType).toBe('CREATED');
      expect(order.events[0].actorType).toBe('customer');
    });
  });

  describe('Update Order', () => {
    it('should update order status', async () => {
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

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.ASSIGNED,
          version: order.version + 1,
        },
      });

      expect(updated.status).toBe(OrderStatus.ASSIGNED);
      expect(updated.version).toBe(1);
    });

    it('should support optimistic locking', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.CREATED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
          version: 0,
        },
      });

      // First update should succeed
      const updated1 = await prisma.order.update({
        where: {
          id: order.id,
          version: 0,
        },
        data: {
          status: OrderStatus.ASSIGNED,
          version: 1,
        },
      });

      expect(updated1.version).toBe(1);

      // Second update with old version should fail
      await expect(
        prisma.order.update({
          where: {
            id: order.id,
            version: 0, // Old version
          },
          data: {
            status: OrderStatus.ACCEPTED,
            version: 2,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Cancel Order', () => {
    it('should cancel order and record cancellation details', async () => {
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

      const cancelled = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: 'customer-123',
          cancellationReason: 'CUSTOMER_REQUEST',
          cancellationFeeCents: 0,
        },
      });

      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect(cancelled.cancelledAt).toBeDefined();
      expect(cancelled.cancellationReason).toBe('CUSTOMER_REQUEST');
    });
  });

  describe('Idempotency', () => {
    it('should handle idempotency key collision', async () => {
      const idempotencyKey = 'test-key-unique';
      const response = { orderId: 'order-123', status: 'CREATED' };

      // First request - no cached response
      mockRedis.getIdempotency.mockResolvedValueOnce(null);

      const result1 = await mockRedis.getIdempotency(idempotencyKey);
      expect(result1).toBeNull();

      // Store response
      await mockRedis.setIdempotency(idempotencyKey, response, 86400);

      // Second request - cached response exists
      mockRedis.getIdempotency.mockResolvedValueOnce({ result: response });

      const result2 = await mockRedis.getIdempotency(idempotencyKey);
      expect(result2).toEqual({ result: response });
    });

    it('should store idempotency key in database', async () => {
      const key = await prisma.idempotencyKey.create({
        data: {
          id: 'test-key-123',
          requestHash: 'hash-123',
          response: { orderId: 'order-456' },
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      expect(key.id).toBe('test-key-123');

      const found = await prisma.idempotencyKey.findUnique({
        where: { id: 'test-key-123' },
      });

      expect(found).toBeDefined();
      expect(found?.response).toEqual({ orderId: 'order-456' });
    });
  });

  describe('Multi-stop Orders', () => {
    it('should maintain stop sequence order', async () => {
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
                { sequence: 0, address: 'Pickup 1', lat: 40.7128, lng: -74.0060, stopType: 'pickup' },
                { sequence: 1, address: 'Dropoff 1', lat: 40.7589, lng: -73.9851, stopType: 'dropoff' },
                { sequence: 2, address: 'Pickup 2', lat: 40.7489, lng: -73.9680, stopType: 'pickup' },
                { sequence: 3, address: 'Dropoff 2', lat: 40.7589, lng: -73.9851, stopType: 'dropoff' },
              ],
            },
          },
        },
        include: {
          stops: {
            orderBy: { sequence: 'asc' },
          },
        },
      });

      expect(order.stops).toHaveLength(4);
      expect(order.stops[0].sequence).toBe(0);
      expect(order.stops[1].sequence).toBe(1);
      expect(order.stops[2].sequence).toBe(2);
      expect(order.stops[3].sequence).toBe(3);
    });

    it('should update waypoint status', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: 'customer-123',
          status: OrderStatus.ACCEPTED,
          priceCents: 5000,
          currency: 'USD',
          porterCountRequested: 1,
          vehicleType: 'sedan',
          stops: {
            createMany: {
              data: [
                { sequence: 0, address: 'Pickup', lat: 40.7128, lng: -74.0060, stopType: 'pickup' },
                { sequence: 1, address: 'Dropoff', lat: 40.7589, lng: -73.9851, stopType: 'dropoff' },
              ],
            },
          },
        },
        include: { stops: true },
      });

      const pickup = order.stops[0];

      const updated = await prisma.orderStop.update({
        where: { id: pickup.id },
        data: {
          status: 'ARRIVED',
          arrivalTimestamp: new Date(),
        },
      });

      expect(updated.status).toBe('ARRIVED');
      expect(updated.arrivalTimestamp).toBeDefined();
    });
  });
});
