# MoveNow Customer Mobile App

The customer-facing mobile application for the MoveNow porter platform, built with React Native and Expo.

## Features

### 🔐 Authentication & Profile
- ✅ Email/phone-based registration and login
- ✅ Password reset functionality
- ✅ Profile management
- ✅ Secure token-based authentication (JWT)
- ⏳ Social login (Google, Facebook) - Planned
- ⏳ Email/phone verification - Planned

### 📦 Order Management
- ✅ Create new orders with:
  - Vehicle type selection (sedan, SUV, van, truck)
  - Porter count selection
  - Pickup and dropoff location
  - Special instructions
- ✅ View order history
- ✅ Order details view
- ⏳ Add item photos and descriptions
- ⏳ Schedule orders for future
- ⏳ Cancel orders
- ⏳ Real-time pricing estimates

### 🗺️ Real-Time Tracking
- ✅ Order tracking screen with map
- ⏳ Real-time porter location updates
- ⏳ Estimated arrival time
- ⏳ Route visualization

### 💬 Communication
- ✅ In-app chat with porters
- ⏳ Send images in chat
- ⏳ Real-time message notifications

### ⭐ Ratings & Reviews
- ⏳ Rate completed orders
- ⏳ Submit reviews for porters
- ⏳ View past ratings

### 🔔 Notifications
- ✅ Push notification support
- ✅ Notification permissions handling
- ⏳ Order status update notifications
- ⏳ Porter arrival notifications

## Tech Stack

- **Framework**: React Native (Expo SDK 50)
- **Language**: TypeScript
- **Navigation**: React Navigation 6 (Native Stack + Bottom Tabs)
- **State Management**: Zustand
- **API Client**: tRPC + React Query
- **UI Components**: React Native Paper
- **Maps**: React Native Maps
- **Real-time**: Socket.io Client
- **Notifications**: Expo Notifications
- **Location**: Expo Location
- **Storage**: Async Storage + Expo Secure Store

## Project Structure

```
customer-app/
├── App.tsx                      # Main app entry point
├── app.json                     # Expo configuration
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
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
│   │   │   └── ForgotPasswordScreen.tsx
│   │   ├── main/               # Main app screens
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── OrdersScreen.tsx
│   │   │   └── ProfileScreen.tsx
│   │   └── orders/             # Order-related screens
│   │       ├── CreateOrderScreen.tsx
│   │       ├── OrderDetailsScreen.tsx
│   │       ├── OrderTrackingScreen.tsx
│   │       └── ChatScreen.tsx
│   ├── services/                # External service integrations
│   │   ├── trpc.ts             # tRPC client configuration
│   │   ├── auth.service.ts     # Authentication service
│   │   ├── notification.service.ts  # Push notifications
│   │   ├── location.service.ts # Location services
│   │   └── socket.service.ts   # WebSocket/real-time
│   ├── store/                   # Global state management
│   │   ├── useAuthStore.ts     # Auth state
│   │   └── useOrderStore.ts    # Order state
│   ├── types/                   # TypeScript type definitions
│   └── utils/                   # Utility functions
│       └── theme.ts            # App theming (colors, typography, etc.)
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
   cd frontends/customer-app
   npm install
   # or
   pnpm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your configuration:
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
   - Scan QR code with Expo Go app on physical device

## Development

### Running the app

```bash
# Start development server
npm start

# Start on iOS
npm run ios

# Start on Android
npm run android

# Start web version
npm run web
```

### Type checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Testing

```bash
npm test
```

## API Integration

The app communicates with the MoveNow API Gateway using tRPC. All API calls are type-safe and automatically validated.

### Available tRPC Routes

**Authentication**:
- `auth.login` - User login
- `auth.register` - User registration
- `auth.refresh` - Refresh access token
- `auth.logout` - User logout
- `auth.requestPasswordReset` - Request password reset
- `auth.confirmPasswordReset` - Confirm password reset

**Orders**:
- `orders.create` - Create new order
- `orders.get` - Get order details
- `orders.list` - List user orders
- `orders.cancel` - Cancel order

**Porters**:
- `porters.nearby` - Find nearby porters
- `porters.get` - Get porter details

**Payments**:
- `payments.createPaymentIntent` - Create payment
- `payments.confirmPayment` - Confirm payment

**Real-time**:
- `realtime.subscribeToNamespace` - Get WebSocket token

### Example Usage

```typescript
import { trpc } from './services/trpc';

