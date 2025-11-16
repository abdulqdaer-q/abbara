# Auth & Users Service

Production-ready Authentication and User Management Service for the MoveNow platform.

## Features

### Authentication
- User registration with email/phone and password
- Login with JWT access and refresh tokens
- Token rotation and refresh token management
- Logout with token revocation
- Password reset flow with time-limited tokens
- Rate limiting on sensitive endpoints
- Device tracking for refresh tokens

### User Management
- User profile CRUD operations
- Public profile retrieval
- Role-based access control (CUSTOMER, PORTER, ADMIN)
- User search functionality
- Email and phone verification support

### Porter Verification
- Porter onboarding and profile management
- Document submission and verification
- Verification status tracking
- Porter rating system
- Verified porter search

### Event Publishing
- UserCreated, UserUpdated events
- PorterVerificationRequested, PorterVerified events
- Kafka/RabbitMQ support
- PII minimization in events

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express + tRPC
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Sessions**: Redis
- **Message Bus**: Kafka (RabbitMQ supported)
- **Authentication**: JWT with RS256/HS256
- **Password Hashing**: Argon2id
- **Validation**: Zod schemas

## Project Structure

```
services/auth-users-service/
├── src/
│   ├── config/              # Configuration loader
│   ├── events/              # Event publishers and helpers
│   ├── middleware/          # Auth, RBAC, rate limiting, correlation ID
│   ├── repositories/        # Database access layer
│   ├── routers/             # tRPC routers (auth, users, porters)
│   ├── trpc/                # tRPC setup and context
│   ├── utils/               # JWT, password, token utilities
│   └── index.ts             # Application entry point
├── prisma/
│   ├── schema.prisma        # Prisma schema
│   └── migrations/          # Database migrations
├── tests/
│   ├── unit/                # Unit tests
│   └── integration/         # Integration tests
├── k8s/                     # Kubernetes manifests
├── docker-compose.yml       # Local development setup
├── Dockerfile               # Multi-stage Docker build
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker and Docker Compose (for local development)
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)
- Kafka (or use Docker)

### Local Development with Docker Compose

1. **Clone the repository**

```bash
git clone <repository-url>
cd services/auth-users-service
```

2. **Copy environment variables**

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start all services**

```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379
- Kafka and Zookeeper
- Auth & Users Service on port 3001

4. **Run migrations**

```bash
docker-compose exec auth-users-service pnpm prisma:migrate
```

5. **Access the service**

- Health check: http://localhost:3001/health
- Readiness check: http://localhost:3001/ready
- tRPC endpoint: http://localhost:3001/trpc

### Manual Setup (Without Docker)

1. **Install dependencies**

```bash
pnpm install
```

2. **Set up environment variables**

```bash
cp .env.example .env
# Edit .env with your database and Redis URLs
```

3. **Generate Prisma client**

```bash
pnpm prisma:generate
```

4. **Run database migrations**

```bash
pnpm prisma:migrate
```

5. **Start development server**

```bash
pnpm dev
```

## Database Migrations

### Create a new migration

```bash
pnpm prisma:migrate
```

### Apply migrations in production

```bash
pnpm prisma:migrate:prod
```

### Open Prisma Studio

```bash
pnpm prisma:studio
```

## Testing

### Run all tests

```bash
pnpm test
```

### Run tests in watch mode

```bash
pnpm test:watch
```

### Run tests with coverage

```bash
pnpm test:coverage
```

## Authentication Flows

### Registration Flow

```
Client                    Service                  Database           Events
  |                         |                         |                 |
  |---register(email)------>|                         |                 |
  |                         |---validate input------->|                 |
  |                         |---check uniqueness----->|                 |
  |                         |<--user exists?----------|                 |
  |                         |---hash password-------->|                 |
  |                         |---create user---------->|                 |
  |                         |<--user created----------|                 |
  |                         |---create refresh token->|                 |
  |                         |---publish event-------->|---------------->|
  |<--tokens + user---------|                         |                 |
```

### Login Flow

```
Client                    Service                  Database           Redis
  |                         |                         |                 |
  |---login(email, pass)--->|                         |                 |
  |                         |---find user------------>|                 |
  |                         |<--user data-------------|                 |
  |                         |---verify password------>|                 |
  |                         |---create refresh token->|                 |
  |                         |---store token hash------|---------------->|
  |<--tokens + user---------|                         |                 |
```

### Refresh Token Flow

```
Client                    Service                  Database
  |                         |                         |
  |---refresh(token)------->|                         |
  |                         |---verify JWT----------->|
  |                         |---check token hash----->|
  |                         |<--token valid?----------|
  |                         |---check revoked?------->|
  |                         |---revoke old token----->|
  |                         |---create new token----->|
  |<--new tokens------------|                         |
```

### Password Reset Flow

```
Request Phase:
Client                    Service                  Database           Notifications
  |                         |                         |                    |
  |---requestReset(email)-->|                         |                    |
  |                         |---find user------------>|                    |
  |                         |---generate token------->|                    |
  |                         |---store token hash----->|                    |
  |                         |---send email------------|-------------------->|
  |<--success message-------|                         |                    |

Confirm Phase:
Client                    Service                  Database
  |                         |                         |
  |---confirmReset--------->|                         |
  |   (token, password)     |---verify token--------->|
  |                         |---hash password-------->|
  |                         |---update user---------->|
  |                         |---mark token used------>|
  |                         |---revoke all tokens---->|
  |<--success---------------|                         |
```

