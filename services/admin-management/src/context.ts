import { inferAsyncReturnType } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { verifyToken, extractTokenFromHeader, JWTPayload } from './middleware/auth';
import { getOrCreateCorrelationId } from './lib/correlation';
import { logger } from './lib/logger';

/**
 * Create context for each tRPC request
 */
export async function createContext({ req, res }: CreateExpressContextOptions) {
  const correlationId = getOrCreateCorrelationId(req.headers as Record<string, string>);

  // Extract admin user from JWT if present
  let admin: JWTPayload | null = null;

  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = extractTokenFromHeader(authHeader);
      admin = verifyToken(token);

      logger.debug('Admin authenticated', {
        adminId: admin.userId,
        role: admin.role,
        correlationId,
      });
    }
  } catch (error) {
    // Authentication errors will be handled by protected procedures
    logger.debug('No valid authentication found', { correlationId });
  }

  return {
    req,
    res,
    admin,
    correlationId,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
