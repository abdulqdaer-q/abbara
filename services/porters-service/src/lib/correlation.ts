import { AsyncLocalStorage } from 'async_hooks';
import { nanoid } from 'nanoid';

interface CorrelationContext {
  correlationId: string;
  userId?: string;
  porterId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

export function getCorrelationContext(): CorrelationContext {
  const context = asyncLocalStorage.getStore();
  if (!context) {
    return { correlationId: nanoid() };
  }
  return context;
}

export function getCorrelationId(): string {
  return getCorrelationContext().correlationId;
}

export function setCorrelationContext(context: Partial<CorrelationContext>): void {
  const currentContext = getCorrelationContext();
  const newContext = {
    ...currentContext,
    ...context,
    correlationId: context.correlationId || currentContext.correlationId || nanoid(),
  };
  asyncLocalStorage.enterWith(newContext);
}

export function runWithCorrelation<T>(
  context: Partial<CorrelationContext>,
  fn: () => T
): T {
  const correlationContext = {
    correlationId: context.correlationId || nanoid(),
    ...context,
  };
  return asyncLocalStorage.run(correlationContext, fn);
}

export async function runWithCorrelationAsync<T>(
  context: Partial<CorrelationContext>,
  fn: () => Promise<T>
): Promise<T> {
  const correlationContext = {
    correlationId: context.correlationId || nanoid(),
    ...context,
  };
  return asyncLocalStorage.run(correlationContext, fn);
}

export default {
  getCorrelationContext,
  getCorrelationId,
  setCorrelationContext,
  runWithCorrelation,
  runWithCorrelationAsync,
};
