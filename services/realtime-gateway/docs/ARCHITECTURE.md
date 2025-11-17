# Realtime Gateway Architecture

## Overview

The Realtime Gateway is a horizontally scalable WebSocket service that provides real-time bidirectional communication between MoveNow clients (customers, porters, admins) and backend services.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
│                    (WebSocket Support)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
        ┌───────▼──────┐ ┌───▼──────┐ ┌───▼──────┐
        │  Gateway #1  │ │Gateway #2│ │Gateway #N│
        └───────┬──────┘ └────┬─────┘ └────┬─────┘
                │             │             │
                └─────────────┼─────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
        ┌───────▼──────┐ ┌───▼──────┐ ┌───▼──────┐
        │    Redis     │ │  Kafka   │ │ Services │
        │   Cluster    │ │  Cluster │ │(Orders,  │
        │ (State sync) │ │(Events)  │ │ etc.)    │
        └──────────────┘ └──────────┘ └──────────┘
```

## Components

### 1. Socket.IO Server

**Responsibilities:**
- WebSocket connection management
- Socket authentication and authorization
- Event routing and handling
- Client namespace management (`/client`, `/porter`, `/admin`)

**Key Features:**
- Multiple transport support (WebSocket, long-polling)
- Automatic reconnection handling
- Binary data support
- Room-based broadcasting

### 2. Redis Adapter

**Purpose:** Enable horizontal scaling across multiple gateway instances

**Functions:**
- Cross-instance pub/sub for message broadcasting
- Session state synchronization
- Distributed room management

**Data Stored:**
```
socket:user:{socketId} → SocketUserData
user:socket:{userId} → Set<socketId>
order:subscription:{orderId} → Set<OrderSubscription>
porter:location:{porterId} → PorterLocation
job:offer:{offerId} → JobOffer
reconnect:token:{token} → SocketUserData
```

### 3. State Management

#### Ephemeral State (Redis)

**Socket Sessions:**
- `socketId → userId` mapping
- `userId → socketId[]` mapping (multi-device support)
- TTL: 24 hours (configurable)

**Subscriptions:**
- Active order subscriptions
- TTL: 24 hours or until unsubscribe

**Location Cache:**
- Last known porter location
- TTL: 1 hour
- Sampled snapshots persisted to Kafka

**Job Offers:**
- Pending offer state
- TTL: Offer expiration time

#### Persistent State (Kafka → Database)

- Chat messages
- Sampled location updates
- Order events
- Job offer acceptance/rejection

### 4. Message Broker Integration

**Kafka Topics:**

| Topic | Purpose | Consumers |
|-------|---------|-----------|
| `order-events` | Order lifecycle events | Gateway, Orders Service |
| `porter-events` | Porter location, availability | Gateway, Porter Service |
| `notification-events` | Push notifications | Gateway, Notification Service |
| `chat-events` | Chat message persistence | Chat Service |

**Consumer Group:** `realtime-gateway-group`
- Partitioned for load distribution
- Each gateway instance consumes from all topics
- Messages are idempotent (deduplicated by event ID)

**Event Flow:**

```
Order Service → Kafka → Gateway → WebSocket → Client
                  ↓
              Database
