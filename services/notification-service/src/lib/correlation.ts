import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Extract or generate a correlation ID from an Express request
 */
export function getOrCreateCorrelationId(req: Request): string {
  const existingId = req.headers[CORRELATION_ID_HEADER];

  if (typeof existingId === 'string' && existingId.length > 0) {
    return existingId;
  }

  return uuidv4();
}

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return uuidv4();
}
