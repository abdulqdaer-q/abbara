import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/movenow_porters_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

// Increase timeout for integration tests
jest.setTimeout(10000);

export {};
