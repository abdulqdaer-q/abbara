# Real-time Features with WebSockets

Learn how to implement real-time features using Socket.io for live updates, location tracking, chat messaging, and job notifications.

## 📋 Table of Contents

- [Overview](#overview)
- [WebSocket Setup](#websocket-setup)
- [Order Tracking](#order-tracking)
- [Location Updates](#location-updates)
- [Chat Messaging](#chat-messaging)
- [Job Notifications](#job-notifications)
- [Best Practices](#best-practices)

## Overview

MoveNow uses **Socket.io** for real-time communication. Key features:

- **Order status updates** - Live order state changes
- **Location tracking** - Real-time porter location
- **Chat messaging** - Customer-porter communication
- **Job offers** - Instant job notifications for porters
- **Presence** - Online/offline status

### Namespaces

The platform has three Socket.io namespaces:

- `/client` - Customer applications
- `/porter` - Porter applications
- `/admin` - Admin dashboards

## WebSocket Setup

### Install Socket.io Client

```bash
npm install socket.io-client
```

### Basic Connection

```typescript
import { io, Socket } from 'socket.io-client';

function connectToRealtime(authToken: string): Socket {
  const socket = io('http://localhost:3002/client', {
    auth: {
      token: authToken,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('✅ Connected to real-time server');
    console.log('Socket ID:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
  });

  return socket;
}
```

### Authenticate Socket

```typescript
async function authenticateSocket(socket: Socket, authToken: string) {
  return new Promise((resolve, reject) => {
    socket.emit('auth:authenticate', { token: authToken });

    socket.once('auth:authenticated', (data) => {
      console.log('✅ Socket authenticated');
      console.log('User ID:', data.userId);
      console.log('Role:', data.role);
      resolve(data);
    });

    socket.once('auth:error', (error) => {
      console.error('❌ Authentication failed:', error.message);
      reject(error);
    });
  });
}
```

### Complete Setup

```typescript
async function setupRealtimeConnection(authToken: string): Promise<Socket> {
  const socket = connectToRealtime(authToken);

  // Wait for connection
  await new Promise((resolve) => {
    if (socket.connected) {
      resolve(null);
    } else {
      socket.once('connect', resolve);
    }
  });

  // Authenticate
  await authenticateSocket(socket, authToken);

  console.log('🚀 Real-time connection ready!');
  return socket;
}
```

## Order Tracking

### Subscribe to Order Updates

```typescript
function subscribeToOrder(socket: Socket, orderId: string) {
  // Subscribe to order
  socket.emit('order:subscribe', { orderId });

  // Listen for status changes
  socket.on('order:status:changed', (data) => {
    console.log('📦 Order status changed!');
    console.log('Order ID:', data.orderId);
    console.log('Old Status:', data.oldStatus);
    console.log('New Status:', data.newStatus);
    console.log('Changed by:', data.actor);
    console.log('Timestamp:', data.timestamp);

    // Update UI
    updateOrderStatus(data);
  });

  // Listen for porter assignment
  socket.on('order:porter:assigned', (data) => {
    console.log('👷 Porter assigned!');
    console.log('Porter:', data.porter.displayName);
    console.log('Rating:', data.porter.averageRating);
    console.log('Vehicle:', data.porter.vehicleType);

    showPorterDetails(data.porter);
  });

  // Listen for updates
  socket.on('order:updated', (data) => {
    console.log('📝 Order updated:', data.changes);
    updateOrderDetails(data.order);
  });
}
```

### Unsubscribe from Order

```typescript
function unsubscribeFromOrder(socket: Socket, orderId: string) {
  socket.emit('order:unsubscribe', { orderId });
  console.log('Unsubscribed from order:', orderId);
}
```

### Complete Order Tracking Example

```typescript
async function trackOrder(orderId: string, authToken: string) {
  const socket = await setupRealtimeConnection(authToken);

  // Subscribe to order
  subscribeToOrder(socket, orderId);

  // Status transition handlers
  const statusHandlers = {
    ASSIGNED: (data) => {
      console.log('Porter assigned to your order');
      showNotification('Porter is on the way!');
    },
    ACCEPTED: (data) => {
      console.log('Porter accepted the job');
      showNotification('Porter accepted your job!');
    },
    ARRIVED: (data) => {
      console.log('Porter arrived at pickup');
      showNotification('Porter has arrived!', 'sound');
    },
    LOADED: (data) => {
      console.log('Items loaded');
      showNotification('Items loaded, heading to destination');
    },
    EN_ROUTE: (data) => {
      console.log('En route to destination');
      startLocationTracking(socket, orderId);
    },
    DELIVERED: (data) => {
      console.log('Delivered!');
      showNotification('Items delivered successfully!');
      requestRating(orderId);
    },
  };

  socket.on('order:status:changed', (data) => {
    const handler = statusHandlers[data.newStatus];
    if (handler) {
      handler(data);
    }
  });

  // Cleanup
  return () => {
    unsubscribeFromOrder(socket, orderId);
    socket.disconnect();
  };
}
```

## Location Updates

### Track Porter Location (Customer)

```typescript
function trackPorterLocation(socket: Socket, orderId: string) {
  socket.on('location:updated', (data) => {
    if (data.orderId === orderId) {
      console.log('📍 Porter location updated');
      console.log('Position:', data.location.lat, data.location.lng);
      console.log('Accuracy:', data.location.accuracy, 'meters');
      console.log('Speed:', data.location.speed, 'km/h');

      // Update map marker
      updatePorterMarker(data.location);

      // Calculate ETA
      calculateETA(data.location);
    }
  });
}

function updatePorterMarker(location: any) {
  // Update map UI (Google Maps, Mapbox, etc.)
  map.setMarkerPosition('porter', {
    lat: location.lat,
    lng: location.lng,
  });

  // Optionally, center map on porter
  map.panTo({ lat: location.lat, lng: location.lng });
}
```

### Send Location Updates (Porter)

```typescript
async function sendLocationUpdate(
  socket: Socket,
  location: { lat: number; lng: number },
  orderId?: string
) {
  socket.emit('location:update', {
    lat: location.lat,
    lng: location.lng,
    accuracy: location.accuracy || 10,
    speed: location.speed || 0,
    orderId, // Associate with active order
  });

  console.log('📍 Location sent');
}
```

### Continuous Location Broadcasting (Porter)

```typescript
function startLocationBroadcasting(socket: Socket, orderId: string) {
  const updateInterval = 5000; // 5 seconds

  const intervalId = setInterval(async () => {
    try {
      const position = await getCurrentPosition();

      socket.emit('location:update', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed || 0,
        orderId,
      });
    } catch (error) {
      console.error('Location update failed:', error);
    }
  }, updateInterval);

  return () => clearInterval(intervalId);
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    });
  });
}
```

## Chat Messaging

### Send Message

```typescript
async function sendChatMessage(
  socket: Socket,
  recipientId: string,
  content: string,
  orderId?: string
) {
  socket.emit('chat:message:send', {
    recipientId,
    content,
    messageType: 'TEXT',
    relatedOrderId: orderId,
  });

  console.log('💬 Message sent');
}
```

### Receive Messages

```typescript
function listenForMessages(socket: Socket) {
  socket.on('chat:message:received', (message) => {
    console.log('💬 New message!');
    console.log('From:', message.sender.displayName);
    console.log('Content:', message.content);
    console.log('Timestamp:', message.timestamp);

    // Display in chat UI
    displayMessage(message);

    // Mark as read
    markMessageAsRead(socket, message.id);

    // Show notification if app is in background
    if (document.hidden) {
      showNotification(`Message from ${message.sender.displayName}`);
    }
  });
}
```

### Mark Messages as Read

```typescript
function markMessageAsRead(socket: Socket, messageId: string) {
  socket.emit('chat:message:markRead', { messageId });
}

function markConversationAsRead(socket: Socket, conversationId: string) {
  socket.emit('chat:conversation:markRead', { conversationId });
}
```

### Complete Chat Example

```typescript
class ChatManager {
  private socket: Socket;
  private orderId: string;
  private otherUserId: string;

  constructor(socket: Socket, orderId: string, otherUserId: string) {
    this.socket = socket;
    this.orderId = orderId;
    this.otherUserId = otherUserId;

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('chat:message:received', (message) => {
      if (
        message.senderId === this.otherUserId ||
        message.recipientId === this.otherUserId
      ) {
        this.handleNewMessage(message);
      }
    });

    this.socket.on('chat:typing', (data) => {
      if (data.userId === this.otherUserId) {
        this.showTypingIndicator();
      }
    });

    this.socket.on('chat:stopped_typing', (data) => {
      if (data.userId === this.otherUserId) {
        this.hideTypingIndicator();
      }
    });
  }

  sendMessage(content: string) {
    this.socket.emit('chat:message:send', {
      recipientId: this.otherUserId,
      content,
      messageType: 'TEXT',
      relatedOrderId: this.orderId,
    });

    // Show in UI immediately (optimistic update)
    this.displayMyMessage(content);
  }

  sendTypingIndicator(isTyping: boolean) {
    this.socket.emit(isTyping ? 'chat:typing' : 'chat:stopped_typing', {
      recipientId: this.otherUserId,
    });
  }

  private handleNewMessage(message: any) {
    this.displayTheirMessage(message);
    this.markMessageAsRead(message.id);

    // Play notification sound
    playSound('message');
  }

  private markMessageAsRead(messageId: string) {
    this.socket.emit('chat:message:markRead', { messageId });
  }

  private displayMyMessage(content: string) {
    // Update chat UI
    console.log('You:', content);
  }

  private displayTheirMessage(message: any) {
    // Update chat UI
    console.log(`${message.sender.displayName}:`, message.content);
  }

  private showTypingIndicator() {
    console.log('Other user is typing...');
  }

  private hideTypingIndicator() {
    console.log('Other user stopped typing');
  }
}
```

## Job Notifications

### Listen for Job Offers (Porter)

```typescript
function listenForJobOffers(socket: Socket) {
  socket.on('job:offer:received', (offer) => {
    console.log('🔔 New job offer!');
    console.log('Offer ID:', offer.id);
    console.log('Order ID:', offer.orderId);
    console.log('Pickup:', offer.pickup.address);
    console.log('Dropoff:', offer.dropoff.address);
    console.log('Price:', `$${offer.priceCents / 100}`);
    console.log('Distance:', `${offer.distanceKm} km`);
    console.log('Expires in:', `${offer.expiresInSeconds} seconds`);

    // Show notification
    showJobOfferNotification(offer);

    // Auto-dismiss when expired
    setTimeout(() => {
      hideJobOfferNotification(offer.id);
    }, offer.expiresInSeconds * 1000);
  });

  socket.on('job:offer:expired', (data) => {
    console.log('⏰ Job offer expired:', data.offerId);
    hideJobOfferNotification(data.offerId);
  });

  socket.on('job:offer:cancelled', (data) => {
    console.log('❌ Job offer cancelled:', data.offerId);
    hideJobOfferNotification(data.offerId);
  });
}
```

### Accept Job via WebSocket

```typescript
async function acceptJobViaSocket(socket: Socket, offerId: string) {
  return new Promise((resolve, reject) => {
    socket.emit('job:offer:accept', { offerId });

    socket.once('job:offer:accepted', (data) => {
      console.log('✅ Job accepted!');
      console.log('Order:', data.order);
      resolve(data);
    });

    socket.once('job:offer:accept:error', (error) => {
      console.error('❌ Failed to accept:', error.message);
      reject(error);
    });
  });
}
```

## Best Practices

### 1. Reconnection Handling

```typescript
function setupReconnectionHandling(socket: Socket, orderId: string) {
  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);

    if (reason === 'io server disconnect') {
      // Server disconnected - manual reconnect
      socket.connect();
    }

    // Show offline indicator
    showOfflineIndicator();
  });

  socket.on('connect', async () => {
    console.log('Reconnected!');

    // Re-authenticate
    const authToken = getStoredAuthToken();
    await authenticateSocket(socket, authToken);

    // Re-subscribe to order
    socket.emit('order:subscribe', { orderId });

    // Hide offline indicator
    hideOfflineIndicator();

    // Fetch missed updates
    await fetchMissedUpdates(orderId);
  });
}
```

### 2. Event Cleanup

```typescript
class SocketManager {
  private socket: Socket;
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, handler: Function) {
    this.socket.on(event, handler);

    // Track listeners for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  cleanup() {
    // Remove all listeners
    this.listeners.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        this.socket.off(event, handler);
      });
    });

    this.listeners.clear();
    this.socket.disconnect();

    console.log('✅ Socket cleaned up');
  }
}
```

### 3. Error Handling

```typescript
function setupErrorHandling(socket: Socket) {
  socket.on('error', (error) => {
    console.error('Socket error:', error);
    showErrorNotification('Connection error');
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);

    if (error.message.includes('unauthorized')) {
      // Token expired - refresh and reconnect
      refreshAuthToken().then((newToken) => {
        socket.auth = { token: newToken };
        socket.connect();
      });
    }
  });

  socket.on('connect_timeout', () => {
    console.error('Connection timeout');
    showErrorNotification('Connection timeout');
  });
}
```

### 4. Batching Updates

```typescript
class LocationBatcher {
  private pendingLocation: any = null;
  private batchTimeout: NodeJS.Timeout | null = null;
  private socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket;
  }

  queueLocationUpdate(location: any) {
    this.pendingLocation = location;

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flush();
      }, 5000); // Batch for 5 seconds
    }
  }

  private flush() {
    if (this.pendingLocation) {
      this.socket.emit('location:update', this.pendingLocation);
      this.pendingLocation = null;
    }

    this.batchTimeout = null;
  }
}
```

### 5. Heartbeat Monitoring

```typescript
function setupHeartbeat(socket: Socket) {
  let heartbeatTimeout: NodeJS.Timeout;

  function startHeartbeat() {
    clearTimeout(heartbeatTimeout);

    heartbeatTimeout = setTimeout(() => {
      console.log('Heartbeat timeout - connection may be stale');
      socket.disconnect();
      socket.connect();
    }, 30000); // 30 seconds
  }

  socket.on('connect', startHeartbeat);
  socket.on('pong', startHeartbeat);

  // Server sends ping, client responds with pong automatically
  socket.on('ping', () => {
    console.log('Heartbeat received');
  });
}
```

## Complete Real-time Example

```typescript
async function setupCompleteRealtime(orderId: string, role: 'customer' | 'porter') {
  const authToken = getAuthToken();

  // Connect
  const namespace = role === 'customer' ? '/client' : '/porter';
  const socket = io(`http://localhost:3002${namespace}`, {
    auth: { token: authToken },
  });

  // Wait for connection
  await new Promise((resolve) => socket.once('connect', resolve));

  // Authenticate
  await authenticateSocket(socket, authToken);

  // Setup error handling
  setupErrorHandling(socket);

  // Setup reconnection
  setupReconnectionHandling(socket, orderId);

  // Subscribe to order updates
  subscribeToOrder(socket, orderId);

  // Track location
  trackPorterLocation(socket, orderId);

  // Setup chat
  socket.on('chat:message:received', (message) => {
    displayMessage(message);
  });

  // Porter-specific: Listen for job offers
  if (role === 'porter') {
    listenForJobOffers(socket);
  }

  console.log('🚀 Real-time system fully initialized');

  return socket;
}
```

## Next Steps

Continue with:

1. **[Pricing & Payments](../08-pricing-payments/README.md)** - Payment processing
2. **[Notifications](../07-notifications/README.md)** - Push notifications
3. **[Admin Management](../09-admin/README.md)** - Admin real-time dashboard

## Quick Reference

```typescript
// Connect
const socket = io('http://localhost:3002/client', { auth: { token } });

// Authenticate
socket.emit('auth:authenticate', { token });

// Subscribe to order
socket.emit('order:subscribe', { orderId });

// Listen for updates
socket.on('order:status:changed', (data) => { /* ... */ });
socket.on('location:updated', (data) => { /* ... */ });
socket.on('chat:message:received', (message) => { /* ... */ });
socket.on('job:offer:received', (offer) => { /* ... */ });

// Send location
socket.emit('location:update', { lat, lng, orderId });

// Send chat message
socket.emit('chat:message:send', { recipientId, content });

// Cleanup
socket.disconnect();
```

---

**Continue to** **[Notifications](../07-notifications/README.md)** →
