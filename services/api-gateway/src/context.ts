import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { getCorrelationId } from './lib/correlation';
import { createLogger } from './lib/logger';
import {
  createInternalTRPCClient,
  ServiceClients,
} from './lib/trpcClientFactory';
import { Logger } from 'winston';

export interface User {
  id: string;
  email: string;
  role: string;
}

export interface Context {
  user: User | null;
  correlationId: string;
  logger: Logger;
  services: ServiceClients;
}

/**
 * Parse and verify JWT access token
 */
function parseAuthToken(authHeader?: string): User | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as {
      userId: string;
      email: string;
      role: string;
    };

    return {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error) {
    // Invalid or expired token
    return null;
  }
}

/**
 * Create context for each tRPC request
 * This runs on every request and provides:
 * - User authentication state
 * - Correlation ID for request tracing
 * - Logger instance
 * - Internal service clients
 */
export async function createContext({
  req,
  res: _res,
}: CreateExpressContextOptions): Promise<Context> {
  // Extract correlation ID
  const correlationId = getCorrelationId(req);

  // Create logger with correlation ID
  const logger = createLogger(correlationId);

  // Parse authentication
  const authHeader = req.headers.authorization;
  const user = parseAuthToken(authHeader);

  // Create internal service clients with correlation ID
  const services: ServiceClients = {
    auth: createInternalTRPCClient<any>(
      config.services.auth,
      correlationId
    ),
    orders: createInternalTRPCClient<any>(
      config.services.orders,
      correlationId
    ),
    pricing: createInternalTRPCClient<any>(
      config.services.pricing,
      correlationId
    ),
    porters: createInternalTRPCClient<any>(
      config.services.porters,
      correlationId
    ),
    payments: createInternalTRPCClient<any>(
      config.services.payments,
      correlationId
    ),
    notifications: createInternalTRPCClient<any>(
      config.services.notifications,
      correlationId
    ),
  };

  return {
    user,
    correlationId,
    logger,
    services,
  };
}

/**
 * Type helper to infer context type
 */
export type CreateContextFn = typeof createContext;
