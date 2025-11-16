# MoveNow Customer App

React Native mobile application for MoveNow customers.

## Features

- **Authentication**: Login and registration for customers
- **Order Management**: Create, track, and manage orders
- **Real-time Tracking**: Track porter location on map
- **In-app Chat**: Communicate with assigned porter
- **Order History**: View past orders and details
- **Ratings**: Rate completed orders

## Tech Stack

- React Native (Expo)
- TypeScript
- Redux Toolkit (State Management)
- React Navigation
- React Query (Data Fetching)
- Socket.io (Real-time Updates)
- React Native Maps

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Expo CLI
- iOS Simulator or Android Emulator

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android
```

## Project Structure

```
src/
├── navigation/       # Navigation configuration
├── modules/          # Feature modules
│   ├── auth/        # Authentication screens
│   ├── order/       # Order management
│   ├── chat/        # Chat functionality
│   ├── profile/     # User profile
│   └── ratings/     # Rating system
├── components/      # Reusable components
├── services/        # API and socket services
├── store/           # Redux store and slices
├── hooks/           # Custom React hooks
├── utils/           # Utility functions
└── types/           # TypeScript types
```

## Available Scripts

- `pnpm start` - Start Expo development server
- `pnpm ios` - Run on iOS simulator
- `pnpm android` - Run on Android emulator
- `pnpm test` - Run tests
- `pnpm lint` - Lint code

## Environment Variables

See `.env.example` for required environment variables.
