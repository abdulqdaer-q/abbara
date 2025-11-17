import { randomUUID } from 'crypto';

/**
 * Generate a unique correlation ID for tracking requests across services
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Extract correlation ID from headers or generate a new one
 */
export function getOrCreateCorrelationId(headers?: Record<string, string | string[] | undefined>): string {
  if (headers?.['x-correlation-id']) {
    const correlationId = headers['x-correlation-id'];
    return Array.isArray(correlationId) ? correlationId[0] : correlationId;
  }
  return generateCorrelationId();
}
