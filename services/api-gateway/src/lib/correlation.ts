import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Express middleware that adds correlation ID to request
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || randomUUID();
  req.headers[CORRELATION_ID_HEADER] = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
}

/**
 * Extracts correlation ID from express request
 */
export function getCorrelationId(req: Request): string {
  return (req.headers[CORRELATION_ID_HEADER] as string) || randomUUID();
}

/**
 * Creates correlation ID if not present
 */
export function ensureCorrelationId(correlationId?: string): string {
  return correlationId || randomUUID();
}
