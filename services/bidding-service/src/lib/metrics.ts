import { register, Counter, Histogram, Gauge } from 'prom-client';

/**
 * Prometheus metrics for observability
 */

// Bidding window metrics
export const biddingWindowsTotal = new Counter({
  name: 'bidding_windows_total',
  help: 'Total number of bidding windows created',
  labelNames: ['status'],
});

export const activeBiddingWindows = new Gauge({
  name: 'active_bidding_windows',
  help: 'Current number of active bidding windows',
});

// Bid metrics
export const bidsTotal = new Counter({
  name: 'bids_total',
  help: 'Total number of bids placed',
  labelNames: ['status'],
});

export const bidAcceptanceDuration = new Histogram({
  name: 'bid_acceptance_duration_seconds',
  help: 'Time taken to accept a bid',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const timeToFirstBid = new Histogram({
  name: 'time_to_first_bid_seconds',
  help: 'Time from window open to first bid',
  buckets: [1, 5, 10, 30, 60, 120, 300],
});

// Lock contention metrics
export const lockAcquisitionAttempts = new Counter({
  name: 'lock_acquisition_attempts_total',
  help: 'Total number of lock acquisition attempts',
  labelNames: ['result'],
});

export const lockHoldDuration = new Histogram({
  name: 'lock_hold_duration_seconds',
  help: 'Time locks are held',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

// Event publishing metrics
export const eventsPublished = new Counter({
  name: 'events_published_total',
  help: 'Total number of events published',
  labelNames: ['event_type', 'status'],
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

// Strategy evaluation metrics
export const strategyEvaluationDuration = new Histogram({
  name: 'strategy_evaluation_duration_seconds',
  help: 'Time taken to evaluate bids with strategy',
  labelNames: ['strategy_id'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
});

/**
 * Get metrics registry for export
 */
export function getMetricsRegistry() {
  return register;
}

/**
 * Get metrics as Prometheus text format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}
