# Offline Features - Customer App

## Overview

The MoveNow Customer App now includes comprehensive offline support, allowing users to access critical features even without an internet connection. When the connection is restored, pending actions are automatically synchronized.

## Features

### 1. Network Status Detection

**Hook:** `useNetworkStatus()` and `useIsOnline()`
**Location:** `/src/hooks/useNetworkStatus.ts`

Monitors real-time network connectivity using `@react-native-community/netinfo`.

```typescript
import { useIsOnline, useNetworkStatus } from './hooks/useNetworkStatus';

// Simple boolean check
const isOnline = useIsOnline();

// Detailed network info
const { isConnected, isInternetReachable, type } = useNetworkStatus();
```

### 2. Offline Data Caching

**Service:** `offlineService`
**Location:** `/src/services/offline.service.ts`

Automatically caches critical data for offline access:

- **Order History**: All user orders cached locally
- **User Profile**: Profile data available offline
- **Favorite Locations**: Saved addresses persist offline
- **Generic Cache**: Cache any custom data

```typescript
import { offlineService } from './services/offline.service';

// Cache orders
await offlineService.cacheOrders(orders);

// Retrieve cached orders
const cachedOrders = await offlineService.getCachedOrders();

// Add favorite location
await offlineService.addFavoriteLocation({
  name: 'Home',
  address: '123 Main St',
  lat: 40.7128,
  lng: -74.0060,
});

// Generic caching
await offlineService.setCacheItem('myKey', { data: 'value' });
const data = await offlineService.getCacheItem('myKey');
```

### 3. Offline Action Queue

**Service:** `offlineQueueService`
**Location:** `/src/services/offline-queue.service.ts`

Queues actions performed offline and syncs them when connection is restored:

**Supported Actions:**
- Cancel Order
- Rate Order
- Update Profile
- Send Message

```typescript
import { offlineQueueService } from './services/offline-queue.service';

// Add action to queue (happens automatically in offline-aware hooks)
await offlineQueueService.addAction('cancelOrder', { orderId: '123' });

// Check pending actions
const pendingCount = offlineQueueService.getQueueSize();

// Manual sync (usually automatic)
const results = await offlineQueueService.sync();

// Listen to sync events
const unsubscribe = offlineQueueService.addSyncListener((results) => {
  console.log('Sync completed:', results);
});
```

**Retry Logic:**
- Max retries: 3 (configurable per action)
- Failed actions are removed after max retries
- Success/failure tracking per action

### 4. Network Status Banner

**Component:** `<NetworkStatusBanner />`
**Location:** `/src/components/NetworkStatusBanner.tsx`

Visual indicator for offline/online status with smooth animations:

- **Offline**: Orange banner showing "No connection"
- **Pending Sync**: Shows count of queued actions
- **Back Online**: Green banner with sync status
- **Auto-hide**: Dismisses automatically when online and synced

Already integrated in `App.tsx` - no manual setup needed.

### 5. Offline-Aware React Query

**Configuration:** Enhanced in `App.tsx`

React Query configured for optimal offline experience:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 60 * 24, // 24 hours cache
      refetchOnReconnect: true, // Auto refetch when back online
      networkMode: 'offlineFirst', // Prioritize cache
    },
  },
});
```

### 6. Persisted Zustand Stores

**Stores:**
- `useAuthStore` - `/src/store/usePersistedAuthStore.ts`
- `useOrderStore` - `/src/store/usePersistedOrderStore.ts`

Automatically persist and restore state:

```typescript
import { useAuthStore } from './store/usePersistedAuthStore';
import { useOrderStore } from './store/usePersistedOrderStore';

// Auth store auto-caches user profile
const { user, isAuthenticated } = useAuthStore();

// Order store auto-caches orders
const { orders, activeOrders, completedOrders } = useOrderStore();
```

### 7. Offline-Aware Hooks

**Location:** `/src/hooks/useOrders.ts`

Custom hooks that automatically handle offline scenarios:

```typescript
import { useOrders, useOrder, useCancelOrder, useRateOrder } from './hooks/useOrders';

// Fetch orders - uses cache when offline
const { orders, isLoading, isOnline } = useOrders();

// Get single order - checks cache first
const { order } = useOrder(orderId);

// Cancel order - queues when offline
const { cancelOrder } = useCancelOrder();
await cancelOrder(orderId);

