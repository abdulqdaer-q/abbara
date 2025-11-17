# Porters Service

Production-ready microservice for managing porter accounts, verification, availability, job acceptance, earnings, and location tracking in the MoveNow platform.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [API Procedures](#api-procedures)
- [Workflows](#workflows)
- [Event System](#event-system)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

The Porters Service is a resilient, secure, and scalable microservice that handles all porter-related operations including:

- **Profile Management**: Porter registration, profile updates, vehicle information
- **Verification Workflow**: Document submission, verification status tracking, admin approval/rejection
- **Availability Management**: Real-time online/offline status, scheduled availability windows
- **Job Acceptance Flow**: Race-safe job offer handling with atomic acceptance, expiry management
- **Location Tracking**: High-frequency location updates with Redis caching and periodic snapshots
- **Earnings & Withdrawals**: Earnings aggregation, transaction history, withdrawal requests
- **Device Management**: Push token registration, socket mapping for realtime features
- **Admin Operations**: Porter suspension, verification approval, status management

## Features

### Core Capabilities

- ✅ **Race-Safe Job Acceptance**: Optimistic locking with database transactions to handle concurrent acceptance attempts
- ✅ **Low-Latency Availability**: Redis-backed online/offline state queryable in <100ms
- ✅ **High-Volume Location Updates**: Rate-limited location streaming with Redis storage and periodic DB snapshots
- ✅ **Idempotent Operations**: Built-in idempotency key support for critical mutations
- ✅ **Event-Driven Architecture**: Publishes domain events to Kafka for system-wide integration
- ✅ **Comprehensive Metrics**: Prometheus metrics for availability, offers, earnings, and performance
- ✅ **Type-Safe RPC**: tRPC procedures with Zod validation and TypeScript end-to-end type safety

### Security

- 🔒 JWT authentication with role-based access control
- 🔒 Porter-only and admin-only procedure enforcement
- 🔒 Rate limiting on high-frequency endpoints (location updates)
- 🔒 Audit logging for all state-changing operations
- 🔒 Document metadata storage (no full documents in service)

### Scalability & Resilience

- 📈 Horizontal pod autoscaling based on CPU/memory
- 📈 Redis clustering for session/availability state
- 📈 Database read replicas for analytics queries
- 📈 Background job processing with BullMQ
- 📈 Graceful shutdown and health checks

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway / Client                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ tRPC / HTTP
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Porters Service                           │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐  │
│  │   tRPC     │  │   Auth     │  │   Rate Limiter      │  │
│  │  Router    │─▶│ Middleware │─▶│                     │  │
│  └────────────┘  └────────────┘  └─────────────────────┘  │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Service Layer                           │   │
│  │  • Availability  • Location  • JobOffer             │   │
│  │  • Earnings      • DeviceSession                     │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Postgres │  │  Redis   │  │  Kafka   │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
                      │ Events
                      ▼
         ┌────────────────────────────┐
         │  Realtime Gateway          │
         │  Notifications Service     │
         │  Orders Service            │
         │  Wallets Service           │
         └────────────────────────────┘
```

### Data Flows

**Availability State**:
- Redis (primary): Current online status, last seen, location
- Database: Scheduled availability windows
- Queryable in <100ms

**Location Updates**:
- Redis: Last-known location (1-hour TTL)
- Database: Periodic snapshots every 60 seconds for audit
- 90-day retention policy

**Job Offers**:
- Database: All offer records with optimistic locking
- Transaction-based acceptance for race safety
- Background job expires offers every 10 seconds

## Technology Stack

- **Runtime**: Node.js 18+ with TypeScript
- **RPC Framework**: tRPC 10.x
- **Validation**: Zod
- **Database**: PostgreSQL 15 with Prisma ORM
- **Cache/Session**: Redis 7
- **Message Broker**: Kafka (or RabbitMQ)
- **Background Jobs**: BullMQ
- **Metrics**: Prometheus (prom-client)
- **Logging**: Winston
- **Testing**: Jest with supertest

## Environment Variables

### Server Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment (development/production/test) | `development` | No |
| `PORT` | HTTP server port | `4002` | No |
| `SERVICE_NAME` | Service identifier | `porters-service` | No |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` | No |

### Database

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `DATABASE_REPLICA_URL` | Read replica connection string | No |

### Redis

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | No |
| `REDIS_SESSION_DB` | DB index for sessions | `0` | No |
| `REDIS_AVAILABILITY_DB` | DB index for availability | `1` | No |
| `REDIS_LOCATION_DB` | DB index for location | `2` | No |

### Kafka / Message Broker

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `KAFKA_BROKERS` | Comma-separated broker list | `localhost:9092` | No |
| `KAFKA_CLIENT_ID` | Kafka client identifier | `porters-service` | No |
| `KAFKA_GROUP_ID` | Consumer group ID | `porters-service-group` | No |
| `KAFKA_TOPIC_PREFIX` | Topic namespace prefix | `movenow` | No |

### Authentication

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret key for JWT verification | Yes |
| `JWT_ISSUER` | Expected JWT issuer | No |
| `JWT_AUDIENCE` | Expected JWT audience | No |

### External Services

| Variable | Description | Required |
|----------|-------------|----------|
| `FILES_SERVICE_URL` | Files service base URL | No |
| `WALLETS_SERVICE_URL` | Wallets service base URL | No |
| `NOTIFICATIONS_SERVICE_URL` | Notifications service base URL | No |
| `AUTH_SERVICE_URL` | Auth service base URL | No |

### Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `LOCATION_UPDATE_RATE_LIMIT` | Max location updates per window | `10` |
| `LOCATION_UPDATE_WINDOW_SECONDS` | Rate limit window | `1` |
| `JOB_OFFER_TIMEOUT_SECONDS` | Offer expiration time | `30` |
| `MAX_CONCURRENT_OFFERS_PER_PORTER` | Max pending offers | `3` |
| `AVAILABILITY_CACHE_TTL_SECONDS` | Availability cache TTL | `300` |
| `LOCATION_SNAPSHOT_INTERVAL_SECONDS` | DB snapshot frequency | `60` |
| `LOCATION_HISTORY_RETENTION_DAYS` | Location history retention | `90` |

### Metrics & Observability

| Variable | Description | Default |
|----------|-------------|---------|
| `METRICS_PORT` | Prometheus metrics port | `9090` |
| `CORS_ORIGIN` | CORS allowed origin | `*` |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- PostgreSQL 15+
- Redis 7+
- Kafka (or Redpanda for local dev)

### Local Development

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

3. **Start dependencies with Docker Compose**:
   ```bash
   docker-compose up -d postgres redis kafka
   ```

4. **Run database migrations**:
   ```bash
   pnpm prisma migrate dev
   ```

5. **Generate Prisma client**:
   ```bash
   pnpm prisma generate
   ```

6. **Start the service**:
   ```bash
   pnpm dev
   ```

   The service will be available at:
   - tRPC API: `http://localhost:4002/trpc`
   - Health check: `http://localhost:4002/health`
   - Metrics: `http://localhost:9090/metrics`

### Using Docker Compose (Recommended)

```bash
# Start all services (Postgres, Redis, Kafka, Porters Service)
docker-compose up

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f porters-service

# Stop all services
docker-compose down
```

## API Procedures

### Porter Procedures

#### `registerPorterProfile`
Create initial porter profile with vehicle information.

**Input**:
```typescript
{
  firstName: string
  lastName: string
  phone: string
  email: string
  vehicleType: 'sedan' | 'suv' | 'van' | 'truck' | 'motorcycle' | 'bicycle'
  vehicleModel?: string
  vehiclePlate?: string
  vehicleColor?: string
  vehicleCapacity?: number // default: 2
}
```

**Authorization**: Porter role required
**Idempotent**: No (use conflict detection)

---

#### `submitVerificationDocuments`
Upload document metadata for verification.

**Input**:
```typescript
{
  porterId: string
  documents: Array<{
    type: string // 'license', 'registration', 'insurance', etc.
    url: string // Signed URL from files-service
    hash?: string
  }>
}
```

**Authorization**: Must own porter profile
**Events**: Publishes `PorterVerificationRequested`

---

#### `getVerificationStatus`
Query current verification state and history.

**Input**:
```typescript
{
  porterId: string
}
```

**Authorization**: Must own porter profile

---

#### `setAvailability`
Set online/offline status (low-latency, Redis-backed).

**Input**:
```typescript
{
  porterId: string
  online: boolean
  location?: { lat: number, lng: number }
}
```

**Authorization**: Must own porter profile
**Events**: Publishes `PorterOnline` or `PorterOffline`

---

#### `getAvailability`
Query porter's current availability.

**Input**:
```typescript
{
  porterId: string
}
```

**Returns**:
```typescript
{
  online: boolean
  lastSeen: string (ISO timestamp)
  location?: { lat: number, lng: number }
}
```

---

#### `listNearbyPorters`
Find porters within a radius.

**Input**:
```typescript
{
  lat: number
  lng: number
  radiusMeters: number // 100-50000, default: 5000
  onlineOnly?: boolean // default: true
}
```

**Authorization**: Authenticated
**Returns**: Array of nearby porter profiles with distance

---

#### `acceptJob`
Accept a job offer (race-safe, idempotent).

**Input**:
```typescript
{
  offerId: string
  porterId: string
  idempotencyKey?: string
}
```

**Authorization**: Must own porter profile
**Idempotent**: Yes (via idempotencyKey)
**Events**: Publishes `PorterAcceptedJob`
**Race Handling**: Optimistic locking with transaction

---

#### `rejectJob`
Reject a job offer.

**Input**:
```typescript
{
  offerId: string
  porterId: string
  reason?: string
}
```

**Authorization**: Must own porter profile
**Events**: Publishes `PorterRejectedJob`

---

#### `updateLocation`
Update porter's current location.

**Input**:
```typescript
{
  porterId: string
  lat: number
  lng: number
  accuracy?: number
  orderId?: string
}
```

**Authorization**: Must own porter profile
**Rate Limit**: 10 requests per second (configurable)
**Events**: Publishes `PorterLocationUpdated`

---

#### `getEarningsSummary`
Get earnings summary and recent transactions.

**Input**:
```typescript
{
  porterId: string
}
```

**Authorization**: Must own porter profile

---

#### `requestWithdrawal`
Request payout/withdrawal.

**Input**:
```typescript
{
  porterId: string
  amountCents: bigint
  idempotencyKey?: string
}
```

**Authorization**: Must own porter profile
**Idempotent**: Yes (via idempotencyKey)

---

#### `getPorterProfile`
Get porter profile (public fields).

**Input**:
```typescript
{
  porterId: string
}
```

**Authorization**: Authenticated

---

### Admin Procedures

#### `adminSuspendPorter`
Suspend a porter account.

**Input**:
```typescript
{
  porterId: string
  reason: string
}
```

**Authorization**: Admin role required
**Events**: Publishes `PorterSuspended`

---

#### `adminUnsuspendPorter`
Unsuspend a porter account.

**Input**:
```typescript
{
  porterId: string
}
```

**Authorization**: Admin role required
**Events**: Publishes `PorterUnsuspended`

---

#### `adminVerifyPorter`
Approve porter verification.

**Input**:
```typescript
{
  porterId: string
  notes?: string
}
```

**Authorization**: Admin role required
**Events**: Publishes `PorterVerified`

---

#### `adminRejectVerification`
Reject porter verification.

**Input**:
```typescript
{
  porterId: string
  reason: string
  notes?: string
}
```

**Authorization**: Admin role required
**Events**: Publishes `PorterVerificationRejected`

---

## Workflows

### Porter Onboarding Flow

```
┌─────────────┐
│   Porter    │
│  Registers  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ registerPorterProfile   │  ─────► PorterRegistered event
│ (pending verification)  │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ submitVerification      │  ─────► PorterVerificationRequested event
│   Documents             │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Admin/Automated Review  │
└──────┬──────────────────┘
       │
       ├─── Approved ───► PorterVerified event
       │                  (Porter can go online)
       │
       └─── Rejected ───► PorterVerificationRejected event
                          (Porter must resubmit)
```

### Availability & Job Offering Flow

```
┌─────────────┐
│   Porter    │
│ Goes Online │  ─────► setAvailability(online: true)
└──────┬──────┘         ─────► PorterOnline event
       │                       Redis: porter:online set updated
       ▼
┌──────────────────────┐
│ Orders/Matching Svc  │
│ Queries nearby       │ ◄──── listNearbyPorters (Redis)
│ porters              │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Create Job Offers    │  ─────► PorterOfferCreated events
│ for selected porters │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Realtime Gateway     │  ─────► Socket emit to porters
│ Notifications Svc    │  ─────► Push notifications
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Porter accepts or    │  ◄──── acceptJob / rejectJob
│ rejects offer        │
└──────┬───────────────┘
       │
       ├─── Accept ───► PorterAcceptedJob event
       │                Other offers revoked
       │                Assignment confirmed
       │
       └─── Reject ───► PorterRejectedJob event
```

### Job Acceptance Race Condition Handling

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Porter1 │  │ Porter2 │  │ Porter3 │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     │◄───────────┴────────────┘ (All receive same offer)
     │
     ├───► acceptJob (START TRANSACTION)
     │     ├─ Lock offer row
     │     ├─ Check status = PENDING ✓
     │     ├─ Check not expired ✓
     │     ├─ Check no existing assignment ✓
     │     ├─ UPDATE status = ACCEPTED
     │     └─ COMMIT ✓ (Porter1 WINS)
     │
     ├───► acceptJob (START TRANSACTION)
     │     ├─ Lock offer row (waits...)
     │     ├─ Check status = PENDING ✗ (already ACCEPTED)
     │     └─ ROLLBACK + CONFLICT error (Porter2 LOSES)
     │
     └───► acceptJob (START TRANSACTION)
           ├─ Lock offer row (waits...)
           ├─ Check status = PENDING ✗ (already ACCEPTED)
           └─ ROLLBACK + CONFLICT error (Porter3 LOSES)

Result: Exactly ONE successful acceptance
Metrics: Race condition counter incremented (won=1, lost=2)
```

### Location Tracking Flow

```
┌─────────────┐
│   Porter    │
│ (on mobile) │
└──────┬──────┘
       │
       │ (High frequency: every 1-5 seconds)
       ▼
┌──────────────────────┐
│ updateLocation       │
└──────┬───────────────┘
       │
       ├─ Rate Limit Check (10/sec)
       │
       ▼
┌──────────────────────┐
│ Redis Write          │  ──► porter:location:{porterId}
│ (immediate)          │       TTL: 1 hour
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ DB Snapshot?         │
│ (every 60 seconds)   │  ──► LocationHistory table
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Publish Event        │  ──► PorterLocationUpdated event
└──────────────────────┘       (consumed by Orders/Tracking)
```

### Earnings & Withdrawal Flow

```
┌─────────────────┐
│ Order Completed │  ─────► OrderCompleted event
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Event Consumer          │
│ (porters-service)       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Record Earnings         │  ──► PorterEarnings table
│ (type: JOB_PAYMENT)     │       status: PENDING
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Update Porter Stats     │  ──► totalEarningsCents
│                         │       completedJobsCount++
└─────────────────────────┘

         (Later...)

┌─────────────────────────┐
│ Porter requests         │  ◄──── requestWithdrawal
│ withdrawal              │         (idempotent)
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Call Wallets Service    │  ─────► Payout request
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ PaymentPayoutProcessed  │  ◄──── Event from Wallets
│ event consumed          │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Update payout status    │  ──► status: PAID_OUT
│                         │       payoutAt: timestamp
└─────────────────────────┘
```

## Event System

### Events Published

| Event Type | When | Payload |
|------------|------|---------|
| `PorterRegistered` | New porter profile created | porterId, userId, vehicleType |
| `PorterVerificationRequested` | Documents submitted | porterId, userId |
| `PorterVerified` | Admin approves verification | porterId, userId, verifiedBy |
| `PorterVerificationRejected` | Admin rejects verification | porterId, userId, reason |
| `PorterOnline` | Porter goes online | porterId, userId, location? |
| `PorterOffline` | Porter goes offline | porterId, userId |
| `PorterLocationUpdated` | Location update received | porterId, userId, lat, lng, orderId? |
| `PorterOfferCreated` | Job offer created | offerId, orderId, porterId, expiresAt |
| `PorterOfferExpired` | Offer expired | offerId, orderId, porterId |
| `PorterAcceptedJob` | Porter accepts offer | offerId, orderId, porterId, userId |
| `PorterRejectedJob` | Porter rejects offer | offerId, orderId, porterId, reason? |
| `PorterCompletedJob` | Job completed | orderId, porterId, userId, earningsCents |
| `PorterSuspended` | Admin suspends porter | porterId, userId, suspendedBy, reason |
| `PorterUnsuspended` | Admin unsuspends porter | porterId, userId, unsuspendedBy |

### Events Consumed

| Event Type | Source | Action |
|------------|--------|--------|
| `OrderAssigned` | Orders Service | Update porter assignment state |
| `OrderCompleted` | Orders Service | Record earnings, increment job count |
| `PaymentPayoutProcessed` | Wallets Service | Update withdrawal status |

## Testing

### Run All Tests

```bash
pnpm test
```

### Unit Tests

```bash
pnpm test:unit
```

### Integration Tests

```bash
# Requires running Postgres and Redis
pnpm test:integration
```

### Coverage Report

```bash
pnpm test:coverage
```

### Test Structure

- `tests/unit/`: Service layer unit tests (mocked dependencies)
- `tests/integration/`: End-to-end workflow tests (real DB/Redis)
- `tests/integration/raceConditions.test.ts`: Concurrent acceptance tests

## Deployment

### Build Docker Image

```bash
docker build -t movenow/porters-service:latest .
```

### Deploy to Kubernetes

```bash
# Apply configurations
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy service
kubectl apply -f k8s/deployment.yaml

# Check rollout status
kubectl rollout status deployment/porters-service
```

### Run Database Migrations

```bash
# In production, run migrations before deployment
kubectl exec -it deployment/porters-service -- pnpm prisma migrate deploy
```

## Monitoring

### Metrics Endpoints

- **Prometheus**: `http://localhost:9090/metrics`
- **Health Check**: `http://localhost:4002/health`
- **Readiness**: `http://localhost:4002/health/ready`
- **Liveness**: `http://localhost:4002/health/live`

### Key Metrics

| Metric | Description | Type |
|--------|-------------|------|
| `porters_online_total` | Current number of online porters | Gauge |
| `porters_offers_created_total` | Total job offers created | Counter |
| `porters_offers_accepted_total` | Total offers accepted | Counter |
| `porters_offers_rejected_total` | Total offers rejected | Counter |
| `porters_offers_expired_total` | Total offers expired | Counter |
| `porters_accept_rate` | Ratio of accepted/total offers | Gauge |
| `porters_location_updates_total` | Total location updates | Counter |
| `porters_location_update_latency_seconds` | Location update latency | Histogram |
| `porters_race_conditions_total` | Race conditions detected (won/lost) | Counter |
| `porters_rpc_requests_total` | RPC requests by procedure and status | Counter |
| `porters_rpc_duration_seconds` | RPC duration by procedure | Histogram |

### Grafana Dashboards

Recommended dashboard panels:

1. **Availability**: Online porters count over time
2. **Offers**: Created/accepted/rejected/expired rates
3. **Location Updates**: Update frequency and latency p50/p95/p99
4. **Race Conditions**: Won vs lost race conditions
5. **RPC Performance**: Request rate, error rate, latency percentiles

## Troubleshooting

### Race Conditions

**Symptom**: Multiple porters accepting the same job

**Diagnosis**:
```bash
# Check race condition metrics
curl http://localhost:9090/metrics | grep race_conditions

# Check database locks
SELECT * FROM pg_locks WHERE relation = 'JobOffer'::regclass;
```

**Solution**:
- Verify transaction isolation level is READ COMMITTED or higher
- Check database connection pool settings
- Review `jobOfferService.acceptOffer` transaction logic

---

### High Latency on Availability Queries

**Symptom**: `getAvailability` taking >100ms

**Diagnosis**:
```bash
# Check Redis latency
redis-cli --latency

# Check Redis connection pool
redis-cli client list
```

**Solution**:
- Verify Redis cluster health
- Check network latency between service and Redis
- Review Redis key expiration policies (TTL=3600)

---

### Location Updates Rejected

**Symptom**: `TOO_MANY_REQUESTS` errors on `updateLocation`

**Diagnosis**:
```bash
# Check rate limit keys in Redis
redis-cli --scan --pattern "ratelimit:location:*"

# Check remaining requests
redis-cli GET "ratelimit:location:{porterId}"
```

**Solution**:
- Adjust `LOCATION_UPDATE_RATE_LIMIT` (default: 10/sec)
- Adjust `LOCATION_UPDATE_WINDOW_SECONDS` (default: 1)
- Implement client-side throttling

---

### Offers Not Expiring

**Symptom**: Pending offers older than timeout seconds

**Diagnosis**:
```bash
# Check BullMQ job queue
redis-cli KEYS "bull:periodic-jobs:*"

# Check background worker logs
docker logs porters-service | grep "expire-offers"
```

**Solution**:
- Verify BullMQ worker is running
- Check `JOB_OFFER_TIMEOUT_SECONDS` configuration
- Review `jobs/expiryJobs.ts` schedule (default: every 10 seconds)

---

### Event Publishing Failures

**Symptom**: Events not appearing in Kafka topics

**Diagnosis**:
```bash
# Check Kafka connectivity
kafka-console-consumer --bootstrap-server localhost:9092 --topic movenow.porter-online --from-beginning

# Check service logs
docker logs porters-service | grep "Failed to publish event"
```

**Solution**:
- Verify `KAFKA_BROKERS` configuration
- Check Kafka cluster health
- Review Kafka ACLs and authentication
- Events are logged but service continues on publish failures (no blocking)

---

### Database Migration Issues

**Symptom**: Prisma client errors or schema mismatches

**Diagnosis**:
```bash
# Check migration status
pnpm prisma migrate status

# Check current schema
pnpm prisma db pull
```

**Solution**:
```bash
# Reset database (DEV ONLY - DESTRUCTIVE)
pnpm prisma migrate reset

# Apply pending migrations
pnpm prisma migrate deploy

# Regenerate Prisma client
pnpm prisma generate
```

---

### Idempotency Key Conflicts

**Symptom**: Cached responses for operations that should execute again

**Diagnosis**:
```sql
-- Check idempotency records
SELECT * FROM IdempotencyRecord WHERE idempotencyKey = 'key-here';
```

**Solution**:
- Idempotency records expire after 24 hours by default
- Use unique idempotency keys per logical operation
- Run cleanup job: calls `cleanupExpiredIdempotencyRecords()` hourly

---

## Contributing

1. Create feature branch from `develop`
2. Make changes with tests
3. Ensure all tests pass: `pnpm test`
4. Ensure linting passes: `pnpm lint`
5. Submit pull request

## License

MIT License - MoveNow Team

---

**Service Version**: 1.0.0
**Last Updated**: 2024
**Support**: [GitHub Issues](https://github.com/movenow/abbara/issues)
