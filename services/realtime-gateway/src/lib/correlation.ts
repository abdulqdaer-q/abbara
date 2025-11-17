import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a new correlation ID for distributed tracing
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Extracts correlation ID from socket handshake or generates a new one
 */
export function getOrCreateCorrelationId(headers: any): string {
  return headers?.['x-correlation-id'] || headers?.['correlationid'] || generateCorrelationId();
}
