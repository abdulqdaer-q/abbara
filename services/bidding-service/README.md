# MoveNow Bidding Service

A robust, production-ready microservice for managing competitive bidding on moving jobs. Supports configurable bidding strategies, real-time bid evaluation, race-safe bid acceptance, and comprehensive event-driven integration with the MoveNow platform.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Development](#development)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Features

### Core Capabilities

- **Bidding Window Management**: Open and close competitive bidding sessions for orders
- **Bid Placement**: Accept bids from porters with validation and eligibility checks
- **Strategy-Based Evaluation**: Pluggable scoring strategies (price, ETA, rating, reliability, distance)
- **Race-Safe Bid Acceptance**: Distributed locking ensures only one bid is accepted per window
- **Automatic Expiry**: Scheduled job enforces bidding window timeouts
- **Idempotency**: All mutating operations support idempotency keys for safe retries
- **Real-time Events**: Publishes bid lifecycle events to Kafka for downstream processing
- **Event Consumption**: Reacts to order cancellations and porter suspensions
- **Observability**: Prometheus metrics, structured logging, distributed tracing

### Strategy Engine

The bidding service supports configurable scoring strategies with weighted parameters:

- **Weighted Score v1** (default): Balanced weighting across all factors
- **Price Focused**: Heavily favors lowest-price bids
- **Speed Focused**: Prioritizes fastest arrival times
- **Quality Focused**: Emphasizes highly-rated and reliable porters

Administrators can create custom strategies with different weight distributions.

## Architecture

### High-Level Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│   Clients   │─────▶│  API Gateway     │─────▶│   Bidding   │
│ (Customers, │◀─────│  (tRPC)          │◀─────│   Service   │
│  Porters)   │      └──────────────────┘      └──────┬──────┘
└─────────────┘                                        │
                                                       │
       ┌───────────────────────────────────────────────┼──────────┐
       │                                               │          │
       ▼                                               ▼          ▼
┌─────────────┐                                ┌───────────┐ ┌────────┐
│  PostgreSQL │                                │   Redis   │ │ Kafka  │
│  (Bids,     │                                │  (Locks,  │ │(Events)│
│   Windows)  │                                │   Cache)  │ │        │
└─────────────┘                                └───────────┘ └────────┘
```

### Bidding Flow Sequence

```
Customer          Bidding Service       Porter 1        Porter 2
   │                     │                  │               │
   │──openBiddingWindow─▶│                  │               │
   │                     │                  │               │
   │                     │───BidOpened─────▶│               │
   │                     │───BidOpened──────┼──────────────▶│
   │                     │                  │               │
   │                     │◀────placeBid─────│               │
   │                     │                  │               │
   │                     │◀────placeBid─────┼───────────────│
   │                     │                  │               │
   │────acceptBid(P1)───▶│                  │               │
   │                     │                  │               │
   │                     │─[Lock Acquired]─▶│               │
   │                     │─[Bid Accepted]──▶│               │
   │                     │─[Window Closed]─▶│               │
   │                     │─[Other Bids]────▶│               │
   │                     │─[Expired]────────┼──────────────▶│
   │                     │                  │               │
   │                     │───BidWinnerSelected─────────────▶Orders
   │                     │                                   Service
```

### Concurrency & Race Condition Handling

**Bid Acceptance Flow**:

1. Acquire distributed lock in Redis (`lock:accept:{windowId}`)
2. Start database transaction
3. Validate window status (must be OPEN)
4. Validate bid status (must be PLACED)
5. Atomically update bid to ACCEPTED
6. Close bidding window
7. Expire all other PLACED bids
8. Commit transaction
9. Release lock
10. Publish events (BidAccepted, BidWinnerSelected)

If lock acquisition fails or window is already closed, operation fails with CONFLICT error.

## Technology Stack

- **Runtime**: Node.js 18+ with TypeScript
- **RPC Framework**: tRPC 10.x
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache**: Redis 7+ (ioredis client)
- **Message Broker**: Kafka (kafkajs client)
- **Validation**: Zod
- **Logging**: Winston
- **Metrics**: Prometheus (prom-client)
- **Testing**: Jest with ts-jest
- **Containerization**: Docker with multi-stage builds

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker Compose)
- Redis 7+ (or use Docker Compose)
- Kafka 3+ (or use Docker Compose)

### Quick Start with Docker Compose

```bash
# Clone repository
cd services/bidding-service

# Start all infrastructure and service
docker-compose up -d

# View logs
docker-compose logs -f bidding-service

# Health check
curl http://localhost:3002/health

# Shutdown
docker-compose down
```

### Manual Setup

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Ensure DATABASE_URL, REDIS_URL, KAFKA_BROKERS, JWT_SECRET are set

# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate

# Seed database with default strategies
pnpm db:seed

# Start development server
pnpm dev
```

The service will start on `http://localhost:3002`.

## Development

### Project Structure

```
bidding-service/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Configuration with validation
│   ├── context.ts            # tRPC context
│   ├── trpc.ts               # tRPC setup and middleware
│   ├── lib/
│   │   ├── db.ts             # Prisma client
│   │   ├── redis.ts          # Redis client and locking
│   │   ├── kafka.ts          # Kafka producer/consumer
│   │   ├── logger.ts         # Winston logger
│   │   ├── metrics.ts        # Prometheus metrics
│   │   └── correlation.ts    # Request ID generation
│   ├── services/
│   │   ├── biddingService.ts # Core bidding logic
│   │   ├── strategyEngine.ts # Bid evaluation strategies
│   │   └── eventConsumer.ts  # Kafka event consumer
│   ├── routers/
│   │   ├── index.ts          # Main router
│   │   ├── bidding.ts        # Bidding procedures
│   │   └── strategy.ts       # Strategy management
│   ├── middleware/
│   │   └── auth.ts           # JWT authentication
│   └── jobs/
│       └── expiryJob.ts      # Scheduled expiry enforcement
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Database seeding
├── tests/
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
├── k8s/                      # Kubernetes manifests
├── Dockerfile                # Production Docker image
├── docker-compose.yml        # Local development stack
└── README.md
```

### Available Scripts

```bash
pnpm dev              # Start development server with hot reload
pnpm build            # Build TypeScript for production
pnpm start            # Start production server
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Generate coverage report
pnpm test:integration # Run integration tests only
pnpm lint             # Lint code with ESLint
pnpm type-check       # Type check without emitting
pnpm prisma:generate  # Generate Prisma client
pnpm prisma:migrate   # Run database migrations
pnpm prisma:studio    # Open Prisma Studio (DB GUI)
pnpm db:seed          # Seed database with default data
```

### Environment Variables

See `.env.example` for all configuration options. Key variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |
| `KAFKA_BROKERS` | Comma-separated Kafka brokers | Yes | - |
| `JWT_SECRET` | Secret for JWT verification (min 32 chars) | Yes | - |
| `PORT` | HTTP server port | No | 3002 |
| `DEFAULT_STRATEGY_ID` | Default bid evaluation strategy | No | weighted-score-v1 |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | No | info |

## API Documentation

### tRPC Procedures

#### `bidding.openBiddingWindow`

Open a new bidding window for orders.

**Input**:
```typescript
{
  orderIds: string[];
  biddingWindowDurationSec?: number; // Default: 300
  strategyId?: string;               // Default: weighted-score-v1
  minimumBidCents?: number;
  reservePriceCents?: number;
  allowedPorterFilters?: Record<string, any>;
  idempotencyKey: string;
}
```

**Output**: `BiddingWindow` object

**Auth**: Requires authenticated user (customer or admin)

#### `bidding.placeBid`

Place a bid on an open window.

**Input**:
```typescript
{
  biddingWindowId: string;
  amountCents: number;
  estimatedArrivalMinutes: number;
  metadata?: Record<string, any>;
  idempotencyKey: string;
}
```

**Output**: `{ bid: Bid, currentTopBid?: {...} }`

**Auth**: Requires authenticated porter

#### `bidding.acceptBid`

Accept a winning bid (race-safe).

**Input**:
```typescript
{
  biddingWindowId: string;
  bidId: string;
  idempotencyKey: string;
}
```

**Output**: `{ bid: Bid, window: BiddingWindow }`

**Auth**: Requires authenticated user (customer or admin)

#### `bidding.getActiveBidsForOrder`

Retrieve active bids for an order.

**Input**:
```typescript
{
  orderId: string;
  page?: number;      // Default: 1
  pageSize?: number;  // Default: 20
}
```

**Output**: Paginated list of bids

**Auth**: Requires authenticated user

#### `strategy.create`

Create a new bid evaluation strategy.

**Input**:
```typescript
{
  name: string;
  description: string;
  parameters: {
    priceWeight: number;       // 0-1
    etaWeight: number;         // 0-1
    ratingWeight: number;      // 0-1
    reliabilityWeight: number; // 0-1
    distanceWeight: number;    // 0-1
  }; // Must sum to 1.0
}
```

**Output**: `BidStrategy` object

**Auth**: Requires admin

### Events Published

The service publishes the following events to Kafka:

- `movenow.bid-opened`: Bidding window opened
- `movenow.bid-placed`: Bid placed by porter
- `movenow.bid-accepted`: Bid accepted
- `movenow.bid-winner-selected`: Winner selected for window
- `movenow.bid-expired`: Bidding window expired
- `movenow.bid-closed`: Bidding window closed
- `movenow.bid-cancelled`: Bid cancelled

### Events Consumed

The service consumes:

- `movenow.order-cancelled`: Cancels active bidding windows
- `movenow.porter-suspended`: Cancels bids from suspended porter
- `movenow.order-assigned`: Closes bidding windows for assigned orders

## Deployment

### Docker Build

```bash
docker build -t movenow/bidding-service:v1.0.0 .
```

### Kubernetes Deployment

```bash
# Create namespace
kubectl create namespace movenow

# Apply configuration and secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy service
kubectl apply -f k8s/deployment.yaml

# Verify deployment
kubectl get pods -n movenow -l app=bidding-service
kubectl logs -n movenow -l app=bidding-service --tail=100
```

### Environment-Specific Configuration

- **Development**: Use docker-compose.yml
- **Staging/Production**: Use Kubernetes manifests with appropriate ConfigMaps and Secrets

Horizontal Pod Autoscaling (HPA) is configured to scale from 3 to 10 replicas based on CPU/memory.

## Testing

### Unit Tests

```bash
pnpm test tests/unit
```

Tests cover:
- Strategy evaluation logic
- Bid scoring and ranking
- Normalization algorithms
- Preview simulations

### Integration Tests

```bash
# Requires running infrastructure (Postgres, Redis, Kafka)
docker-compose up -d postgres redis kafka

# Run tests
pnpm test:integration
```

Tests cover:
- Complete bidding flow (open → place → accept)
- Idempotency enforcement
- Validation rules
- Concurrency scenarios

### Load Testing

Use tools like `k6` or `artillery` to simulate high bid volumes:

```javascript
// Example k6 scenario
import http from 'k6/http';

export default function() {
  const payload = JSON.stringify({
    biddingWindowId: 'window-id',
    amountCents: 10000,
    estimatedArrivalMinutes: 30,
    idempotencyKey: `bid-${__VU}-${__ITER}`,
  });

  http.post('http://localhost:3002/trpc/bidding.placeBid', payload);
}
```

## Monitoring

### Health Endpoints

- `GET /health`: Liveness probe (returns 200 if service is running)
- `GET /ready`: Readiness probe (checks DB and Redis connectivity)
- `GET /metrics`: Prometheus metrics in text format

### Key Metrics

- `bidding_windows_total`: Total bidding windows created (labeled by status)
- `active_bidding_windows`: Current number of active windows
- `bids_total`: Total bids placed (labeled by status)
- `bid_acceptance_duration_seconds`: Time to accept a bid
- `time_to_first_bid_seconds`: Time from window open to first bid
- `lock_acquisition_attempts_total`: Lock acquisition attempts (success/failure)
- `events_published_total`: Events published to Kafka
- `db_query_duration_seconds`: Database query latency

### Logs

Structured JSON logs include:
- `correlationId`: Request tracing ID
- `userId`, `porterId`: Actor identifiers
- `biddingWindowId`, `bidId`: Resource identifiers
- `error`: Error messages and stack traces

## Troubleshooting

### Common Issues

#### Database Connection Failures

```
Error: P1001: Can't reach database server
```

**Solution**: Verify `DATABASE_URL` is correct and database is accessible.

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

#### Redis Connection Errors

```
Error: Redis connection refused
```

**Solution**: Ensure Redis is running and `REDIS_URL` is correct.

```bash
# Test Redis
redis-cli -u $REDIS_URL ping
```

#### Lock Contention

```
TRPCError: Another bid acceptance is in progress (CONFLICT)
```

**Explanation**: This is expected behavior when multiple bid acceptances are attempted concurrently. The first to acquire the lock succeeds; others fail safely.

**Solution**: Client should retry or inform user that bid was already accepted by another party.

#### Bidding Window Expired

```
TRPCError: Bidding window has expired (BAD_REQUEST)
```

**Solution**: The expiry job closed the window. This is normal behavior. Client should check window status before placing bids.

#### Kafka Consumer Lag

**Symptom**: Events not processed in time, high consumer lag

**Solution**:
1. Scale up consumer instances
2. Increase partition count on topics
3. Optimize event handler performance

```bash
# Check consumer lag
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group bidding-service-group --describe
```

### Logs Analysis

```bash
# View recent errors
docker-compose logs bidding-service | grep '"level":"error"'

# Follow logs for specific correlation ID
docker-compose logs -f bidding-service | grep "correlation-id-123"

# View metrics
curl http://localhost:3002/metrics | grep bidding_
```

## License

MIT

## Support

For issues or questions, contact the MoveNow Platform Team or open an issue in the repository.
