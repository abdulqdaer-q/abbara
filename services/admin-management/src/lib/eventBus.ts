import { Kafka, Producer, Consumer, KafkaMessage } from 'kafkajs';
import { logger } from './logger';
import { AdminDomainEvent, AdminEventType } from '../types/events';

export class EventBus {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private messageHandlers: Map<string, (event: AdminDomainEvent) => Promise<void>> = new Map();

  constructor() {
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'admin-management-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });
  }

  /**
   * Initialize the event bus producer
   */
  async initProducer(): Promise<void> {
    try {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
      });

      await this.producer.connect();
      logger.info('Kafka producer connected successfully');
    } catch (error) {
      logger.error('Failed to connect Kafka producer', { error });
      throw error;
    }
  }

  /**
   * Initialize the event bus consumer
   */
  async initConsumer(groupId?: string): Promise<void> {
    try {
      this.consumer = this.kafka.consumer({
        groupId: groupId || process.env.KAFKA_GROUP_ID || 'admin-management-consumer-group',
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });

      await this.consumer.connect();
      logger.info('Kafka consumer connected successfully');
    } catch (error) {
      logger.error('Failed to connect Kafka consumer', { error });
      throw error;
    }
  }

  /**
   * Publish an event to the event bus
   */
  async publish(event: AdminDomainEvent): Promise<void> {
    if (!this.producer) {
      throw new Error('Producer not initialized. Call initProducer() first.');
    }

    const topic = this.getTopicForEventType(event.type);

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: event.correlationId,
            value: JSON.stringify({
              ...event,
              timestamp: event.timestamp.toISOString(),
            }),
            headers: {
              'event-type': event.type,
              'correlation-id': event.correlationId,
              'actor-id': event.actorId,
            },
          },
        ],
      });

      logger.info('Event published successfully', {
        type: event.type,
        correlationId: event.correlationId,
        topic,
      });
    } catch (error) {
      logger.error('Failed to publish event', {
        type: event.type,
        correlationId: event.correlationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Subscribe to events of specific types
   */
  async subscribe(
    eventTypes: AdminEventType[],
    handler: (event: AdminDomainEvent) => Promise<void>
  ): Promise<void> {
    if (!this.consumer) {
      throw new Error('Consumer not initialized. Call initConsumer() first.');
    }

    const topics = eventTypes.map(type => this.getTopicForEventType(type));

    // Subscribe to topics
    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
    }

    // Store handler for each event type
    eventTypes.forEach(type => {
      this.messageHandlers.set(type, handler);
    });

    // Start consuming messages
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        await this.handleMessage(topic, partition, message);
      },
    });

    logger.info('Subscribed to event types', { eventTypes, topics });
  }

  /**
   * Handle incoming Kafka messages
   */
  private async handleMessage(
    topic: string,
    partition: number,
    message: KafkaMessage
  ): Promise<void> {
    try {
      const eventType = message.headers?.['event-type']?.toString();
      const correlationId = message.headers?.['correlation-id']?.toString();

      if (!eventType || !message.value) {
        logger.warn('Received message without event type or value', { topic, partition });
        return;
      }

      const event = JSON.parse(message.value.toString()) as AdminDomainEvent;

      // Convert timestamp string back to Date
      if (typeof event.timestamp === 'string') {
        event.timestamp = new Date(event.timestamp);
      }

      const handler = this.messageHandlers.get(eventType);

      if (handler) {
        logger.info('Processing event', { eventType, correlationId, topic, partition });
        await handler(event);
        logger.info('Event processed successfully', { eventType, correlationId });
      } else {
        logger.warn('No handler registered for event type', { eventType });
      }
    } catch (error) {
      logger.error('Error processing message', {
        topic,
        partition,
        offset: message.offset,
        error,
      });
      // Note: In production, you might want to send failed messages to a dead-letter queue
      throw error;
    }
  }

  /**
   * Get Kafka topic name for an event type
   */
  private getTopicForEventType(eventType: AdminEventType): string {
    // Map event types to Kafka topics
    // You can customize this mapping based on your requirements
    const topicMap: Record<string, string> = {
      [AdminEventType.USER_STATUS_UPDATED]: 'admin-user-events',
      [AdminEventType.PORTER_VERIFIED]: 'admin-porter-events',
      [AdminEventType.PORTER_VERIFICATION_REJECTED]: 'admin-porter-events',
      [AdminEventType.PROMO_CODE_CREATED]: 'admin-promo-events',
      [AdminEventType.PROMO_CODE_UPDATED]: 'admin-promo-events',
      [AdminEventType.PROMO_CODE_DISABLED]: 'admin-promo-events',
      [AdminEventType.VEHICLE_TYPE_CREATED]: 'admin-vehicle-type-events',
      [AdminEventType.VEHICLE_TYPE_UPDATED]: 'admin-vehicle-type-events',
      [AdminEventType.VEHICLE_TYPE_DELETED]: 'admin-vehicle-type-events',
      [AdminEventType.ORDER_UPDATED]: 'admin-order-events',
      [AdminEventType.PLATFORM_SETTING_UPDATED]: 'admin-platform-events',
    };

    return topicMap[eventType] || 'admin-events';
  }

  /**
   * Disconnect producer and consumer
   */
  async disconnect(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        logger.info('Kafka producer disconnected');
      }
      if (this.consumer) {
        await this.consumer.disconnect();
        logger.info('Kafka consumer disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting from Kafka', { error });
      throw error;
    }
  }
}

// Singleton instance
export const eventBus = new EventBus();
