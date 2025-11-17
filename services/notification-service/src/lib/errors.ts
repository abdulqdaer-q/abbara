import { TRPCError } from '@trpc/server';

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }
}

export class DeliveryError extends AppError {
  constructor(channel: string, reason: string, details?: unknown) {
    super(`Failed to deliver notification via ${channel}: ${reason}`, 'DELIVERY_ERROR', 500, details);
    this.name = 'DeliveryError';
  }
}

export class DuplicateNotificationError extends AppError {
  constructor(idempotencyKey: string) {
    super(`Duplicate notification detected with idempotency key: ${idempotencyKey}`, 'DUPLICATE_NOTIFICATION', 409);
    this.name = 'DuplicateNotificationError';
  }
}

/**
 * Convert an AppError to a TRPCError
 */
export function toTRPCError(error: AppError, _correlationId?: string): TRPCError {
  const codeMap: Record<string, TRPCError['code']> = {
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    RATE_LIMIT_EXCEEDED: 'TOO_MANY_REQUESTS',
    DELIVERY_ERROR: 'INTERNAL_SERVER_ERROR',
    DUPLICATE_NOTIFICATION: 'CONFLICT',
  };

  return new TRPCError({
    code: codeMap[error.code] || 'INTERNAL_SERVER_ERROR',
    message: error.message,
    cause: error,
  });
}

/**
 * Wrap downstream service errors with correlation ID
 */
export function wrapDownstreamError(error: unknown, service: string, correlationId?: string): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      `Downstream service error from ${service}: ${error.message}`,
      'DOWNSTREAM_ERROR',
      500,
      { originalError: error.message, correlationId }
    );
  }

  return new AppError(
    `Unknown error from ${service}`,
    'DOWNSTREAM_ERROR',
    500,
    { correlationId }
  );
}
