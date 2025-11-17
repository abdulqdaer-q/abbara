import { Kafka, Producer, Consumer, EachMessagePayload, logLevel } from 'kafkajs';
import { DomainEvent, EventType } from '@movenow/common';
import { logger } from './logger';

const topicPrefix = process.env.KAFKA_TOPIC_PREFIX || 'movenow';

export class KafkaClient {
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();

  constructor() {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    const clientId = process.env.KAFKA_CLIENT_ID || 'porters-service';

    this.kafka = new Kafka({
      clientId,
      brokers,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });
  }

  async connect() {
    await this.producer.connect();
    logger.info('Kafka producer connected');
  }

  async disconnect() {
    await this.producer.disconnect();
    for (const consumer of this.consumers.values()) {
      await consumer.disconnect();
    }
    logger.info('Kafka disconnected');
  }

  /**
   * Publish a domain event to Kafka
   */
  async publishEvent<T extends DomainEvent>(
    event: T,
    options?: { idempotencyKey?: string }
  ): Promise<void> {
    try {
      const topic = this.getTopicForEventType(event.type);
      const message = {
        key: event.userId || event.correlationId,
        value: JSON.stringify({
          ...event,
          timestamp: event.timestamp.toISOString(),
        }),
        headers: {
          eventType: event.type,
          correlationId: event.correlationId,
          ...(options?.idempotencyKey && { idempotencyKey: options.idempotencyKey }),
        },
      };

      await this.producer.send({
        topic,
        messages: [message],
      });

      logger.info('Event published', {
        eventType: event.type,
        topic,
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

  /**
   * Subscribe to events and process with handler
   */
  async subscribe<T extends DomainEvent>(
    eventTypes: EventType[],
    groupId: string,
    handler: (event: T, payload: EachMessagePayload) => Promise<void>
  ): Promise<void> {
    const topics = eventTypes.map((type) => this.getTopicForEventType(type));
    const consumerKey = `${groupId}-${topics.join(',')}`;

    if (this.consumers.has(consumerKey)) {
      logger.warn('Consumer already exists', { groupId, topics });
      return;
    }

    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    await consumer.connect();
    await consumer.subscribe({ topics, fromBeginning: false });

    await consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        try {
          const eventData = JSON.parse(payload.message.value?.toString() || '{}');

          // Convert timestamp string back to Date
          if (eventData.timestamp) {
            eventData.timestamp = new Date(eventData.timestamp);
          }

          logger.info('Event received', {
            eventType: eventData.type,
            topic: payload.topic,
            partition: payload.partition,
            offset: payload.message.offset,
          });

          await handler(eventData as T, payload);
        } catch (error) {
          logger.error('Error processing event', {
            topic: payload.topic,
            partition: payload.partition,
            offset: payload.message.offset,
            error,
          });
          // Don't throw - allow Kafka to continue processing
          // In production, you'd send this to a dead-letter queue
        }
      },
    });

    this.consumers.set(consumerKey, consumer);
    logger.info('Kafka consumer subscribed', { groupId, topics });
  }

  /**
   * Map event type to Kafka topic
   */
  private getTopicForEventType(eventType: EventType): string {
    // Normalize event type to topic name (e.g., 'porter.online' -> 'porter-online')
    const topicName = eventType.replace(/\./g, '-');
    return `${topicPrefix}.${topicName}`;
  }
}

// Singleton instance
let kafkaClient: KafkaClient | null = null;

export async function initKafka(): Promise<KafkaClient> {
  if (!kafkaClient) {
    kafkaClient = new KafkaClient();
    await kafkaClient.connect();
  }
  return kafkaClient;
}

export function getKafkaClient(): KafkaClient {
  if (!kafkaClient) {
    throw new Error('Kafka not initialized. Call initKafka() first.');
  }
  return kafkaClient;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  if (kafkaClient) {
    await kafkaClient.disconnect();
  }
});

export default {
  initKafka,
  getKafkaClient,
};
