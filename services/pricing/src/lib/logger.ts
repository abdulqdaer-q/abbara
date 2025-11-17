import winston from 'winston';
import { config } from '../config';

/**
 * Structured logger for pricing service
 */
export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: config.serviceName,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

/**
 * Create child logger with additional context
 */
export function createLogger(meta: Record<string, unknown>) {
  return logger.child(meta);
}

/**
 * Log pricing estimate request
 */
export function logPricingEstimate(data: {
  correlationId: string;
  vehicleType: string;
  distanceMeters: number;
  totalCents: number;
  durationMs: number;
}) {
  logger.info('Pricing estimate computed', {
    ...data,
    eventType: 'pricing_estimate',
  });
}

/**
 * Log pricing snapshot persistence
 */
export function logSnapshotPersisted(data: {
  correlationId: string;
  snapshotId: string;
  orderId: string;
  totalCents: number;
}) {
  logger.info('Pricing snapshot persisted', {
    ...data,
    eventType: 'snapshot_persisted',
  });
}

/**
 * Log rule change
 */
export function logRuleChange(data: {
  correlationId: string;
  action: string;
  ruleId: string;
  changedBy: string;
}) {
  logger.info('Pricing rule changed', {
    ...data,
    eventType: 'rule_change',
  });
}

/**
 * Log cache hit/miss
 */
export function logCacheEvent(data: {
  correlationId: string;
  cacheKey: string;
  hit: boolean;
  ttlSeconds?: number;
}) {
  logger.debug('Cache event', {
    ...data,
    eventType: 'cache',
  });
}

/**
 * Log external dependency call
 */
export function logExternalCall(data: {
  correlationId: string;
  provider: string;
  operation: string;
  durationMs: number;
  success: boolean;
  error?: string;
}) {
  logger.info('External dependency call', {
    ...data,
    eventType: 'external_call',
  });
}