```

### 5. Authentication & Authorization

**Flow:**

1. Client requests socket token from API Gateway
2. API Gateway issues short-lived JWT (24h)
3. Client connects to Realtime Gateway with token
4. Gateway validates JWT and extracts user context
5. Socket is authenticated and user context attached

**Token Types:**
- **Access Token**: Standard user session token (15 min)
- **Socket Token**: Longer-lived token for socket connections (24h)

**Authorization Rules:**
- Clients can only subscribe to their own orders
- Porters can only subscribe to assigned orders
- Admins can subscribe to any order
- Only porters can send location updates
- Only porters can accept/reject job offers

### 6. Rate Limiting

**Strategy:** Token bucket algorithm with Redis backing

**Limits:**

| Event Type | Points | Duration |
|-----------|--------|----------|
| General | 100 | 60s |
| Location | 1000 | 60s |
| Chat | 50 | 60s |

**Enforcement:**
- Per-user limits (identified by userId)
- Separate buckets for different event types
- Backpressure: emit error event when limit exceeded

### 7. Metrics & Monitoring

**Prometheus Metrics:**

```
realtime_active_connections{namespace}
realtime_messages_received_total{namespace,event}
realtime_messages_sent_total{namespace,event}
realtime_location_updates_total
realtime_fanout_latency_seconds
realtime_authentication_errors_total{reason}
realtime_redis_hits_total{operation}
```

**Distributed Tracing:**
- Correlation ID propagated through all events
- Jaeger integration for request tracing
- Parent-child span relationships

**Logging:**
- Structured JSON logs
- Correlation ID in all log entries
- Sensitive data redaction
- Log levels: debug, info, warn, error

## Event Processing Flow

### 1. Location Update Flow

```
Porter App → location:update → Gateway Instance #1
                                      ↓
                                 Validate
                                      ↓
                                 Rate Limit Check
                                      ↓
                                 Store in Redis
                                      ↓
                          ┌───────────┼──────────┐
                          ↓                      ↓
                    Sample to Kafka        Fan-out to Subscribers
                  (1 in 10 updates)              ↓
                          ↓              Get order subscriptions
                    Persist later                ↓
                                          Redis pub/sub
                                                 ↓
                                  ┌──────────────┼──────────────┐
                                  ↓              ↓              ↓
                            Instance #1    Instance #2    Instance #3
                                  ↓              ↓              ↓
                             WebSocket      WebSocket      WebSocket
                                  ↓              ↓              ↓
                              Clients        Clients        Clients
```

### 2. Order Status Update Flow

```
Orders Service → Kafka (order-events)
                        ↓
                Gateway Consumers (all instances)
                        ↓
                Get order subscriptions from Redis
                        ↓
                Emit to room (order:{orderId})
                        ↓
                Redis adapter distributes
                        ↓
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
   Instance #1     Instance #2     Instance #3
        ↓               ↓               ↓
    Emit to sockets in room
        ↓               ↓               ↓
    Customers       Porters         Admins
```

### 3. Chat Message Flow

```
Customer App → chat:message:send → Gateway
                                      ↓
                                 Validate & Rate Limit
                                      ↓
                           Publish to Kafka (chat-events)
                                      ↓
                          ┌───────────┴──────────┐
                          ↓                      ↓
                    Chat Service           Gateway (all instances)
                    (Persist)                    ↓
                                        Emit to room (order:{orderId})
                                                 ↓
                                        Both customer & porter receive
