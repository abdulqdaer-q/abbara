import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { verifyToken, extractToken, JWTPayload } from './middleware/auth';
import { setCorrelationContext } from './lib/correlation';
import { nanoid } from 'nanoid';

export interface Context {
  user?: JWTPayload;
  correlationId: string;
}

/**
 * Create tRPC context from Express request
 */
export async function createContext({
  req,
}: CreateExpressContextOptions): Promise<Context> {
  // Extract and set correlation ID
  const correlationId = (req.headers['x-correlation-id'] as string) || nanoid();

  // Try to authenticate user
  let user: JWTPayload | undefined;

  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = extractToken(authHeader);
      user = verifyToken(token);

      // Set correlation context
      setCorrelationContext({
        correlationId,
        userId: user.userId,
      });
    } else {
      setCorrelationContext({ correlationId });
    }
  } catch (error) {
    // Authentication failed, but we still create context
    // Individual procedures will decide if auth is required
    setCorrelationContext({ correlationId });
  }

  return {
    user,
    correlationId,
  };
}

export type { JWTPayload };
