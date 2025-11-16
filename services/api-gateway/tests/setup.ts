/**
 * Jest test setup
 * Configures global test environment
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3999';
process.env.HOST = '0.0.0.0';
process.env.CORS_ORIGIN = 'http://localhost:3001';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.AUTH_SERVICE_URL = 'http://localhost:4001/trpc';
process.env.ORDERS_SERVICE_URL = 'http://localhost:4002/trpc';
process.env.PRICING_SERVICE_URL = 'http://localhost:4003/trpc';
process.env.PORTERS_SERVICE_URL = 'http://localhost:4004/trpc';
process.env.PAYMENTS_SERVICE_URL = 'http://localhost:4005/trpc';
process.env.NOTIFICATIONS_SERVICE_URL = 'http://localhost:4006/trpc';
process.env.REALTIME_SERVICE_URL = 'http://localhost:4007';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
process.env.SERVICE_NAME = 'api-gateway-test';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging test failures
};
