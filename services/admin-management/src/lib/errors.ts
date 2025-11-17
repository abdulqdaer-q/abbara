import { TRPCError } from '@trpc/server';

/**
 * Custom error classes for Admin Management Service
 */

export class UnauthorizedError extends TRPCError {
  constructor(message = 'Unauthorized access') {
    super({
      code: 'UNAUTHORIZED',
      message,
    });
  }
}

export class ForbiddenError extends TRPCError {
  constructor(message = 'Forbidden: Insufficient permissions') {
    super({
      code: 'FORBIDDEN',
      message,
    });
  }
}

export class NotFoundError extends TRPCError {
  constructor(resource: string, id?: string) {
    super({
      code: 'NOT_FOUND',
      message: id ? `${resource} with id ${id} not found` : `${resource} not found`,
    });
  }
}

export class ConflictError extends TRPCError {
  constructor(message: string) {
    super({
      code: 'CONFLICT',
      message,
    });
  }
}

export class ValidationError extends TRPCError {
  constructor(message: string) {
    super({
      code: 'BAD_REQUEST',
      message,
    });
  }
}

export class OptimisticLockError extends TRPCError {
  constructor(resource: string) {
    super({
      code: 'CONFLICT',
      message: `${resource} has been modified by another user. Please refresh and try again.`,
    });
  }
}

export class InternalServerError extends TRPCError {
  constructor(message = 'An unexpected error occurred') {
    super({
      code: 'INTERNAL_SERVER_ERROR',
      message,
    });
  }
}