// In a React component
function MyComponent() {
  const loginMutation = trpc.auth.login.useMutation();

  const handleLogin = async () => {
    const result = await loginMutation.mutateAsync({
      emailOrPhone: 'user@example.com',
      password: 'password123',
    });
  };
}
```

## State Management

The app uses Zustand for global state management:

### Auth Store (`useAuthStore`)

```typescript
const {
  user,              // Current user object
  isAuthenticated,   // Auth status
  isLoading,         // Loading state
  error,             // Error message
  login,             // Login function
  register,          // Register function
  logout,            // Logout function
  refreshAuth,       // Refresh auth state
} = useAuthStore();
```

### Order Store (`useOrderStore`)

```typescript
const {
  currentOrder,      // Currently viewing order
  orders,            // All orders
  activeOrders,      // Active orders
  completedOrders,   // Completed orders
  draftOrder,        // Draft order (multi-step creation)
  setDraftOrder,     // Update draft order
  setCurrentOrder,   // Set current order
  updateOrder,       // Update an order
} = useOrderStore();
```

## Real-Time Features

### WebSocket Connection

```typescript
import { socketService } from './services/socket.service';

// Connect to WebSocket
await socketService.connect('client');

// Subscribe to order updates
socketService.subscribeToOrderUpdates(orderId, (update) => {
  console.log('Order updated:', update);
});

// Subscribe to porter location
socketService.subscribeToPorterLocation(porterId, (location) => {
  console.log('Porter location:', location);
});

// Send chat message
socketService.sendChatMessage(orderId, 'Hello!');
```

## Notifications

### Push Notifications

```typescript
import { notificationService } from './services/notification.service';

// Request permissions
await notificationService.requestPermissions();

// Get push token
const token = await notificationService.getPushToken();

// Schedule local notification
await notificationService.scheduleNotification(
  'Order Update',
  'Your order is on the way!',
  { orderId: '123' }
);
```

## Location Services

```typescript
import { locationService } from './services/location.service';

// Get current location
const location = await locationService.getCurrentLocation();

// Watch location changes
const subscription = await locationService.watchLocation((location) => {
  console.log('Location updated:', location);
});

// Geocode address
const coords = await locationService.forwardGeocode('123 Main St');
```

## Theming

The app uses a centralized theme system (`src/utils/theme.ts`):

```typescript
import { colors, spacing, typography, shadows } from '../utils/theme';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  card: {
    ...shadows.md,
  },
});
```

## Building for Production

### iOS

```bash
# Build for iOS
eas build --platform ios

# Build for App Store
eas build --platform ios --profile production
```

### Android

```bash
# Build APK
eas build --platform android

# Build AAB for Google Play
eas build --platform android --profile production
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `API_GATEWAY_URL` | Backend API Gateway URL | `http://localhost:3000` |
| `WEBSOCKET_URL` | WebSocket server URL | `ws://localhost:3007` |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | `AIza...` |
| `APP_ENV` | App environment | `development` |

## Troubleshooting

### Common Issues

1. **Metro bundler not starting**:
   ```bash
   npx expo start -c
   ```

2. **iOS build fails**:
   ```bash
   cd ios && pod install
   ```

3. **Android build fails**:
   ```bash
   cd android && ./gradlew clean
   ```

4. **Type errors**:
   ```bash
   npm run type-check
   ```

## Contributing

1. Follow the existing code structure
2. Use TypeScript for all new files
3. Follow the ESLint configuration
4. Write tests for new features
5. Update documentation as needed

## Future Enhancements

- [ ] Social login (Google, Facebook, Apple)
- [ ] Email/phone verification
- [ ] Item photo upload
- [ ] Scheduled orders
- [ ] Loyalty points and rewards
- [ ] Multiple payment methods
- [ ] Dark mode support
- [ ] Multi-language support
- [ ] Offline mode support
- [ ] Voice notes in chat
- [ ] Order receipts (PDF generation)
- [ ] Promo code redemption

## License

Proprietary - MoveNow Platform
