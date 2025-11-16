# MoveNow Porter Mobile App

The porter-facing mobile application for the MoveNow platform, built with React Native and Expo.

## Features

### 🔐 Authentication & Profile
- ✅ Porter registration and login
- ✅ Secure JWT-based authentication
- ⏳ Document upload for verification (ID, vehicle registration, insurance)
- ⏳ Profile management with vehicle details
- ⏳ Verification status tracking

### 💼 Job Management
- ⏳ Real-time job notifications
- ⏳ Accept/reject job requests
- ⏳ View job details (customer info, locations, items)
- ⏳ Multi-stop job handling
- ⏳ Job history and analytics
- ⏳ Scheduled jobs calendar

### 📍 Navigation & Tracking
- ✅ Real-time location tracking
- ⏳ Turn-by-turn navigation to pickup/dropoff
- ⏳ Background location sharing with customers
- ⏳ Route optimization for multi-stop jobs
- ⏳ Update job status (arrived, loaded, in transit, delivered, completed)

### 💰 Earnings & Wallet
- ⏳ Real-time earnings dashboard
- ⏳ Daily/weekly/monthly earnings reports
- ⏳ Transaction history
- ⏳ Wallet management
- ⏳ Bank account linking
- ⏳ Withdrawal requests
- ⏳ Earnings breakdown (base fare, tips, bonuses)

### 💬 Communication
- ⏳ In-app chat with customers
- ⏳ Phone call integration
- ⏳ Push notifications for job updates
- ⏳ Support ticket system

### ⭐ Ratings & Performance
- ⏳ View customer ratings and reviews
- ⏳ Performance metrics
- ⏳ Respond to reviews
- ⏳ Rating trends and analytics

### 🎯 Porter Status Management
- ⏳ Online/offline toggle
- ⏳ Availability scheduling
- ⏳ Break mode
- ⏳ Service area preferences

## Tech Stack

- **Framework**: React Native (Expo SDK 50)
- **Language**: TypeScript
- **Navigation**: React Navigation 6
- **State Management**: Zustand
- **API Client**: tRPC + React Query
- **UI Components**: React Native Paper
- **Maps**: React Native Maps
- **Real-time**: Socket.io Client
- **Notifications**: Expo Notifications
- **Location**: Expo Location + Task Manager (background tracking)
- **Storage**: Async Storage + Expo Secure Store
- **Document Upload**: Expo Document Picker

## Project Structure

```
porter-app/
├── App.tsx                      # Main app entry point
├── app.json                     # Expo configuration
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
├── babel.config.js              # Babel configuration
├── .env.example                 # Environment variables example
├── src/
│   ├── components/              # Reusable UI components
│   ├── hooks/                   # Custom React hooks
│   │   └── useAuth.ts          # Authentication hook
│   ├── navigation/              # Navigation configuration
│   │   ├── AuthNavigator.tsx   # Auth flow navigation
│   │   └── MainNavigator.tsx   # Main app navigation
│   ├── screens/                 # App screens
│   │   ├── auth/               # Authentication screens
│   │   │   ├── WelcomeScreen.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   └── VerificationScreen.tsx
│   │   ├── main/               # Main app screens
│   │   │   ├── HomeScreen.tsx  # Job dashboard
│   │   │   ├── JobsScreen.tsx  # Job history
│   │   │   ├── EarningsScreen.tsx  # Earnings dashboard
│   │   │   └── ProfileScreen.tsx
│   │   └── jobs/               # Job-related screens
│   │       ├── JobDetailsScreen.tsx
│   │       ├── ActiveJobScreen.tsx
│   │       ├── NavigationScreen.tsx
│   │       └── ChatScreen.tsx
│   ├── services/                # External service integrations
│   │   ├── trpc.ts             # tRPC client configuration
│   │   ├── auth.service.ts     # Authentication service
│   │   ├── notification.service.ts  # Push notifications
│   │   ├── location.service.ts # Location services
│   │   └── socket.service.ts   # WebSocket/real-time
│   ├── store/                   # Global state management
│   │   ├── useAuthStore.ts     # Auth state
│   │   ├── usePorterStore.ts   # Porter profile & status
│   │   └── useJobStore.ts      # Job management state
│   ├── types/                   # TypeScript type definitions
│   └── utils/                   # Utility functions
│       └── theme.ts            # App theming
└── assets/                      # Static assets
    ├── images/                  # Images and icons
    └── fonts/                   # Custom fonts
```

## Installation & Setup

### Prerequisites

- Node.js 20+
- npm or pnpm
- Expo CLI
- iOS Simulator (Mac only) or Android Emulator

### Steps

