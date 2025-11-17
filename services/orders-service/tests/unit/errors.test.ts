import {
  OrderNotFoundError,
  UnauthorizedOrderAccessError,
  InvalidOrderStatusTransitionError,
  OfferAlreadyAcceptedError,
  ConcurrencyError,
  PricingServiceError,
  toTRPCError,
} from '../../src/lib/errors';
import { TRPCError } from '@trpc/server';

describe('Error Classes', () => {
  describe('OrderNotFoundError', () => {
    it('should create error with correct message', () => {
      const error = new OrderNotFoundError('order-123');
      expect(error.message).toBe('Order not found: order-123');
      expect(error.name).toBe('OrderNotFoundError');
    });
  });

  describe('UnauthorizedOrderAccessError', () => {
    it('should create error with correct message', () => {
      const error = new UnauthorizedOrderAccessError('order-123', 'user-456');
      expect(error.message).toBe('User user-456 is not authorized to access order order-123');
      expect(error.name).toBe('UnauthorizedOrderAccessError');
    });
  });

  describe('InvalidOrderStatusTransitionError', () => {
    it('should create error with correct message', () => {
      const error = new InvalidOrderStatusTransitionError('order-123', 'COMPLETED', 'CREATED');
      expect(error.message).toBe('Invalid status transition for order order-123: COMPLETED -> CREATED');
      expect(error.name).toBe('InvalidOrderStatusTransitionError');
    });
  });

  describe('ConcurrencyError', () => {
    it('should create error with correct message', () => {
      const error = new ConcurrencyError('order-123');
      expect(error.message).toBe('Concurrent modification detected for order order-123. Please retry.');
      expect(error.name).toBe('ConcurrencyError');
    });
  });

  describe('OfferAlreadyAcceptedError', () => {
    it('should create error with correct message', () => {
      const error = new OfferAlreadyAcceptedError('order-123');
      expect(error.message).toBe('An offer for order order-123 has already been accepted by another porter');
      expect(error.name).toBe('OfferAlreadyAcceptedError');
    });
  });
});

describe('toTRPCError', () => {
  it('should convert OrderNotFoundError to NOT_FOUND', () => {
    const error = new OrderNotFoundError('order-123');
    const trpcError = toTRPCError(error);

    expect(trpcError).toBeInstanceOf(TRPCError);
    expect(trpcError.code).toBe('NOT_FOUND');
    expect(trpcError.message).toBe('Order not found: order-123');
  });

  it('should convert UnauthorizedOrderAccessError to FORBIDDEN', () => {
    const error = new UnauthorizedOrderAccessError('order-123', 'user-456');
    const trpcError = toTRPCError(error);

    expect(trpcError).toBeInstanceOf(TRPCError);
    expect(trpcError.code).toBe('FORBIDDEN');
  });

  it('should convert InvalidOrderStatusTransitionError to BAD_REQUEST', () => {
    const error = new InvalidOrderStatusTransitionError('order-123', 'COMPLETED', 'CREATED');
    const trpcError = toTRPCError(error);

    expect(trpcError).toBeInstanceOf(TRPCError);
    expect(trpcError.code).toBe('BAD_REQUEST');
  });

  it('should convert ConcurrencyError to CONFLICT', () => {
    const error = new ConcurrencyError('order-123');
    const trpcError = toTRPCError(error);

    expect(trpcError).toBeInstanceOf(TRPCError);
    expect(trpcError.code).toBe('CONFLICT');
  });

  it('should convert PricingServiceError to INTERNAL_SERVER_ERROR', () => {
    const error = new PricingServiceError('Service unavailable');
    const trpcError = toTRPCError(error);

    expect(trpcError).toBeInstanceOf(TRPCError);
    expect(trpcError.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should handle already TRPCError', () => {
    const originalError = new TRPCError({ code: 'BAD_REQUEST', message: 'Test error' });
    const trpcError = toTRPCError(originalError);

    expect(trpcError).toBe(originalError);
  });

  it('should convert unknown error to INTERNAL_SERVER_ERROR', () => {
    const error = new Error('Unknown error');
    const trpcError = toTRPCError(error);

    expect(trpcError).toBeInstanceOf(TRPCError);
    expect(trpcError.code).toBe('INTERNAL_SERVER_ERROR');
    expect(trpcError.message).toBe('Unknown error');
  });
});
