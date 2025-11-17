import { TRPCError } from '@trpc/server';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503);
  }
}

export class BadGatewayError extends AppError {
  constructor(message: string = 'Bad gateway - downstream service error') {
    super(message, 502);
  }
}

/**
 * Converts AppError to TRPCError with appropriate code
 */
export function toTRPCError(error: Error, correlationId?: string): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof AppError) {
    const code = statusCodeToTRPCCode(error.statusCode);
    return new TRPCError({
      code,
      message: error.message,
      cause: {
        correlationId,
        statusCode: error.statusCode,
      },
    });
  }

  // Unknown error
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    cause: {
      correlationId,
      originalMessage: error.message,
    },
  });
}

function statusCodeToTRPCCode(statusCode: number): TRPCError['code'] {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'TOO_MANY_REQUESTS';
    case 500:
      return 'INTERNAL_SERVER_ERROR';
    case 502:
      // Bad Gateway - map to INTERNAL_SERVER_ERROR as tRPC doesn't have BAD_GATEWAY
      return 'INTERNAL_SERVER_ERROR';
    case 503:
      // Service Unavailable - map to INTERNAL_SERVER_ERROR as tRPC doesn't have SERVICE_UNAVAILABLE
      return 'INTERNAL_SERVER_ERROR';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

/**
 * Wraps downstream service errors with correlation ID
 */
export function wrapDownstreamError(error: unknown, serviceName: string, correlationId: string): TRPCError {
  const message = error instanceof Error ? error.message : 'Unknown error';

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `${serviceName} error: ${message}`,
    cause: {
      correlationId,
      serviceName,
      originalError: error,
    },
  });
}
