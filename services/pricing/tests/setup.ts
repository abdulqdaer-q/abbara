// Jest setup file
// This runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/movenow_pricing_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_API_KEY = 'test-admin-key';
process.env.MAPS_PROVIDER_ENABLED = 'false';
process.env.LOG_LEVEL = 'error';

// Mock external dependencies if needed
jest.setTimeout(10000);
