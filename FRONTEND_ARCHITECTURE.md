# MoveNow Frontend Architecture

## Overview

The MoveNow frontend consists of three main applications:

1. **Customer App** (React Native) - iOS/Android mobile app for customers
2. **Porter App** (React Native) - iOS/Android mobile app for porters
3. **Admin Panel** (React.js) - Web-based admin dashboard

## Architecture Principles

- **Modular Design**: Feature-based module organization
- **Type Safety**: Full TypeScript implementation with shared types
- **State Management**: Redux Toolkit for global state, React Query for server state
- **Real-time Updates**: Socket.io integration for live data
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Testing**: Comprehensive test coverage (unit, integration, E2E)

## Technology Stack

### Customer & Porter Apps (React Native)

- **Framework**: React Native 0.73 with Expo
- **Language**: TypeScript
- **Navigation**: React Navigation v6
- **State Management**: Redux Toolkit
- **Data Fetching**: React Query + tRPC
- **Real-time**: Socket.io Client
- **Maps**: React Native Maps
- **Testing**: Jest + React Testing Library + Detox

### Admin Panel (React.js)

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Redux Toolkit
- **Routing**: React Router v6
- **Data Fetching**: React Query + tRPC
- **Charts**: Recharts
- **Testing**: Vitest + React Testing Library

## Project Structure

```
apps/
├── customer-app/           # Customer mobile app
│   ├── src/
│   │   ├── navigation/    # Navigation configuration
│   │   ├── modules/       # Feature modules
│   │   │   ├── auth/     # Authentication
│   │   │   ├── order/    # Order management
│   │   │   ├── map/      # Map & tracking
│   │   │   ├── chat/     # In-app chat
│   │   │   ├── profile/  # User profile
│   │   │   └── ratings/  # Rating system
│   │   ├── components/   # Reusable components
│   │   ├── services/     # API & Socket services
│   │   ├── store/        # Redux store
│   │   ├── hooks/        # Custom hooks
│   │   └── utils/        # Utilities
│   └── __tests__/        # Tests
│
├── porter-app/            # Porter mobile app
│   ├── src/
│   │   ├── navigation/   # Navigation configuration
│   │   ├── modules/      # Feature modules
│   │   │   ├── auth/    # Authentication
│   │   │   ├── jobs/    # Job management
│   │   │   ├── map/     # Navigation
│   │   │   ├── chat/    # Chat
│   │   │   ├── wallet/  # Earnings
│   │   │   └── profile/ # Profile & verification
│   │   ├── components/  # Reusable components
│   │   ├── services/    # API & Socket services
│   │   ├── store/       # Redux store
│   │   └── utils/       # Utilities
│   └── __tests__/       # Tests
│
└── admin-panel/          # Admin web dashboard
    ├── src/
    │   ├── components/  # Reusable components
    │   │   ├── layout/ # Layout components
    │   │   ├── common/ # Common components
    │   │   └── ui/     # UI primitives
    │   ├── modules/    # Feature modules
    │   │   ├── dashboard/  # Dashboard
    │   │   ├── users/      # User management
    │   │   ├── orders/     # Order management
    │   │   ├── vehicles/   # Vehicle & pricing
    │   │   ├── promos/     # Promo codes
    │   │   ├── analytics/  # Analytics
    │   │   └── settings/   # Settings
    │   ├── services/   # API services
    │   ├── store/      # Redux store
    │   └── utils/      # Utilities
    └── tests/          # Tests
```

## State Management Architecture

### Global State (Redux Toolkit)

**Customer App:**
- `auth`: Authentication state, user profile
- `order`: Active orders, order history
- `notification`: In-app notifications

**Porter App:**
- `auth`: Authentication state, porter profile
- `job`: Active jobs, job requests, completed jobs
- `availability`: Online/offline status, location

**Admin Panel:**
- `auth`: Admin authentication

### Server State (React Query)

- User data fetching and caching
- Order list queries
- Analytics data
- Infinite scrolling for lists
- Optimistic updates

### Local State

- Component-level UI state
- Form inputs
- Modal visibility
- Map markers

## Navigation Architecture

### Customer App

```
RootNavigator
├── AuthNavigator (if not authenticated)
│   ├── Login
│   └── Register
└── MainNavigator (if authenticated)
    ├── HomeNavigator (Tab)
    │   ├── HomeMain
    │   ├── CreateOrder
    │   ├── OrderTracking
    │   └── Chat
    ├── OrdersNavigator (Tab)
    │   ├── OrderHistory
    │   ├── OrderDetails
    │   └── RateOrder
    └── ProfileNavigator (Tab)
        ├── ProfileMain
        └── EditProfile
```

### Porter App

```
RootNavigator
├── AuthNavigator (if not authenticated)
│   ├── Login
│   └── Register
└── MainNavigator (if authenticated)
    ├── JobsNavigator (Tab)
    │   ├── JobsList
    │   ├── JobDetails
    │   ├── Navigation
    │   └── Chat
    ├── WalletNavigator (Tab)
    │   └── WalletMain
    └── ProfileNavigator (Tab)
        ├── ProfileMain
        ├── EditProfile
        └── Verification
```

### Admin Panel

