import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a custom registry
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

/**
 * Order metrics
 */
export const orderCreatedCounter = new Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['status', 'vehicleType'],
  registers: [register],
});

export const orderStatusChangedCounter = new Counter({
  name: 'orders_status_changed_total',
  help: 'Total number of order status changes',
  labelNames: ['fromStatus', 'toStatus'],
  registers: [register],
});

export const orderCancelledCounter = new Counter({
  name: 'orders_cancelled_total',
  help: 'Total number of cancelled orders',
  labelNames: ['reason', 'cancelledBy'],
  registers: [register],
});

export const orderCompletedCounter = new Counter({
  name: 'orders_completed_total',
  help: 'Total number of completed orders',
  registers: [register],
});

/**
 * Assignment metrics
 */
export const porterAssignmentCounter = new Counter({
  name: 'porter_assignments_total',
  help: 'Total number of porter assignments',
  labelNames: ['status', 'strategy'],
  registers: [register],
});

export const porterOfferAcceptanceTime = new Histogram({
  name: 'porter_offer_acceptance_seconds',
  help: 'Time taken for porter to accept an offer',
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

/**
 * Event publishing metrics
 */
export const eventPublishedCounter = new Counter({
  name: 'events_published_total',
  help: 'Total number of events published',
  labelNames: ['eventType', 'status'],
  registers: [register],
});

export const eventPublishDuration = new Histogram({
  name: 'event_publish_duration_seconds',
  help: 'Duration of event publishing',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

/**
 * Procedure metrics
 */
export const procedureCallCounter = new Counter({
  name: 'procedure_calls_total',
  help: 'Total number of procedure calls',
  labelNames: ['procedure', 'status'],
  registers: [register],
});

export const procedureDuration = new Histogram({
  name: 'procedure_duration_seconds',
  help: 'Duration of procedure calls',
  labelNames: ['procedure'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [register],
});

/**
 * Idempotency metrics
 */
export const idempotencyHitCounter = new Counter({
  name: 'idempotency_hits_total',
  help: 'Total number of idempotency key hits',
  labelNames: ['procedure'],
  registers: [register],
});

/**
 * Active orders gauge
 */
export const activeOrdersGauge = new Gauge({
  name: 'active_orders',
  help: 'Number of active orders',
  labelNames: ['status'],
  registers: [register],
});

/**
 * Scheduled orders gauge
 */
export const scheduledOrdersGauge = new Gauge({
  name: 'scheduled_orders',
  help: 'Number of scheduled orders (future)',
  registers: [register],
});

/**
 * Database connection pool metrics
 */
export const dbConnectionsGauge = new Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

/**
 * Helper function to measure async function duration
 */
export const measureDuration = async <T>(
  histogram: Histogram,
  labels: Record<string, string>,
  fn: () => Promise<T>
): Promise<T> => {
  const end = histogram.startTimer(labels);
  try {
    const result = await fn();
    end();
    return result;
  } catch (error) {
    end();
    throw error;
  }
};
