import { Registry, Counter, Gauge, Histogram } from 'prom-client';
import { logger } from '../lib/logger';

export class MetricsService {
  private registry: Registry;

  // Connection metrics
  public activeConnections: Gauge;
  public totalConnections: Counter;
  public disconnections: Counter;
  public reconnections: Counter;

  // Message metrics
  public messagesReceived: Counter;
  public messagesSent: Counter;
  public locationUpdates: Counter;
  public chatMessages: Counter;
  public jobOffers: Counter;

  // Performance metrics
  public fanoutLatency: Histogram;
  public messageProcessingLatency: Histogram;
  public authenticationLatency: Histogram;

  // Error metrics
  public authenticationErrors: Counter;
  public messageErrors: Counter;
  public deliveryFailures: Counter;

  // Redis metrics
  public redisHits: Counter;
  public redisMisses: Counter;
  public redisErrors: Counter;

  // Rate limiting metrics
  public rateLimitedRequests: Counter;

  constructor() {
    this.registry = new Registry();

    // Connection metrics
    this.activeConnections = new Gauge({
      name: 'realtime_active_connections',
      help: 'Number of active WebSocket connections',
      labelNames: ['namespace'],
      registers: [this.registry],
    });

    this.totalConnections = new Counter({
      name: 'realtime_total_connections',
      help: 'Total number of WebSocket connections',
      labelNames: ['namespace'],
      registers: [this.registry],
    });

    this.disconnections = new Counter({
      name: 'realtime_disconnections',
      help: 'Total number of disconnections',
      labelNames: ['namespace', 'reason'],
      registers: [this.registry],
    });

    this.reconnections = new Counter({
      name: 'realtime_reconnections',
      help: 'Total number of reconnections',
      labelNames: ['namespace'],
      registers: [this.registry],
    });

    // Message metrics
    this.messagesReceived = new Counter({
      name: 'realtime_messages_received_total',
      help: 'Total number of messages received from clients',
      labelNames: ['namespace', 'event'],
      registers: [this.registry],
    });

    this.messagesSent = new Counter({
      name: 'realtime_messages_sent_total',
      help: 'Total number of messages sent to clients',
      labelNames: ['namespace', 'event'],
      registers: [this.registry],
    });

    this.locationUpdates = new Counter({
      name: 'realtime_location_updates_total',
      help: 'Total number of location updates processed',
      registers: [this.registry],
    });

    this.chatMessages = new Counter({
      name: 'realtime_chat_messages_total',
      help: 'Total number of chat messages processed',
      labelNames: ['direction'],
      registers: [this.registry],
    });

    this.jobOffers = new Counter({
      name: 'realtime_job_offers_total',
      help: 'Total number of job offers sent',
      labelNames: ['status'],
      registers: [this.registry],
    });

    // Performance metrics
    this.fanoutLatency = new Histogram({
      name: 'realtime_fanout_latency_seconds',
      help: 'Latency of message fan-out operations',
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });

    this.messageProcessingLatency = new Histogram({
      name: 'realtime_message_processing_latency_seconds',
      help: 'Latency of message processing',
      labelNames: ['event'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });

    this.authenticationLatency = new Histogram({
      name: 'realtime_authentication_latency_seconds',
      help: 'Latency of authentication operations',
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    // Error metrics
    this.authenticationErrors = new Counter({
      name: 'realtime_authentication_errors_total',
      help: 'Total number of authentication errors',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.messageErrors = new Counter({
      name: 'realtime_message_errors_total',
      help: 'Total number of message processing errors',
      labelNames: ['event', 'error_type'],
      registers: [this.registry],
    });

    this.deliveryFailures = new Counter({
      name: 'realtime_delivery_failures_total',
      help: 'Total number of message delivery failures',
      labelNames: ['event'],
      registers: [this.registry],
    });

    // Redis metrics
    this.redisHits = new Counter({
      name: 'realtime_redis_hits_total',
      help: 'Total number of Redis cache hits',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    this.redisMisses = new Counter({
      name: 'realtime_redis_misses_total',
      help: 'Total number of Redis cache misses',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    this.redisErrors = new Counter({
      name: 'realtime_redis_errors_total',
      help: 'Total number of Redis errors',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    // Rate limiting metrics
    this.rateLimitedRequests = new Counter({
      name: 'realtime_rate_limited_requests_total',
      help: 'Total number of rate limited requests',
      labelNames: ['namespace', 'event'],
      registers: [this.registry],
    });

    logger.info('Metrics service initialized');
  }

  /**
   * Get metrics registry for /metrics endpoint
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Get metrics as text
   */
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  /**
   * Record a connection
   */
  recordConnection(namespace: string): void {
    this.activeConnections.inc({ namespace });
    this.totalConnections.inc({ namespace });
  }

  /**
   * Record a disconnection
   */
  recordDisconnection(namespace: string, reason: string): void {
    this.activeConnections.dec({ namespace });
    this.disconnections.inc({ namespace, reason });
  }

  /**
   * Record a reconnection
   */
  recordReconnection(namespace: string): void {
    this.reconnections.inc({ namespace });
  }

  /**
   * Record a received message
   */
  recordMessageReceived(namespace: string, event: string): void {
    this.messagesReceived.inc({ namespace, event });
  }

  /**
   * Record a sent message
   */
  recordMessageSent(namespace: string, event: string): void {
    this.messagesSent.inc({ namespace, event });
  }

  /**
   * Record a location update
   */
  recordLocationUpdate(): void {
    this.locationUpdates.inc();
  }

  /**
   * Record a chat message
   */
  recordChatMessage(direction: 'inbound' | 'outbound'): void {
    this.chatMessages.inc({ direction });
  }

  /**
   * Record a job offer
   */
  recordJobOffer(status: string): void {
    this.jobOffers.inc({ status });
  }

  /**
   * Time a fan-out operation
   */
  timeFanout(): () => void {
    const end = this.fanoutLatency.startTimer();
    return () => end();
  }

  /**
   * Time message processing
   */
  timeMessageProcessing(event: string): () => void {
    const end = this.messageProcessingLatency.startTimer({ event });
    return () => end();
  }

  /**
   * Time authentication
   */
  timeAuthentication(): () => void {
    const end = this.authenticationLatency.startTimer();
    return () => end();
  }

  /**
   * Record an authentication error
   */
  recordAuthError(reason: string): void {
    this.authenticationErrors.inc({ reason });
  }

  /**
   * Record a message error
   */
  recordMessageError(event: string, errorType: string): void {
    this.messageErrors.inc({ event, error_type: errorType });
  }

  /**
   * Record a delivery failure
   */
  recordDeliveryFailure(event: string): void {
    this.deliveryFailures.inc({ event });
  }

  /**
   * Record a Redis hit
   */
  recordRedisHit(operation: string): void {
    this.redisHits.inc({ operation });
  }

  /**
   * Record a Redis miss
   */
  recordRedisMiss(operation: string): void {
    this.redisMisses.inc({ operation });
  }

  /**
   * Record a Redis error
   */
  recordRedisError(operation: string): void {
    this.redisErrors.inc({ operation });
  }

  /**
   * Record a rate limited request
   */
  recordRateLimited(namespace: string, event: string): void {
    this.rateLimitedRequests.inc({ namespace, event });
  }
}

export const metricsService = new MetricsService();