## API Documentation

### Authentication Router (`auth`)

#### `auth.register`
- **Input**: `{ email?, phone?, password, displayName, role?, idempotencyKey? }`
- **Output**: `{ user, accessToken, refreshToken }`
- **Errors**: `BAD_REQUEST`, `CONFLICT`

#### `auth.login`
- **Input**: `{ email?, phone?, password }`
- **Output**: `{ user, accessToken, refreshToken }`
- **Errors**: `BAD_REQUEST`, `UNAUTHORIZED`

#### `auth.refresh`
- **Input**: `{ refreshToken }`
- **Output**: `{ accessToken, refreshToken }`
- **Errors**: `UNAUTHORIZED`

#### `auth.logout`
- **Input**: `{ refreshToken?, revokeAll? }`
- **Output**: `{ message, count? }`
- **Auth**: Required

#### `auth.requestPasswordReset`
- **Input**: `{ email?, phone? }`
- **Output**: `{ message }`
- **Rate Limited**: Yes

#### `auth.confirmPasswordReset`
- **Input**: `{ token, newPassword }`
- **Output**: `{ message }`

### Users Router (`users`)

#### `users.getProfile`
- **Output**: User profile
- **Auth**: Required

#### `users.updateProfile`
- **Input**: `{ displayName?, avatarUrl?, email?, phone? }`
- **Output**: Updated user profile
- **Auth**: Required

#### `users.getPublicProfile`
- **Input**: `{ userId }`
- **Output**: Public user profile

#### `users.search`
- **Input**: `{ query, limit? }`
- **Output**: User array
- **Auth**: Required

#### `users.getUserById`
- **Input**: `{ userId }`
- **Output**: User details
- **Auth**: Admin only

#### `users.updateRole`
- **Input**: `{ userId, role }`
- **Output**: Updated role
- **Auth**: Admin only

### Porters Router (`porters`)

#### `porters.submitVerification`
- **Input**: `{ documents: [{ type, url }] }`
- **Output**: `{ id, verificationStatus, message }`
- **Auth**: Porter only

#### `porters.getVerificationStatus`
- **Output**: Verification details
- **Auth**: Required

#### `porters.getPorterProfile`
- **Input**: `{ userId }`
- **Output**: Porter profile

#### `porters.listByStatus`
- **Input**: `{ status, skip?, take? }`
- **Output**: Porter profiles array
- **Auth**: Admin only

#### `porters.updateVerificationStatus`
- **Input**: `{ userId, status, rejectionReason? }`
- **Output**: Updated verification
- **Auth**: Admin only

#### `porters.updateRating`
- **Input**: `{ porterId, rating }`
- **Output**: Updated rating
- **Auth**: Required

#### `porters.searchVerified`
- **Input**: `{ skip?, take?, minRating? }`
- **Output**: Verified porters array
- **Auth**: Required

## Environment Variables

See `.env.example` for all required and optional environment variables.

### Critical Variables

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_ACCESS_SECRET`: Secret for access tokens (32+ chars)
- `JWT_REFRESH_SECRET`: Secret for refresh tokens (32+ chars)
- `KAFKA_BROKERS`: Kafka broker addresses

## Security Features

- **Password Hashing**: Argon2id with configurable work factors
- **JWT Tokens**: Short-lived access tokens, rotating refresh tokens
- **Token Revocation**: Refresh tokens stored hashed and can be revoked
- **Refresh Token Rotation**: Automatic rotation on refresh
- **Token Reuse Detection**: Revokes all tokens on reuse attempt
- **Rate Limiting**: Protects login, register, and password reset
- **Input Validation**: All inputs validated with Zod schemas
- **PII Protection**: Events minimize PII exposure
- **Correlation IDs**: Request tracing for security auditing

## Production Deployment

### Docker

```bash
# Build production image
docker build -t movenow/auth-users-service:latest --target production .

# Run with environment variables
docker run -p 3001:3001 \
  -e DATABASE_URL=... \
  -e REDIS_URL=... \
  -e JWT_ACCESS_SECRET=... \
  movenow/auth-users-service:latest
```

### Kubernetes

```bash
# Create secrets
kubectl create secret generic auth-users-service-secrets \
  --from-literal=DATABASE_URL=... \
  --from-literal=REDIS_URL=... \
  --from-literal=JWT_ACCESS_SECRET=...

# Apply manifests
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## Monitoring

### Health Checks

- **Health**: `GET /health` - Basic health check
- **Readiness**: `GET /ready` - Database connectivity check

### Metrics

Prometheus metrics available on port 9090 (if enabled)

### Logging

Structured JSON logs with correlation IDs for request tracing.

## Contributing

1. Follow TypeScript and ESLint conventions
2. Write tests for new features
3. Update documentation
4. Ensure all tests pass before submitting PR

## License

MIT
