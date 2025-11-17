# MoveNow Pricing Service

Production-ready pricing service for the MoveNow platform. Provides accurate, explainable fare estimates and immutable price snapshots for order capture.

## Overview

The Pricing Service is responsible for:

- **Price Estimation**: Calculate accurate fare estimates based on distance, time, vehicle type, porter count, and configurable pricing rules
- **Price Snapshots**: Persist immutable pricing snapshots for orders to ensure captured prices are reproducible
- **Rule Management**: Admin interfaces for creating and managing complex pricing rules
- **Surge Pricing**: Support for peak/surge multipliers based on time windows or dynamic demand
- **Promotional Discounts**: Apply promo codes and business account pricing
- **Audit Trail**: Complete audit history of pricing rules and changes

## Features

### Core Capabilities

- ✅ **Deterministic Pricing**: All calculations use smallest currency unit (cents) to avoid floating-point errors
- ✅ **Explainable Estimates**: Detailed breakdown of every pricing component
- ✅ **Flexible Rules Engine**: Support for base fares, per-km/min pricing, porter fees, surcharges, taxes, discounts
- ✅ **Caching**: Redis-backed caching for distance/time calculations and pricing results
- ✅ **Maps Integration**: Google Maps Distance Matrix API with fallback heuristics
- ✅ **Multi-Stop Support**: Accurate pricing for complex routes with multiple stops
- ✅ **Versioning**: Rule versioning for audit and reproducibility
- ✅ **Event-Driven**: Publishes pricing events for downstream services

### Pricing Rule Types

1. **BASE_FARE** - Base fare per vehicle type
2. **PER_KM** - Distance-based pricing with optional tiers
3. **PER_MINUTE** - Time-based pricing for traffic delays
4. **PORTER_FEE** - Per-porter fees with tiered options
5. **ITEM_SIZE_SURCHARGE** - Surcharges for oversized items
6. **MINIMUM_FARE** - Enforce minimum fare threshold
7. **PEAK_MULTIPLIER** - Surge pricing during peak hours
8. **GEO_MULTIPLIER** - Zone-based pricing multipliers
9. **PROMO_DISCOUNT** - Promotional discounts (percentage or fixed)
10. **SERVICE_FEE** - Platform commission
11. **TAX** - Jurisdiction-specific taxes
12. **MULTI_STOP_FEE** - Extra fees for multiple stops

## Architecture

```
┌─────────────────┐
│  API Gateway    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ Pricing Service ├─────▶│  PostgreSQL  │
│    (tRPC API)   │      │  (Rules/     │
└────────┬────────┘      │  Snapshots)  │
         │               └──────────────┘
         │
         ├─────▶ Redis (Caching)
         │
         ├─────▶ Google Maps API
         │
         └─────▶ Event Bus (Future)
```

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **RPC Framework**: tRPC for type-safe APIs
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis (ioredis)
- **Validation**: Zod schemas
- **Maps Provider**: Google Maps Distance Matrix API
- **Logging**: Winston
- **Testing**: Jest
- **Containerization**: Docker

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- pnpm (or npm/yarn)
- Google Maps API key (optional)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate
```

### Development

```bash
# Start in development mode with hot reload
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type check
pnpm type-check

# Lint code
pnpm lint
```

### Docker Development

```bash
# Start all services (pricing, postgres, redis)
docker-compose up

