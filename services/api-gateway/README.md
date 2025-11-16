# MoveNow API Gateway

Production-ready tRPC API Gateway microservice for MoveNow - a typed, Node.js + TypeScript service that exposes the public API to mobile/web clients, authenticates requests, orchestrates backend microservices, validates inputs, and relays realtime events.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Development](#development)
- [Security](#security)

## Overview

The API Gateway serves as the single entry point for all client applications (web and mobile). It handles:

- **Authentication & Authorization**: JWT-based access control with role-based permissions
- **Request Orchestration**: Coordinates multiple microservices to fulfill client requests
- **Input Validation**: Zod schema validation for all incoming requests
- **Rate Limiting**: IP and user-based rate limiting to prevent abuse
- **Error Handling**: Standardized error responses with correlation IDs
- **Logging**: Structured logging with request tracing

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Applications                         │
│                     (Web App, Mobile Apps)                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API Gateway (tRPC)                          │
│  ┌──────────────┬──────────────┬──────────────┬──────────────────┐  │
│  │ Auth Router  │Orders Router │Porters Router│Payments Router   │  │
│  ├──────────────┼──────────────┼──────────────┼──────────────────┤  │
│  │              │              │              │   Admin Router   │  │
│  │ Auth Middleware │ Rate Limiter │ CORS      │Realtime Router   │  │
│  └──────────────┴──────────────┴──────────────┴──────────────────┘  │
└───────────┬─────────────┬─────────────┬─────────────┬───────────────┘
            │             │             │             │
            │ tRPC/HTTP   │ tRPC/HTTP   │ tRPC/HTTP   │ tRPC/HTTP
            ▼             ▼             ▼             ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Auth Service  │ │Orders Service │ │Pricing Service│ │Porters Service│
└───────────────┘ └───────┬───────┘ └───────────────┘ └───────────────┘
                          │
                          │ Publishes Events
                          ▼
                  ┌───────────────────┐
                  │   Message Bus     │
                  │   (Event Broker)  │
                  └─────────┬─────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────┐
│Notifications Svc│ │Realtime Svc  │ │Analytics Svc │
└─────────────────┘ └──────────────┘ └──────────────┘
```

### Create Order Flow

```
Client                  API Gateway           Pricing Service    Orders Service    Message Bus
  │                          │                       │                  │               │
  │  POST /trpc/orders.create│                       │                  │               │
  ├─────────────────────────>│                       │                  │               │
  │                          │                       │                  │               │
  │                          │  1. estimate()        │                  │               │
  │                          ├──────────────────────>│                  │               │
  │                          │                       │                  │               │
  │                          │<──────────────────────┤                  │               │
  │                          │  { totalCents: 5000 } │                  │               │
  │                          │                       │                  │               │
  │                          │  2. createOrder()     │                  │               │
  │                          │  (with priceCents)    │                  │               │
  │                          ├──────────────────────────────────────────>│               │
  │                          │                       │                  │               │
  │                          │                       │  3. OrderCreated │               │
  │                          │                       │      Event       │               │
  │                          │                       │                  ├──────────────>│
  │                          │                       │                  │               │
  │                          │<──────────────────────────────────────────┤               │
  │                          │  { orderId: "..." }   │                  │               │
  │                          │                       │                  │               │
  │  { orderId, priceCents } │                       │                  │               │
  │<─────────────────────────┤                       │                  │               │
  │                          │                       │                  │               │
  │                          │                       │                  │               │
  │                                                                      │               │
  │                              (Async Event Processing)               │               │
  │                                                                      ▼               │
  │                                                         ┌─────────────────────────┐ │
  │                                                         │ • Notifications Service │ │
  │                                                         │ • Realtime Gateway      │◄─┘
  │                                                         │ • Analytics Service     │
  │                                                         └─────────────────────────┘
```

**Flow Steps:**

1. **Sync**: API Gateway calls Pricing Service to get price estimate
2. **Sync**: API Gateway calls Orders Service to create order with calculated price
3. **Async**: Orders Service publishes `OrderCreated` event to message bus
4. **Async**: Other services (Notifications, Realtime, Analytics) consume event

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3
- **API Framework**: tRPC v10
- **Validation**: Zod
- **HTTP Server**: Express
- **Security**: Helmet, CORS, JWT
- **Logging**: Winston
- **Testing**: Jest, Supertest
- **Containerization**: Docker
- **Orchestration**: Kubernetes

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for local development)
- Access to downstream microservices

### Installation

1. Clone the repository:
```bash
git clone https://github.com/movenow/api-gateway.git
cd api-gateway
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
# ... other variables
```

### Running Locally

#### Option 1: Development Mode (requires downstream services)

```bash
npm run dev
```

The gateway will start on `http://localhost:3000`

#### Option 2: Docker Compose (with mock services)

```bash
docker-compose up
```

This will start:
- API Gateway on port 3000
- Mock downstream services (auth, orders, pricing, etc.)

### Verify Installation

Check health endpoint:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## API Documentation

### Public Procedures (No Auth Required)

#### `auth.login`
```typescript
input: {
  email: string;
  password: string;
}
output: {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}
```

#### `auth.refresh`
```typescript
input: {
  refreshToken: string;
}
output: {
  accessToken: string;
  refreshToken: string;
}
```

#### `porters.nearby`
```typescript
input: {
  lat: number;
  lng: number;
  radiusMeters?: number;
  vehicleType?: string;
}
output: PorterSummary[]
```

### Protected Procedures (Requires Authentication)

#### `orders.create`
```typescript
input: {
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  vehicleType: 'sedan' | 'suv' | 'van' | 'truck';
  porterCount: number;
  scheduledAt?: Date;
  notes?: string;
  idempotencyKey?: string;
}
output: {
  orderId: string;
  priceCents: number;
  estimatedDuration: number;
}
```

**Orchestration**:
1. Calls `pricing-service` for price estimate
2. Calls `orders-service` to create order
3. Returns order ID to client

#### `orders.get`
```typescript
input: string (orderId)
output: OrderDetail
```

#### `orders.list`
```typescript
input: {
  status?: OrderStatus;
  limit?: number;
  offset?: number;
}
output: {
  orders: OrderDetail[];
  total: number;
}
```

#### `orders.cancel`
```typescript
input: {
  orderId: string;
  reason?: string;
}
output: {
  success: boolean;
  refundCents?: number;
}
```

#### `payments.createPaymentIntent`
```typescript
input: {
  orderId: string;
  method: 'card' | 'wallet' | 'cash';
  idempotencyKey?: string;
}
output: {
  paymentIntentId: string;
  clientSecret?: string;
  walletHoldId?: string;
  status: string;
}
```

#### `realtime.subscribeToNamespace`
```typescript
input: {
  namespace: 'client' | 'porter';
  token: string;
}
output: {
  url: string;
  token: string;
  namespace: string;
  userId: string;
  expiresIn: number;
}
```

### Admin Procedures (Requires Admin Role)

All admin procedures require `admin` or `superadmin` role.

See `src/routers/admin.ts` for full API.

## Testing

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Test Structure

- `tests/routers/` - Unit tests for each router
- `tests/integration/` - Integration tests simulating full request flows
- `tests/setup.ts` - Global test configuration

### Example Test

```typescript
// tests/routers/orders.test.ts
it('should orchestrate order creation correctly', async () => {
  const ctx = createMockContext();
  const caller = appRouter.createCaller(ctx);

  const result = await caller.orders.create({
    pickup: { address: '123 Main St', lat: 40.7128, lng: -74.006 },
    dropoff: { address: '456 Oak Ave', lat: 40.7589, lng: -73.9851 },
    vehicleType: 'sedan',
    porterCount: 2,
  });

  // Assert pricing was called first
  expect(ctx.services.pricing.estimate.query).toHaveBeenCalled();

  // Assert order was created with price
  expect(ctx.services.orders.createOrder.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ priceCents: 5000 })
  );
});
```

## Deployment

### Docker Build

```bash
docker build -t movenow/api-gateway:latest .
```

### Kubernetes Deployment

1. Create namespace:
```bash
kubectl create namespace movenow
```

2. Apply secrets (update with real values):
```bash
kubectl apply -f k8s/secret.yaml
```

3. Apply configuration:
```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/serviceaccount.yaml
```

4. Deploy application:
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
```

5. Verify deployment:
```bash
kubectl get pods -n movenow
kubectl logs -f deployment/api-gateway -n movenow
```

### Environment Variables

See `.env.example` for all required environment variables.

**Critical Variables:**
- `JWT_ACCESS_SECRET` - Secret for signing access tokens
- `JWT_REFRESH_SECRET` - Secret for signing refresh tokens
- `*_SERVICE_URL` - URLs for downstream microservices

## Development

### Project Structure

```
services/api-gateway/
├── src/
│   ├── routers/          # tRPC routers
│   │   ├── auth.ts
│   │   ├── orders.ts
│   │   ├── porters.ts
│   │   ├── payments.ts
│   │   ├── admin.ts
│   │   ├── realtime.ts
│   │   └── index.ts
│   ├── middleware/       # Express/tRPC middleware
│   │   ├── rateLimiter.ts
│   │   └── requireAuth.ts
│   ├── lib/             # Utilities
│   │   ├── trpcClientFactory.ts
│   │   ├── correlation.ts
│   │   ├── errors.ts
│   │   └── logger.ts
│   ├── types/           # Type definitions & Zod schemas
│   │   └── zodSchemas.ts
│   ├── trpc.ts          # tRPC initialization
│   ├── context.ts       # Context builder
│   ├── config.ts        # Configuration
│   └── index.ts         # Server bootstrap
├── tests/
│   ├── routers/
│   ├── integration/
│   └── setup.ts
├── k8s/                 # Kubernetes manifests
├── Dockerfile
├── docker-compose.yml
└── package.json
```

### Adding a New Router

1. Create router file in `src/routers/`:
```typescript
// src/routers/myRouter.ts
import { router, protectedProcedure } from '../trpc';

export const myRouter = router({
  myProcedure: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Implementation
    }),
});
```

2. Add to main router in `src/routers/index.ts`:
```typescript
import { myRouter } from './myRouter';

export const appRouter = router({
  // ... existing routers
  my: myRouter,
});
```

3. Add tests in `tests/routers/myRouter.test.ts`

### Code Style

- Use TypeScript strict mode
- No `any` types
- Explicit return types for functions
- Zod schemas for all inputs
- Structured logging with correlation IDs

## Security

### Authentication

JWT-based authentication with access and refresh tokens:
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Tokens include user ID, email, and role

### Authorization

Role-based access control (RBAC):
- `client` - Standard user
- `porter` - Service provider
- `admin` - Administrator
- `superadmin` - System administrator

### Rate Limiting

- IP-based: 100 requests per minute
- User-based: 200 requests per minute
- Auth endpoints: 5 attempts per 15 minutes

### Security Headers

Helmet.js applies security headers:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

### Input Validation

All inputs validated with Zod schemas to prevent:
- SQL Injection
- XSS
- Command Injection
- Invalid data types

### CORS

Configurable CORS policy with whitelist of allowed origins.

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and add tests
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Commit changes: `git commit -m "Add my feature"`
6. Push to branch: `git push origin feature/my-feature`
7. Create Pull Request

## License

MIT

## Support

For issues and questions:
- GitHub Issues: https://github.com/movenow/api-gateway/issues
- Email: support@movenow.com