// Rate order - queues when offline
const { rateOrder } = useRateOrder();
await rateOrder(orderId, 5, 'Great service!');
```

## How It Works

### Offline Flow

1. **User Action Offline**: User cancels an order while offline
2. **Optimistic Update**: UI updates immediately (order marked as cancelled)
3. **Queue Action**: Action queued in `offlineQueueService`
4. **Visual Feedback**: Banner shows "No connection - 1 action pending"

### Online Flow

1. **Connection Restored**: Network status changes to online
2. **Auto Sync**: `offlineQueueService.sync()` called automatically
3. **Execute Actions**: Queued actions sent to server in order
4. **Update UI**: Banner shows "Back online - Syncing..."
5. **Complete**: Banner shows success and auto-dismisses

### Data Loading

1. **App Launch**: Check AsyncStorage for cached data
2. **Display Cache**: Show cached orders/profile immediately
3. **Background Fetch**: Fetch fresh data from API (if online)
4. **Update & Cache**: Update UI and cache new data

## Storage Keys

AsyncStorage keys used by offline features:

- `offline_orders` - Cached order history
- `offline_user_profile` - Cached user profile
- `offline_favorites` - Saved locations
- `offline_queue` - Pending action queue
- `offline_cache_*` - Generic cached items

## Installation

The package dependencies are already added to `package.json`:

```bash
# Install dependencies
pnpm install

# Or with npm
npm install

# For Expo
npx expo install @react-native-community/netinfo
```

## Testing Offline Mode

### On iOS Simulator

1. Toggle Network: `Hardware > Simulate Network > Off`
2. Or use Network Link Conditioner in macOS

### On Android Emulator

1. Click `...` (More) in emulator toolbar
2. Go to `Settings > Proxy`
3. Disable network, or use Airplane mode

### Physical Device

1. Enable Airplane Mode
2. Or disable Wi-Fi and cellular data

### Testing Checklist

- [ ] View orders while offline (should show cached data)
- [ ] Cancel an order while offline (should queue)
- [ ] Go back online (should sync automatically)
- [ ] Check banner animations (offline/online transitions)
- [ ] Verify data refreshes when back online
- [ ] Check favorite locations persist offline
- [ ] Profile data accessible offline

## Performance Considerations

### Storage Limits

- AsyncStorage: ~6MB on iOS, ~100MB+ on Android
- Current implementation: Efficient JSON storage
- Monitoring: Use `offlineService.getStorageInfo()`

### Memory Usage

- Cached data cleared on logout
- Old cache entries persist for 24 hours
- Manual cleanup: `offlineService.clearAllOfflineData()`

### Network Usage

- Batch queries when possible
- Avoid frequent refetches
- Use stale-while-revalidate pattern

## Future Enhancements

Potential improvements for offline support:

1. **Conflict Resolution**: Handle server conflicts for queued actions
2. **Image Caching**: Cache order item photos for offline viewing
3. **Map Tiles**: Offline map tile caching for tracking
4. **Compression**: Compress cached data to save space
5. **Selective Sync**: User choice of what to sync
6. **Background Sync**: Use Background Fetch API
7. **Incremental Sync**: Delta updates instead of full refresh

## Troubleshooting

### Orders not loading offline

```typescript
// Check if orders are cached
const orders = await offlineService.getCachedOrders();
console.log('Cached orders:', orders.length);
```

### Queue not syncing

```typescript
// Check queue status
console.log('Queue size:', offlineQueueService.getQueueSize());
console.log('Has pending:', offlineQueueService.hasPendingActions());

// Manual sync
await offlineQueueService.sync();
```

### Storage issues

```typescript
// Check storage
const info = await offlineService.getStorageInfo();
console.log('Cached keys:', info.keys);
console.log('Storage size:', info.size, 'bytes');

// Clear if needed
await offlineService.clearAllOfflineData();
```

## API Reference

See individual service files for detailed API documentation:

- `/src/services/offline.service.ts` - Data caching
- `/src/services/offline-queue.service.ts` - Action queuing
- `/src/hooks/useNetworkStatus.ts` - Network detection
- `/src/hooks/useOrders.ts` - Offline-aware data hooks

## Support

For issues or questions about offline features:
- Check console logs for error messages
- Review network inspector for API calls
- Verify AsyncStorage contents in React Native Debugger
- Open an issue on GitHub with reproduction steps
