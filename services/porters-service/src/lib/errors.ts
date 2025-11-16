import { TRPCError } from '@trpc/server';

/**
 * Standard error codes aligned with tRPC error codes
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code:
      | 'BAD_REQUEST'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'PRECONDITION_FAILED'
      | 'PAYLOAD_TOO_LARGE'
      | 'UNPROCESSABLE_CONTENT'
      | 'TOO_MANY_REQUESTS'
      | 'INTERNAL_SERVER_ERROR'
      | 'BAD_GATEWAY'
      | 'SERVICE_UNAVAILABLE'
      | 'GATEWAY_TIMEOUT',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  toTRPCError(): TRPCError {
    return new TRPCError({
      code: this.code,
      message: this.message,
      cause: this.details,
    });
  }
}

export function throwBadRequest(message: string, details?: Record<string, unknown>): never {
  throw new AppError(message, 'BAD_REQUEST', details);
}

export function throwUnauthorized(message = 'Unauthorized'): never {
  throw new AppError(message, 'UNAUTHORIZED');
}

export function throwForbidden(message = 'Forbidden'): never {
  throw new AppError(message, 'FORBIDDEN');
}

export function throwNotFound(resource: string, id?: string): never {
  const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
  throw new AppError(message, 'NOT_FOUND');
}

export function throwConflict(message: string, details?: Record<string, unknown>): never {
  throw new AppError(message, 'CONFLICT', details);
}

export function throwServiceUnavailable(
  service: string,
  details?: Record<string, unknown>
): never {
  throw new AppError(`${service} service unavailable`, 'SERVICE_UNAVAILABLE', details);
}

export function throwTooManyRequests(message = 'Too many requests'): never {
  throw new AppError(message, 'TOO_MANY_REQUESTS');
}

export default {
  AppError,
  throwBadRequest,
  throwUnauthorized,
  throwForbidden,
  throwNotFound,
  throwConflict,
  throwServiceUnavailable,
  throwTooManyRequests,
};
