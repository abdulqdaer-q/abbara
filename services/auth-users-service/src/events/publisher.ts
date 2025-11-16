import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { DomainEvent } from '@movenow/common';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishBatch(events: DomainEvent[]): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Kafka Event Publisher
 */
export class KafkaEventPublisher implements EventPublisher {
  private kafka: Kafka;
  private producer: Producer;
  private connected: boolean = false;

  constructor() {
    const brokers = config.KAFKA_BROKERS?.split(',') || ['localhost:9092'];

    this.kafka = new Kafka({
      clientId: config.KAFKA_CLIENT_ID,
      brokers,
      retry: {
        retries: 5,
        initialRetryTime: 100,
        maxRetryTime: 30000,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
      logger.info('Kafka producer connected');
    }
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.ensureConnected();

    const topic = `${config.KAFKA_TOPIC_PREFIX}.${event.type}`;

    const record: ProducerRecord = {
      topic,
      messages: [
        {
          key: event.userId || event.correlationId,
          value: JSON.stringify({
            ...event,
            timestamp: event.timestamp.toISOString(),
          }),
          headers: {
            correlationId: event.correlationId,
            eventType: event.type,
          },
        },
      ],
    };

    try {
      await this.producer.send(record);
      logger.info('Event published', {
        eventType: event.type,
        correlationId: event.correlationId,
      });
    } catch (error) {
      logger.error('Failed to publish event', {
        eventType: event.type,
        error,
      });
      throw error;
    }
  }

  async publishBatch(events: DomainEvent[]): Promise<void> {
    await this.ensureConnected();

    const recordsByTopic = events.reduce((acc, event) => {
      const topic = `${config.KAFKA_TOPIC_PREFIX}.${event.type}`;

      if (!acc[topic]) {
        acc[topic] = [];
      }

      acc[topic].push({
        key: event.userId || event.correlationId,
        value: JSON.stringify({
          ...event,
          timestamp: event.timestamp.toISOString(),
        }),
        headers: {
          correlationId: event.correlationId,
          eventType: event.type,
        },
      });

      return acc;
    }, {} as Record<string, any[]>);

    try {
      await Promise.all(
        Object.entries(recordsByTopic).map(([topic, messages]) =>
          this.producer.send({ topic, messages })
        )
      );

      logger.info('Batch events published', { count: events.length });
    } catch (error) {
      logger.error('Failed to publish batch events', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
      logger.info('Kafka producer disconnected');
    }
  }
}

/**
 * Factory function to create the appropriate event publisher
 */
export function createEventPublisher(): EventPublisher {
  if (config.MESSAGE_BUS_TYPE === 'kafka') {
    return new KafkaEventPublisher();
  }

  // For RabbitMQ, you would implement a RabbitMQEventPublisher
  // For now, we'll default to Kafka
  throw new Error(`Unsupported message bus type: ${config.MESSAGE_BUS_TYPE}`);
}

// Singleton instance
let eventPublisher: EventPublisher | null = null;

export function getEventPublisher(): EventPublisher {
  if (!eventPublisher) {
    eventPublisher = createEventPublisher();
  }
  return eventPublisher;
}
