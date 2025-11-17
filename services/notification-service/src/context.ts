import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { Context } from './types/context';
import { getOrCreateCorrelationId } from './lib/correlation';
import { createLogger } from './lib/logger';
import { getPrismaClient } from './lib/db';

/**
 * Create tRPC context for each request
 * This runs for every request and provides the context to all procedures
 */
export async function createContext({ req, _res }: CreateExpressContextOptions): Promise<Context> {
  const correlationId = getOrCreateCorrelationId(req);
  const logger = createLogger(correlationId);

  // In a real implementation, you would parse JWT from Authorization header
  // For now, we'll extract user info from a custom header (simplified for demo)
  let user = null;

  const userId = req.headers['x-user-id'] as string | undefined;
  const userEmail = req.headers['x-user-email'] as string | undefined;
  const userRole = req.headers['x-user-role'] as string | undefined;

  if (userId && userEmail && userRole) {
    user = {
      id: userId,
      email: userEmail,
      role: userRole,
    };
  }

  const db = getPrismaClient();

  return {
    user,
    correlationId,
    logger,
    db,
  };
}
