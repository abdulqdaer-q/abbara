import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { config } from '../config';
import { logger } from './logger';
import { DomainEvent } from '@movenow/common';

/**
 * Kafka client singleton
 */
let kafka: Kafka;
let producer: Producer;
let consumer: Consumer;

export function getKafkaClient(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: config.kafkaClientId,
      brokers: config.kafkaBrokers,
      retry: {
        retries: 5,
        initialRetryTime: 100,
        factor: 2,
      },
    });

    logger.info('Kafka client initialized', {
      clientId: config.kafkaClientId,
      brokers: config.kafkaBrokers,
    });
  }

  return kafka;
}

/**
 * Get Kafka producer
 */
export async function getKafkaProducer(): Promise<Producer> {
  if (!producer) {
    producer = getKafkaClient().producer({
      idempotent: true,
      maxInFlightRequests: 5,
      transactionalId: `${config.kafkaClientId}-producer`,
    });

    await producer.connect();
    logger.info('Kafka producer connected');
  }

  return producer;
}

/**
 * Get Kafka consumer
 */
export async function getKafkaConsumer(): Promise<Consumer> {
  if (!consumer) {
    consumer = getKafkaClient().consumer({
      groupId: config.kafkaGroupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    await consumer.connect();
    logger.info('Kafka consumer connected');
  }

  return consumer;
}

/**
 * Publish domain event to Kafka
 */
export async function publishEvent(event: DomainEvent): Promise<void> {
  const producer = await getKafkaProducer();

  const topic = `movenow.${event.type.replace(/\./g, '-')}`;
  const message = {
    key: event.correlationId,
    value: JSON.stringify(event),
    headers: {
      'event-type': event.type,
      'correlation-id': event.correlationId,
      timestamp: event.timestamp.toISOString(),
    },
  };

  try {
    await producer.send({
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
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Subscribe to events and process them
 */
export async function subscribeToEvents(
  topics: string[],
  handler: (payload: EachMessagePayload) => Promise<void>
): Promise<void> {
  const consumer = await getKafkaConsumer();

  await consumer.subscribe({
    topics,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async (payload) => {
      const { topic, partition, message } = payload;

      logger.debug('Processing event', {
        topic,
        partition,
        offset: message.offset,
      });

      try {
        await handler(payload);
      } catch (error) {
        logger.error('Error processing event', {
          topic,
          partition,
          offset: message.offset,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't rethrow - let Kafka handle retries via consumer groups
      }
    },
  });

  logger.info('Consumer subscribed to topics', { topics });
}

/**
 * Gracefully disconnect Kafka
 */
export async function disconnectKafka() {
  const promises: Promise<void>[] = [];

  if (producer) {
    promises.push(producer.disconnect());
  }

  if (consumer) {
    promises.push(consumer.disconnect());
  }

  await Promise.all(promises);
  logger.info('Kafka client disconnected');
}
