# MoveNow API Tutorials

Welcome to the MoveNow Platform API tutorials! This guide will help you build applications on top of MoveNow's microservices architecture using tRPC.

## 📚 About These Tutorials

These tutorials are designed to be hands-on, practical guides that will take you from basic setup to advanced integration with the MoveNow platform. Each tutorial includes:

- **Code examples** in TypeScript
- **Step-by-step instructions**
- **Best practices** and common pitfalls
- **Real-world use cases**

## 🏗️ Architecture Overview

MoveNow is built as a microservices architecture with:

- **tRPC** for type-safe API communication (not REST or GraphQL)
- **PostgreSQL** with Prisma ORM for data persistence
- **Kafka/RabbitMQ** for event-driven communication
- **Redis** for caching and session management
- **Socket.io** for real-time features
- **JWT** for authentication

## 🎯 Tutorial Roadmap

### Level 1: Fundamentals

1. **[Getting Started](./01-getting-started/README.md)**
   - Environment setup
   - Making your first API call
   - Understanding tRPC clients
   - Error handling basics

2. **[Authentication & Users](./02-authentication/README.md)**
   - User registration
   - Login and token management
   - Password reset flow
   - Profile management

### Level 2: Core Features

3. **[Order Management](./03-orders/README.md)**
   - Creating orders
   - Understanding the order lifecycle
   - Multi-stop orders and waypoints
   - Order evidence and documentation

4. **[Bidding System](./04-bidding/README.md)**
   - How bidding works
   - Opening bidding windows
   - Placing and accepting bids
   - Evaluation strategies

5. **[Porter Workflows](./05-porters/README.md)**
   - Porter registration and verification
   - Availability management
   - Accepting and rejecting jobs
   - Location updates and tracking

### Level 3: Advanced Features

6. **[Real-time Features](./06-realtime/README.md)**
   - WebSocket setup with Socket.io
   - Real-time location tracking
   - In-app chat messaging
   - Job offer notifications

7. **[Pricing & Payments](./08-pricing-payments/README.md)**
   - Price estimation
   - Creating payment intents
   - Price snapshots
   - Pricing rules and configuration

8. **[Notifications & Messaging](./07-notifications/README.md)**
   - Sending push notifications
   - Email and SMS notifications
   - User preferences
   - Broadcast messages

### Level 4: Administration

9. **[Admin Management](./09-admin/README.md)**
   - User and porter management
   - Vehicle type configuration
   - Promotional codes
   - Analytics and reporting

## 🚀 Quick Start Paths

### For Mobile App Developers (Customer App)

Follow these tutorials in order:
1. Getting Started → 2. Authentication → 3. Orders → 6. Real-time → 8. Pricing

**Goal:** Build a customer-facing app where users can book moving services.

### For Mobile App Developers (Porter App)

Follow these tutorials in order:
1. Getting Started → 2. Authentication → 5. Porters → 4. Bidding → 6. Real-time

**Goal:** Build a porter app for accepting jobs and managing availability.

### For Web Dashboard Developers

Follow these tutorials in order:
1. Getting Started → 2. Authentication → 9. Admin → 7. Notifications → 6. Real-time

**Goal:** Build an admin dashboard for platform management.

### For Backend Integration Developers

Follow all tutorials in numerical order.

**Goal:** Integrate MoveNow services with existing systems or build custom solutions.

## 🔑 Prerequisites

Before starting these tutorials, you should have:

- **Node.js 18+** installed
- **TypeScript** knowledge (basic to intermediate)
- **Understanding of async/await** and Promises
- **Git** for cloning the repository
- **Docker** (optional, for running services locally)

## 🛠️ Development Environment

### Option 1: Use the API Gateway (Recommended for Clients)

Connect to the deployed API Gateway at `http://localhost:3000` (or production URL).

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@movenow/api-gateway';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
});
```

### Option 2: Direct Service Communication (Advanced)

Connect directly to individual microservices for specific features.

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@movenow/orders-service';

const ordersClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:4001/trpc',
    }),
  ],
});
```

## 📖 Tutorial Structure

Each tutorial follows this structure:

1. **Overview** - What you'll learn
2. **Prerequisites** - What you need to know before starting
3. **Concepts** - Key concepts explained
4. **Implementation** - Step-by-step code walkthrough
5. **Testing** - How to test your implementation
6. **Common Issues** - Troubleshooting guide
7. **Next Steps** - Where to go from here

## 🔗 Additional Resources

- **[Main README](../../README.md)** - Project overview and setup
- **[Sequence Diagrams](../SEQUENCE_DIAGRAMS.md)** - Visual workflow documentation
- **[Frontend Architecture](../../FRONTEND_ARCHITECTURE.md)** - Frontend application structure
- **Service READMEs** - Detailed documentation for each microservice
  - [API Gateway](../../services/api-gateway/README.md)
  - [Auth & Users](../../services/auth-users-service/README.md)
  - [Orders](../../services/orders-service/README.md)
  - [Bidding](../../services/bidding-service/README.md)
  - [Porters](../../services/porters-service/README.md)
  - [Pricing](../../services/pricing/README.md)
  - [Notifications](../../services/notification-service/README.md)
  - [Admin](../../services/admin-management/README.md)
  - [Realtime](../../services/realtime-gateway/README.md)

## 💡 Best Practices

Throughout these tutorials, we emphasize:

- **Type Safety** - Leveraging TypeScript and tRPC for compile-time guarantees
- **Error Handling** - Proper error handling and user feedback
- **Idempotency** - Safe retry mechanisms for critical operations
- **Security** - Authentication, authorization, and data validation
- **Performance** - Caching, pagination, and efficient queries
- **Real-time** - WebSocket best practices and connection management

## 🆘 Getting Help

If you encounter issues:

1. Check the **Common Issues** section in each tutorial
2. Review the service-specific README files
3. Examine the sequence diagrams for workflow understanding
4. Check the codebase examples in `/apps` directory
5. Open an issue in the repository

## 🎓 Learning Path

```
Beginner          Intermediate       Advanced
   ↓                   ↓                 ↓
Getting Started → Authentication → Orders
                       ↓                 ↓
                   Porters ←→ Bidding System
                       ↓                 ↓
                Real-time Features ← Pricing
                       ↓                 ↓
                  Notifications ← Admin Management
```

Ready to get started? Jump into **[Getting Started](./01-getting-started/README.md)**!

---

**Built with ❤️ for the MoveNow Platform**
