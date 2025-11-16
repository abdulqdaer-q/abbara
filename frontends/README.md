# MoveNow Frontend Applications

This directory contains all frontend applications for the MoveNow porter platform.

## Applications

### 1. Customer Mobile App (`customer-app/`)
**Technology**: React Native (Expo)
**Platform**: iOS & Android
**Purpose**: Customer-facing mobile application for booking porter services

**Features**:
- User authentication (email, phone, social login)
- Order creation and management
- Real-time porter tracking
- In-app communication with porters
- Payment processing
- Order history and receipts
- Ratings and reviews
- Push notifications

### 2. Porter Mobile App (`porter-app/`)
**Technology**: React Native (Expo)
**Platform**: iOS & Android
**Purpose**: Porter-facing mobile application for accepting and managing jobs

**Features**:
- Porter authentication and verification
- Job request notifications
- Order acceptance/rejection
- Real-time navigation
- Earnings tracking
- In-app communication with customers
- Rating and review management
- Availability status management

### 3. Admin Panel (`admin-panel/`)
**Technology**: React + Vite
**Platform**: Web (Desktop)
**Purpose**: Administrative dashboard for platform management

**Features**:
- User and porter management
- Order oversight and analytics
- Porter verification workflow
- Pricing and vehicle management
- Promo code administration
- System analytics and reporting
- Platform-wide notifications
- System settings configuration

## Shared Dependencies

All applications share:
- `@movenow/common` - Shared types, schemas, and event definitions
- tRPC client for API communication
- Common authentication flow
- Consistent UI/UX patterns

## API Gateway

All frontend applications communicate with the API Gateway running on port 3000:
- **Development**: `http://localhost:3000`
- **Production**: Configure via environment variables

## Getting Started

Each application has its own README with detailed setup instructions. Navigate to the respective directory and follow the instructions:

```bash
# Customer App
cd customer-app
npm install
npm start

# Porter App
cd porter-app
npm install
npm start

# Admin Panel
cd admin-panel
npm install
npm run dev
```

## Environment Variables

Each app requires configuration via `.env` files. See individual app READMEs for specific requirements.

Common variables:
- `API_GATEWAY_URL` - API Gateway endpoint
- `WEBSOCKET_URL` - Real-time service endpoint
- `GOOGLE_MAPS_API_KEY` - For maps functionality (mobile apps)

## Development Workflow

1. Ensure backend services are running (see `/services` directory)
2. Start the API Gateway on port 3000
3. Launch the desired frontend application
4. Use the application with live backend integration

## Testing

Each application includes:
- Unit tests (Jest)
- Component tests (React Testing Library)
- E2E tests (Detox for mobile, Playwright for web)

Run tests from individual app directories:
```bash
npm test
```

## Build & Deployment

### Mobile Apps (Expo)
```bash
# Development build
npm run build

# Production build for iOS
eas build --platform ios

# Production build for Android
eas build --platform android
```

### Admin Panel (Vite)
```bash
# Production build
npm run build

# Preview production build
npm run preview
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend Applications                  │
├──────────────┬──────────────┬─────────────────────────┤
│  Customer    │   Porter     │   Admin Panel           │
│  Mobile App  │  Mobile App  │   (Web)                 │
│  (Expo)      │  (Expo)      │   (React + Vite)        │
└──────┬───────┴──────┬───────┴──────────┬──────────────┘
       │              │                   │
       │              │                   │
       └──────────────┴───────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  API Gateway  │ (Port 3000)
              │    (tRPC)     │
              └───────┬───────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Auth     │  │ Orders   │  │ Porters  │
  │ Service  │  │ Service  │  │ Service  │
  └──────────┘  └──────────┘  └──────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
                      ▼
              ┌───────────────┐
              │   PostgreSQL  │
              │     Redis     │
              │     Kafka     │
              └───────────────┘
```

## Contributing

1. Follow the existing code structure and naming conventions
2. Write tests for new features
3. Update documentation as needed
4. Use TypeScript for type safety
5. Follow the ESLint configuration

## License

Proprietary - MoveNow Platform
