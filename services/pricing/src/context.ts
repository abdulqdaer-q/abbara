import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import crypto from 'crypto';

/**
 * tRPC context
 */
export interface Context {
  correlationId: string;
  userId?: string;
  isAdmin?: boolean;
}

/**
 * Create context for each request
 */
export function createContext({ req, _res }: CreateExpressContextOptions): Context {
  // Extract correlation ID from header or generate new one
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();

  // Extract user info from auth headers (if authenticated)
  const userId = req.headers['x-user-id'] as string | undefined;
  const isAdmin = req.headers['x-user-role'] === 'admin' || req.headers['x-user-role'] === 'superadmin';

  return {
    correlationId,
    userId,
    isAdmin,
  };
}

export type ContextType = Context;
