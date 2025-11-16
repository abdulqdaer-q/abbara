/**
 * Jest test setup
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_bidding';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.KAFKA_BROKERS = 'localhost:9092';
process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-long';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Global test timeout
jest.setTimeout(10000);

// Mock external dependencies if needed
// jest.mock('../src/lib/kafka');
