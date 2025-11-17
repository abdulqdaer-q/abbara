import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { extractCorrelationId } from './lib/correlation';
import { logger } from './lib/logger';

/**
 * User extracted from JWT token
 */
export interface User {
  id: string;
  role: 'client' | 'porter' | 'admin' | 'superadmin';
  email?: string;
}

/**
 * tRPC context shape
 */
export interface Context {
  user: User | null;
  correlationId: string;
  requestId: string;
  timestamp: Date;
}

/**
 * Create context from Express request
 */
export async function createContext({
  req,
  _res,
}: CreateExpressContextOptions): Promise<Context> {
  const correlationId = extractCorrelationId(req.headers);

  // Extract user from request (set by auth middleware)
  const user = (req as any).user || null;

  const context: Context = {
    user,
    correlationId,
    requestId: correlationId,
    timestamp: new Date(),
  };

  logger.debug('Context created', {
    correlationId,
    userId: user?.id,
    userRole: user?.role,
  });

  return context;
}
