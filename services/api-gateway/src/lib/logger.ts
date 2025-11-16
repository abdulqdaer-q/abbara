import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
    const correlationPart = correlationId ? `[${correlationId}]` : '';
    const metaPart = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level} ${correlationPart}: ${message} ${metaPart}`;
  })
);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: config.serviceName },
  transports: [
    new winston.transports.Console({
      format: config.server.env === 'development' ? consoleFormat : logFormat,
    }),
  ],
});

/**
 * Creates a child logger with correlation ID
 */
export function createLogger(correlationId: string): winston.Logger {
  return logger.child({ correlationId });
}