# Access Prisma Studio for database management
# Navigate to http://localhost:5555
```

## Environment Variables

See `.env.example` for all available configuration options.

### Required in Production

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT validation
- `ADMIN_API_KEY` - API key for admin operations
- `GOOGLE_MAPS_API_KEY` - Google Maps API key (if maps enabled)

### Pricing Configuration

- `DEFAULT_CURRENCY` - Default currency (USD, EUR, GBP)
- `DEFAULT_TAX_RATE` - Default tax rate (e.g., 0.08 for 8%)
- `MIN_FARE_CENTS` - Minimum fare in cents
- `MAX_SURGE_MULTIPLIER` - Maximum surge multiplier cap

## API Reference

### Core Procedures

#### `pricing.estimatePrice`

Calculate fare estimate for an order.

**Input:**
```typescript
{
  pickup: { lat: number, lng: number, address: string },
  dropoff: { lat: number, lng: number, address: string },
  additionalStops?: Array<{ lat, lng, address }>,
  vehicleType: 'sedan' | 'suv' | 'van' | 'truck',
  porterCount: number,
  items?: Array<{ description, quantity, weightKg?, dimensions? }>,
  scheduledAt?: Date,
  promoCode?: string,
  customerType?: 'consumer' | 'business' | 'enterprise',
  distanceMeters?: number,  // Optional: provide if already known
  durationSeconds?: number  // Optional: provide if already known
}
```

**Output:**
```typescript
{
  baseFareCents: number,
  distanceFareCents: number,
  timeFareCents: number,
  porterFeesCents: number,
  surchargesCents: number,
  subtotalCents: number,
  discountCents: number,
  taxCents: number,
  serviceFeesCents: number,
  totalCents: number,
  currency: string,
  breakdown: Array<{ type, ruleId?, amountCents, description }>,
  rulesApplied: Array<{ ruleId, ruleVersion, ruleName, ruleType }>,
  estimatedDistanceMeters: number,
  estimatedDurationSeconds: number,
  estimatedArrivalTime: Date
}
```

#### `pricing.persistPriceSnapshot`

Persist immutable price snapshot for an order.

**Input:**
```typescript
{
  orderId: string,
  estimate: PricingEstimateInput,
  idempotencyKey?: string
}
```

**Output:**
```typescript
{
  snapshotId: string,
  success: boolean
}
```

#### `pricing.getPriceSnapshot`

Retrieve persisted price snapshot.

**Input:**
```typescript
{
  orderId?: string,
  snapshotId?: string
}
```

#### `pricing.previewPriceChange`

Preview price impact of order modifications.

**Input:**
```typescript
{
  orderId: string,
  changedFields: Partial<PricingEstimateInput>
}
```

**Output:**
```typescript
{
  originalTotalCents: number,
  newTotalCents: number,
  deltaCents: number,
  requiresConfirmation: boolean,
  newBreakdown: Array<PriceBreakdownItem>
}
```

### Admin Procedures

All admin procedures require authentication with `x-user-role: admin` header.

#### `admin.createRule`

Create new pricing rule.

```typescript
{
  name: string,
  description?: string,
  ruleType: RuleType,
  priority: number,
  enabled: boolean,
  vehicleTypes: VehicleType[],
  customerTypes: CustomerType[],
  effectiveFrom: Date,
  effectiveTo?: Date,
  config: RuleConfig  // Type-specific configuration
}
```

#### `admin.updateRule`

Update existing pricing rule.

#### `admin.deleteRule`

Archive pricing rule (soft delete).

#### `admin.listRules`

List all active pricing rules with filtering.

#### `admin.toggleRule`

Enable or disable a pricing rule.

## Pricing Calculation Order

The pricing engine applies rules in the following order:

1. **Base Fare** - Applied first
2. **Distance Fees** - Per-kilometer charges
3. **Time Fees** - Per-minute charges
4. **Porter Fees** - Per-porter charges
5. **Item Surcharges** - Size/weight surcharges
6. **Multi-Stop Fees** - Additional stop fees
7. **Multipliers** - Peak/geo surge applied to subtotal
8. **Subtotal Calculation** - Sum of above components
9. **Minimum Fare** - Enforce minimum if needed
10. **Discounts** - Apply promotional discounts
11. **Taxes** - Calculate taxes (before or after discount based on config)
12. **Service Fees** - Platform commission
13. **Final Total** - Final amount to charge

### Rounding Rules

- All intermediate calculations use integer arithmetic (cents)
- No floating-point calculations to avoid precision errors
- Final amounts always rounded to nearest cent (half-up)

## Example Pricing Configurations

### Standard City Fare

```typescript
// Base fare: $5.00
{
  ruleType: 'BASE_FARE',
  vehicleTypes: ['SEDAN'],
  config: { amountCents: 500 }
}

// Per-km: $1.50/km
{
  ruleType: 'PER_KM',
  vehicleTypes: ['SEDAN'],
  config: { ratePerKm: 150 }
}

// Per-minute: $0.25/min
{
  ruleType: 'PER_MINUTE',
  vehicleTypes: ['SEDAN'],
  config: { ratePerMinute: 25 }
}

