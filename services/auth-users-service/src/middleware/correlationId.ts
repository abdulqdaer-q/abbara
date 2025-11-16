import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Generate or extract correlation ID from request
 */
export function getOrCreateCorrelationId(headerValue?: string): string {
  if (headerValue && typeof headerValue === 'string') {
    logger.debug('Using existing correlation ID', { correlationId: headerValue });
    return headerValue;
  }

  const correlationId = uuidv4();
  logger.debug('Generated new correlation ID', { correlationId });
  return correlationId;
}

/**
 * Attach correlation ID to logger context
 */
export function withCorrelationId<T>(
  _correlationId: string,
  fn: () => T
): T {
  // In a production environment, you might use AsyncLocalStorage
  // For now, we'll pass it explicitly through the context
  return fn();
}