```

## Scaling Considerations

### Horizontal Scaling

**Stateless Design:**
- No sticky sessions required
- All session state in Redis
- Any instance can serve any client

**Capacity Planning:**

| Resource | Per Instance | Recommended |
|----------|-------------|-------------|
| Connections | 5,000 | Scale at 4,000 |
| CPU | 2 cores | 70% threshold |
| Memory | 2 GB | 80% threshold |
| Messages/sec | 10,000 | Monitor latency |

**Auto-scaling Triggers:**
1. Average active connections > 4,000 per instance
2. CPU utilization > 70%
3. Memory utilization > 80%
4. Message processing latency > 100ms (p95)

### Redis Scaling

**Cluster Mode:**
- Use Redis Cluster for high availability
- Minimum 3 master nodes
- Replication factor: 2

**Connection Pooling:**
- Each gateway instance: 3 connections (client, pub, sub)
- Total connections = instances × 3

### Kafka Scaling

**Partition Strategy:**
- Partition by correlation ID for ordering
- Number of partitions ≥ number of gateway instances
- Allows parallel consumption

**Consumer Lag:**
- Monitor lag on all topics
- Alert if lag > 1000 messages
- Scale consumers if persistent lag

## Failure Modes & Recovery

### Gateway Instance Failure

**Impact:**
- Clients on that instance disconnect
- Sessions cleaned up via TTL

**Recovery:**
1. Clients auto-reconnect to another instance
2. Re-authenticate with reconnect token
3. Subscriptions restored from Redis
4. Resume normal operation

**Mitigation:**
- Run ≥3 instances always
- Pod anti-affinity rules
- Health checks for automatic restart

### Redis Failure

**Impact:**
- Cannot sync state across instances
- New connections fail
- Existing connections work (in-memory)

**Recovery:**
1. Redis auto-failover to replica
2. Gateway reconnects automatically
3. Rebuild state from active sockets

**Mitigation:**
- Redis Sentinel or Cluster mode
- Connection retry logic
- Circuit breaker pattern

### Kafka Failure

**Impact:**
- Cannot consume backend events
- Cannot persist chat/location

**Recovery:**
1. Kafka broker failover
2. Consumer rebalancing
3. Resume from last committed offset

**Mitigation:**
- Multi-broker cluster
- Replication factor ≥2
- Consumer auto-reconnect

### Network Partition

**Impact:**
- Split-brain scenario possible
- Clients may see stale data

**Recovery:**
1. Kubernetes network policies
2. Redis Cluster handles partitions
3. Clients reconnect to healthy instance

**Mitigation:**
- Multi-AZ deployment
- Network redundancy
- Client-side timeout detection

## Security Architecture

### Transport Security

- TLS 1.3 for all connections
- Certificate pinning option for mobile
- WSS (WebSocket Secure) in production

### Authentication

- JWT with short expiry
- Token refresh via API Gateway
- No long-lived credentials

### Authorization

- Role-based access control
- Resource-level permissions
- Subscription validation

### Data Protection

- No PII in logs
- Message encryption in transit
- Redis encryption at rest (optional)

### DoS Protection

- Per-user rate limiting
- Global connection limits
- Max payload size enforcement
- Connection rate limiting

## Performance Optimizations

### 1. Location Updates

- In-memory buffering
- Sampling for persistence (1:10)
- Batch Redis writes
- Efficient fan-out via rooms

### 2. Message Broadcasting

- Use Socket.IO rooms for efficient targeting
- Redis pub/sub for cross-instance
- Avoid N×M fanout patterns

### 3. Redis Operations

- Pipeline multiple operations
- Use Lua scripts for atomic operations
- Appropriate key expiration

### 4. Memory Management

- Limit max connections per instance
- Automatic socket cleanup on disconnect
- Redis key TTLs prevent memory leaks

## Deployment Architecture

### Development

```
docker-compose:
  - Gateway (1 instance)
  - Redis (single node)
  - Kafka (single broker)
  - Zookeeper
```

### Staging

```
Kubernetes:
  - Gateway: 2 replicas
  - Redis: Sentinel (1 master, 2 replicas)
  - Kafka: 3 brokers
```

### Production

```
Kubernetes:
  - Gateway: 3-20 replicas (HPA)
  - Redis: Cluster (3 masters, 3 replicas)
  - Kafka: 3+ brokers (multi-AZ)
  - Load Balancer (sticky sessions disabled)
```

## Monitoring & Alerts

### Critical Alerts

1. **No healthy instances**
   - Severity: P0
   - Action: Page on-call

2. **Redis connection failures**
   - Severity: P1
   - Action: Investigate immediately

3. **Kafka consumer lag > 5000**
   - Severity: P2
   - Action: Scale or investigate

### Warning Alerts

1. **Average connections > 4000/instance**
2. **CPU > 70%**
3. **Authentication error rate > 5%**
4. **Message delivery failures > 1%**

### Dashboards

1. **Connection Metrics**
   - Active connections by namespace
   - Connection/disconnection rate
   - Average connection duration

2. **Performance Metrics**
   - Message throughput (in/out)
   - Fan-out latency (p50, p95, p99)
   - Location update latency

3. **Error Metrics**
   - Authentication errors
   - Rate limit exceeded
   - Delivery failures
   - Redis/Kafka errors

## Future Enhancements

1. **Message Queuing**
   - Queue messages for offline clients
   - Deliver on reconnect

2. **Advanced Presence**
   - User online/offline status
   - Last seen timestamps
   - Typing indicators optimization

3. **Message Persistence**
   - Built-in message store
   - Message history API

4. **Analytics**
   - Connection analytics
   - Usage patterns
   - Performance insights

5. **Multi-Region**
   - Geographic distribution
   - Regional failover
   - Cross-region sync
