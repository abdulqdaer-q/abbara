import { appRouter } from '../../src/routers';
import { Context } from '../../src/context';
import { Logger } from 'winston';

/**
 * Unit tests for orders router
 * Tests orchestration logic and downstream service calls
 */
describe('Orders Router', () => {
  // Mock context
  const createMockContext = (overrides?: Partial<Context>): Context => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    return {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'client',
      },
      correlationId: 'test-correlation-id',
      logger: mockLogger,
      services: {
        auth: {} as any,
        orders: {
          createOrder: {
            mutate: jest.fn().mockResolvedValue({ orderId: '550e8400-e29b-41d4-a716-446655440000' }),
          },
          getOrder: {
            query: jest.fn().mockResolvedValue({
              id: '550e8400-e29b-41d4-a716-446655440000',
              userId: 'user-123',
              status: 'pending',
              pickup: { address: '123 Main St', lat: 40.7128, lng: -74.006 },
              dropoff: { address: '456 Oak Ave', lat: 40.7589, lng: -73.9851 },
              vehicleType: 'sedan',
              porterCount: 2,
              priceCents: 5000,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          listOrders: {
            query: jest.fn().mockResolvedValue({
              orders: [],
              total: 0,
            }),
          },
          cancelOrder: {
            mutate: jest.fn().mockResolvedValue({
              success: true,
              refundCents: 5000,
            }),
          },
        } as any,
        pricing: {
          estimate: {
            query: jest.fn().mockResolvedValue({
              totalCents: 5000,
              breakdown: {
                baseFare: 2000,
                distanceFare: 2500,
                porterFee: 500,
              },
              estimatedDuration: 1800,
              distanceMeters: 5000,
            }),
          },
        } as any,
        porters: {} as any,
        payments: {} as any,
        notifications: {} as any,
      },
      ...overrides,
    };
  };

  describe('create', () => {
    it('should orchestrate order creation correctly', async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const input = {
        pickup: { address: '123 Main St', lat: 40.7128, lng: -74.006 },
        dropoff: { address: '456 Oak Ave', lat: 40.7589, lng: -73.9851 },
        vehicleType: 'sedan' as const,
        porterCount: 2,
        idempotencyKey: 'test-idempotency-key',
      };

      const result = await caller.orders.create(input);

      // Assert price estimate was called first
      expect(ctx.services.pricing.estimate.query).toHaveBeenCalledWith({
        pickup: { lat: input.pickup.lat, lng: input.pickup.lng },
        dropoff: { lat: input.dropoff.lat, lng: input.dropoff.lng },
        vehicleType: input.vehicleType,
        porterCount: input.porterCount,
      });

      // Assert order creation was called with price
      expect(ctx.services.orders.createOrder.mutate).toHaveBeenCalledWith({
        userId: ctx.user!.id,
        pickup: input.pickup,
        dropoff: input.dropoff,
        vehicleType: input.vehicleType,
        porterCount: input.porterCount,
        scheduledAt: undefined,
        notes: undefined,
        priceCents: 5000,
      });

      // Assert result contains orderId
      expect(result).toEqual({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        priceCents: 5000,
        estimatedDuration: 1800,
      });
    });

    it('should call pricing service before orders service', async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const callOrder: string[] = [];

      (ctx.services.pricing.estimate.query as jest.Mock).mockImplementation(async () => {
        callOrder.push('pricing');
        return {
          totalCents: 5000,
          breakdown: { baseFare: 2000, distanceFare: 2500, porterFee: 500 },
          estimatedDuration: 1800,
          distanceMeters: 5000,
        };
      });

      (ctx.services.orders.createOrder.mutate as jest.Mock).mockImplementation(async () => {
        callOrder.push('orders');
        return { orderId: '550e8400-e29b-41d4-a716-446655440000' };
      });

      await caller.orders.create({
        pickup: { address: '123 Main St', lat: 40.7128, lng: -74.006 },
        dropoff: { address: '456 Oak Ave', lat: 40.7589, lng: -73.9851 },
        vehicleType: 'sedan',
        porterCount: 2,
      });

      // Verify pricing service was called before orders service
      expect(callOrder).toEqual(['pricing', 'orders']);
    });

    it('should require authentication', async () => {
      const ctx = createMockContext({ user: null });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.orders.create({
          pickup: { address: '123 Main St', lat: 40.7128, lng: -74.006 },
          dropoff: { address: '456 Oak Ave', lat: 40.7589, lng: -73.9851 },
          vehicleType: 'sedan',
          porterCount: 2,
        })
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('get', () => {
    it('should fetch order details', async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.orders.get('550e8400-e29b-41d4-a716-446655440000');

      expect(ctx.services.orders.getOrder.query).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.userId).toBe('user-123');
    });

    it('should reject access to other users orders', async () => {
      const ctx = createMockContext();
      (ctx.services.orders.getOrder.query as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'different-user-id',
        status: 'pending',
        pickup: { address: '123 Main St', lat: 40.7128, lng: -74.006 },
        dropoff: { address: '456 Oak Ave', lat: 40.7589, lng: -73.9851 },
        vehicleType: 'sedan',
        porterCount: 2,
        priceCents: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const caller = appRouter.createCaller(ctx);

      await expect(caller.orders.get('550e8400-e29b-41d4-a716-446655440000')).rejects.toThrow(
        'You do not have access to this order'
      );
    });
  });

  describe('cancel', () => {
    it('should cancel order successfully', async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.orders.cancel({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'Changed my mind',
      });

      expect(ctx.services.orders.cancelOrder.mutate).toHaveBeenCalledWith({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        reason: 'Changed my mind',
      });

      expect(result).toEqual({
        success: true,
        refundCents: 5000,
      });
    });
  });
});
