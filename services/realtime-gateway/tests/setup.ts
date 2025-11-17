// Test setup file
// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_SOCKET_SECRET = 'test-socket-secret';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.KAFKA_BROKERS = 'localhost:9092';
process.env.LOG_LEVEL = 'error';

// Mock Redis to avoid connection issues in tests
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      scard: jest.fn().mockResolvedValue(0),
      expire: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      publish: jest.fn().mockResolvedValue(1),
      subscribe: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    };
  });
});

// Mock Kafka to avoid connection issues in tests
jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn().mockImplementation(() => {
      return {
        producer: jest.fn().mockReturnValue({
          connect: jest.fn().mockResolvedValue(undefined),
          send: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn().mockResolvedValue(undefined),
        }),
        consumer: jest.fn().mockReturnValue({
          connect: jest.fn().mockResolvedValue(undefined),
          subscribe: jest.fn().mockResolvedValue(undefined),
          run: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn().mockResolvedValue(undefined),
        }),
      };
    }),
  };
});
