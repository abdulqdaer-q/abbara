import winston from 'winston';
import { config } from '../config';

/**
 * Structured logger using Winston
 */
export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'bidding-service' },
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
 * Create child logger with additional metadata
 */
export function createLogger(meta: Record<string, any>) {
  return logger.child(meta);
}
