import { Registry, Counter, Gauge, Histogram } from 'prom-client';

export const register = new Registry();

// Default metrics
register.setDefaultLabels({
  service: 'porters-service',
});

/**
 * Porter availability metrics
 */
export const onlinePortersGauge = new Gauge({
  name: 'porters_online_total',
  help: 'Current number of online porters',
  registers: [register],
});

export const availabilityToggleCounter = new Counter({
  name: 'porters_availability_toggle_total',
  help: 'Total number of availability toggles',
  labelNames: ['status'], // 'online' | 'offline'
  registers: [register],
});

/**
 * Job offer metrics
 */
export const offersCreatedCounter = new Counter({
  name: 'porters_offers_created_total',
  help: 'Total number of job offers created',
  registers: [register],
});

export const offersAcceptedCounter = new Counter({
  name: 'porters_offers_accepted_total',
  help: 'Total number of job offers accepted',
  registers: [register],
});

export const offersRejectedCounter = new Counter({
  name: 'porters_offers_rejected_total',
  help: 'Total number of job offers rejected',
  registers: [register],
});

export const offersExpiredCounter = new Counter({
  name: 'porters_offers_expired_total',
  help: 'Total number of job offers expired',
  registers: [register],
});

export const acceptRateGauge = new Gauge({
  name: 'porters_accept_rate',
  help: 'Ratio of accepted offers to total offers',
  registers: [register],
});

/**
 * Location update metrics
 */
export const locationUpdatesCounter = new Counter({
  name: 'porters_location_updates_total',
  help: 'Total number of location updates received',
  registers: [register],
});

export const locationUpdateLatencyHistogram = new Histogram({
  name: 'porters_location_update_latency_seconds',
  help: 'Location update processing latency',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

/**
 * Verification metrics
 */
export const verificationRequestsCounter = new Counter({
  name: 'porters_verification_requests_total',
  help: 'Total number of verification requests',
  registers: [register],
});

export const verificationApprovedCounter = new Counter({
  name: 'porters_verification_approved_total',
  help: 'Total number of approved verifications',
  registers: [register],
});

export const verificationRejectedCounter = new Counter({
  name: 'porters_verification_rejected_total',
  help: 'Total number of rejected verifications',
  registers: [register],
});

/**
 * Earnings metrics
 */
export const earningsRecordedCounter = new Counter({
  name: 'porters_earnings_recorded_total',
  help: 'Total number of earnings recorded',
  labelNames: ['type'], // 'job_payment', 'bonus', 'tip', etc.
  registers: [register],
});

export const totalEarningsGauge = new Gauge({
  name: 'porters_total_earnings_cents',
  help: 'Total earnings in cents across all porters',
  registers: [register],
});

/**
 * RPC metrics
 */
export const rpcRequestCounter = new Counter({
  name: 'porters_rpc_requests_total',
  help: 'Total number of RPC requests',
  labelNames: ['procedure', 'status'], // status: 'success' | 'error'
  registers: [register],
});

export const rpcDurationHistogram = new Histogram({
  name: 'porters_rpc_duration_seconds',
  help: 'RPC request duration',
  labelNames: ['procedure'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

/**
 * Race condition metrics
 */
export const raceConditionCounter = new Counter({
  name: 'porters_race_conditions_total',
  help: 'Total number of race conditions detected during job acceptance',
  labelNames: ['outcome'], // 'won' | 'lost'
  registers: [register],
});

/**
 * Helper functions to update metrics
 */
export function incrementOnlinePorters() {
  onlinePortersGauge.inc();
  availabilityToggleCounter.inc({ status: 'online' });
}

export function decrementOnlinePorters() {
  onlinePortersGauge.dec();
  availabilityToggleCounter.inc({ status: 'offline' });
}

export function recordOfferCreated() {
  offersCreatedCounter.inc();
}

export function recordOfferAccepted() {
  offersAcceptedCounter.inc();
  updateAcceptRate();
}

export function recordOfferRejected() {
  offersRejectedCounter.inc();
  updateAcceptRate();
}

export function recordOfferExpired() {
  offersExpiredCounter.inc();
}

function updateAcceptRate() {
  const accepted = (offersAcceptedCounter as any).hashMap[''].value || 0;
  const rejected = (offersRejectedCounter as any).hashMap[''].value || 0;
  const total = accepted + rejected;
  if (total > 0) {
    acceptRateGauge.set(accepted / total);
  }
}

export function recordLocationUpdate(latencySeconds: number) {
  locationUpdatesCounter.inc();
  locationUpdateLatencyHistogram.observe(latencySeconds);
}

export function recordVerificationRequest() {
  verificationRequestsCounter.inc();
}

export function recordVerificationApproved() {
  verificationApprovedCounter.inc();
}

export function recordVerificationRejected() {
  verificationRejectedCounter.inc();
}

export function recordEarning(type: string) {
  earningsRecordedCounter.inc({ type });
}

export function recordRpcRequest(procedure: string, status: 'success' | 'error', duration: number) {
  rpcRequestCounter.inc({ procedure, status });
  rpcDurationHistogram.observe({ procedure }, duration);
}

export function recordRaceCondition(outcome: 'won' | 'lost') {
  raceConditionCounter.inc({ outcome });
}

export default register;
