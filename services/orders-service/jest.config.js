module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Run tests serially to avoid database conflicts
  maxWorkers: 1,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/lib/kafka.ts',
    '!src/lib/redis.ts',
    '!src/lib/logger.ts',
    '!src/lib/prisma.ts',
    '!src/lib/metrics.ts',
    '!src/lib/correlation.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 35,
      lines: 50,
      statements: 50,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
