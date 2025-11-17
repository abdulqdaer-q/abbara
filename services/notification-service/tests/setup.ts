// Test setup file
// This file runs before all tests

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3005';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/notification_service_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
process.env.EVENT_QUEUE_NAME = 'test.events';
process.env.EMAIL_ENABLED = 'false';
process.env.SMS_ENABLED = 'false';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.MAX_RETRY_ATTEMPTS = '3';
process.env.RETRY_BACKOFF_MS = '1000';
process.env.NOTIFICATION_BATCH_SIZE = '100';
process.env.RATE_LIMIT_PER_USER_PER_MINUTE = '10';
process.env.DEDUPLICATION_WINDOW_SECONDS = '300';
process.env.MESSAGE_RETENTION_DAYS = '90';
process.env.AUDIT_LOG_RETENTION_DAYS = '365';
process.env.HEALTH_CHECK_INTERVAL_MS = '30000';

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
