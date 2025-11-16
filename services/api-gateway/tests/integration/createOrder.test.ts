import { appRouter } from '../../src/routers';
import { Context } from '../../src/context';
import { Logger } from 'winston';

/**
 * Integration test for create order flow
 * Simulates the full order creation process with mocked downstream services
 */
describe('Create Order Integration Test', () => {
  it('should successfully create an order with full orchestration', async () => {
    // Mock logger
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    // Track the sequence of service calls
    const callSequence: string[] = [];

    // Mock pricing service
    const mockPricingService = {
      estimate: {
        query: jest.fn().mockImplementation(async (input) => {
          callSequence.push('pricing.estimate');

          // Simulate pricing calculation based on distance
          const distanceMeters = 5000;
          const baseFare = 2000;
          const distanceFare = Math.floor(distanceMeters * 0.5); // 50 cents per km
          const porterFee = input.porterCount * 250; // 250 cents per porter

          return {
            totalCents: baseFare + distanceFare + porterFee,
            breakdown: {
              baseFare,
              distanceFare,
              porterFee,
            },
            estimatedDuration: 1800, // 30 minutes
            distanceMeters,
          };
        }),
      },
    };

    // Mock orders service
    const mockOrdersService = {
      createOrder: {
        mutate: jest.fn().mockImplementation(async (input) => {
          callSequence.push('orders.createOrder');

          // Validate that pricing was called first
          expect(callSequence[0]).toBe('pricing.estimate');

          // Validate input has price
          expect(input.priceCents).toBe(4750); // 2000 + 2500 + 500 (2 porters)

          return {
            orderId: 'order-789',
          };
        }),
      },
      getOrder: {
        query: jest.fn(),
      },
      listOrders: {
        query: jest.fn(),
      },
      cancelOrder: {
        mutate: jest.fn(),
      },
    };

    // Create test context
    const ctx: Context = {
      user: {
        id: 'user-456',
        email: 'integration@test.com',
        role: 'client',
      },
      correlationId: 'integration-test-correlation-id',
      logger: mockLogger,
      services: {
        auth: {} as any,
        orders: mockOrdersService as any,
        pricing: mockPricingService as any,
        porters: {} as any,
        payments: {} as any,
        notifications: {} as any,
      },
    };

    // Create caller
    const caller = appRouter.createCaller(ctx);

    // Execute order creation
    const orderInput = {
      pickup: {
        address: '789 Test St, New York, NY',
        lat: 40.7128,
        lng: -74.006,
      },
      dropoff: {
        address: '321 Demo Ave, Brooklyn, NY',
        lat: 40.6782,
        lng: -73.9442,
      },
      vehicleType: 'van' as const,
      porterCount: 2,
      notes: 'Please handle with care',
      idempotencyKey: 'test-idempotency-123',
    };

    const result = await caller.orders.create(orderInput);

    // Assertions
    expect(result).toEqual({
      orderId: 'order-789',
      priceCents: 4750,
      estimatedDuration: 1800,
    });

    // Verify call sequence
    expect(callSequence).toEqual(['pricing.estimate', 'orders.createOrder']);

    // Verify pricing service was called with correct params
    expect(mockPricingService.estimate.query).toHaveBeenCalledWith({
      pickup: { lat: 40.7128, lng: -74.006 },
      dropoff: { lat: 40.6782, lng: -73.9442 },
      vehicleType: 'van',
      porterCount: 2,
    });

    // Verify orders service was called with complete data
    expect(mockOrdersService.createOrder.mutate).toHaveBeenCalledWith({
      userId: 'user-456',
      pickup: orderInput.pickup,
      dropoff: orderInput.dropoff,
      vehicleType: 'van',
      porterCount: 2,
      scheduledAt: undefined,
      notes: 'Please handle with care',
      priceCents: 4750,
    });

    // Verify logging
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Creating order',
      expect.objectContaining({
        userId: 'user-456',
        idempotencyKey: 'test-idempotency-123',
      })
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Order created successfully',
      expect.objectContaining({
        orderId: 'order-789',
      })
    );
  });

  it('should handle pricing service failure gracefully', async () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    // Mock pricing service that fails
    const mockPricingService = {
      estimate: {
        query: jest.fn().mockRejectedValue(new Error('Pricing service unavailable')),
      },
    };

    const ctx: Context = {
      user: {
        id: 'user-456',
        email: 'integration@test.com',
        role: 'client',
      },
      correlationId: 'integration-test-correlation-id',
      logger: mockLogger,
      services: {
        auth: {} as any,
        orders: {
          createOrder: { mutate: jest.fn() },
          getOrder: { query: jest.fn() },
          listOrders: { query: jest.fn() },
          cancelOrder: { mutate: jest.fn() },
        } as any,
        pricing: mockPricingService as any,
        porters: {} as any,
        payments: {} as any,
        notifications: {} as any,
      },
    };

    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.orders.create({
        pickup: { address: '123 Main St', lat: 40.7128, lng: -74.006 },
        dropoff: { address: '456 Oak Ave', lat: 40.7589, lng: -73.9851 },
        vehicleType: 'sedan',
        porterCount: 1,
      })
    ).rejects.toThrow();

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Order creation failed',
      expect.objectContaining({
        userId: 'user-456',
      })
    );
  });
});
