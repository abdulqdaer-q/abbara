# Notifications & Messaging

Learn how to implement push notifications, email/SMS notifications, in-app messaging, and manage user notification preferences.

## 📋 Table of Contents

- [Overview](#overview)
- [Push Notifications](#push-notifications)
- [Email & SMS](#email--sms)
- [In-App Messaging](#in-app-messaging)
- [User Preferences](#user-preferences)
- [Broadcast Messages](#broadcast-messages)
- [Best Practices](#best-practices)

## Overview

MoveNow supports multi-channel notifications:

- **Push** - Mobile (FCM/APNs) and web push
- **Email** - Transactional and marketing emails
- **SMS** - Text messages via Twilio
- **In-App** - Real-time in-app notifications

## Push Notifications

### Register Device Token

```typescript
import { client } from '../client';

async function registerForPushNotifications(deviceToken: string, platform: 'ios' | 'android' | 'web') {
  try {
    await client.preferences.registerDeviceToken.mutate({
      token: deviceToken,
      platform,
      deviceInfo: {
        model: 'iPhone 14',
        osVersion: 'iOS 17.0',
        appVersion: '1.0.0',
      },
    });

    console.log('✅ Device registered for push notifications');
  } catch (error) {
    console.error('Failed to register device:', error);
    throw error;
  }
}
```

### Request Push Permissions (Mobile)

```typescript
async function requestPushPermission() {
  try {
    // Request permission (React Native example)
    const { status } = await Notifications.requestPermissionsAsync();

    if (status !== 'granted') {
      console.log('❌ Push notification permission denied');
      return false;
    }

    // Get FCM/APNs token
    const token = (await Notifications.getExpoPushTokenAsync()).data;

    // Register with backend
    await registerForPushNotifications(token, 'ios');

    console.log('✅ Push notifications enabled');
    return true;
  } catch (error) {
    console.error('Error requesting push permission:', error);
    return false;
  }
}
```

### Request Web Push Permissions

```typescript
async function requestWebPushPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'your-vapid-public-key',
      });

      // Send to backend
      await registerForPushNotifications(
        JSON.stringify(subscription),
        'web'
      );

      console.log('✅ Web push enabled');
      return true;
    }
  }

  console.log('❌ Web push not supported or denied');
  return false;
}
```

### Handle Incoming Push Notifications

```typescript
// React Native example
import * as Notifications from 'expo-notifications';

function setupPushNotificationHandlers() {
  // Foreground notification handler
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      console.log('📬 Notification received (foreground)');
      console.log('Title:', notification.request.content.title);
      console.log('Body:', notification.request.content.body);
      console.log('Data:', notification.request.content.data);

      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });

  // Notification click handler
  Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('👆 Notification tapped');

    const data = response.notification.request.content.data;

    // Navigate based on notification type
    if (data.orderId) {
      navigateToOrder(data.orderId);
    } else if (data.chatId) {
      navigateToChat(data.chatId);
    }
  });
}
```

## Email & SMS

### Send Notification (Multi-Channel)

```typescript
async function sendOrderConfirmation(userId: string, orderId: string) {
  try {
    await client.notification.send.mutate({
      recipientId: userId,
      channels: ['PUSH', 'EMAIL'], // Send via push and email
      messageType: 'ORDER_CONFIRMATION',
      payload: {
        orderId,
        orderNumber: 'MN-12345',
        pickup: '123 Market St',
        dropoff: '456 Mission St',
        scheduledAt: '2024-12-15T10:00:00',
        price: '$75.00',
      },
      priority: 'HIGH',
    });

    console.log('✅ Confirmation sent');
  } catch (error) {
    console.error('Failed to send confirmation:', error);
  }
}
```

### Send SMS Only

```typescript
async function sendSmsVerification(userId: string, code: string) {
  await client.notification.send.mutate({
    recipientId: userId,
    channels: ['SMS'], // SMS only
    messageType: 'VERIFICATION_CODE',
    payload: {
      code,
      expiresIn: 5, // minutes
    },
  });

  console.log('✅ SMS verification code sent');
}
```

### Send Email Only

```typescript
async function sendWelcomeEmail(userId: string) {
  await client.notification.send.mutate({
    recipientId: userId,
    channels: ['EMAIL'],
    messageType: 'WELCOME',
    payload: {
      userName: 'John Doe',
      loginUrl: 'https://app.movenow.com/login',
    },
  });

  console.log('✅ Welcome email sent');
}
```

### Send with Template

```typescript
async function sendCustomNotification(userId: string) {
  await client.notification.send.mutate({
    recipientId: userId,
    channels: ['EMAIL', 'PUSH'],
    messageType: 'CUSTOM',
    payload: {
      template: 'porter-verification-complete',
      data: {
        porterName: 'John Porter',
        verifiedAt: new Date().toISOString(),
        nextSteps: [
          'Complete your profile',
          'Set your availability',
          'Start accepting jobs',
        ],
      },
    },
  });

  console.log('✅ Custom notification sent');
}
```

## In-App Messaging

### Send In-App Message

```typescript
async function sendInAppMessage(recipientId: string, content: string) {
  try {
    await client.messaging.sendMessage.mutate({
      recipientId,
      content,
      messageType: 'TEXT',
    });

    console.log('✅ Message sent');
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}
```

### Send Order-Related Message

```typescript
async function sendOrderMessage(
  recipientId: string,
  orderId: string,
  content: string
) {
  await client.messaging.sendMessage.mutate({
    recipientId,
    content,
    messageType: 'TEXT',
    relatedOrderId: orderId,
  });

  console.log('✅ Order message sent');
}
```

### Get Chat History

```typescript
async function getChatHistory(conversationId: string) {
  try {
    const messages = await client.messaging.getChatHistory.query({
      conversationId,
      limit: 50,
    });

    console.log(`Retrieved ${messages.length} messages:\n`);

    messages.forEach((message) => {
      const time = new Date(message.timestamp).toLocaleTimeString();
      console.log(`[${time}] ${message.sender.displayName}: ${message.content}`);

      if (!message.readAt) {
        console.log('  (unread)');
      }
    });

    return messages;
  } catch (error) {
    console.error('Failed to get chat history:', error);
    throw error;
  }
}
```

### Get Chat with Specific User

```typescript
async function getChatWithUser(otherUserId: string) {
  const messages = await client.messaging.getChatHistory.query({
    otherUserId,
    limit: 100,
  });

  console.log(`Chat with user ${otherUserId}:`, messages.length, 'messages');
  return messages;
}
```

### Mark Messages as Read

```typescript
async function markMessagesAsRead(messageIds: string[]) {
  await client.messaging.markAsRead.mutate({
    messageIds,
  });

  console.log('✅ Messages marked as read');
}

async function markConversationAsRead(conversationId: string) {
  await client.messaging.markAsRead.mutate({
    conversationId,
  });

  console.log('✅ Conversation marked as read');
}
```

## User Preferences

### Get Notification Preferences

```typescript
async function getNotificationPreferences() {
  try {
    const prefs = await client.preferences.get.query();

    console.log('🔔 Notification Preferences:');
    console.log('Push Notifications:', prefs.pushEnabled ? 'ON' : 'OFF');
    console.log('Email Notifications:', prefs.emailEnabled ? 'ON' : 'OFF');
    console.log('SMS Notifications:', prefs.smsEnabled ? 'ON' : 'OFF');

    if (prefs.quietHours) {
      console.log(
        'Quiet Hours:',
        `${prefs.quietHours.start} - ${prefs.quietHours.end}`
      );
    }

    return prefs;
  } catch (error) {
    console.error('Failed to get preferences:', error);
    throw error;
  }
}
```

### Update Notification Preferences

```typescript
async function updateNotificationPreferences() {
  const prefs = await client.preferences.update.mutate({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false, // Disable SMS
    quietHours: {
      start: '22:00', // 10 PM
      end: '08:00', // 8 AM
      timezone: 'America/Los_Angeles',
    },
  });

  console.log('✅ Preferences updated');
  return prefs;
}
```

### Disable All Notifications

```typescript
async function disableAllNotifications() {
  await client.preferences.update.mutate({
    pushEnabled: false,
    emailEnabled: false,
    smsEnabled: false,
  });

  console.log('✅ All notifications disabled');
}
```

### Channel-Specific Preferences

```typescript
async function setChannelPreferences() {
  await client.preferences.update.mutate({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    preferences: {
      orderUpdates: {
        push: true,
        email: false,
        sms: false,
      },
      marketing: {
        push: false,
        email: true,
        sms: false,
      },
      chat: {
        push: true,
        email: false,
        sms: false,
      },
    },
  });

  console.log('✅ Channel preferences set');
}
```

## Broadcast Messages

### Send Broadcast (Admin)

```typescript
async function sendBroadcastMessage() {
  try {
    await client.broadcast.send.mutate({
      messageContent: {
        title: 'Platform Maintenance',
        body: 'We will be performing maintenance on Dec 15 from 2-4 AM PST',
        action: {
          type: 'URL',
          url: 'https://status.movenow.com',
        },
      },
      channels: ['PUSH', 'EMAIL', 'IN_APP'],
      filters: {
        roles: ['CUSTOMER', 'PORTER'], // Target specific roles
        regions: ['SF', 'OAK'], // Target specific regions
      },
      priority: 'HIGH',
    });

    console.log('✅ Broadcast message sent');
  } catch (error) {
    console.error('Failed to send broadcast:', error);
  }
}
```

### Send to All Users

```typescript
async function sendToAllUsers() {
  await client.broadcast.send.mutate({
    messageContent: {
      title: 'New Feature Alert!',
      body: 'Try our new multi-stop delivery feature',
    },
    channels: ['PUSH', 'IN_APP'],
    // No filters = all users
  });

  console.log('✅ Sent to all users');
}
```

### Send to Specific User Segment

```typescript
async function sendToActivePorters() {
  await client.broadcast.send.mutate({
    messageContent: {
      title: 'Earn More This Weekend',
      body: 'Peak hour bonuses available Saturday & Sunday',
    },
    channels: ['PUSH'],
    filters: {
      roles: ['PORTER'],
      userStatus: 'ACTIVE',
      lastActiveWithin: 7, // days
    },
    priority: 'NORMAL',
  });

  console.log('✅ Sent to active porters');
}
```

## Best Practices

### 1. Respect User Preferences

```typescript
async function sendNotificationRespectingPreferences(
  userId: string,
  messageType: string,
  payload: any
) {
  // Get user preferences
  const prefs = await client.preferences.get.query();

  // Determine which channels to use
  const channels: string[] = [];

  if (prefs.pushEnabled) channels.push('PUSH');
  if (prefs.emailEnabled) channels.push('EMAIL');
  if (prefs.smsEnabled) channels.push('SMS');

  // Check quiet hours
  const now = new Date();
  const isQuietHours = checkQuietHours(now, prefs.quietHours);

  if (isQuietHours) {
    // Only send email during quiet hours (non-intrusive)
    const filteredChannels = channels.filter((c) => c === 'EMAIL');

    if (filteredChannels.length === 0) {
      console.log('⏰ Quiet hours - notification delayed');
      return; // Queue for later
    }
  }

  // Send notification
  await client.notification.send.mutate({
    recipientId: userId,
    channels,
    messageType,
    payload,
  });
}
```

### 2. Rate Limiting

```typescript
class NotificationRateLimiter {
  private sentCounts: Map<string, number> = new Map();
  private maxPerHour = 10;

  async canSend(userId: string): Promise<boolean> {
    const key = `${userId}-${new Date().getHours()}`;
    const count = this.sentCounts.get(key) || 0;

    if (count >= this.maxPerHour) {
      console.log('⚠️ Rate limit reached for user:', userId);
      return false;
    }

    this.sentCounts.set(key, count + 1);
    return true;
  }
}

const rateLimiter = new NotificationRateLimiter();

async function sendWithRateLimit(userId: string, content: any) {
  if (await rateLimiter.canSend(userId)) {
    await client.notification.send.mutate(content);
  } else {
    console.log('Notification skipped due to rate limit');
  }
}
```

### 3. Notification Grouping

```typescript
async function sendGroupedNotifications(userId: string, updates: any[]) {
  if (updates.length === 1) {
    // Single notification
    await sendSingleNotification(userId, updates[0]);
  } else {
    // Grouped notification
    await client.notification.send.mutate({
      recipientId: userId,
      channels: ['PUSH'],
      messageType: 'MULTIPLE_UPDATES',
      payload: {
        title: `${updates.length} new updates`,
        body: 'You have multiple order updates',
        updates,
      },
    });
  }
}
```

### 4. Track Notification History

```typescript
async function getNotificationHistory(userId: string) {
  const history = await client.notification.getHistory.query({
    userId,
    limit: 50,
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      end: new Date(),
    },
  });

  console.log(`Notification history (${history.length}):\n`);

  history.forEach((notification) => {
    console.log(`[${notification.timestamp}] ${notification.messageType}`);
    console.log(`  Channels: ${notification.channels.join(', ')}`);
    console.log(`  Status: ${notification.status}`);
    if (notification.readAt) {
      console.log(`  Read: ${notification.readAt}`);
    }
    console.log();
  });

  return history;
}
```

### 5. Deep Linking

```typescript
async function sendNotificationWithDeepLink(userId: string, orderId: string) {
  await client.notification.send.mutate({
    recipientId: userId,
    channels: ['PUSH'],
    messageType: 'ORDER_UPDATE',
    payload: {
      title: 'Order Update',
      body: 'Your porter has arrived!',
      deepLink: `movenow://order/${orderId}`, // Custom deep link
      orderId,
    },
  });

  console.log('✅ Notification sent with deep link');
}

// Handle deep link in app
function handleDeepLink(url: string) {
  const match = url.match(/movenow:\/\/order\/(.+)/);

  if (match) {
    const orderId = match[1];
    navigateToOrder(orderId);
  }
}
```

## Notification Types Reference

Common notification types in MoveNow:

```typescript
type NotificationType =
  | 'ORDER_CONFIRMATION' // Order created
  | 'ORDER_ASSIGNED' // Porter assigned
  | 'ORDER_ACCEPTED' // Porter accepted
  | 'PORTER_ARRIVED' // Porter at pickup
  | 'ORDER_EN_ROUTE' // On the way
  | 'ORDER_DELIVERED' // Delivered
  | 'ORDER_CANCELLED' // Order cancelled
  | 'PAYMENT_SUCCESSFUL' // Payment processed
  | 'PAYMENT_FAILED' // Payment failed
  | 'JOB_OFFER' // New job for porter
  | 'BID_RECEIVED' // New bid on order
  | 'BID_ACCEPTED' // Bid accepted
  | 'VERIFICATION_APPROVED' // Porter verified
  | 'VERIFICATION_REJECTED' // Verification rejected
  | 'CHAT_MESSAGE' // New chat message
  | 'PROMO_CODE' // Promo code notification
  | 'PLATFORM_UPDATE'; // Platform announcement
```

## Next Steps

Continue with:

1. **[Admin Management](../09-admin/README.md)** - Admin notification management
2. **[Real-time Features](../06-realtime/README.md)** - Real-time messaging
3. **[Order Management](../03-orders/README.md)** - Order status notifications

## Quick Reference

```typescript
// Send notification
await client.notification.send.mutate({
  recipientId,
  channels,
  messageType,
  payload,
  priority?,
});

// Send message
await client.messaging.sendMessage.mutate({
  recipientId,
  content,
  messageType?,
  relatedOrderId?,
});

// Get preferences
await client.preferences.get.query();

// Update preferences
await client.preferences.update.mutate({
  pushEnabled?,
  emailEnabled?,
  smsEnabled?,
  quietHours?,
});

// Register device
await client.preferences.registerDeviceToken.mutate({ token, platform });

// Broadcast
await client.broadcast.send.mutate({
  messageContent,
  channels,
  filters?,
});
```

---

**Continue to** **[Admin Management](../09-admin/README.md)** →
