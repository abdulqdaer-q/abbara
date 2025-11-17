import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';
import { config } from '../config';
import { logger } from '../lib/logger';
import { KafkaMessage } from '../types';

export type MessageHandler = (message: KafkaMessage) => Promise<void>;

export class KafkaService {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private isConnected: boolean = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({
      groupId: config.kafka.groupId,
      sessionTimeout: config.kafka.sessionTimeout,
      heartbeatInterval: config.kafka.heartbeatInterval,
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      await this.consumer.connect();
      this.isConnected = true;
      logger.info('Kafka connected', {
        brokers: config.kafka.brokers,
        clientId: config.kafka.clientId,
      });
    } catch (error) {
      logger.error('Failed to connect to Kafka', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Subscribe to topics and start consuming
   */
  async subscribe(): Promise<void> {
    const topics = [
      config.topics.orderEvents,
      config.topics.porterEvents,
      config.topics.notificationEvents,
      config.topics.chatEvents,
    ];

    try {
      for (const topic of topics) {
        await this.consumer.subscribe({ topic, fromBeginning: false });
        logger.info('Subscribed to Kafka topic', { topic });
      }

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });

      logger.info('Kafka consumer started');
    } catch (error) {
      logger.error('Failed to subscribe to Kafka topics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle incoming Kafka message
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      if (!message.value) {
        logger.warn('Received empty Kafka message', { topic, partition });
        return;
      }

      const kafkaMessage: KafkaMessage = JSON.parse(message.value.toString());

      // Get handlers for this message type
      const handlers = this.handlers.get(kafkaMessage.type) || [];

      // Execute all handlers
      await Promise.all(
        handlers.map(async (handler) => {
          try {
            await handler(kafkaMessage);
          } catch (error) {
            logger.error('Kafka message handler error', {
              type: kafkaMessage.type,
              error: error instanceof Error ? error.message : 'Unknown error',
              correlationId: kafkaMessage.correlationId,
            });
          }
        })
      );
    } catch (error) {
      logger.error('Failed to process Kafka message', {
        topic,
        partition,
        offset: message.offset,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Register a handler for a specific message type
   */
  onMessage(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
    logger.debug('Registered Kafka message handler', { type });
  }

  /**
   * Publish a message to Kafka
   */
  async publish(topic: string, message: KafkaMessage): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Kafka not connected, message not published', {
        topic,
        type: message.type,
      });
      return;
    }

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            value: JSON.stringify(message),
            key: message.correlationId,
          },
        ],
      });

      logger.debug('Published message to Kafka', {
        topic,
        type: message.type,
        correlationId: message.correlationId,
      });
    } catch (error) {
      logger.error('Failed to publish to Kafka', {
        topic,
        type: message.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    try {
      await this.consumer.disconnect();
      await this.producer.disconnect();
      this.isConnected = false;
      logger.info('Kafka disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Kafka', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected;
  }
}

export const kafkaService = new KafkaService();
