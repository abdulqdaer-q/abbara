# Socket Event Catalog

Complete reference for all socket events supported by the MoveNow Realtime Gateway.

## Event Naming Convention

Events follow the pattern: `{domain}:{action}:{detail?}`

- **C2S**: Client to Server
- **S2C**: Server to Client
- **B**: Bidirectional

## Authentication Events

### `auth:authenticate` (C2S)

Authenticate socket connection with JWT token.

**Authorization**: None (performed during connection handshake)

**Payload**:
```typescript
{
  token: string;  // JWT access or socket token
}
```

**Response**: `auth:authenticated` or `auth:error`

**Rate Limit**: N/A (handled at connection level)

**Example**:
```typescript
socket.emit('auth:authenticate', {
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
});
```

---

### `auth:authenticated` (S2C)

Confirmation of successful authentication.

**Payload**:
```typescript
{
  success: true;
  userId: string;
  role: 'client' | 'porter' | 'admin';
}
```

**Example**:
```typescript
socket.on('auth:authenticated', (response) => {
  console.log('Authenticated as:', response.userId);
});
```

---

### `auth:error` (S2C)

Authentication error occurred.

**Payload**:
```typescript
{
  error: string;      // Error code (e.g., 'INVALID_TOKEN')
  message: string;    // Human-readable error message
  code?: string;      // Optional error code
}
```

---

## Order Subscription Events

### `order:subscribe` (C2S)

Subscribe to updates for a specific order.

**Authorization**:
- Customers can subscribe to their own orders
- Porters can subscribe to assigned orders
- Admins can subscribe to any order

**Payload**:
```typescript
{
  orderId: string;  // UUID of the order
}
```

**Response**: `order:subscription:confirmed` or `order:subscription:error`

**Rate Limit**: 100 requests per 60 seconds

**Example**:
```typescript
socket.emit('order:subscribe', {
  orderId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
});
```

---

### `order:unsubscribe` (C2S)

Unsubscribe from order updates.

**Payload**:
```typescript
{
  orderId: string;
}
```

**Example**:
```typescript
socket.emit('order:unsubscribe', {
  orderId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
});
```

---

### `order:subscription:confirmed` (S2C)

Subscription confirmation.

**Payload**:
```typescript
{
  success: true;
  orderId: string;
}
```

---

### `order:subscription:error` (S2C)

Subscription error.

**Payload**:
```typescript
{
  success: false;
  orderId?: string;
  error: string;
  message: string;
}
```

---

### `order:status:changed` (S2C)

Order status has changed.

**Payload**:
```typescript
{
  orderId: string;
  status: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  previousStatus?: string;
  timestamp: number;    // Unix timestamp in milliseconds
  metadata?: Record<string, any>;
}
```

**Delivery**: At-least-once delivery guaranteed

**Persistence**: Persisted in OrderEvents table

**Example**:
```typescript
socket.on('order:status:changed', (event) => {
  console.log(`Order ${event.orderId} changed from ${event.previousStatus} to ${event.status}`);
});
```

---

### `order:timeline:updated` (S2C)

Order timeline has been updated with new event.

**Payload**:
```typescript
{
  orderId: string;
  timeline: Array<{
    event: string;
    timestamp: number;
    details?: any;
  }>;
  timestamp: number;
}
```

---

## Location Events

### `location:update` (C2S)

Send location update (Porter only).

**Authorization**: Porter role required

**Payload**:
```typescript
{
  lat: number;        // Latitude (-90 to 90)
  lng: number;        // Longitude (-180 to 180)
  accuracy?: number;  // Accuracy in meters
  heading?: number;   // Heading in degrees (0-360)
  speed?: number;     // Speed in m/s
  timestamp: number;  // Unix timestamp in milliseconds
}
```

**Validation**:
- Coordinates must be valid latitude/longitude
- Timestamp must be within 5 minutes of current time
- Max payload size: 1KB

**Rate Limit**: 1000 updates per 60 seconds (high-frequency allowed)

**Response**: `location:updated` or `location:error`

**Persistence**: Sampled (1 in 10 by default) and persisted to storage

**Example**:
```typescript
navigator.geolocation.watchPosition((position) => {
  socket.emit('location:update', {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
    timestamp: position.timestamp
  });
});
```

---

### `location:updated` (S2C)

Location update received and broadcasted to subscribers.

**Payload**:
```typescript
{
  orderId: string;
  porterId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}
```

**Delivery**: Best-effort (ephemeral, not persisted for delivery)

**Example**:
```typescript
socket.on('location:updated', (location) => {
  updateMapMarker(location.porterId, {
    lat: location.lat,
    lng: location.lng
  });
});
```

