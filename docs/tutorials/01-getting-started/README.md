# Getting Started with MoveNow API

This tutorial will help you set up your development environment and make your first API call to the MoveNow platform.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Understanding tRPC](#understanding-trpc)
- [Environment Setup](#environment-setup)
- [Your First API Call](#your-first-api-call)
- [Error Handling](#error-handling)
- [Next Steps](#next-steps)

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **npm** or **pnpm** package manager
- Basic TypeScript knowledge
- A code editor (VS Code recommended)

## Understanding tRPC

MoveNow uses **tRPC** instead of traditional REST or GraphQL. Here's why:

### What is tRPC?

tRPC is a framework for building **type-safe APIs** in TypeScript. Key benefits:

- **End-to-end type safety** - Your client knows the exact shape of API responses
- **No code generation** - Types are inferred automatically
- **Autocompletion** - Your IDE suggests available procedures
- **Compile-time errors** - Catch API misuse before runtime

### tRPC vs REST

```typescript
// ❌ Traditional REST (no type safety)
const response = await fetch('/api/orders/123');
const order = await response.json(); // order is 'any' type

// ✅ tRPC (fully typed)
const order = await client.orders.get.query({ orderId: '123' });
// order type is automatically inferred: Order
```

### Key Concepts

- **Router** - A collection of procedures (similar to REST endpoints)
- **Procedure** - A single API operation
  - **Query** - For reading data (like GET)
  - **Mutation** - For modifying data (like POST/PUT/DELETE)
  - **Subscription** - For real-time updates
- **Context** - Request-scoped data (auth, user info, etc.)

## Environment Setup

### 1. Create a New Project

```bash
# Create a new directory
mkdir movenow-client
cd movenow-client

# Initialize package.json
npm init -y

# Install TypeScript
npm install -D typescript @types/node tsx

# Initialize TypeScript config
npx tsc --init
```

### 2. Install tRPC Client

```bash
npm install @trpc/client
```

### 3. Configure TypeScript

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### 4. Set Up Type Imports (Option 1: Using Shared Types)

If you have access to the monorepo, you can import types directly:

```typescript
// src/client.ts
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@movenow/api-gateway';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
      headers() {
        return {
          'Content-Type': 'application/json',
        };
      },
    }),
  ],
});

export { client };
```

### 5. Set Up Type Imports (Option 2: External Client)

If you're building an external application, you need to generate types:

```typescript
// src/client.ts
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

// You'll need to either:
// 1. Import the router type from a published package
// 2. Generate types from the API schema
// 3. Use any and lose type safety (not recommended)

// For this tutorial, we'll use a published package approach
import type { AppRouter } from '@movenow/api-types';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: process.env.API_URL || 'http://localhost:3000/trpc',
    }),
  ],
});

export { client };
```

## Your First API Call

Let's make some actual API calls to test our setup!

### Example 1: Get Nearby Porters (Public Endpoint)

Create `src/examples/nearby-porters.ts`:

```typescript
import { client } from '../client';

async function findNearbyPorters() {
  try {
    // Find porters near a location (San Francisco coordinates)
    const porters = await client.porters.nearby.query({
      lat: 37.7749,
      lng: -122.4194,
      radiusMeters: 5000, // 5km radius
      vehicleType: 'VAN', // Optional filter
    });

    console.log(`Found ${porters.length} nearby porters:`);
    porters.forEach((porter) => {
      console.log(`- ${porter.displayName}`);
      console.log(`  Vehicle: ${porter.vehicleType}`);
      console.log(`  Rating: ${porter.averageRating}/5`);
      console.log(`  Distance: ${porter.distanceMeters}m`);
      console.log();
    });
  } catch (error) {
    console.error('Error finding porters:', error);
  }
}

findNearbyPorters();
```

Run it:

```bash
npx tsx src/examples/nearby-porters.ts
```

### Example 2: Health Check

Create `src/examples/health-check.ts`:

```typescript
import { client } from '../client';

async function checkApiHealth() {
  try {
    // Most tRPC servers expose a health check
    const health = await client.health.query();

    console.log('API Status:', health.status);
    console.log('Version:', health.version);
    console.log('Services:', health.services);
  } catch (error) {
    console.error('API is not available:', error);
  }
}

checkApiHealth();
```

### Example 3: Estimate Price (Public Endpoint)

Create `src/examples/estimate-price.ts`:

```typescript
import { client } from '../client';

async function estimateOrderPrice() {
  try {
    const estimate = await client.payments.estimatePrice.query({
      pickup: {
        address: '123 Market St, San Francisco, CA',
        lat: 37.7749,
        lng: -122.4194,
      },
      dropoff: {
        address: '456 Mission St, San Francisco, CA',
        lat: 37.7849,
        lng: -122.3974,
      },
      vehicleType: 'VAN',
      porterCount: 2,
      scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
    });

    console.log('Price Estimate:');
    console.log(`Base Fare: $${estimate.baseFareCents / 100}`);
    console.log(`Distance: ${estimate.distanceKm} km`);
    console.log(`Duration: ${estimate.durationMinutes} minutes`);
    console.log(`Porter Fee: $${estimate.porterFeeCents / 100}`);
    console.log(`Service Fee: $${estimate.serviceFeeCents / 100}`);
    console.log(`─────────────────────────`);
    console.log(`Total: $${estimate.totalCents / 100}`);
  } catch (error) {
    console.error('Error estimating price:', error);
  }
}

estimateOrderPrice();
```

## Error Handling

tRPC errors follow a standard structure. Here's how to handle them properly:

### Basic Error Handling

```typescript
import { TRPCClientError } from '@trpc/client';

async function callApiWithErrorHandling() {
  try {
    const result = await client.orders.get.query({ orderId: 'invalid-id' });
    return result;
  } catch (error) {
    if (error instanceof TRPCClientError) {
      console.error('tRPC Error Code:', error.data?.code);
      console.error('Error Message:', error.message);
      console.error('HTTP Status:', error.data?.httpStatus);

      // Handle specific error codes
      switch (error.data?.code) {
        case 'UNAUTHORIZED':
          console.log('Please log in first');
          break;
        case 'NOT_FOUND':
          console.log('Order not found');
          break;
        case 'BAD_REQUEST':
          console.log('Invalid request:', error.message);
          break;
        default:
          console.log('Unexpected error');
      }
    } else {
      // Network or other errors
      console.error('Unexpected error:', error);
    }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `BAD_REQUEST` | 400 | Invalid input parameters |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Not authorized |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

### Typed Error Handling Utility

Create `src/utils/error-handler.ts`:

```typescript
import { TRPCClientError } from '@trpc/client';

export interface ApiError {
  code: string;
  message: string;
  statusCode?: number;
}

export function handleApiError(error: unknown): ApiError {
  if (error instanceof TRPCClientError) {
    return {
      code: error.data?.code || 'UNKNOWN_ERROR',
      message: error.message,
      statusCode: error.data?.httpStatus,
    };
  }

  return {
    code: 'CLIENT_ERROR',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  };
}

// Usage
try {
  const order = await client.orders.get.query({ orderId: '123' });
} catch (error) {
  const apiError = handleApiError(error);
  console.error(`[${apiError.code}] ${apiError.message}`);
}
```

## Advanced Setup

### Adding Authentication

Most endpoints require authentication. Here's how to add JWT tokens:

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@movenow/api-gateway';

let authToken: string | null = null;

export const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
      headers() {
        return {
          'Content-Type': 'application/json',
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        };
      },
    }),
  ],
});

export function setAuthToken(token: string) {
  authToken = token;
}

export function clearAuthToken() {
  authToken = null;
}
```

### Environment Variables

Create `.env`:

```env
API_URL=http://localhost:3000/trpc
NODE_ENV=development
```

Install dotenv:

```bash
npm install dotenv
```

Update your client:

```typescript
import 'dotenv/config';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

const client = createTRPCProxyClient({
  links: [
    httpBatchLink({
      url: process.env.API_URL || 'http://localhost:3000/trpc',
    }),
  ],
});
```

### Request Logging

Add logging to debug API calls:

```typescript
import { createTRPCProxyClient, httpBatchLink, loggerLink } from '@trpc/client';

const client = createTRPCProxyClient({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === 'development' ||
        (opts.direction === 'down' && opts.result instanceof Error),
    }),
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
});
```

## Testing Your Setup

Create a comprehensive test file `src/test-setup.ts`:

```typescript
import { client, setAuthToken } from './client';

async function testSetup() {
  console.log('🧪 Testing MoveNow API Setup\n');

  // Test 1: Public endpoint
  console.log('Test 1: Finding nearby porters...');
  try {
    const porters = await client.porters.nearby.query({
      lat: 37.7749,
      lng: -122.4194,
      radiusMeters: 5000,
    });
    console.log('✅ Success! Found', porters.length, 'porters\n');
  } catch (error) {
    console.log('❌ Failed:', error, '\n');
  }

  // Test 2: Price estimation
  console.log('Test 2: Estimating price...');
  try {
    const estimate = await client.payments.estimatePrice.query({
      pickup: { lat: 37.7749, lng: -122.4194, address: '123 Market St' },
      dropoff: { lat: 37.7849, lng: -122.3974, address: '456 Mission St' },
      vehicleType: 'VAN',
      porterCount: 2,
    });
    console.log('✅ Success! Total:', `$${estimate.totalCents / 100}\n`);
  } catch (error) {
    console.log('❌ Failed:', error, '\n');
  }

  // Test 3: Protected endpoint (should fail without auth)
  console.log('Test 3: Accessing protected endpoint without auth...');
  try {
    await client.orders.list.query({ limit: 10 });
    console.log('❌ Unexpected: Should have failed\n');
  } catch (error) {
    console.log('✅ Expected failure: Unauthorized\n');
  }

  console.log('🎉 Setup test complete!');
}

testSetup();
```

Run the test:

```bash
npx tsx src/test-setup.ts
```

## Common Issues

### Issue: Type errors with AppRouter

**Solution**: Ensure you're importing the correct router type:

```typescript
// ✅ Correct
import type { AppRouter } from '@movenow/api-gateway';

// ❌ Wrong
import { AppRouter } from '@movenow/api-gateway'; // Don't import as value
```

### Issue: CORS errors

**Solution**: Make sure the API Gateway has CORS enabled for your origin:

```typescript
// Server-side (already configured in api-gateway)
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
```

### Issue: Connection refused

**Solution**: Verify the API Gateway is running:

```bash
cd services/api-gateway
pnpm dev
```

### Issue: Module not found errors

**Solution**: Ensure all dependencies are installed:

```bash
npm install @trpc/client
```

## Next Steps

Now that you have your environment set up, continue with:

1. **[Authentication Tutorial](../02-authentication/README.md)** - Learn how to register users and manage sessions
2. **[Order Management Tutorial](../03-orders/README.md)** - Create and manage orders
3. **[Real-time Features](../06-realtime/README.md)** - Set up WebSocket connections

## Quick Reference

### Creating a tRPC Client

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

const client = createTRPCProxyClient<AppRouter>({
  links: [httpBatchLink({ url: 'http://localhost:3000/trpc' })],
});
```

### Making API Calls

```typescript
// Query (read data)
const data = await client.procedureName.query(input);

// Mutation (modify data)
const result = await client.procedureName.mutate(input);
```

### Error Handling

```typescript
import { TRPCClientError } from '@trpc/client';

try {
  await client.procedureName.query(input);
} catch (error) {
  if (error instanceof TRPCClientError) {
    console.error(error.data?.code, error.message);
  }
}
```

---

**Ready to authenticate?** Continue to **[Authentication Tutorial](../02-authentication/README.md)** →
