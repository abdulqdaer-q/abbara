import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import { Logger } from 'winston';
import { config } from '../config';
import { EventType } from '@movenow/common';
import { handleOrderEvent } from './handlers/orderEventHandler';
import { handleBidEvent } from './handlers/bidEventHandler';
import { handlePaymentEvent } from './handlers/paymentEventHandler';
import { handlePorterEvent } from './handlers/porterEventHandler';
import { PrismaClient } from '@prisma/client';

export class EventConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected: boolean = false;

  constructor(
    private db: PrismaClient,
    private logger: Logger
  ) {}

  /**
   * Connect to RabbitMQ and start consuming events
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to RabbitMQ...');

      this.connection = await amqp.connect(config.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Assert queue exists
      await this.channel.assertQueue(config.eventQueueName, {
        durable: true,
      });

      // Set prefetch to process one message at a time
      await this.channel.prefetch(1);

      this.isConnected = true;
      this.logger.info('Connected to RabbitMQ successfully');

      // Start consuming messages
      await this.startConsuming();

      // Handle connection errors
      this.connection.on('error', (error) => {
        this.logger.error('RabbitMQ connection error:', error);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          void this.connect();
        }, 5000);
      });
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ:', error);
      this.isConnected = false;
      // Retry connection after 5 seconds
      setTimeout(() => {
        void this.connect();
      }, 5000);
    }
  }

  /**
   * Start consuming messages from the queue
   */
  private async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    this.logger.info(`Starting to consume messages from queue: ${config.eventQueueName}`);

    await this.channel.consume(
      config.eventQueueName,
      async (msg) => {
        if (msg) {
          await this.handleMessage(msg);
        }
      },
      { noAck: false }
    );
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    if (!this.channel) {
      return;
    }

    try {
      const content = msg.content.toString();
      const event = JSON.parse(content);

      this.logger.info('Received event', {
        type: event.type,
        correlationId: event.correlationId,
      });

      // Route event to appropriate handler
      await this.routeEvent(event);

      // Acknowledge message
      this.channel.ack(msg);

      this.logger.info('Event processed successfully', {
        type: event.type,
        correlationId: event.correlationId,
      });
    } catch (error) {
      this.logger.error('Failed to process event:', error);

      // Reject message and requeue for retry
      // In production, you might want to implement a dead-letter queue
      if (this.channel) {
        this.channel.nack(msg, false, true);
      }
    }
  }

  /**
   * Route event to appropriate handler based on event type
   */
  private async routeEvent(event: { type: string; [key: string]: unknown }): Promise<void> {
    switch (event.type) {
      // Order events
      case EventType.ORDER_CREATED:
      case EventType.ORDER_CONFIRMED:
      case EventType.ORDER_ASSIGNED:
      case EventType.ORDER_STARTED:
      case EventType.ORDER_COMPLETED:
      case EventType.ORDER_CANCELLED:
        await handleOrderEvent(event, this.db, this.logger);
        break;

      // Bid events
      case 'BID_RECEIVED':
      case 'BID_ACCEPTED':
      case 'BID_REJECTED':
        await handleBidEvent(event, this.db, this.logger);
        break;

      // Payment events
      case EventType.PAYMENT_COMPLETED:
      case 'PAYMENT_FAILED':
        await handlePaymentEvent(event, this.db, this.logger);
        break;

      // Porter events
      case EventType.PORTER_LOCATION_UPDATED:
      case 'PORTER_VERIFIED':
      case 'PORTER_ARRIVED':
        await handlePorterEvent(event, this.db, this.logger);
        break;

      default:
        this.logger.warn('Unknown event type', { type: event.type });
    }
  }

  /**
   * Disconnect from RabbitMQ
   */
  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.isConnected = false;
      this.logger.info('Disconnected from RabbitMQ');
    } catch (error) {
      this.logger.error('Error disconnecting from RabbitMQ:', error);
    }
  }

  /**
   * Check if consumer is connected
   */
  isReady(): boolean {
    return this.isConnected;
  }
}
