# MoveNow Porter App

React Native mobile application for MoveNow porters.

## Features

- **Authentication**: Login and registration for porters
- **Online/Offline Status**: Toggle availability status
- **Job Management**: Accept/reject job requests
- **Navigation**: Turn-by-turn directions to pickup/dropoff
- **Order Workflow**: ARRIVED → LOADED → DELIVERED → COMPLETED
- **Wallet**: Track earnings from completed jobs
- **In-app Chat**: Communicate with customers
- **Document Upload**: Upload verification documents

## Tech Stack

- React Native (Expo)
- TypeScript
- Redux Toolkit (State Management)
- React Navigation
- React Query (Data Fetching)
- Socket.io (Real-time Updates)
- React Native Maps with Directions

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
│   ├── jobs/        # Job management
│   ├── map/         # Navigation and maps
│   ├── chat/        # Chat functionality
│   ├── wallet/      # Earnings and wallet
│   └── profile/     # Porter profile
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
