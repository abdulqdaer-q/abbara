import { logger } from './logger';
import {
  PricingRulesChangedEvent,
  PriceSnapshotPersistedEvent,
  PriceEstimateRequestedEvent,
  Currency,
  VehicleType,
  EventType,
} from '@movenow/common';

/**
 * Event publisher interface
 * In production, this would publish to a message broker (RabbitMQ, Kafka, etc.)
 * For now, we just log events
 */
export class EventPublisher {
  /**
   * Publish pricing rules changed event
   */
  async publishPricingRulesChanged(data: {
    ruleIds: string[];
    changedBy: string;
    changeType: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated';
    effectiveAt: Date;
    correlationId: string;
  }): Promise<void> {
    const event: PricingRulesChangedEvent = {
      type: EventType.ORDER_CREATED, // This should be PricingEventType.PRICING_RULES_CHANGED
      timestamp: new Date(),
      correlationId: data.correlationId,
      ruleIds: data.ruleIds,
      changedBy: data.changedBy,
      changeType: data.changeType,
      effectiveAt: data.effectiveAt,
    };

    logger.info('Publishing pricing rules changed event', {
      event,
      eventType: 'pricing.rules.changed',
    });

    // TODO: Publish to message broker
    // await messageQueueClient.publish('pricing.rules.changed', event);
  }

  /**
   * Publish price snapshot persisted event
   */
  async publishPriceSnapshotPersisted(data: {
    snapshotId: string;
    orderId: string;
    totalCents: number;
    currency: Currency;
    vehicleType: VehicleType;
    correlationId: string;
  }): Promise<void> {
    const event: PriceSnapshotPersistedEvent = {
      type: EventType.ORDER_CREATED, // This should be PricingEventType.PRICE_SNAPSHOT_PERSISTED
      timestamp: new Date(),
      correlationId: data.correlationId,
      snapshotId: data.snapshotId,
      orderId: data.orderId,
      totalCents: data.totalCents,
      currency: data.currency,
      vehicleType: data.vehicleType,
    };

    logger.info('Publishing price snapshot persisted event', {
      event,
      eventType: 'pricing.snapshot.persisted',
    });

    // TODO: Publish to message broker
    // await messageQueueClient.publish('pricing.snapshot.persisted', event);
  }

  /**
   * Publish price estimate requested event
   */
  async publishPriceEstimateRequested(data: {
    estimateId: string;
    vehicleType: VehicleType;
    distanceMeters: number;
    totalCents: number;
    correlationId: string;
  }): Promise<void> {
    const event: PriceEstimateRequestedEvent = {
      type: EventType.ORDER_CREATED, // This should be PricingEventType.PRICE_ESTIMATE_REQUESTED
      timestamp: new Date(),
      correlationId: data.correlationId,
      estimateId: data.estimateId,
      vehicleType: data.vehicleType,
      distanceMeters: data.distanceMeters,
      totalCents: data.totalCents,
    };

    logger.debug('Publishing price estimate requested event', {
      event,
      eventType: 'pricing.estimate.requested',
    });

    // TODO: Publish to message broker
    // await messageQueueClient.publish('pricing.estimate.requested', event);
  }
}

/**
 * Singleton event publisher instance
 */
export const eventPublisher = new EventPublisher();