// Porter: $8/porter
{
  ruleType: 'PORTER_FEE',
  config: { perPorter: 800 }
}

// Tax: 8%
{
  ruleType: 'TAX',
  config: { rate: 0.08, applyAfterDiscount: true }
}
```

### Peak Hour Surge (1.5x)

```typescript
{
  ruleType: 'PEAK_MULTIPLIER',
  priority: 100,  // High priority
  config: { multiplier: 1.5 },
  timeWindows: [{
    dayOfWeek: [1, 2, 3, 4, 5],  // Monday-Friday
    startTime: 480,  // 8:00 AM (minutes from midnight)
    endTime: 600     // 10:00 AM
  }]
}
```

### Business Account Discount (10% off)

```typescript
{
  ruleType: 'PROMO_DISCOUNT',
  customerTypes: ['BUSINESS'],
  config: { type: 'percentage', value: 10 }
}
```

## Deployment

### Docker

```bash
# Build image
docker build -t movenow/pricing-service:latest .

# Run container
docker run -p 3002:3002 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  movenow/pricing-service:latest
```

### Kubernetes

```bash
# Create secrets
kubectl create secret generic pricing-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=redis-url="redis://..." \
  --from-literal=google-maps-api-key="..." \
  --from-literal=jwt-secret="..." \
  --from-literal=admin-api-key="..."

# Apply configuration
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -l app=pricing-service
```

### Horizontal Pod Autoscaling

The service is configured to auto-scale based on CPU/memory:

- **Min replicas**: 3
- **Max replicas**: 10
- **CPU target**: 70%
- **Memory target**: 80%

## Monitoring & Observability

### Health Checks

- **Liveness**: `GET /health` - Checks database and Redis connectivity
- **Readiness**: `GET /ready` - Checks if service is ready to accept traffic

### Metrics

The service logs the following metrics:

- `estimates_per_second` - Rate of price estimates
- `estimate_latency_ms` - Estimate calculation latency (p50, p95, p99)
- `cache_hit_ratio` - Cache hit percentage
- `snapshots_persisted` - Count of persisted snapshots
- `rule_changes` - Count of pricing rule modifications
- `maps_provider_latency_ms` - External maps API latency

### Structured Logging

All logs include:

- `correlationId` - Request correlation ID
- `service` - Service name
- `timestamp` - ISO timestamp
- `level` - Log level (info, warn, error)
- `eventType` - Event type for filtering

## Performance

### Caching Strategy

- **Distance/time results**: Cached for 24 hours
- **Pricing estimates**: Cached for 1 hour
- **Cache invalidation**: Automatic on rule changes

### Benchmarks

Expected performance (with proper resources):

- **Estimate latency**: < 100ms (p95) with cache hits
- **Throughput**: > 1000 requests/second per instance
- **Database queries**: < 10ms (p95) for rule lookups

## Security

### Input Validation

- All inputs validated with Zod schemas
- Sanity checks for negative values, extreme inputs
- Rate limiting per client

### Authentication

- JWT validation for user requests
- Admin API key for admin operations
- RBAC for sensitive operations

### Data Protection

- PII redaction in logs
- Secrets via environment variables
- TLS/HTTPS in production

## Troubleshooting

### Common Issues

**High estimate latency**

- Check maps provider latency/availability
- Verify Redis cache is working
- Check database query performance

**Incorrect pricing**

- Review active pricing rules and priorities
- Check rule effective dates
- Verify time windows for peak pricing

**Cache not working**

- Verify Redis connectivity
- Check cache TTL configuration
- Review cache key patterns

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug pnpm dev
```

## Contributing

### Code Style

- TypeScript strict mode enabled
- ESLint for linting
- Prettier for formatting (if configured)

### Testing Requirements

- Unit tests for all pricing calculations
- Integration tests for end-to-end flows
- Minimum 80% code coverage

### Pull Request Process

1. Create feature branch
2. Implement changes with tests
3. Run `pnpm lint` and `pnpm test`
4. Submit PR with description

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:

- GitHub Issues: [movenow/pricing-service](https://github.com/movenow/pricing-service/issues)
- Documentation: [MoveNow Docs](https://docs.movenow.com)
- Email: engineering@movenow.com
