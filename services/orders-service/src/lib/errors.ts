import { TRPCError } from '@trpc/server';

/**
 * Custom error classes for orders service
 */

export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`);
    this.name = 'OrderNotFoundError';
  }
}

export class UnauthorizedOrderAccessError extends Error {
  constructor(orderId: string, userId: string) {
    super(`User ${userId} is not authorized to access order ${orderId}`);
    this.name = 'UnauthorizedOrderAccessError';
  }
}

export class InvalidOrderStatusTransitionError extends Error {
  constructor(orderId: string, currentStatus: string, newStatus: string) {
    super(
      `Invalid status transition for order ${orderId}: ${currentStatus} -> ${newStatus}`
    );
    this.name = 'InvalidOrderStatusTransitionError';
  }
}

export class OrderUpdateNotAllowedError extends Error {
  constructor(orderId: string, reason: string) {
    super(`Order ${orderId} cannot be updated: ${reason}`);
    this.name = 'OrderUpdateNotAllowedError';
  }
}

export class OrderAlreadyCancelledError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} is already cancelled`);
    this.name = 'OrderAlreadyCancelledError';
  }
}

export class OrderAlreadyCompletedError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} is already completed`);
    this.name = 'OrderAlreadyCompletedError';
  }
}

export class AssignmentNotFoundError extends Error {
  constructor(orderId: string, porterId: string) {
    super(`Assignment not found for order ${orderId} and porter ${porterId}`);
    this.name = 'AssignmentNotFoundError';
  }
}

export class OfferExpiredError extends Error {
  constructor(orderId: string, porterId: string) {
    super(`Offer expired for order ${orderId} and porter ${porterId}`);
    this.name = 'OfferExpiredError';
  }
}

export class OfferAlreadyAcceptedError extends Error {
  constructor(orderId: string) {
    super(`An offer for order ${orderId} has already been accepted by another porter`);
    this.name = 'OfferAlreadyAcceptedError';
  }
}

export class ConcurrencyError extends Error {
  constructor(orderId: string) {
    super(`Concurrent modification detected for order ${orderId}. Please retry.`);
    this.name = 'ConcurrencyError';
  }
}

export class PricingServiceError extends Error {
  constructor(message: string) {
    super(`Pricing service error: ${message}`);
    this.name = 'PricingServiceError';
  }
}

export class PaymentsServiceError extends Error {
  constructor(message: string) {
    super(`Payments service error: ${message}`);
    this.name = 'PaymentsServiceError';
  }
}

/**
 * Convert custom errors to tRPC errors
 */
export const toTRPCError = (error: Error): TRPCError => {
  if (error instanceof OrderNotFoundError || error instanceof AssignmentNotFoundError) {
    return new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }

  if (error instanceof UnauthorizedOrderAccessError) {
    return new TRPCError({
      code: 'FORBIDDEN',
      message: error.message,
    });
  }

  if (
    error instanceof InvalidOrderStatusTransitionError ||
    error instanceof OrderUpdateNotAllowedError ||
    error instanceof OrderAlreadyCancelledError ||
    error instanceof OrderAlreadyCompletedError ||
    error instanceof OfferExpiredError ||
    error instanceof OfferAlreadyAcceptedError
  ) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
    });
  }

  if (error instanceof ConcurrencyError) {
    return new TRPCError({
      code: 'CONFLICT',
      message: error.message,
    });
  }

  if (error instanceof PricingServiceError || error instanceof PaymentsServiceError) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message,
    });
  }

  if (error instanceof TRPCError) {
    return error;
  }

  // Unknown error
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error.message || 'An unexpected error occurred',
    cause: error,
  });
};
