import { config } from '../src/lib/config';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/movenow_admin_test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only-32-chars-minimum';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock logger in tests
jest.mock('../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Clean up after all tests
afterAll(async () => {
  // Add any global cleanup here
});
