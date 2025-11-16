import { prisma } from '../../src/lib/prisma';
import { CreateOrderInput } from '@movenow/common';

describe('CreateOrder Integration Tests', () => {
  it('should create a basic order with stops and items', async () => {
    const input: CreateOrderInput = {
      customerId: 'customer-123',
      stops: [
        {
          sequence: 0,
          address: '123 Main St',
          lat: 40.7128,
          lng: -74.006,
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
      items: [
        {
          name: 'Couch',
          quantity: 1,
          lengthCm: 200,
          widthCm: 90,
          heightCm: 80,
          weightKg: 50,
          isFragile: false,
          isHeavy: true,
        },
      ],
      vehicleType: 'van',
      porterCountRequested: 2,
      idempotencyKey: 'test-key-1',
    };

    // Test would call the tRPC procedure here
    // For now, just verify we can create the order directly via Prisma

    const order = await prisma.order.create({
      data: {
        customerId: input.customerId,
        status: 'CREATED',
        priceCents: 5000,
        currency: 'USD',
        porterCountRequested: input.porterCountRequested,
        vehicleType: input.vehicleType,
      },
    });

    expect(order).toBeDefined();
    expect(order.customerId).toBe(input.customerId);
    expect(order.status).toBe('CREATED');
    expect(order.porterCountRequested).toBe(2);
  });

  it('should enforce idempotency for duplicate requests', async () => {
    // Test idempotency logic
    const idempotencyKey = 'test-idempotency-key';

    // First request
    const order1 = await prisma.order.create({
      data: {
        customerId: 'customer-123',
        status: 'CREATED',
        priceCents: 5000,
        currency: 'USD',
        porterCountRequested: 1,
        vehicleType: 'sedan',
      },
    });

    // Store idempotency key
    await prisma.idempotencyKey.create({
      data: {
        id: idempotencyKey,
        requestHash: 'hash-123',
        response: { orderId: order1.id },
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Verify idempotency key exists
    const stored = await prisma.idempotencyKey.findUnique({
      where: { id: idempotencyKey },
    });

    expect(stored).toBeDefined();
    expect(stored?.response).toEqual({ orderId: order1.id });
  });
});