---

### `location:error` (S2C)

Location update error.

**Payload**:
```typescript
{
  error: string;
  message: string;
  code?: string;
}
```

---

## Job Offer Events (Porter)

### `job:offer:received` (S2C)

New job offer received (Porter only).

**Payload**:
```typescript
{
  offerId: string;              // UUID
  orderId: string;              // UUID
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  dropoff: {
    address: string;
    lat: number;
    lng: number;
  };
  vehicleType: 'sedan' | 'suv' | 'van' | 'truck';
  porterCount: number;
  priceCents: number;
  estimatedDistanceMeters: number;
  expiresAt: number;           // Unix timestamp
}
```

**Delivery**: At-least-once delivery

**Persistence**: Temporary (expires after `expiresAt`)

**Example**:
```typescript
socket.on('job:offer:received', (offer) => {
  showJobOfferNotification(offer);

  // Auto-expire UI after offer expires
  const timeUntilExpiry = offer.expiresAt - Date.now();
  setTimeout(() => {
    hideJobOfferNotification(offer.offerId);
  }, timeUntilExpiry);
});
```

---

### `job:offer:accept` (C2S)

Accept a job offer (Porter only).

**Authorization**: Porter role required, must be the intended recipient

**Payload**:
```typescript
{
  offerId: string;
  orderId: string;
}
```

**Validation**:
- Offer must exist and not be expired
- Porter must be the intended recipient
- Offer must still be in 'pending' status

**Rate Limit**: 100 requests per 60 seconds

**Response**: `job:offer:accepted` or `job:offer:error`

**Side Effects**:
- Publishes acceptance to Kafka for order assignment
- Other pending offers for this order may be cancelled

**Example**:
```typescript
socket.emit('job:offer:accept', {
  offerId: 'abc-123',
  orderId: 'order-456'
});
```

---

### `job:offer:reject` (C2S)

Reject a job offer (Porter only).

**Payload**:
```typescript
{
  offerId: string;
  orderId: string;
}
```

**Response**: `job:offer:rejected` or `job:offer:error`

**Side Effects**:
- Publishes rejection to Kafka
- Offer may be sent to other porters

---

### `job:offer:accepted` (S2C)

Job offer acceptance confirmation.

**Payload**:
```typescript
{
  success: true;
  offerId: string;
  orderId: string;
}
```

---

### `job:offer:rejected` (S2C)

Job offer rejection confirmation.

**Payload**:
```typescript
{
  success: true;
  offerId: string;
  orderId: string;
}
```

---

### `job:offer:error` (S2C)

Job offer error occurred.

**Payload**:
```typescript
{
  error: string;      // Error code
  message: string;
  code?: string;
  offerId?: string;
}
```

**Common Error Codes**:
- `OFFER_NOT_FOUND` - Offer doesn't exist or expired
- `OFFER_EXPIRED` - Offer has expired
- `OFFER_ALREADY_PROCESSED` - Offer already accepted/rejected
- `FORBIDDEN` - Not authorized for this offer

---

## Chat Events

### `chat:message:send` (C2S)

Send a chat message.

**Authorization**: Client or Porter role, must be part of the order

**Payload**:
```typescript
{
  orderId: string;
  message: string;      // Max 1000 characters
  tempId?: string;      // Optional client-generated ID for deduplication
}
```

**Validation**:
- Message length: 1-1000 characters
- User must be customer or assigned porter for the order
- No HTML/script injection

**Rate Limit**: 50 messages per 60 seconds

**Response**: Message is broadcast as `chat:message:received`

**Persistence**: All chat messages persisted to database via Kafka

**Example**:
```typescript
const tempId = generateUUID();

socket.emit('chat:message:send', {
  orderId: currentOrder.id,
  message: 'On my way!',
  tempId: tempId
});

// Display optimistically with tempId
displayMessage({ tempId, message: 'On my way!', status: 'sending' });

socket.on('chat:message:received', (msg) => {
  if (msg.tempId === tempId) {
    updateMessage(tempId, { status: 'sent', messageId: msg.messageId });
  }
});
```

---

### `chat:message:received` (S2C)

Chat message received (broadcast to all order participants).

**Payload**:
```typescript
{
  messageId: string;
  orderId: string;
  senderId: string;
  senderRole: 'client' | 'porter';
  message: string;
  timestamp: number;
  tempId?: string;      // Echoed back if provided
}
```

**Delivery**: At-least-once delivery

**Example**:
```typescript
socket.on('chat:message:received', (msg) => {
  if (msg.senderId === currentUserId) {
    // My message confirmed
    updateMessageStatus(msg.tempId, 'delivered');
  } else {
    // New message from other party
    displayIncomingMessage(msg);
    playNotificationSound();
  }
});
```

