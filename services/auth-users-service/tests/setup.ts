// Test setup file
// This file runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-12345678901234567890';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-12345678901234567890';
process.env.JWT_ALGORITHM = 'HS256'; // Use HS256 for tests (RS256 requires RSA keys)
process.env.KAFKA_BROKERS = 'localhost:9092';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