1. **Install dependencies**:
   ```bash
   cd frontends/porter-app
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env`:
   ```env
   API_GATEWAY_URL=http://localhost:3000
   WEBSOCKET_URL=ws://localhost:3007
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Run on device/simulator**:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app

## Development

### Running the app

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Type checking

```bash
npm run type-check
```

## Porter-Specific Features

### Background Location Tracking

The app tracks porter location in the background during active jobs:

```typescript
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

// Define background task
TaskManager.defineTask('BACKGROUND_LOCATION_TASK', async ({ data, error }) => {
  if (error) return;
  if (data) {
    const { locations } = data as any;
    // Send location to server
    await socketService.emit('porter:location', locations[0].coords);
  }
});

// Start tracking
await Location.startLocationUpdatesAsync('BACKGROUND_LOCATION_TASK', {
  accuracy: Location.Accuracy.High,
  timeInterval: 5000,
  distanceInterval: 10,
  foregroundService: {
    notificationTitle: 'MoveNow is tracking your delivery',
    notificationBody: 'Customer can see your location',
  },
});
```

### Document Verification

Upload verification documents:

```typescript
import * as DocumentPicker from 'expo-document-picker';
import { trpc } from './services/trpc';

const uploadDocument = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
  });

  if (result.type === 'success') {
    await trpc.porters.submitVerification.mutate({
      documentType: 'drivers_license',
      documentUrl: result.uri,
    });
  }
};
```

### Job Notifications

Real-time job request notifications:

```typescript
import { socketService } from './services/socket.service';

// Subscribe to job offers
socketService.on('job:offer', (job) => {
  // Show notification
  notificationService.scheduleNotification(
    'New Job Available!',
    `${job.distance}km away - $${job.estimatedPrice}`,
    { jobId: job.id }
  );
});
```

## State Management

### Porter Store (`usePorterStore`)

```typescript
const {
  status,            // Porter status: offline | online | busy | on_job
  isOnline,          // Online status
  profile,           // Porter profile data
  currentLocation,   // Current GPS location
  setStatus,         // Update status
  toggleOnline,      // Toggle online/offline
  updateLocation,    // Update current location
} = usePorterStore();
```

### Job Store (`useJobStore`)

```typescript
const {
  availableJobs,     // Available job offers
  activeJob,         // Currently active job
  completedJobs,     // Completed job history
  setActiveJob,      // Set active job
  updateJobStatus,   // Update job status
  addCompletedJob,   // Add to completed jobs
} = useJobStore();
```

## API Integration

### Porter-Specific tRPC Routes

**Porter Management**:
- `porters.submitVerification` - Upload verification documents
- `porters.getVerificationStatus` - Check verification status
- `porters.getPorterProfile` - Get porter profile
- `porters.updatePorterProfile` - Update porter info

**Job Management**:
- `jobs.getAvailable` - Get available jobs
- `jobs.accept` - Accept a job
- `jobs.reject` - Reject a job
- `jobs.updateStatus` - Update job status
- `jobs.complete` - Complete a job

**Earnings**:
- `earnings.getStats` - Get earnings statistics
- `earnings.getTransactions` - Get transaction history
- `earnings.requestWithdrawal` - Request withdrawal

## Real-Time Features

### Job Offers

```typescript
socketService.on('job:offer', (job) => {
  // Handle new job offer
  useJobStore.getState().setAvailableJobs([...availableJobs, job]);
});
```

### Location Sharing

```typescript
// Share location with customer
const shareLocation = (location) => {
  socketService.emit('porter:location', {
    jobId: activeJob.id,
    lat: location.lat,
    lng: location.lng,
    timestamp: new Date(),
  });
};
```

## Key Differences from Customer App

1. **Role**: Porters instead of customers
2. **Job Management**: Accept/reject jobs vs. create orders
3. **Navigation**: Turn-by-turn navigation for deliveries
4. **Earnings**: Track income and withdrawals
5. **Background Location**: Continuous tracking during jobs
6. **Verification**: Document upload and approval process
7. **Status Management**: Online/offline/busy states

## Building for Production

### iOS

```bash
eas build --platform ios --profile production
```

### Android

```bash
eas build --platform android --profile production
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `API_GATEWAY_URL` | Backend API Gateway URL | `http://localhost:3000` |
| `WEBSOCKET_URL` | WebSocket server URL | `ws://localhost:3007` |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | `AIza...` |
| `APP_ENV` | App environment | `development` |

## Future Enhancements

- [ ] Offline mode with job queue
- [ ] Voice navigation
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Shift scheduling
- [ ] Heat maps for high-demand areas
- [ ] Porter leaderboards
- [ ] Referral program
- [ ] Insurance claim filing
- [ ] In-app training modules

## License

Proprietary - MoveNow Platform
