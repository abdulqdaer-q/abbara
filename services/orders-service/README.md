# Orders Service

Production-ready Orders Service for the MoveNow platform. This service is the source of truth for order lifecycle management, handling order creation, assignment, status transitions, cancellations, multi-stop orders, and event publishing for downstream consumers.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Order Lifecycle](#order-lifecycle)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Event Schemas](#event-schemas)
- [Deployment](#deployment)
- [Testing](#testing)
- [Observability](#observability)
- [Troubleshooting](#troubleshooting)

## Features

- **Complete Order Lifecycle Management**: Create, assign, track, complete, and cancel orders
- **Multi-Stop Support**: Handle complex routes with multiple pickup and dropoff locations
- **Porter Assignment**: Direct assignment, offer-based, and bidding strategies
- **Event-Driven Architecture**: Publishes lifecycle events to Kafka for downstream consumers
- **Idempotency**: All mutating operations support idempotency keys to prevent duplicates
- **Concurrency Control**: Optimistic locking to handle concurrent updates safely
- **Audit Trail**: Immutable event log for every order state change
- **Evidence Management**: Support for pre/post-move photos and documentation
- **Real-time Updates**: Integration with realtime-gateway for socket emissions
- **Admin Tools**: Override capabilities and dispute resolution
- **Observability**: Prometheus metrics, structured logging, health checks
- **Security**: JWT authentication, role-based access control

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Orders Service                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   tRPC API   │───▶│  Middleware  │───▶│   Routers    │     │
│  │   Gateway    │    │              │    │              │     │
│  └──────────────┘    │ - Auth       │    │ - Orders     │     │
│                       │ - Idempotency│    │ - Assignments│     │
│                       │ - Logging    │    │ - Waypoints  │     │
│                       └──────────────┘    │ - Evidence   │     │
│                                            │ - Admin      │     │
│                                            └──────────────┘     │
│                                                     │            │
│                       ┌─────────────────────────────┘            │
│                       ▼                                          │
│         ┌────────────────────────────┐                          │
│         │    Business Logic Layer    │                          │
│         │  (Services & Validations)  │                          │
│         └────────────────────────────┘                          │
│                       │                                          │
│         ┌─────────────┼──────────────┐                          │
│         ▼             ▼              ▼                          │
│  ┌───────────┐ ┌───────────┐ ┌────────────┐                   │
│  │  Prisma   │ │   Kafka   │ │   Redis    │                   │
│  │ (Postgres)│ │ (Events)  │ │(Idempotency)                   │
│  └───────────┘ └───────────┘ └────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### External Dependencies

- **PostgreSQL**: Primary database with PostGIS for geo queries
- **Redis**: Idempotency key storage and caching
- **Kafka**: Event publishing for downstream services
- **Pricing Service**: Synchronous pricing calculations
- **Payments Service**: Payment capture and refund triggers

## Order Lifecycle

### State Diagram

```
                 ┌──────────┐
                 │ CREATED  │
                 └────┬─────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
  ┌──────────┐  ┌─────────┐  ┌──────────┐
  │TENTATIVELY│  │ASSIGNED │  │CANCELLED │
  │ ASSIGNED  │  └────┬────┘  └──────────┘
  └─────┬─────┘       │
        │             │
        └──────┬──────┘
               ▼
         ┌──────────┐
         │ ACCEPTED │
         └────┬─────┘
              │
              ▼
         ┌──────────┐
         │ ARRIVED  │
         └────┬─────┘
              │
              ▼
         ┌──────────┐
         │  LOADED  │
         └────┬─────┘
              │
              ▼
         ┌──────────┐
         │ EN_ROUTE │
         └────┬─────┘
              │
              ▼
         ┌──────────┐
         │DELIVERED │
         └────┬─────┘
              │
              ▼
         ┌──────────┐
         │COMPLETED │
         └────┬─────┘
              │
              ▼
         ┌──────────┐
         │  CLOSED  │
         └──────────┘
```

### Key Flows

#### 1. Create Order Flow

```
Customer → API Gateway → Orders Service
                             │
                             ▼
                    Validate Input (Zod)
                             │
                             ▼
                    Call Pricing Service
                             │
                             ▼
                    Begin Transaction:
                      - Create Order
                      - Create Stops
                      - Create Items
                      - Create Pricing Snapshot
                      - Record Audit Event
                             │
                             ▼
                    Publish OrderCreated Event → Kafka
                             │
                             ▼
                    Return Order ID to Customer
```

#### 2. Assignment & Acceptance Flow

```
System/Admin → assignPorters(strategy: 'offer')
                      │
                      ▼
              Create Assignments
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
    Porter A Offered         Porter B Offered
          │                       │
          ▼                       ▼
    Publish PorterOffered Events
          │                       │
    ┌─────┴───────────────────────┴─────┐
    │   Notifications/Realtime Gateway  │
    └─────┬───────────────────────┬─────┘
          ▼                       ▼
    Porter A Views          Porter B Views
          │                       │
          ▼                       │
    acceptOffer()                 │
          │                       │
          ▼                       ▼
    RACE CONDITION              Waiting...
          │                       │
          ▼                       │
    Transaction:                  │
    - Update Assignment (ACCEPTED)│
    - Revoke Other Offers ────────┤
    - Update Order Status         │
          │                       ▼
          ▼                 PorterOfferExpired
    Publish Events               Event
```

#### 3. Status Progression & Completion

```
Porter → changeStatus(ARRIVED)
              │
              ▼
        Validate Transition
              │
              ▼
        Update Order Status
              │
              ▼
        Record Audit Event
              │
              ▼
        Publish OrderStatusChanged
              │
              ▼
        Notify Realtime Gateway
              │
              ▼
        Customer Sees Update

... (LOADED → EN_ROUTE → DELIVERED → COMPLETED)

On COMPLETED:
  → Publish OrderCompleted Event
  → Trigger Payments Service (capture)
  → Trigger Analytics
```

#### 4. Cancellation & Refunds

```
Customer/Porter → cancelOrder()
                       │
                       ▼
                 Check Order Status
                       │
                       ▼
              Calculate Cancellation Fee
              (based on current status)
                       │
                       ▼
              Begin Transaction:
                - Update Order (CANCELLED)
                - Record Cancellation Event
                       │
                       ▼
              Publish OrderCancelled Event
                       │
              ┌────────┴────────┐
              ▼                 ▼
      Payments Service    Notifications
      (process refund)    (notify parties)
```

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **RPC Framework**: tRPC 10
- **Database**: PostgreSQL 15 with Prisma ORM
- **Geo Support**: PostGIS extension
- **Message Broker**: Kafka (KafkaJS)
- **Caching**: Redis (ioredis)
- **Validation**: Zod
- **Logging**: Winston
- **Metrics**: Prometheus (prom-client)
- **Testing**: Jest
- **Containerization**: Docker
- **Orchestration**: Kubernetes

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Docker & Docker Compose
- PostgreSQL 15 (with PostGIS)
- Redis
- Kafka

### Local Development Setup

1. **Clone the repository**:
   ```bash
   cd services/orders-service
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. **Start infrastructure with Docker Compose**:
   ```bash
   docker-compose up -d postgres redis kafka
   ```

5. **Run database migrations**:
   ```bash
   pnpm run prisma:migrate
   ```

6. **Generate Prisma client**:
   ```bash
   pnpm run prisma:generate
   ```

7. **Start the service in development mode**:
   ```bash
   pnpm run dev
   ```

8. **Verify the service is running**:
   ```bash
   curl http://localhost:4001/health
   ```

### Using Docker Compose (Full Stack)

To run the entire stack including the service:

```bash
docker-compose up
```

This will start:
- Orders Service
- PostgreSQL with PostGIS
- Redis
- Kafka with Zookeeper

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment (development/production) | `development` | No |
| `PORT` | HTTP server port | `4001` | No |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` | No |
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | No |
| `KAFKA_BROKERS` | Comma-separated Kafka brokers | `localhost:9092` | No |
| `KAFKA_CLIENT_ID` | Kafka client identifier | `orders-service` | No |
| `KAFKA_GROUP_ID` | Kafka consumer group ID | `orders-service-group` | No |
| `PRICING_SERVICE_URL` | Pricing service tRPC endpoint | - | Yes |
| `PAYMENTS_SERVICE_URL` | Payments service tRPC endpoint | - | Yes |
| `IDEMPOTENCY_TTL_SECONDS` | Idempotency key TTL | `86400` | No |
| `METRICS_PORT` | Prometheus metrics port | `9090` | No |
| `CORS_ORIGIN` | CORS allowed origin | `*` | No |
| `JWT_SECRET` | JWT signing secret | - | Yes |

## API Documentation

### tRPC Procedures

#### Orders Router

**`orders.create`**
- **Input**: `CreateOrderInput`
- **Output**: Order ID, status, price
- **Auth**: Customer required
- **Idempotent**: Yes

**`orders.get`**
- **Input**: Order ID, requesting user
- **Output**: Full order details
- **Auth**: Customer/Porter/Admin
- **Idempotent**: No

**`orders.list`**
- **Input**: Filters (customer ID, porter ID, status, date range), pagination
- **Output**: Paginated order list
- **Auth**: Required
- **Idempotent**: No

**`orders.update`**
- **Input**: Order ID, updated fields
- **Output**: Updated order
- **Auth**: Customer/Admin
- **Idempotent**: Yes

**`orders.cancel`**
- **Input**: Order ID, reason, cancelled by
- **Output**: Cancellation details, refund info
- **Auth**: Customer/Porter/Admin
- **Idempotent**: Yes

**`orders.changeStatus`**
- **Input**: Order ID, new status, actor, location
- **Output**: Updated status, timeline
- **Auth**: Porter/Admin
- **Idempotent**: Yes

#### Assignments Router

**`assignments.assignPorters`**
- **Input**: Order ID, strategy, porter IDs, options
- **Output**: Assignment results
- **Auth**: Admin/System
- **Idempotent**: Yes

**`assignments.acceptOffer`**
- **Input**: Order ID, porter ID
- **Output**: Acceptance confirmation
- **Auth**: Porter required
- **Idempotent**: Yes

**`assignments.rejectOffer`**
- **Input**: Order ID, porter ID, reason
- **Output**: Rejection confirmation
- **Auth**: Porter required
- **Idempotent**: Yes

#### Waypoints Router

**`waypoints.updateStatus`**
- **Input**: Waypoint ID, new status, porter ID
- **Output**: Updated waypoint
- **Auth**: Porter required
- **Idempotent**: Yes

#### Evidence Router

**`evidence.create`**
- **Input**: Order ID, type, URL, metadata
- **Output**: Evidence ID
- **Auth**: Porter required
- **Idempotent**: Yes

#### Admin Router

**`admin.overrideOrder`**
- **Input**: Order ID, action, reason
- **Output**: Override result
- **Auth**: Admin required
- **Idempotent**: Yes

**`admin.getAuditTrail`**
- **Input**: Order ID
- **Output**: List of audit events
- **Auth**: Admin required
- **Idempotent**: No

**`admin.getStatistics`**
- **Input**: Date range
- **Output**: Order statistics
- **Auth**: Admin required
- **Idempotent**: No

## Event Schemas

All events published to Kafka conform to strongly-typed schemas defined in `@movenow/common`.

### Published Events

- `order.created` - When a new order is created
- `order.updated` - When order fields are modified
- `order.assigned` - When porters are assigned to an order
- `porter.offered` - When an offer is sent to a porter
- `porter.offer.expired` - When a porter offer expires
- `order.status.changed` - When order status transitions
- `order.cancelled` - When an order is cancelled
- `order.completed` - When an order is completed
- `waypoint.status.changed` - When a waypoint status updates
- `evidence.uploaded` - When evidence is uploaded

### Event Consumers

The following services consume order events:
- **Notifications Service**: Sends push/SMS/email notifications
- **Realtime Gateway**: Emits socket updates to connected clients
- **Payments Service**: Captures payments on completion
- **Analytics Service**: Tracks metrics and generates reports
- **Admin Service**: Updates dashboards and alerts
- **Fraud Service**: Monitors for suspicious activity

## Deployment

### Docker Build

```bash
docker build -t movenow/orders-service:latest .
```

### Kubernetes Deployment

1. Create secrets:
```bash
kubectl create secret generic orders-service-secrets \
  --from-literal=database-url='postgresql://...' \
  --from-literal=jwt-secret='your-secret'
```

2. Apply ConfigMap:
```bash
kubectl apply -f k8s/configmap.yaml
```

3. Deploy the service:
```bash
kubectl apply -f k8s/deployment.yaml
```

4. Verify deployment:
```bash
kubectl get pods -l app=orders-service
kubectl logs -l app=orders-service
```

### Scaling

The service includes a Horizontal Pod Autoscaler (HPA) that scales based on CPU and memory utilization:

```yaml
minReplicas: 3
maxReplicas: 10
targetCPUUtilization: 70%
targetMemoryUtilization: 80%
```

## Testing

### Run Unit Tests

```bash
pnpm run test
```

### Run Integration Tests

```bash
pnpm run test tests/integration
```

### Run with Coverage

```bash
pnpm run test:coverage
```

### Test Coverage Thresholds

- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## Observability

### Health Checks

- **Liveness**: `GET /health` - Checks database, Redis, and Kafka connectivity
- **Readiness**: `GET /ready` - Checks if service is ready to accept traffic

### Metrics

Prometheus metrics available at `GET /metrics`:

**Order Metrics**:
- `orders_created_total` - Total orders created
- `orders_status_changed_total` - Status transition counts
- `orders_cancelled_total` - Cancelled order counts
- `orders_completed_total` - Completed order counts

**Assignment Metrics**:
- `porter_assignments_total` - Assignment counts by strategy
- `porter_offer_acceptance_seconds` - Time to accept offers

**Event Metrics**:
- `events_published_total` - Published event counts
- `event_publish_duration_seconds` - Event publishing latency

**Procedure Metrics**:
- `procedure_calls_total` - tRPC procedure call counts
- `procedure_duration_seconds` - Procedure execution time

**Idempotency Metrics**:
- `idempotency_hits_total` - Idempotency key cache hits

### Logging

Structured JSON logs with correlation IDs for request tracing:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Procedure called",
  "service": "orders-service",
  "correlationId": "abc123",
  "path": "orders.create",
  "userId": "customer-123"
}
```

### Tracing

All critical flows include distributed tracing context via correlation IDs.

## Troubleshooting

### Event Replay

To replay events from the audit trail:

1. Query the `order_events` table for the order:
```sql
SELECT * FROM order_events WHERE order_id = 'order-123' ORDER BY created_at ASC;
```

2. Re-publish events using the admin tools or custom scripts

### Inspecting Idempotency Keys

Check Redis for stored idempotency responses:

```bash
redis-cli GET "idempotency:your-key-here"
```

### Database Connection Pooling

The service uses Prisma's connection pooling. Monitor active connections:

```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'movenow_orders';
```

### Kafka Consumer Lag

Monitor consumer lag to ensure events are being processed:

```bash
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --describe --group orders-service-group
```

### Common Issues

**Issue**: Order creation fails with pricing error
- **Solution**: Verify Pricing Service is accessible and responding

**Issue**: Events not publishing to Kafka
- **Solution**: Check Kafka broker connectivity and topic configuration

**Issue**: Idempotency keys not working
- **Solution**: Verify Redis is connected and TTL is set correctly

**Issue**: Concurrent modification errors
- **Solution**: This is expected behavior; clients should retry with exponential backoff

## Contributing

1. Follow the existing code structure and naming conventions
2. Write tests for new features
3. Update this README for significant changes
4. Ensure all tests pass before committing
5. Use conventional commit messages

## License

MIT
