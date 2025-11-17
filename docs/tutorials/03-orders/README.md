# Order Management

Learn how to create, manage, and track orders through their complete lifecycle in the MoveNow platform.

## 📋 Table of Contents

- [Overview](#overview)
- [Order Lifecycle](#order-lifecycle)
- [Creating Orders](#creating-orders)
- [Retrieving Orders](#retrieving-orders)
- [Multi-Stop Orders](#multi-stop-orders)
- [Order Evidence](#order-evidence)
- [Updating Order Status](#updating-order-status)
- [Canceling Orders](#canceling-orders)
- [Best Practices](#best-practices)

## Overview

Orders are the core entity in MoveNow. An order represents a moving job from pickup to delivery, with optional intermediate stops.

### Key Concepts

- **Order** - A complete moving job
- **Waypoint** - A stop location (pickup, dropoff, or intermediate)
- **Assignment** - Porter(s) assigned to the order
- **Evidence** - Photos and documentation of the move
- **Status** - Current state in the order lifecycle

## Order Lifecycle

Orders progress through these states:

```
CREATED
   ↓
TENTATIVELY_ASSIGNED (optional, for bidding)
   ↓
ASSIGNED (porters assigned)
   ↓
ACCEPTED (porters accepted)
   ↓
ARRIVED (at pickup location)
   ↓
LOADED (items loaded)
   ↓
EN_ROUTE (traveling to destination)
   ↓
DELIVERED (items delivered)
   ↓
COMPLETED (job finished)
   ↓
CLOSED (payment settled)
```

### Status Transitions

| Current Status | Can Transition To | Actor |
|---------------|-------------------|-------|
| CREATED | TENTATIVELY_ASSIGNED, ASSIGNED, CANCELLED | System/Admin |
| ASSIGNED | ACCEPTED, CANCELLED | Porter |
| ACCEPTED | ARRIVED, CANCELLED | Porter |
| ARRIVED | LOADED, CANCELLED | Porter |
| LOADED | EN_ROUTE | Porter |
| EN_ROUTE | DELIVERED | Porter |
| DELIVERED | COMPLETED | System |
| COMPLETED | CLOSED | System |

## Creating Orders

### Basic Order

```typescript
import { client } from '../client';

async function createBasicOrder() {
  try {
    const order = await client.orders.create.mutate({
      pickup: {
        address: '123 Market St, San Francisco, CA 94103',
        lat: 37.7749,
        lng: -122.4194,
        contactName: 'John Doe',
        contactPhone: '+14155551234',
        notes: 'Ring doorbell #3',
      },
      dropoff: {
        address: '456 Mission St, San Francisco, CA 94105',
        lat: 37.7849,
        lng: -122.3974,
        contactName: 'Jane Smith',
        contactPhone: '+14155555678',
        notes: 'Loading dock entrance',
      },
      vehicleType: 'VAN',
      porterCount: 2,
      scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
      notes: 'Please be careful with the piano',
    });

    console.log('Order created successfully!');
    console.log('Order ID:', order.id);
    console.log('Status:', order.status);
    console.log('Estimated Price:', `$${order.estimatedPriceCents / 100}`);

    return order;
  } catch (error) {
    console.error('Failed to create order:', error);
    throw error;
  }
}
```

### Immediate Order (ASAP)

```typescript
async function createImmediateOrder() {
  const order = await client.orders.create.mutate({
    pickup: {
      address: '789 Howard St, San Francisco, CA',
      lat: 37.7749,
      lng: -122.4194,
      contactName: 'Mike Johnson',
      contactPhone: '+14155559999',
    },
    dropoff: {
      address: '321 Folsom St, San Francisco, CA',
      lat: 37.7849,
      lng: -122.3974,
      contactName: 'Mike Johnson',
      contactPhone: '+14155559999',
    },
    vehicleType: 'SEDAN',
    porterCount: 1,
    // Don't set scheduledAt for immediate order
  });

  console.log('Immediate order created:', order.id);
  return order;
}
```

### Order with Item Details

```typescript
async function createOrderWithItems() {
  const order = await client.orders.create.mutate({
    pickup: {
      address: '123 Residential Ave, San Francisco, CA',
      lat: 37.7749,
      lng: -122.4194,
      contactName: 'Sarah Wilson',
      contactPhone: '+14155551111',
    },
    dropoff: {
      address: '456 New Home Blvd, Oakland, CA',
      lat: 37.8044,
      lng: -122.2711,
      contactName: 'Sarah Wilson',
      contactPhone: '+14155551111',
    },
    vehicleType: 'TRUCK',
    porterCount: 3,
    items: [
      {
        name: 'Piano',
        quantity: 1,
        weight: 500, // pounds
        dimensions: { length: 60, width: 24, height: 40 }, // inches
        requiresSpecialHandling: true,
      },
      {
        name: 'Sofa',
        quantity: 1,
        weight: 150,
      },
      {
        name: 'Box',
        quantity: 15,
        weight: 30,
      },
    ],
    scheduledAt: new Date('2024-03-15T09:00:00'),
    notes: 'Third floor apartment, no elevator',
  });

  console.log('Order with items created:', order.id);
  return order;
}
```

### Scheduled Order

```typescript
async function createScheduledOrder() {
  // Schedule for next Saturday at 9 AM
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + ((6 - scheduledDate.getDay()) % 7 || 7));
  scheduledDate.setHours(9, 0, 0, 0);

  const order = await client.orders.create.mutate({
    pickup: {
      address: '100 Storage Unit Way, San Francisco, CA',
      lat: 37.7749,
      lng: -122.4194,
      contactName: 'Bob Anderson',
      contactPhone: '+14155552222',
    },
    dropoff: {
      address: '200 New Apartment Rd, San Francisco, CA',
      lat: 37.7849,
      lng: -122.3974,
      contactName: 'Bob Anderson',
      contactPhone: '+14155552222',
    },
    vehicleType: 'VAN',
    porterCount: 2,
    scheduledAt: scheduledDate,
  });

  console.log(`Order scheduled for ${scheduledDate.toLocaleString()}`);
  return order;
}
```

## Retrieving Orders

### Get Single Order

```typescript
async function getOrder(orderId: string) {
  try {
    const order = await client.orders.get.query({ orderId });

    console.log('Order Details:');
    console.log('ID:', order.id);
    console.log('Status:', order.status);
    console.log('Created:', order.createdAt);
    console.log('Customer:', order.customer.displayName);
    console.log('Pickup:', order.waypoints[0].address);
    console.log('Dropoff:', order.waypoints[order.waypoints.length - 1].address);

    if (order.assignedPorters.length > 0) {
      console.log('Assigned Porters:');
      order.assignedPorters.forEach((porter) => {
        console.log(`  - ${porter.displayName} (Rating: ${porter.averageRating}/5)`);
      });
    }

    return order;
  } catch (error) {
    if (error.data?.code === 'NOT_FOUND') {
      console.error('Order not found');
    } else if (error.data?.code === 'FORBIDDEN') {
      console.error('You do not have permission to view this order');
    }
    throw error;
  }
}
```

### List User's Orders

```typescript
async function listMyOrders() {
  try {
    const orders = await client.orders.list.query({
      limit: 20,
      offset: 0,
    });

    console.log(`You have ${orders.total} total orders`);
    console.log(`Showing ${orders.data.length} orders:\n`);

    orders.data.forEach((order) => {
      console.log(`Order #${order.id}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  From: ${order.pickup.address}`);
      console.log(`  To: ${order.dropoff.address}`);
      console.log(`  Date: ${order.scheduledAt?.toLocaleDateString() || 'ASAP'}`);
      console.log(`  Price: $${order.finalPriceCents ? order.finalPriceCents / 100 : order.estimatedPriceCents / 100}`);
      console.log();
    });

    return orders;
  } catch (error) {
    console.error('Failed to list orders:', error);
    throw error;
  }
}
```

### Filter Orders by Status

```typescript
async function getActiveOrders() {
  const orders = await client.orders.list.query({
    status: 'ACCEPTED', // Only show accepted orders
    limit: 10,
  });

  console.log('Active orders:', orders.data.length);
  return orders;
}

async function getCompletedOrders() {
  const orders = await client.orders.list.query({
    status: 'COMPLETED',
    limit: 50,
    offset: 0,
  });

  console.log('Completed orders:', orders.data.length);
  return orders;
}
```

### Paginate Through Orders

```typescript
async function getAllOrders() {
  const allOrders = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const result = await client.orders.list.query({ limit, offset });
    allOrders.push(...result.data);

    console.log(`Fetched ${result.data.length} orders (total: ${allOrders.length}/${result.total})`);

    if (allOrders.length >= result.total) {
      break;
    }

    offset += limit;
  }

  return allOrders;
}
```

## Multi-Stop Orders

### Create Order with Multiple Stops

```typescript
async function createMultiStopOrder() {
  const order = await client.orders.create.mutate({
    pickup: {
      address: '123 Start Location, San Francisco, CA',
      lat: 37.7749,
      lng: -122.4194,
      contactName: 'Alice Brown',
      contactPhone: '+14155553333',
    },
    additionalStops: [
      {
        address: '456 Stop #1, San Francisco, CA',
        lat: 37.7849,
        lng: -122.3974,
        type: 'PICKUP', // Pick up more items
        contactName: 'Bob Green',
        contactPhone: '+14155554444',
        notes: 'Pick up additional boxes',
      },
      {
        address: '789 Stop #2, Oakland, CA',
        lat: 37.8044,
        lng: -122.2711,
        type: 'DROPOFF', // Drop off some items
        contactName: 'Carol White',
        contactPhone: '+14155555555',
        notes: 'Deliver furniture here',
      },
    ],
    dropoff: {
      address: '999 Final Destination, Berkeley, CA',
      lat: 37.8715,
      lng: -122.2730,
      contactName: 'Alice Brown',
      contactPhone: '+14155553333',
      notes: 'Final delivery location',
    },
    vehicleType: 'TRUCK',
    porterCount: 2,
  });

  console.log('Multi-stop order created');
  console.log('Total waypoints:', order.waypoints.length);

  order.waypoints.forEach((waypoint, index) => {
    console.log(`${index + 1}. ${waypoint.type}: ${waypoint.address}`);
  });

  return order;
}
```

### Update Waypoint Status (Porter)

```typescript
async function updateWaypointStatus(waypointId: string, newStatus: string) {
  try {
    const waypoint = await client.waypoints.updateStatus.mutate({
      waypointId,
      newStatus,
      porterId: 'current-porter-id', // Automatically set from auth context
      arrivedAt: new Date(), // For ARRIVED status
      completedAt: newStatus === 'COMPLETED' ? new Date() : undefined,
    });

    console.log(`Waypoint ${waypointId} updated to ${newStatus}`);
    return waypoint;
  } catch (error) {
    console.error('Failed to update waypoint:', error);
    throw error;
  }
}
```

## Order Evidence

### Upload Evidence Photos

```typescript
async function uploadPickupEvidence(orderId: string) {
  try {
    // First, upload image to your storage (S3, Cloudinary, etc.)
    const imageUrl = await uploadToStorage('pickup-photo.jpg');

    // Then create evidence record
    const evidence = await client.evidence.create.mutate({
      orderId,
      type: 'PICKUP_PHOTO',
      url: imageUrl,
      metadata: {
        timestamp: new Date().toISOString(),
        location: { lat: 37.7749, lng: -122.4194 },
        notes: 'All items loaded successfully',
      },
    });

    console.log('Evidence uploaded:', evidence.id);
    return evidence;
  } catch (error) {
    console.error('Failed to upload evidence:', error);
    throw error;
  }
}

async function uploadDeliveryEvidence(orderId: string) {
  const imageUrl = await uploadToStorage('delivery-photo.jpg');

  const evidence = await client.evidence.create.mutate({
    orderId,
    type: 'DELIVERY_PHOTO',
    url: imageUrl,
    metadata: {
      timestamp: new Date().toISOString(),
      signature: 'data:image/png;base64,...', // Customer signature
    },
  });

  console.log('Delivery evidence uploaded');
  return evidence;
}
```

### Evidence Types

```typescript
type EvidenceType =
  | 'PICKUP_PHOTO'      // Photo at pickup
  | 'DELIVERY_PHOTO'    // Photo at delivery
  | 'DAMAGE_REPORT'     // Photo of damage
  | 'SIGNATURE'         // Customer signature
  | 'ITEM_PHOTO'        // Photo of specific item
  | 'OTHER';            // Other documentation
```

## Updating Order Status

### Change Order Status (Porter)

```typescript
async function acceptOrder(orderId: string) {
  try {
    const order = await client.orders.changeStatus.mutate({
      orderId,
      newStatus: 'ACCEPTED',
      actor: 'PORTER', // Automatically inferred from auth
    });

    console.log('Order accepted!');
    return order;
  } catch (error) {
    if (error.data?.code === 'CONFLICT') {
      console.error('Order already accepted by another porter');
    }
    throw error;
  }
}

async function markArrived(orderId: string) {
  const order = await client.orders.changeStatus.mutate({
    orderId,
    newStatus: 'ARRIVED',
    actor: 'PORTER',
    location: {
      lat: 37.7749,
      lng: -122.4194,
    },
  });

  console.log('Marked as arrived at pickup location');
  return order;
}

async function markLoaded(orderId: string) {
  const order = await client.orders.changeStatus.mutate({
    orderId,
    newStatus: 'LOADED',
    actor: 'PORTER',
  });

  console.log('Items loaded, ready to go!');
  return order;
}

async function markEnRoute(orderId: string) {
  const order = await client.orders.changeStatus.mutate({
    orderId,
    newStatus: 'EN_ROUTE',
    actor: 'PORTER',
  });

  console.log('En route to destination');
  return order;
}

async function markDelivered(orderId: string) {
  const order = await client.orders.changeStatus.mutate({
    orderId,
    newStatus: 'DELIVERED',
    actor: 'PORTER',
  });

  console.log('Order delivered!');
  return order;
}
```

### Complete Order Flow (Porter Side)

```typescript
async function completeOrderWorkflow(orderId: string) {
  try {
    // 1. Accept the order
    console.log('Step 1: Accepting order...');
    await acceptOrder(orderId);

    // 2. Drive to pickup location
    console.log('Step 2: Driving to pickup...');
    // ... (navigation happens)

    // 3. Mark arrived at pickup
    console.log('Step 3: Arrived at pickup');
    await markArrived(orderId);

    // 4. Upload pickup evidence
    console.log('Step 4: Taking pickup photos...');
    await uploadPickupEvidence(orderId);

    // 5. Load items
    console.log('Step 5: Loading items...');
    await markLoaded(orderId);

    // 6. Start journey
    console.log('Step 6: En route to destination');
    await markEnRoute(orderId);

    // 7. Arrive and deliver
    console.log('Step 7: Delivered!');
    await markDelivered(orderId);

    // 8. Upload delivery evidence
    console.log('Step 8: Taking delivery photos...');
    await uploadDeliveryEvidence(orderId);

    console.log('✅ Order completed successfully!');
  } catch (error) {
    console.error('Error during order workflow:', error);
    throw error;
  }
}
```

## Canceling Orders

### Cancel Order (Customer)

```typescript
async function cancelOrder(orderId: string, reason: string) {
  try {
    const order = await client.orders.cancel.mutate({
      orderId,
      reason,
    });

    console.log('Order cancelled');
    console.log('Refund status:', order.refundStatus);

    return order;
  } catch (error) {
    if (error.data?.code === 'BAD_REQUEST') {
      console.error('Order cannot be cancelled at this stage');
    }
    throw error;
  }
}

// Usage
await cancelOrder('order-123', 'Changed moving date');
```

### Cancellation Policies

```typescript
async function checkCancellationPolicy(orderId: string) {
  const order = await client.orders.get.query({ orderId });

  const now = new Date();
  const scheduledTime = new Date(order.scheduledAt);
  const hoursUntilPickup = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilPickup > 24) {
    console.log('Full refund available');
  } else if (hoursUntilPickup > 4) {
    console.log('50% cancellation fee applies');
  } else {
    console.log('No refund - order is too close to scheduled time');
  }
}
```

## Best Practices

### 1. Validate Addresses Before Creating Orders

```typescript
async function validateAndCreateOrder(pickupAddress: string, dropoffAddress: string) {
  // Use a geocoding service to validate addresses
  const pickupCoords = await geocodeAddress(pickupAddress);
  const dropoffCoords = await geocodeAddress(dropoffAddress);

  if (!pickupCoords || !dropoffCoords) {
    throw new Error('Invalid address');
  }

  return await client.orders.create.mutate({
    pickup: {
      address: pickupAddress,
      lat: pickupCoords.lat,
      lng: pickupCoords.lng,
      // ...
    },
    dropoff: {
      address: dropoffAddress,
      lat: dropoffCoords.lat,
      lng: dropoffCoords.lng,
      // ...
    },
    // ...
  });
}
```

### 2. Show Price Estimate Before Creating Order

```typescript
async function createOrderWithPriceConfirmation(orderData: any) {
  // First, get price estimate
  const estimate = await client.payments.estimatePrice.query({
    pickup: orderData.pickup,
    dropoff: orderData.dropoff,
    vehicleType: orderData.vehicleType,
    porterCount: orderData.porterCount,
  });

  console.log(`Estimated price: $${estimate.totalCents / 100}`);

  // Ask user for confirmation
  const confirmed = await askUserConfirmation(
    `The estimated price is $${estimate.totalCents / 100}. Proceed?`
  );

  if (!confirmed) {
    return null;
  }

  // Create order
  return await client.orders.create.mutate(orderData);
}
```

### 3. Handle Idempotency for Critical Operations

```typescript
async function createOrderIdempotent(orderData: any, idempotencyKey: string) {
  try {
    return await client.orders.create.mutate({
      ...orderData,
      idempotencyKey,
    });
  } catch (error) {
    // If duplicate, retrieve existing order
    if (error.message.includes('duplicate')) {
      return await client.orders.getByIdempotencyKey.query({ idempotencyKey });
    }
    throw error;
  }
}
```

### 4. Poll for Order Updates

```typescript
async function watchOrder(orderId: string, callback: (order: any) => void) {
  let lastStatus = '';

  const interval = setInterval(async () => {
    try {
      const order = await client.orders.get.query({ orderId });

      if (order.status !== lastStatus) {
        lastStatus = order.status;
        callback(order);
      }

      // Stop polling when order is completed
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
        clearInterval(interval);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    }
  }, 5000); // Poll every 5 seconds

  return () => clearInterval(interval);
}

// Usage
const stopWatching = watchOrder('order-123', (order) => {
  console.log('Order status changed to:', order.status);
});
```

### 5. Use WebSockets for Real-Time Updates (Recommended)

For better performance, use WebSocket subscriptions instead of polling:

```typescript
// See Real-time Features tutorial for WebSocket setup
socket.on('order:status:changed', (data) => {
  console.log('Order updated:', data.orderId, data.newStatus);
});
```

## Next Steps

Now that you understand order management, explore:

1. **[Bidding System](../04-bidding/README.md)** - Competitive pricing for orders
2. **[Real-time Features](../06-realtime/README.md)** - WebSocket updates for orders
3. **[Pricing & Payments](../08-pricing-payments/README.md)** - Payment processing

## Quick Reference

```typescript
// Create order
await client.orders.create.mutate({ pickup, dropoff, vehicleType, porterCount });

// Get order
await client.orders.get.query({ orderId });

// List orders
await client.orders.list.query({ status?, limit?, offset? });

// Change status
await client.orders.changeStatus.mutate({ orderId, newStatus, actor });

// Cancel order
await client.orders.cancel.mutate({ orderId, reason });

// Upload evidence
await client.evidence.create.mutate({ orderId, type, url, metadata? });
```

---

**Ready for advanced features?** Continue to **[Bidding System](../04-bidding/README.md)** →
