import { randomUUID } from 'crypto';

/**
 * Generate correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Extract correlation ID from headers
 */
export function extractCorrelationId(headers: Record<string, any>): string {
  const correlationId =
    headers['x-correlation-id'] ||
    headers['x-request-id'] ||
    generateCorrelationId();

  return correlationId;
}
