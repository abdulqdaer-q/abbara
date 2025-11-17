# Orders Service Test Suite

Comprehensive test suite for the Orders Service covering unit tests, integration tests, and contract tests.

## Test Structure

```
tests/
├── setup.ts                          # Global test setup and teardown
├── unit/                             # Unit tests for business logic
│   ├── orderService.test.ts          # Order service functions (status transitions, access control)
│   └── errors.test.ts                # Error classes and tRPC error conversion
├── integration/                      # Integration tests with database
│   ├── createOrder.test.ts           # Legacy order creation test
│   ├── orders.test.ts                # Order CRUD operations
│   ├── assignments.test.ts           # Porter assignment workflows
│   └── waypoints-evidence.test.ts    # Waypoint tracking and evidence uploads
└── contract/                         # Contract tests for event schemas
    └── events.test.ts                # Event schema validation tests
```

## Test Categories

### Unit Tests (tests/unit/)

**Purpose**: Test individual functions and business logic in isolation

**Coverage**:
- `orderService.test.ts` (60+ tests)
  - Status transition validation (15+ cases)
  - Access control verification
  - Authorization logic
- `errors.test.ts` (15+ tests)
  - Error class creation
  - tRPC error conversion
  - Error message formatting

**Key Features**:
- Mocked dependencies (Prisma, Kafka, Redis)
- Fast execution
- Tests pure business logic

### Integration Tests (tests/integration/)

**Purpose**: Test complete workflows with real database interactions

**Coverage**:
- `orders.test.ts` (20+ tests)
  - Order creation with stops, items, pricing
  - Order updates with optimistic locking
  - Order cancellation
  - Idempotency enforcement
  - Multi-stop order handling
- `assignments.test.ts` (25+ tests)
  - Direct porter assignment
  - Offer-based assignment workflow
  - Multi-porter assignments
  - Offer acceptance/rejection
  - Assignment race conditions
  - Earnings tracking
- `waypoints-evidence.test.ts` (25+ tests)
  - Waypoint status tracking
  - Multi-stop routing
  - Evidence uploads (pre-move, post-move, damage, signature)
  - Complete order lifecycle with waypoints and evidence

**Key Features**:
- Real Prisma database operations
- Mocked external services (Kafka, Redis)
- Transaction testing
- Concurrency testing

### Contract Tests (tests/contract/)

**Purpose**: Validate event schemas conform to published contracts

**Coverage**:
- `events.test.ts` (30+ tests)
  - OrderCreatedEvent schema validation
  - OrderUpdatedEvent schema validation
  - OrderAssignedEvent schema validation
  - PorterOfferedEvent schema validation
  - OrderStatusChangedEvent schema validation
  - OrderCancelledEvent schema validation
  - OrderCompletedEvent schema validation
  - WaypointStatusChangedEvent schema validation
  - EvidenceUploadedEvent schema validation
  - Event type enum validation

**Key Features**:
- Zod schema validation
- Positive and negative test cases
- Required vs optional field testing
- Event type safety

## Running Tests

### Run All Tests
```bash
pnpm test
```

### Run Specific Test Suite
```bash
# Unit tests only
pnpm test -- tests/unit

# Integration tests only
pnpm test -- tests/integration

# Contract tests only
pnpm test -- tests/contract
```

### Run Specific Test File
```bash
pnpm test -- tests/unit/orderService.test.ts
```

### Run with Coverage
```bash
pnpm test:coverage
```

### Watch Mode
```bash
pnpm test:watch
```

## Coverage Requirements

The test suite maintains the following coverage thresholds:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## Test Data Cleanup

All tests use the global setup in `tests/setup.ts` which:
- Connects to test database before all tests
- Cleans up all tables after each test
- Disconnects from database after all tests

This ensures:
- Tests are isolated from each other
- No data pollution between tests
- Clean state for every test

## Mocking Strategy

### External Services
- **Kafka**: Mocked to prevent event publishing during tests
- **Redis**: Mocked for idempotency key storage
- **Prisma**: Real database for integration tests, mocked for unit tests

### Mock Implementations
```typescript
// Kafka mock
jest.mock('../../src/lib/kafka');
const mockKafka = {
  publishEvent: jest.fn().mockResolvedValue(undefined),
};
(getKafkaClient as jest.Mock).mockReturnValue(mockKafka);

// Redis mock
jest.mock('../../src/lib/redis');
const mockRedis = {
  getIdempotency: jest.fn().mockResolvedValue(null),
  setIdempotency: jest.fn().mockResolvedValue(undefined),
};
(getRedisClient as jest.Mock).mockReturnValue(mockRedis);
```

## Key Test Scenarios

### Order Lifecycle
1. Create order with stops and items
2. Assign porter(s)
3. Porter accepts assignment
4. Track waypoint progression
5. Upload evidence at each stage
6. Complete order

### Assignment Race Conditions
- Multiple porters racing to accept same offer
- Only first acceptance wins
- Others get revoked
- Unique constraint enforcement

### Optimistic Locking
- Version-based concurrency control
- Detect concurrent modifications
- Retry mechanism for conflicts

### Idempotency
- Duplicate request detection
- Cached response return
- TTL-based expiration

### Status Transitions
- Valid transition paths
- Invalid transition rejection
- Cancellation allowed states
- Terminal state enforcement

## Adding New Tests

When adding new features:

1. **Unit Test**: Add to appropriate file in `tests/unit/`
2. **Integration Test**: Add to appropriate file in `tests/integration/`
3. **Contract Test**: Add schema validation to `tests/contract/events.test.ts`

Example:
```typescript
// Unit test
describe('NewFeature', () => {
  it('should validate business logic', () => {
    // Test pure function
  });
});

// Integration test
it('should persist new feature to database', async () => {
  const result = await prisma.model.create({...});
  expect(result).toBeDefined();
});

// Contract test
it('should validate NewFeatureEvent schema', () => {
  const event = { ... };
  const result = NewFeatureEventSchema.safeParse(event);
  expect(result.success).toBe(true);
});
```

## Test Performance

- **Unit tests**: ~500ms (fast, no I/O)
- **Integration tests**: ~5-10s (database operations)
- **Contract tests**: ~1s (schema validation)
- **Total suite**: ~15-20s

## Continuous Integration

Tests run automatically on:
- Every commit push
- Pull request creation
- Pull request updates

CI Requirements:
- All tests must pass
- Coverage thresholds must be met
- No failing assertions
- No unhandled promise rejections
