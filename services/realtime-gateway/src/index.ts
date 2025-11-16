import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from './config';
import { logger } from './lib/logger';
import { redisService } from './services/redis.service';
import { kafkaService } from './services/kafka.service';
import { metricsService } from './services/metrics.service';
import { authMiddleware } from './middleware/auth';
import { AuthHandler } from './handlers/auth.handler';
import { LocationHandler } from './handlers/location.handler';
import { OrderHandler } from './handlers/order.handler';
import { JobOfferHandler } from './handlers/jobOffer.handler';
import { ChatHandler } from './handlers/chat.handler';
import { SocketEvent, EventType } from '@movenow/common';
import { AuthenticatedSocket, SocketNamespace } from './types';

/**
 * Bootstrap the Realtime Gateway server
 */
async function bootstrap() {
  const app = express();
  const httpServer = createServer(app);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: config.server.env === 'production',
  }));

  // CORS configuration
  app.use(cors({
    origin: config.server.corsOrigin,
    credentials: true,
  }));

  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: config.serviceName,
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe
  app.get('/ready', async (req, res) => {
    try {
      const redisConnected = await redisService.isUserOnline('health-check');
      const kafkaConnected = kafkaService.isReady();

      if (kafkaConnected) {
        res.json({
          status: 'ready',
          service: config.serviceName,
          timestamp: new Date().toISOString(),
          dependencies: {
            redis: true,
            kafka: kafkaConnected,
          },
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          message: 'Kafka not connected',
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      const metrics = await metricsService.getMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Initialize Socket.IO with Redis adapter
  const io = new Server(httpServer, {
    cors: {
      origin: config.server.corsOrigin,
      credentials: true,
    },
    maxHttpBufferSize: config.performance.maxPayloadSize,
    pingTimeout: config.performance.pingTimeout,
    pingInterval: config.performance.pingInterval,
    transports: ['websocket', 'polling'],
  });

  // Set up Redis adapter for horizontal scaling
  const redisClients = redisService.getClients();
  const adapter = createAdapter(redisClients.publisher, redisClients.subscriber);
  io.adapter(adapter);

  logger.info('Socket.IO Redis adapter configured');

  // Initialize handlers
  const authHandler = new AuthHandler(io);
  const locationHandler = new LocationHandler(io);
  const orderHandler = new OrderHandler(io);
  const jobOfferHandler = new JobOfferHandler(io);
  const chatHandler = new ChatHandler(io);

  // Set up namespaces with authentication
  const clientNamespace = io.of(SocketNamespace.CLIENT);
  const porterNamespace = io.of(SocketNamespace.PORTER);
  const adminNamespace = io.of(SocketNamespace.ADMIN);

  // Apply authentication middleware to all namespaces
  clientNamespace.use(authMiddleware);
  porterNamespace.use(authMiddleware);
  adminNamespace.use(authMiddleware);

  // Client namespace handlers
  clientNamespace.on('connection', async (socket: AuthenticatedSocket) => {
    await authHandler.handleConnection(socket);

    // Order subscriptions
    socket.on(SocketEvent.SUBSCRIBE_ORDER, (payload) =>
      orderHandler.handleSubscribe(socket, payload)
    );

    socket.on(SocketEvent.UNSUBSCRIBE_ORDER, (payload) =>
      orderHandler.handleUnsubscribe(socket, payload)
    );

    // Chat
    socket.on(SocketEvent.CHAT_MESSAGE_SEND, (payload) =>
      chatHandler.handleChatMessage(socket, payload)
    );

    socket.on(SocketEvent.CHAT_TYPING_START, (payload) =>
      chatHandler.handleTypingStart(socket, payload)
    );

    socket.on(SocketEvent.CHAT_TYPING_STOP, (payload) =>
      chatHandler.handleTypingStop(socket, payload)
    );

    // Heartbeat
    socket.on(SocketEvent.HEARTBEAT, (payload) =>
      authHandler.handleHeartbeat(socket, payload)
    );

    // Reconnect
    socket.on(SocketEvent.RECONNECT, (payload) =>
      authHandler.handleReconnect(socket, payload)
    );

    // Disconnect
    socket.on('disconnect', (reason) =>
      authHandler.handleDisconnection(socket, reason)
    );
  });

  // Porter namespace handlers
  porterNamespace.on('connection', async (socket: AuthenticatedSocket) => {
    await authHandler.handleConnection(socket);

    // Location updates
    socket.on(SocketEvent.LOCATION_UPDATE, (payload) =>
      locationHandler.handleLocationUpdate(socket, payload)
    );

    // Order subscriptions
    socket.on(SocketEvent.SUBSCRIBE_ORDER, (payload) =>
      orderHandler.handleSubscribe(socket, payload)
    );

    socket.on(SocketEvent.UNSUBSCRIBE_ORDER, (payload) =>
      orderHandler.handleUnsubscribe(socket, payload)
    );

    // Job offers
    socket.on(SocketEvent.JOB_OFFER_ACCEPT, (payload) =>
      jobOfferHandler.handleAcceptOffer(socket, payload)
    );

    socket.on(SocketEvent.JOB_OFFER_REJECT, (payload) =>
      jobOfferHandler.handleRejectOffer(socket, payload)
    );

    // Chat
    socket.on(SocketEvent.CHAT_MESSAGE_SEND, (payload) =>
      chatHandler.handleChatMessage(socket, payload)
    );

    socket.on(SocketEvent.CHAT_TYPING_START, (payload) =>
      chatHandler.handleTypingStart(socket, payload)
    );

    socket.on(SocketEvent.CHAT_TYPING_STOP, (payload) =>
      chatHandler.handleTypingStop(socket, payload)
    );

    // Heartbeat
    socket.on(SocketEvent.HEARTBEAT, (payload) =>
      authHandler.handleHeartbeat(socket, payload)
    );

    // Reconnect
    socket.on(SocketEvent.RECONNECT, (payload) =>
      authHandler.handleReconnect(socket, payload)
    );

    // Disconnect
    socket.on('disconnect', (reason) =>
      authHandler.handleDisconnection(socket, reason)
    );
  });

  // Admin namespace handlers
  adminNamespace.on('connection', async (socket: AuthenticatedSocket) => {
    await authHandler.handleConnection(socket);

    // Admins can subscribe to any order
    socket.on(SocketEvent.SUBSCRIBE_ORDER, (payload) =>
      orderHandler.handleSubscribe(socket, payload)
    );

    socket.on(SocketEvent.UNSUBSCRIBE_ORDER, (payload) =>
      orderHandler.handleUnsubscribe(socket, payload)
    );

    // Heartbeat
    socket.on(SocketEvent.HEARTBEAT, (payload) =>
      authHandler.handleHeartbeat(socket, payload)
    );

    // Disconnect
    socket.on('disconnect', (reason) =>
      authHandler.handleDisconnection(socket, reason)
    );
  });

  // Connect to Kafka and subscribe to topics
  await kafkaService.connect();
  await kafkaService.subscribe();

  // Register Kafka event handlers
  kafkaService.onMessage(EventType.ORDER_CREATED, async (message) => {
    logger.info('Order created event received', {
      correlationId: message.correlationId,
    });
    // Could broadcast to admin dashboard
  });

  kafkaService.onMessage(EventType.ORDER_CONFIRMED, async (message) => {
    logger.info('Order confirmed event received', {
      correlationId: message.correlationId,
    });
  });

  kafkaService.onMessage(EventType.ORDER_ASSIGNED, async (message) => {
    logger.info('Order assigned event received', {
      correlationId: message.correlationId,
    });
    // Broadcast status change to subscribed clients
    await orderHandler.broadcastStatusChange({
      orderId: message.payload.orderId,
      status: 'assigned',
      timestamp: message.timestamp,
    });
  });

  kafkaService.onMessage(EventType.ORDER_STARTED, async (message) => {
    await orderHandler.broadcastStatusChange({
      orderId: message.payload.orderId,
      status: 'in_progress',
      timestamp: message.timestamp,
    });
  });

  kafkaService.onMessage(EventType.ORDER_COMPLETED, async (message) => {
    await orderHandler.broadcastStatusChange({
      orderId: message.payload.orderId,
      status: 'completed',
      timestamp: message.timestamp,
    });
  });

  kafkaService.onMessage(EventType.ORDER_CANCELLED, async (message) => {
    await orderHandler.broadcastStatusChange({
      orderId: message.payload.orderId,
      status: 'cancelled',
      timestamp: message.timestamp,
    });
  });

  // Custom job offer event from Porter service
  kafkaService.onMessage('job.offer.created', async (message) => {
    await jobOfferHandler.sendJobOffer(
      message.payload.porterId,
      message.payload.offer
    );
  });

  logger.info('Kafka event handlers registered');

  // Start HTTP server
  httpServer.listen(config.server.port, config.server.host, () => {
    logger.info('Realtime Gateway started', {
      env: config.server.env,
      host: config.server.host,
      port: config.server.port,
      corsOrigin: config.server.corsOrigin,
    });

    logger.info('Available endpoints', {
      health: `http://${config.server.host}:${config.server.port}/health`,
      ready: `http://${config.server.host}:${config.server.port}/ready`,
      metrics: `http://${config.server.host}:${config.server.port}/metrics`,
      client: `ws://${config.server.host}:${config.server.port}${SocketNamespace.CLIENT}`,
      porter: `ws://${config.server.host}:${config.server.port}${SocketNamespace.PORTER}`,
      admin: `ws://${config.server.host}:${config.server.port}${SocketNamespace.ADMIN}`,
    });
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');

    // Close Socket.IO server
    io.close(() => {
      logger.info('Socket.IO server closed');
    });

    // Disconnect from Kafka
    await kafkaService.disconnect();

    // Disconnect from Redis
    await redisService.disconnect();

    // Close HTTP server
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Start the server
bootstrap().catch((error) => {
  logger.error('Failed to start server', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
