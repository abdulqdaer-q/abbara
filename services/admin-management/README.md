# MoveNow Admin Management Service

A centralized microservice for platform administrators to manage users, porters, orders, pricing, promo codes, analytics, and system configuration for the MoveNow platform.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [RBAC & Permissions](#rbac--permissions)
- [Event-Driven Architecture](#event-driven-architecture)
- [Testing](#testing)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Sequence Diagrams](#sequence-diagrams)

---

## Overview

The Admin Management Service provides a secure, auditable interface for platform administrators to:

- Manage users (customers and porters)
- Verify porter documents and credentials
- Configure vehicle types and pricing multipliers
- Create and manage promotional codes
- Oversee and intervene in orders
- View analytics and generate reports
- Configure platform-wide settings

All administrative actions are logged in an immutable audit trail and published as events for other services to consume.

---

## Features

### User Management
- List, search, and filter users by role, status, and verification state
- View detailed user profiles with order history and wallet balance
- Update user status (active, suspended, deactivated)
- Full audit trail of all user-related actions

### Porter Verification
- Review submitted porter documents (driver's license, vehicle registration, insurance)
- Approve or reject documents with review notes
- Automated notifications to porters on verification outcome
- Track verification status and history

### Vehicle Type Management
- CRUD operations for vehicle types
- Configure max load capacity and pricing multipliers
- Soft delete with deprecation status
- Optimistic locking for concurrent updates

### Promo Code Management
- Create percentage or fixed-amount discount codes
- Set usage limits, validity dates, and eligible user roles
- Track usage statistics in real-time
- Disable or expire codes

### Order Oversight
- View all orders with advanced filtering
- Admin intervention (reassign porters, update status, cancel orders)
- Special instructions and reason tracking
- Integration with Order Service via events

### Analytics & Dashboards
- Order metrics (total, completion rate, cancellation rate)
- Revenue analytics with trend analysis
- Porter activity and verification statistics
- User growth tracking
- Promo code usage reports

### Platform Settings
- Configure global settings (max porters per order, surge multipliers, loyalty points)
- Version-controlled settings with change history
- Settings propagated to other services via events

### Security & Audit
- Role-Based Access Control (RBAC) with 5 admin roles
- JWT-based authentication
- Immutable audit logs for all administrative actions
- IP address and user agent tracking
- Permission-based authorization

---

## Architecture

### Service Structure

```
services/admin-management/
├── src/
│   ├── routers/          # tRPC procedure definitions
│   │   ├── users.ts
│   │   ├── porters.ts
│   │   ├── vehicleTypes.ts
│   │   ├── promoCodes.ts
│   │   ├── orders.ts
│   │   ├── analytics.ts
│   │   ├── settings.ts
│   │   └── index.ts
│   ├── services/         # Business logic
│   │   └── auditService.ts
│   ├── middleware/       # Auth & RBAC
│   │   ├── auth.ts
│   │   └── rbac.ts
│   ├── lib/              # Utilities
│   │   ├── eventBus.ts
│   │   ├── logger.ts
│   │   ├── config.ts
│   │   ├── errors.ts
│   │   ├── correlation.ts
│   │   └── prisma.ts
│   ├── types/            # Schemas & types
│   │   ├── schemas.ts
│   │   └── events.ts
│   ├── context.ts        # tRPC context
│   ├── trpc.ts           # tRPC setup
│   └── index.ts          # Entry point
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seeding
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── security/         # Security tests
├── k8s/                  # Kubernetes manifests
├── Dockerfile
├── docker-compose.yml
└── package.json
```

### Database Schema

**Core Models:**
- `AdminUser` - Admin accounts with roles
- `AuditLog` - Immutable audit trail
- `VehicleType` - Vehicle configurations
- `PromoCode` - Promotional codes
- `PlatformSetting` - Global settings
- `User` - Cached user data (shadow table)
- `PorterDocument` - Porter verification documents
- `Order` - Cached order data (shadow table)

---

## Technology Stack

- **Runtime**: Node.js 18+ with TypeScript
- **API Framework**: tRPC v10 (type-safe RPC)
- **Validation**: Zod
- **Database**: PostgreSQL with Prisma ORM
- **Event Bus**: Kafka (KafkaJS)
- **Authentication**: JWT
- **Logging**: Winston
- **Testing**: Jest
- **Containerization**: Docker
- **Orchestration**: Kubernetes

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- PostgreSQL 15+
- Kafka (or use Docker Compose)

### Local Development with Docker Compose

The easiest way to get started:

```bash
# Navigate to the service directory
cd services/admin-management

# Start all services (Postgres, Kafka, Admin Management)
docker-compose up

# The service will be available at http://localhost:3001
```

This will automatically:
- Start PostgreSQL and Kafka
- Run database migrations
- Seed the database with initial data
- Start the service in development mode

### Manual Setup

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Set DATABASE_URL, JWT_SECRET, KAFKA_BROKERS, etc.

# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Seed the database
pnpm db:seed

# Start development server
pnpm dev
```

### Default Admin Credentials

After seeding, a super admin account is created:
- **Email**: admin@movenow.com
- **Password**: changeme (from DEFAULT_ADMIN_PASSWORD env var)

**⚠️ IMPORTANT**: Change the password in production!

---

## API Documentation

### Base URL

```
http://localhost:3001/trpc
```

### Authentication

All endpoints (except health check) require JWT authentication:

```
Authorization: Bearer <your-jwt-token>
```

### Main Procedures

#### Users

- `users.list` - List users with filters and pagination
- `users.get` - Get detailed user information
- `users.updateStatus` - Update user status (suspend, activate, etc.)

#### Porters

- `porters.verifyDocument` - Approve or reject porter documents
- `porters.getPendingDocuments` - Get pending verification documents

#### Vehicle Types

- `vehicleTypes.list` - List all vehicle types
- `vehicleTypes.create` - Create new vehicle type
- `vehicleTypes.update` - Update vehicle type (with optimistic locking)
- `vehicleTypes.delete` - Soft delete vehicle type

#### Promo Codes

- `promoCodes.list` - List promo codes with filters
- `promoCodes.create` - Create new promo code
- `promoCodes.update` - Update promo code
- `promoCodes.disable` - Disable promo code

#### Orders

- `orders.list` - List orders with filters
- `orders.get` - Get order details
- `orders.update` - Admin intervention on order

#### Analytics

- `analytics.get` - Get analytics data (orders, revenue, ratings, etc.)
- `analytics.getDashboardSummary` - Get dashboard summary statistics

#### Settings

- `settings.list` - List all platform settings
- `settings.get` - Get specific setting
- `settings.update` - Update platform setting

---

## RBAC & Permissions

### Admin Roles

The service supports 5 admin roles with hierarchical permissions:

1. **SUPER_ADMIN** - Full system access
2. **ADMIN** - Broad administrative access (except admin management)
3. **OPERATIONS** - User verification, order management, analytics
4. **FINANCE** - Analytics, promo codes, revenue data
5. **SUPPORT** - Read-only access to users and orders

### Permission Matrix

| Permission | SUPER_ADMIN | ADMIN | OPERATIONS | FINANCE | SUPPORT |
|-----------|-------------|-------|------------|---------|---------|
| View Users | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update User Status | ✅ | ✅ | ❌ | ❌ | ❌ |
| Verify Porter | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage Vehicle Types | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Promo Codes | ✅ | ✅ | ❌ | ✅ | ❌ |
| View Orders | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update Orders | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Analytics | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Admins | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Event-Driven Architecture

### Published Events

The service publishes events to Kafka for consumption by other services:

**User Events:**
- `admin.user.status_updated` - When admin updates user status

**Porter Events:**
- `admin.porter.verified` - When porter document is approved
- `admin.porter.verification_rejected` - When porter document is rejected

**Promo Code Events:**
- `admin.promo_code.created` - New promo code created
- `admin.promo_code.updated` - Promo code updated
- `admin.promo_code.disabled` - Promo code disabled

**Vehicle Type Events:**
- `admin.vehicle_type.created` - New vehicle type created
- `admin.vehicle_type.updated` - Vehicle type updated
- `admin.vehicle_type.deleted` - Vehicle type deleted

**Order Events:**
- `admin.order.updated` - Admin intervention on order

**Platform Settings Events:**
- `admin.platform_setting.updated` - Platform setting changed

### Event Schema

All events include:
```typescript
{
  type: AdminEventType;
  timestamp: Date;
  correlationId: string;
  actorId: string;  // Admin user ID
  // ... event-specific data
}
```

---

## Testing

### Run Tests

```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# Security tests
pnpm test:security

# Coverage report
pnpm test:coverage
```

### Test Categories

- **Unit Tests**: RBAC logic, audit service, validation schemas
- **Integration Tests**: tRPC procedures, database operations, event publishing
- **Security Tests**: Authentication, authorization, permission enforcement

---

## Deployment

### Docker Build

```bash
# Build image
docker build -t movenow/admin-management:latest .

# Run container
docker run -p 3001:3001 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  -e KAFKA_BROKERS=... \
  movenow/admin-management:latest
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/hpa.yaml

# Check status
kubectl get pods -l app=admin-management
kubectl logs -f deployment/admin-management
```

### Scaling

The service is designed to scale horizontally:
- **Stateless**: No in-memory session storage
- **Database**: Connection pooling with Prisma
- **Events**: Kafka consumer groups for distributed processing
- **HPA**: Auto-scaling based on CPU/memory (2-10 replicas)

---

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment (development/production) | development | No |
| `PORT` | HTTP server port | 3001 | No |
| `HOST` | HTTP server host | 0.0.0.0 | No |
| `DATABASE_URL` | PostgreSQL connection string | - | **Yes** |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | - | **Yes** |
| `JWT_EXPIRES_IN` | JWT expiration time | 24h | No |
| `KAFKA_BROKERS` | Kafka broker addresses | localhost:9092 | No |
| `KAFKA_CLIENT_ID` | Kafka client ID | admin-management-service | No |
| `KAFKA_GROUP_ID` | Kafka consumer group ID | admin-management-consumer-group | No |
| `SUPER_ADMIN_EMAIL` | Default super admin email | admin@movenow.com | No |
| `DEFAULT_ADMIN_PASSWORD` | Default admin password | changeme | No |
| `ENABLE_ANALYTICS` | Enable analytics features | true | No |
| `ENABLE_AUDIT_LOGS` | Enable audit logging | true | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | 900000 | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 | No |
| `LOG_LEVEL` | Logging level (error/warn/info/debug) | info | No |

---

## Sequence Diagrams

### Porter Verification Flow

```
Admin UI          Admin Service       Event Bus       Notification Service
   |                    |                  |                   |
   |--verifyDocument--->|                  |                   |
   |                    |--Get Document--->|                   |
   |                    |   (from DB)      |                   |
   |                    |                  |                   |
   |                    |--Update Status-->|                   |
   |                    |   (in DB)        |                   |
   |                    |                  |                   |
   |                    |--Create Audit--->|                   |
   |                    |   Log            |                   |
   |                    |                  |                   |
   |                    |--Publish Event-->|                   |
   |                    |   porter.verified|                   |
   |                    |                  |                   |
   |<------Success------|                  |                   |
   |                    |                  |--Consume Event--->|
   |                    |                  |                   |
   |                    |                  |                   |--Send Email/SMS
   |                    |                  |                   |  to Porter
```

### Promo Code Creation Flow

```
Admin UI          Admin Service       Event Bus       Pricing Service
   |                    |                  |                   |
   |--createPromoCode-->|                  |                   |
   |                    |--Validate Input->|                   |
   |                    |   (Zod Schema)   |                   |
   |                    |                  |                   |
   |                    |--Check Existing->|                   |
   |                    |   (Unique Code)  |                   |
   |                    |                  |                   |
   |                    |--Create in DB--->|                   |
   |                    |                  |                   |
   |                    |--Create Audit--->|                   |
   |                    |   Log            |                   |
   |                    |                  |                   |
   |                    |--Publish Event-->|                   |
   |                    |   promo.created  |                   |
   |                    |                  |                   |
   |<--PromoCode Data---|                  |                   |
   |                    |                  |--Consume Event--->|
   |                    |                  |                   |
   |                    |                  |                   |--Update Pricing
   |                    |                  |                   |  Rules Cache
```

### Order Admin Intervention Flow

```
Admin UI          Admin Service       Event Bus       Order Service
   |                    |                  |                   |
   |--updateOrder------>|                  |                   |
   |  (reassign porter) |                  |                   |
   |                    |--Get Order------>|                   |
   |                    |   (from DB)      |                   |
   |                    |                  |                   |
   |                    |--Update Order--->|                   |
   |                    |   (in DB)        |                   |
   |                    |                  |                   |
   |                    |--Create Audit--->|                   |
   |                    |   Log (reason)   |                   |
   |                    |                  |                   |
   |                    |--Publish Event-->|                   |
   |                    |   order.updated  |                   |
   |                    |                  |                   |
   |<------Success------|                  |                   |
   |                    |                  |--Consume Event--->|
   |                    |                  |                   |
   |                    |                  |                   |--Sync Order State
   |                    |                  |                   |--Notify Customer
   |                    |                  |                   |--Notify Porter
```

---

## Monitoring & Observability

### Metrics

The service exposes the following metrics:
- Admin actions per second
- Vehicle types managed
- Promo codes created/updated
- Orders updated by admin
- Audit log writes per second

### Logs

Structured JSON logs with:
- Timestamp
- Log level
- Service name
- Correlation ID
- Actor ID (admin user)
- Request path
- Response time

### Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "service": "admin-management",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

---

## Security Considerations

1. **JWT Security**: Use strong secrets (min 32 characters), rotate regularly
2. **RBAC Enforcement**: All procedures check permissions before execution
3. **Audit Logging**: All admin actions are logged immutably
4. **Rate Limiting**: 100 requests per 15 minutes per IP
5. **SQL Injection**: Protected by Prisma's parameterized queries
6. **HTTPS Only**: Use TLS in production
7. **Password Hashing**: Bcrypt with salt rounds

---

## Contributing

When adding new admin procedures:

1. Define the Zod input/output schemas in `src/types/schemas.ts`
2. Add the procedure to the appropriate router in `src/routers/`
3. Add permission checks using `requirePermission()` middleware
4. Create audit logs for state-changing operations
5. Publish events for actions that other services need to know about
6. Write unit tests and integration tests
7. Update this README

---

## License

MIT

---

## Support

For issues or questions:
- Create an issue in the repository
- Contact the MoveNow platform team
- Check the main monorepo README for general setup

---

**Built with ❤️ by the MoveNow Team**