```
Layout
├── /dashboard      - Dashboard
├── /users          - User management
├── /orders         - Order management
├── /vehicles       - Vehicle types & pricing
├── /promos         - Promo codes
├── /analytics      - Analytics & reports
└── /settings       - Platform settings
```

## Real-time Communication

### Socket.io Events

**Customer App Listens:**
- `order.confirmed` - Order confirmed by system
- `order.assigned` - Porter assigned to order
- `order.started` - Order picked up
- `order.completed` - Order delivered
- `porter.location.updated` - Porter location updates
- `chat.message` - New chat message

**Porter App Listens:**
- `job.new` - New job request
- `job.cancelled` - Job cancelled by customer
- `chat.message` - New chat message

**Admin Panel Listens:**
- `order.created` - New order created
- `user.created` - New user registered
- `porter.verification.requested` - New verification request

## API Integration

### tRPC Client Setup

All apps use tRPC for type-safe API communication:

```typescript
// Shared tRPC client configuration
const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: API_URL,
      headers: async () => ({
        authorization: `Bearer ${await getToken()}`,
      }),
    }),
  ],
});
```

### API Endpoints Used

- `auth.login` - User authentication
- `auth.register` - User registration
- `orders.createOrder` - Create new order
- `orders.getOrders` - Fetch order list
- `orders.updateStatus` - Update order status
- `users.getUsers` - Fetch users (admin)
- `vehicles.getVehicles` - Fetch vehicle types
- `promos.getPromos` - Fetch promo codes

## Testing Strategy

### Unit Tests

- Component rendering tests
- Redux reducer tests
- Utility function tests
- Custom hook tests

```bash
# Run unit tests
pnpm --filter @movenow/customer-app test
pnpm --filter @movenow/porter-app test
pnpm --filter @movenow/admin-panel test
```

### Integration Tests

- Navigation flow tests
- API integration tests
- Socket event handling tests

### End-to-End Tests

**Mobile Apps (Detox):**
- Complete order flow
- Porter job acceptance
- Chat functionality

**Admin Panel (Cypress/Playwright):**
- User management workflow
- Order assignment
- Settings update

## Deployment

### Customer & Porter Apps

**iOS:**
```bash
cd apps/customer-app
eas build --platform ios
eas submit --platform ios
```

**Android:**
```bash
cd apps/customer-app
eas build --platform android
eas submit --platform android
```

**OTA Updates:**
```bash
eas update --branch production
```

### Admin Panel

**Build:**
```bash
cd apps/admin-panel
pnpm build
```

**Deploy to Vercel:**
```bash
vercel --prod
```

**Deploy to AWS S3:**
```bash
aws s3 sync dist/ s3://movenow-admin-panel
aws cloudfront create-invalidation --distribution-id XXX --paths "/*"
```

## Environment Variables

### Customer App (`.env`)
```
EXPO_PUBLIC_API_URL=https://api.movenow.com/trpc
EXPO_PUBLIC_SOCKET_URL=https://api.movenow.com
```

### Porter App (`.env`)
```
EXPO_PUBLIC_API_URL=https://api.movenow.com/trpc
EXPO_PUBLIC_SOCKET_URL=https://api.movenow.com
```

### Admin Panel (`.env`)
```
VITE_API_URL=https://api.movenow.com
```

## Performance Optimization

### Mobile Apps

- **Code Splitting**: Dynamic imports for large modules
- **Image Optimization**: Expo image optimization
- **List Virtualization**: FlatList for long lists
- **Memoization**: React.memo, useMemo, useCallback
- **Bundle Size**: Remove unused dependencies

### Admin Panel

- **Code Splitting**: Route-based splitting with React.lazy
- **Tree Shaking**: Vite automatic tree shaking
- **Asset Optimization**: Image compression
- **Caching**: React Query caching strategy
- **Lazy Loading**: Defer non-critical resources

## Accessibility

### Mobile Apps

- Screen reader support (iOS VoiceOver, Android TalkBack)
- Touch target sizes (minimum 44x44pt)
- Color contrast ratios (WCAG AA)
- Alternative text for images
- Focus management

### Admin Panel

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Skip links
- Focus indicators

## Monitoring & Error Tracking

### Integration

```typescript
// Sentry configuration
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### Metrics Tracked

- App start time
- Network request latency
- Map render performance
- Socket connection status
- Crash reports
- User flow analytics

## Development Workflow

### Setup

```bash
# Install dependencies
pnpm install

# Start all apps
pnpm dev

# Start specific app
pnpm --filter @movenow/customer-app start
pnpm --filter @movenow/porter-app start
pnpm --filter @movenow/admin-panel dev
```

### Code Quality

```bash
# Linting
pnpm lint

# Type checking
pnpm type-check

# Testing
pnpm test

# Build
pnpm build
```

## Security Considerations

- JWT token storage in secure storage (React Native Keychain/AsyncStorage)
- HTTPS-only API communication
- Input validation and sanitization
- XSS prevention
- CSRF protection
- Rate limiting on sensitive actions
- Secure file upload handling

## Future Enhancements

- [ ] Dark mode support
- [ ] Multi-language support (i18n)
- [ ] Offline mode with sync
- [ ] Push notification improvements
- [ ] Advanced analytics dashboard
- [ ] Video call support for customer-porter communication
- [ ] AR navigation for porters
- [ ] Voice commands for hands-free operation