---

### `chat:message:error` (S2C)

Chat message error.

**Payload**:
```typescript
{
  error: string;
  message: string;
  tempId?: string;      // If provided in original request
}
```

---

### `chat:typing:start` (C2S)

Indicate user is typing.

**Payload**:
```typescript
{
  orderId: string;
}
```

**Rate Limit**: Not strictly limited (lightweight)

**Delivery**: Best-effort, ephemeral

**Example**:
```typescript
let typingTimeout;

messageInput.on('input', () => {
  clearTimeout(typingTimeout);

  socket.emit('chat:typing:start', { orderId: currentOrder.id });

  typingTimeout = setTimeout(() => {
    socket.emit('chat:typing:stop', { orderId: currentOrder.id });
  }, 3000);
});
```

---

### `chat:typing:stop` (C2S)

Indicate user stopped typing.

**Payload**:
```typescript
{
  orderId: string;
}
```

---

## Notification Events

### `notification:received` (S2C)

Generic notification received.

**Payload**:
```typescript
{
  notificationId: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  data?: Record<string, any>;
}
```

**Example**:
```typescript
socket.on('notification:received', (notification) => {
  showToast({
    type: notification.type,
    title: notification.title,
    message: notification.message
  });
});
```

---

## Presence Events

### `porter:online` (S2C)

Porter came online (Admin only).

**Payload**:
```typescript
{
  porterId: string;
  timestamp: number;
}
```

---

### `porter:offline` (S2C)

Porter went offline (Admin only).

**Payload**:
```typescript
{
  porterId: string;
  timestamp: number;
}
```

---

## Connection Lifecycle Events

### `heartbeat` (B)

Keep-alive ping/pong.

**Payload**:
```typescript
{
  timestamp: number;
}
```

**Example**:
```typescript
// Client sends heartbeat every 25 seconds
setInterval(() => {
  socket.emit('heartbeat', { timestamp: Date.now() });
}, 25000);

// Server echoes back
socket.on('heartbeat', (response) => {
  lastHeartbeat = response.timestamp;
});
```

---

### `reconnect` (C2S)

Attempt to reconnect with token.

**Payload**:
```typescript
{
  reconnectToken: string;
  lastEventId?: string;     // Optional: request replay from this event
}
```

**Response**: Subscription state restored, missed events may be replayed

---

### `disconnect:reason` (S2C)

Server providing disconnect reason and reconnect token.

**Payload**:
```typescript
{
  reason: string;
  reconnectToken: string;   // Use this to reconnect
}
```

---

## Error Response Format

All error events follow this format:

```typescript
{
  error: string;       // Machine-readable error code
  message: string;     // Human-readable description
  code?: string;       // Optional HTTP-style error code
}
```

**Common Error Codes**:
- `INVALID_PAYLOAD` - Payload validation failed
- `FORBIDDEN` - Insufficient permissions
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error
- `NOT_FOUND` - Resource not found

---

## Best Practices

### 1. Error Handling

Always listen for error events:

```typescript
socket.on('order:subscription:error', (error) => {
  console.error('Subscription failed:', error.message);
  showErrorToUser(error.message);
});
```

### 2. Reconnection

Handle disconnections gracefully:

```typescript
let reconnectToken = null;

socket.on('disconnect:reason', ({ reason, reconnectToken: token }) => {
  reconnectToken = token;
});

socket.on('disconnect', () => {
  // Attempt reconnect with token
  if (reconnectToken) {
    socket.auth.reconnectToken = reconnectToken;
    socket.connect();
  }
});
```

### 3. Optimistic Updates

For better UX, update UI optimistically:

```typescript
// Send message
const tempId = uuid();
addMessageToUI({ tempId, text, status: 'sending' });

socket.emit('chat:message:send', { orderId, message: text, tempId });

// Confirm when received
socket.on('chat:message:received', (msg) => {
  if (msg.tempId === tempId) {
    updateMessageInUI(tempId, { status: 'sent', id: msg.messageId });
  }
});
```

### 4. Cleanup

Unsubscribe when leaving:

```typescript
useEffect(() => {
  socket.emit('order:subscribe', { orderId });

  return () => {
    socket.emit('order:unsubscribe', { orderId });
  };
}, [orderId]);
```

---

## Rate Limits Summary

| Event Type | Limit | Window |
|-----------|-------|--------|
| General | 100 requests | 60 seconds |
| Location Updates | 1000 updates | 60 seconds |
| Chat Messages | 50 messages | 60 seconds |
| Job Offers | 100 requests | 60 seconds |

Rate limits are per user (identified by userId from JWT).
