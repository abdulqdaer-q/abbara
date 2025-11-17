# MoveNow Realtime Gateway

A highly available, low-latency WebSocket gateway that handles socket connections for customers and porters, authenticates sockets, relays location updates and chat messages, delivers job offers and status updates, and bridges backend event streams to connected clients.

## Features

- 🔌 **WebSocket Communication**: Socket.IO-based real-time communication with multiple namespaces
- 🔐 **JWT Authentication**: Secure socket authentication with short-lived tokens
- 📍 **Location Tracking**: High-frequency location updates from porters with intelligent sampling
- 💬 **Real-time Chat**: Bi-directional messaging between customers and porters
- 📊 **Job Offers**: Real-time job offer delivery and acceptance flow for porters
- 🔄 **Order Subscriptions**: Subscribe to order updates and status changes
- 📈 **Horizontal Scaling**: Redis adapter for cross-instance socket synchronization
- 📊 **Metrics & Monitoring**: Prometheus metrics and distributed tracing
- ⚡ **Rate Limiting**: Per-user and per-event rate limiting with backpressure
- 🔥 **High Performance**: Sub-100ms latency for location propagation

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Realtime  │────▶│    Redis    │
│  (Mobile)   │◀────│   Gateway   │◀────│   Cluster   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ├────────────┐
                           │            │
                    ┌──────▼─────┐ ┌───▼────────┐
                    │   Kafka    │ │  Orders    │
                    │   Broker   │ │  Service   │
                    └────────────┘ └────────────┘
```

## Prerequisites

- Node.js >= 18.0.0
- pnpm (package manager)
- Redis >= 6.0
- Kafka >= 2.8 (or compatible message broker)

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

### Required Variables

- `JWT_ACCESS_SECRET` - Secret for verifying access tokens
- `JWT_SOCKET_SECRET` - Secret for socket-specific tokens
- `REDIS_HOST` - Redis server hostname
- `REDIS_PORT` - Redis server port
- `KAFKA_BROKERS` - Comma-separated list of Kafka brokers

### Optional Variables

See `.env.example` for full list of configuration options.

## Development

### Local Development with Docker Compose

The easiest way to run the service locally:

```bash
# Start all services (Gateway, Redis, Kafka)
docker-compose up

# View logs
docker-compose logs -f realtime-gateway

# Stop services
docker-compose down
```

Access points:
- Realtime Gateway: `ws://localhost:3002`
- Metrics: `http://localhost:9090/metrics`
- Kafka UI: `http://localhost:8080`
- Redis Commander: `http://localhost:8081`

### Manual Development

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Start Kafka (simplified with docker-compose)
docker-compose up -d kafka zookeeper

# Start the gateway in watch mode
pnpm run dev
```

## Socket Namespaces

The gateway provides three namespaces:

- `/client` - For customer applications
- `/porter` - For porter applications
- `/admin` - For admin dashboards

## Authentication

### Getting a Socket Token

Socket tokens can be obtained from the API Gateway:

```typescript
// Request socket token from API Gateway
const response = await fetch('https://api.movenow.com/auth/socket-token', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { socketToken } = await response.json();
```

### Connecting to Socket

```typescript
import { io } from 'socket.io-client';

const socket = io('wss://realtime.movenow.com/client', {
  auth: {
    token: socketToken
  }
});

socket.on('auth:authenticated', (response) => {
  console.log('Authenticated:', response);
});
```

## Socket Events

See [Socket Event Catalog](./docs/SOCKET_EVENTS.md) for complete list of events and schemas.

### Common Events

**Client → Server:**
- `auth:authenticate` - Authenticate socket connection
- `order:subscribe` - Subscribe to order updates
- `location:update` - Send location update (porters)
- `chat:message:send` - Send chat message
- `job:offer:accept` - Accept job offer (porters)

**Server → Client:**
- `auth:authenticated` - Authentication successful
- `order:status:changed` - Order status updated
- `location:updated` - Location update received
- `chat:message:received` - New chat message
- `job:offer:received` - New job offer (porters)

## Testing

```bash
# Run unit tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:coverage

# Run integration tests (requires running server)
pnpm run test:integration

# Run load tests
pnpm run test:load
```

## Deployment

### Docker

```bash
# Build production image
docker build -t movenow/realtime-gateway:latest .

# Run container
docker run -d \
  -p 3002:3002 \
  -p 9090:9090 \
  --env-file .env \
  movenow/realtime-gateway:latest
```

### Kubernetes

```bash
# Create namespace
kubectl create namespace movenow

# Create secrets
kubectl create secret generic realtime-gateway-secrets \
  --from-literal=JWT_ACCESS_SECRET=your-secret \
  --from-literal=JWT_SOCKET_SECRET=your-secret \
  --from-literal=REDIS_PASSWORD=your-password \
  -n movenow

# Apply configurations
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
```

## Monitoring

### Metrics

Prometheus metrics are exposed at `/metrics` on port 9090.

Key metrics:
- `realtime_active_connections` - Active WebSocket connections
- `realtime_messages_received_total` - Total messages received
- `realtime_messages_sent_total` - Total messages sent
- `realtime_location_updates_total` - Location updates processed
- `realtime_fanout_latency_seconds` - Fan-out operation latency

### Health Checks

- `/health` - Basic health check
- `/ready` - Readiness check (includes dependency checks)

## Scaling

The gateway is designed for horizontal scaling:

1. **Stateless Design**: All session state is stored in Redis
2. **Redis Adapter**: Socket.IO uses Redis pub/sub for cross-instance communication
3. **No Sticky Sessions**: Clients can connect to any instance
4. **Auto-scaling**: HPA based on CPU, memory, and active connections

Recommended scaling:
- Start with 3 replicas
- Scale up to 20 replicas based on load
- Each instance can handle ~5,000 concurrent connections

## Troubleshooting

### Connection Issues

**Problem**: Clients can't connect
- Check CORS configuration in `.env`
- Verify JWT secrets are correct
- Check firewall/security group rules

**Problem**: Reconnection loops
- Check Redis connectivity
- Verify reconnect token TTL settings

### Performance Issues

**Problem**: High latency for location updates
- Check Redis latency with `redis-cli --latency`
- Verify network between gateway and Redis
- Check if location sample rate is appropriate

**Problem**: High CPU usage
- Increase replica count
- Check for inefficient fan-out patterns
- Review rate limiting settings

### Data Issues

**Problem**: Messages not delivered
- Check Kafka consumer lag
- Verify subscription state in Redis
- Check logs for delivery failures

## Security

- All socket connections require JWT authentication
- TLS encryption in production (configure `TLS_ENABLED=true`)
- Rate limiting per user and per event type
- Input validation on all incoming messages
- No sensitive data in logs (automatic redaction)

## Performance Targets

- **Latency**: <100ms end-to-end for location updates
- **Throughput**: 10,000+ messages/second per instance
- **Concurrent Connections**: 5,000+ per instance
- **Availability**: 99.9%+ uptime

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Submit a pull request

## License

MIT
