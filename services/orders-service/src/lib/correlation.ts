import { nanoid } from 'nanoid';
import { AsyncLocalStorage } from 'async_hooks';

interface CorrelationContext {
  correlationId: string;
  userId?: string;
  orderId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Generate a new correlation ID
 */
export const generateCorrelationId = (): string => {
  return nanoid();
};

/**
 * Get the current correlation ID from context
 */
export const getCorrelationId = (): string => {
  const store = asyncLocalStorage.getStore();
  return store?.correlationId || generateCorrelationId();
};

/**
 * Get the current context
 */
export const getContext = (): CorrelationContext | undefined => {
  return asyncLocalStorage.getStore();
};

/**
 * Run a function with correlation context
 */
export const runWithContext = <T>(
  context: CorrelationContext,
  fn: () => T
): T => {
  return asyncLocalStorage.run(context, fn);
};

/**
 * Middleware to set correlation context
 */
export const withCorrelationId = <T extends (...args: any[]) => any>(
  fn: T,
  correlationId?: string
): ((...args: Parameters<T>) => ReturnType<T>) => {
  return (...args: Parameters<T>): ReturnType<T> => {
    const context: CorrelationContext = {
      correlationId: correlationId || generateCorrelationId(),
    };
    return runWithContext(context, () => fn(...args));
  };
};
