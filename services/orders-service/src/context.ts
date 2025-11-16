import { inferAsyncReturnType } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { generateCorrelationId } from './lib/correlation';

export interface User {
  userId: string;
  role: 'customer' | 'porter' | 'admin' | 'system';
  email?: string;
  phone?: string;
}

/**
 * Create context for tRPC requests
 */
export const createContext = ({ req, res }: CreateExpressContextOptions) => {
  // Extract authorization token from headers
  const token = req.headers.authorization?.replace('Bearer ', '');

  // Get or generate correlation ID
  const correlationId =
    (req.headers['x-correlation-id'] as string) || generateCorrelationId();

  return {
    req,
    res,
    token,
    correlationId,
    user: undefined as User | undefined,
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;
