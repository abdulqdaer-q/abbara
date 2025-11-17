# MoveNow - On-Demand Moving & Porter Services Platform

A comprehensive microservices-based platform for on-demand moving and porter services, featuring mobile apps for customers and porters, plus a web-based admin panel.

## 🏗️ Architecture

This is a monorepo project using pnpm workspaces with the following structure:

```
movenow/
├── apps/                    # Frontend applications
│   ├── customer-app/       # React Native customer app
│   ├── porter-app/         # React Native porter app
│   └── admin-panel/        # React.js admin dashboard
├── services/               # Backend microservices
│   ├── api-gateway/       # tRPC API Gateway
│   ├── auth-users-service/# Authentication & user management
│   ├── orders-service/    # Order management (planned)
│   ├── payments-service/  # Payment processing (planned)
│   └── notifications-service/ # Notifications (planned)
└── packages/              # Shared packages
    └── common/           # Shared types, schemas, events
```

## 🚀 Tech Stack

### Frontend
- **Mobile Apps**: React Native (Expo), TypeScript, Redux Toolkit, React Navigation
- **Admin Panel**: React 18, TypeScript, Vite, TailwindCSS
- **Real-time**: Socket.io Client
- **API**: tRPC Client with React Query
- **Maps**: React Native Maps, Mapbox

### Backend
- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express.js
- **API**: tRPC
- **Database**: PostgreSQL (Prisma ORM)
- **Message Queue**: RabbitMQ
- **Caching**: Redis
- **Real-time**: Socket.io

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes
- **CI/CD**: GitHub Actions
- **Cloud**: AWS/Azure/GCP

## 📋 Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3.12+

## 🛠️ Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/movenow.git
cd movenow
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

```bash
# Backend services
cp services/api-gateway/.env.example services/api-gateway/.env
cp services/auth-users-service/.env.example services/auth-users-service/.env

# Frontend apps
cp apps/customer-app/.env.example apps/customer-app/.env
cp apps/porter-app/.env.example apps/porter-app/.env
cp apps/admin-panel/.env.example apps/admin-panel/.env
```

### 4. Start Infrastructure Services

```bash
docker-compose up -d postgres redis rabbitmq
```

### 5. Run Database Migrations

```bash
cd services/auth-users-service
pnpm prisma migrate dev
```

### 6. Start Development Servers

```bash
# Start all services and apps
pnpm dev

# Or start individually
pnpm --filter api-gateway dev
pnpm --filter auth-users-service dev
pnpm --filter @movenow/customer-app start
pnpm --filter @movenow/porter-app start
pnpm --filter @movenow/admin-panel dev
```

## 📱 Applications

### Customer App (React Native)

**Features:**
- User registration and authentication
- Order creation with address selection
- Real-time order tracking on map
- In-app chat with porter
- Order history and receipts
- Rating and reviews
- Push notifications

**Getting Started:**
```bash
cd apps/customer-app
pnpm start        # Start Expo
pnpm ios          # Run on iOS
pnpm android      # Run on Android
```

### Porter App (React Native)

**Features:**
- Porter registration and verification
- Online/offline status toggle
- Job request notifications
- Accept/reject job requests
- Turn-by-turn navigation
- Order workflow management
- Earnings dashboard
- In-app chat with customer

**Getting Started:**
```bash
cd apps/porter-app
pnpm start        # Start Expo
pnpm ios          # Run on iOS
pnpm android      # Run on Android
```

### Admin Panel (React.js)

**Features:**
- Dashboard with KPIs
- User management (customers & porters)
- Porter verification
- Order management
- Vehicle types & pricing configuration
- Promo code management
- Analytics and reports
- Platform settings

**Getting Started:**
```bash
cd apps/admin-panel
pnpm dev          # Start dev server (http://localhost:3001)
pnpm build        # Build for production
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Test specific app/service
pnpm --filter @movenow/customer-app test
pnpm --filter api-gateway test

# E2E tests
pnpm --filter @movenow/customer-app test:e2e
```

## 🏗️ Building for Production

### Mobile Apps

```bash
# Customer App
cd apps/customer-app
eas build --platform ios
eas build --platform android

# Porter App
cd apps/porter-app
eas build --platform ios
eas build --platform android
```

### Admin Panel

```bash
cd apps/admin-panel
pnpm build
# Output in dist/ directory
```

### Backend Services

```bash
# Build all services
pnpm build

# Build specific service
pnpm --filter api-gateway build
```

## 🐳 Docker Deployment

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

## 📚 Documentation

- [Frontend Architecture](./FRONTEND_ARCHITECTURE.md)
- [Sequence Diagrams](./docs/SEQUENCE_DIAGRAMS.md)
- [API Documentation](./services/api-gateway/README.md)
- [Customer App Guide](./apps/customer-app/README.md)
- [Porter App Guide](./apps/porter-app/README.md)
- [Admin Panel Guide](./apps/admin-panel/README.md)

## 🔧 Available Scripts

```bash
# Development
pnpm dev              # Start all services in dev mode
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm type-check       # Type check all packages

# Specific filters
pnpm --filter <package-name> <script>
```

## 🌳 Git Workflow

1. Create feature branch from `develop`
2. Make changes and commit
3. Run tests and linting
4. Create pull request to `develop`
5. After review, merge to `develop`
6. Release to `main` for production

## 📄 License

MIT

## 👥 Contributors

- MoveNow Team

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📧 Support

For support, email support@movenow.com or create an issue in the repository.
