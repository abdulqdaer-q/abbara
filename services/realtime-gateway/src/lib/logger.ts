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
  winston.format.printf(({ timestamp, level, message, correlationId, socketId, userId, ...meta }) => {
    const correlationPart = correlationId ? `[${correlationId}]` : '';
    const socketPart = socketId ? `[socket:${socketId.substring(0, 8)}]` : '';
    const userPart = userId ? `[user:${userId}]` : '';
    const metaPart = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level} ${correlationPart}${socketPart}${userPart}: ${message} ${metaPart}`;
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
 * Creates a child logger with correlation ID and optional socket/user context
 */
export function createLogger(context: {
  correlationId?: string;
  socketId?: string;
  userId?: string;
}): winston.Logger {
  return logger.child(context);
}

/**
 * Redacts sensitive information from logs
 */
export function redactSensitive(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const redacted = { ...data };
  const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'apiKey'];

  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitive(redacted[key]);
    }
  }

  return redacted;
}
