import { Kafka, Producer, ProducerRecord, logLevel } from 'kafkajs';
import { logger } from './logger';
import { OrderEvent } from '@movenow/common';

interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
}

class KafkaClient {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private connected = false;

  constructor(config: KafkaConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 300,
        retries: 8,
        maxRetryTime: 30000,
        multiplier: 2,
      },
    });
  }

  /**
   * Connect to Kafka and initialize producer
   */
  async connect(): Promise<void> {
    if (this.connected) {
      logger.warn('Kafka client already connected');
      return;
    }

    try {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
      });

      await this.producer.connect();
      this.connected = true;
      logger.info('Kafka producer connected successfully');
    } catch (error) {
      logger.error('Failed to connect Kafka producer', { error });
      throw new Error('Kafka connection failed');
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (!this.producer || !this.connected) {
      return;
    }

    try {
      await this.producer.disconnect();
      this.connected = false;
      logger.info('Kafka producer disconnected');
    } catch (error) {
      logger.error('Error disconnecting Kafka producer', { error });
      throw error;
    }
  }

  /**
   * Publish an order event to Kafka
   */
  async publishEvent(event: OrderEvent, topic = 'order-events'): Promise<void> {
    if (!this.producer || !this.connected) {
      throw new Error('Kafka producer not connected');
    }

    try {
      const message: ProducerRecord = {
        topic,
        messages: [
          {
            key: event.type,
            value: JSON.stringify(event),
            timestamp: new Date(event.timestamp).getTime().toString(),
            headers: {
              correlationId: event.correlationId,
              eventType: event.type,
            },
          },
        ],
      };

      await this.producer.send(message);

      logger.info('Event published to Kafka', {
        topic,
        eventType: event.type,
        correlationId: event.correlationId,
      });
    } catch (error) {
      logger.error('Failed to publish event to Kafka', {
        topic,
        eventType: event.type,
        error,
      });
      throw new Error('Event publishing failed');
    }
  }

  /**
   * Publish multiple events in a batch
   */
  async publishEventsBatch(
    events: OrderEvent[],
    topic = 'order-events'
  ): Promise<void> {
    if (!this.producer || !this.connected) {
      throw new Error('Kafka producer not connected');
    }

    if (events.length === 0) {
      return;
    }

    try {
      const messages = events.map((event) => ({
        key: event.type,
        value: JSON.stringify(event),
        timestamp: new Date(event.timestamp).getTime().toString(),
        headers: {
          correlationId: event.correlationId,
          eventType: event.type,
        },
      }));

      await this.producer.send({
        topic,
        messages,
      });

      logger.info('Events batch published to Kafka', {
        topic,
        count: events.length,
      });
    } catch (error) {
      logger.error('Failed to publish events batch to Kafka', {
        topic,
        count: events.length,
        error,
      });
      throw new Error('Event batch publishing failed');
    }
  }

  /**
   * Health check
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance
let kafkaClient: KafkaClient | null = null;

export const initKafka = (config: KafkaConfig): KafkaClient => {
  if (!kafkaClient) {
    kafkaClient = new KafkaClient(config);
  }
  return kafkaClient;
};

export const getKafkaClient = (): KafkaClient => {
  if (!kafkaClient) {
    throw new Error('Kafka client not initialized. Call initKafka first.');
  }
  return kafkaClient;
};

export { KafkaClient };
