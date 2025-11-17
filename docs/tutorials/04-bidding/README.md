# Bidding System

Learn how to implement competitive bidding for moving jobs, allowing porters to bid for orders and customers to choose the best offer.

## 📋 Table of Contents

- [Overview](#overview)
- [How Bidding Works](#how-bidding-works)
- [Opening Bidding Windows](#opening-bidding-windows)
- [Placing Bids](#placing-bids)
- [Accepting Bids](#accepting-bids)
- [Evaluation Strategies](#evaluation-strategies)
- [Best Practices](#best-practices)

## Overview

The bidding system allows for competitive pricing on moving jobs:

- **Customers** can receive multiple offers and choose the best one
- **Porters** can bid on jobs that match their preferences
- **System** evaluates bids using configurable strategies

### Benefits

- **Lower prices** through competition
- **Porter flexibility** - bid on preferred jobs
- **Transparency** - see all offers
- **Fair allocation** - porters compete on price, speed, and quality

## How Bidding Works

### Bidding Flow

```
1. Customer creates order
   ↓
2. System opens bidding window (30-60 minutes)
   ↓
3. Nearby porters receive notification
   ↓
4. Porters place bids with price and ETA
   ↓
5. System ranks bids using evaluation strategy
   ↓
6. Customer accepts a bid (or system auto-accepts best)
   ↓
7. Order assigned to winning porter
```

### Key Concepts

- **Bidding Window** - Time period for receiving bids
- **Bid** - Porter's offer (price + estimated arrival)
- **Evaluation Strategy** - Algorithm for ranking bids
- **Auto-accept** - Automatically accept best bid when window closes

## Opening Bidding Windows

### Basic Bidding Window

```typescript
import { client } from '../client';

async function openBiddingForOrder(orderId: string) {
  try {
    const biddingWindow = await client.bidding.openBiddingWindow.mutate({
      orderIds: [orderId],
      durationSec: 1800, // 30 minutes
      strategyId: 'weighted-score-v1', // Default strategy
      minimumBidCents: 5000, // $50 minimum
      autoAcceptBestBid: true,
    });

    console.log('Bidding window opened!');
    console.log('Window ID:', biddingWindow.id);
    console.log('Closes at:', biddingWindow.closesAt);
    console.log('Minimum bid:', `$${biddingWindow.minimumBidCents / 100}`);

    return biddingWindow;
  } catch (error) {
    console.error('Failed to open bidding window:', error);
    throw error;
  }
}
```

### Custom Duration

```typescript
async function openShortBiddingWindow(orderId: string) {
  // Quick bidding - 15 minutes
  const window = await client.bidding.openBiddingWindow.mutate({
    orderIds: [orderId],
    durationSec: 900, // 15 minutes
    autoAcceptBestBid: true,
  });

  console.log('Short bidding window (15 min) opened');
  return window;
}

async function openLongBiddingWindow(orderId: string) {
  // Extended bidding - 1 hour
  const window = await client.bidding.openBiddingWindow.mutate({
    orderIds: [orderId],
    durationSec: 3600, // 60 minutes
    autoAcceptBestBid: false, // Manual acceptance
  });

  console.log('Extended bidding window (60 min) opened');
  return window;
}
```

### Batch Bidding (Multiple Orders)

```typescript
async function openBatchBidding(orderIds: string[]) {
  const window = await client.bidding.openBiddingWindow.mutate({
    orderIds, // Multiple orders
    durationSec: 1800,
    strategyId: 'price-focused',
    autoAcceptBestBid: true,
  });

  console.log(`Bidding window opened for ${orderIds.length} orders`);
  return window;
}
```

## Placing Bids

### Submit a Bid (Porter)

```typescript
async function placeBid(biddingWindowId: string) {
  try {
    const bid = await client.bidding.placeBid.mutate({
      biddingWindowId,
      amountCents: 7500, // $75
      estimatedArrivalMinutes: 20,
      metadata: {
        vehicleType: 'VAN',
        notes: 'Have moving equipment and blankets',
        guaranteedCompletion: true,
      },
    });

    console.log('Bid placed successfully!');
    console.log('Bid ID:', bid.id);
    console.log('Amount:', `$${bid.amountCents / 100}`);
    console.log('Rank:', bid.currentRank);

    return bid;
  } catch (error) {
    if (error.data?.code === 'CONFLICT') {
      console.error('You already bid on this job');
    } else if (error.data?.code === 'BAD_REQUEST') {
      console.error('Bidding window closed or bid too low');
    }
    throw error;
  }
}
```

### Update Existing Bid

```typescript
async function updateMyBid(biddingWindowId: string, newAmountCents: number) {
  try {
    // Submit new bid - old one is automatically replaced
    const bid = await client.bidding.placeBid.mutate({
      biddingWindowId,
      amountCents: newAmountCents,
      estimatedArrivalMinutes: 15,
    });

    console.log('Bid updated!');
    console.log('New amount:', `$${bid.amountCents / 100}`);
    console.log('New rank:', bid.currentRank);

    return bid;
  } catch (error) {
    console.error('Failed to update bid:', error);
    throw error;
  }
}
```

### Strategic Bidding

```typescript
async function placeCompetitiveBid(biddingWindowId: string) {
  // Get active bids to see competition
  const activeBids = await client.bidding.getActiveBidsForOrder.query({
    biddingWindowId,
  });

  // Find lowest bid
  const lowestBid = Math.min(...activeBids.map((b) => b.amountCents));
  console.log('Lowest current bid:', `$${lowestBid / 100}`);

  // Bid slightly lower to compete
  const myBid = lowestBid - 500; // $5 less

  // But ensure it's profitable
  const minimumAcceptable = 6000; // $60
  const finalBid = Math.max(myBid, minimumAcceptable);

  return await client.bidding.placeBid.mutate({
    biddingWindowId,
    amountCents: finalBid,
    estimatedArrivalMinutes: 10, // Quick arrival as competitive advantage
  });
}
```

## Accepting Bids

### Accept Best Bid (Customer)

```typescript
async function acceptBid(biddingWindowId: string, bidId: string) {
  try {
    const result = await client.bidding.acceptBid.mutate({
      biddingWindowId,
      bidId,
    });

    console.log('Bid accepted!');
    console.log('Order assigned to:', result.porter.displayName);
    console.log('Final price:', `$${result.finalPriceCents / 100}`);
    console.log('Order ID:', result.orderId);

    return result;
  } catch (error) {
    if (error.data?.code === 'CONFLICT') {
      console.error('This bid was already accepted or window is closed');
    }
    throw error;
  }
}
```

### View All Bids

```typescript
async function viewBidsForOrder(biddingWindowId: string) {
  try {
    const bids = await client.bidding.getActiveBidsForOrder.query({
      biddingWindowId,
      page: 1,
      pageSize: 20,
    });

    console.log(`Received ${bids.length} bids:\n`);

    bids.forEach((bid, index) => {
      console.log(`${index + 1}. ${bid.porter.displayName}`);
      console.log(`   Price: $${bid.amountCents / 100}`);
      console.log(`   ETA: ${bid.estimatedArrivalMinutes} minutes`);
      console.log(`   Rating: ${bid.porter.averageRating}/5 (${bid.porter.totalJobs} jobs)`);
      console.log(`   Score: ${bid.evaluationScore}`);
      console.log();
    });

    return bids;
  } catch (error) {
    console.error('Failed to retrieve bids:', error);
    throw error;
  }
}
```

### Auto-Accept Flow

```typescript
async function setupAutoAccept(orderId: string) {
  // Open bidding with auto-accept enabled
  const window = await client.bidding.openBiddingWindow.mutate({
    orderIds: [orderId],
    durationSec: 1800,
    autoAcceptBestBid: true, // Automatically accept best bid
    strategyId: 'weighted-score-v1',
  });

  console.log('Bidding window will auto-accept best bid at:', window.closesAt);

  // The system will automatically:
  // 1. Evaluate all bids using the strategy
  // 2. Select the highest-scoring bid
  // 3. Assign order to that porter
  // 4. Notify all parties

  return window;
}
```

## Evaluation Strategies

### Available Strategies

```typescript
async function listEvaluationStrategies() {
  const strategies = await client.strategy.list.query();

  console.log('Available bidding strategies:\n');

  strategies.forEach((strategy) => {
    console.log(`${strategy.name}`);
    console.log(`  ID: ${strategy.id}`);
    console.log(`  Description: ${strategy.description}`);
    console.log(`  Parameters:`, strategy.parameters);
    console.log();
  });

  return strategies;
}
```

### 1. Weighted Score (Default)

Balances price, speed, and quality:

```typescript
async function useWeightedStrategy(orderId: string) {
  const window = await client.bidding.openBiddingWindow.mutate({
    orderIds: [orderId],
    durationSec: 1800,
    strategyId: 'weighted-score-v1',
    // Default weights:
    // - Price: 40%
    // - Speed (ETA): 30%
    // - Quality (rating): 30%
  });

  return window;
}
```

**How it works:**
- Lower price = higher score
- Faster ETA = higher score
- Higher rating = higher score
- Final score = weighted average

### 2. Price Focused

Prioritizes lowest price:

```typescript
async function usePriceFocusedStrategy(orderId: string) {
  const window = await client.bidding.openBiddingWindow.mutate({
    orderIds: [orderId],
    durationSec: 1800,
    strategyId: 'price-focused',
    // Weights:
    // - Price: 70%
    // - Speed: 15%
    // - Quality: 15%
  });

  console.log('Lowest price will likely win');
  return window;
}
```

### 3. Speed Focused

Prioritizes fastest arrival:

```typescript
async function useSpeedFocusedStrategy(orderId: string) {
  const window = await client.bidding.openBiddingWindow.mutate({
    orderIds: [orderId],
    durationSec: 900, // Short window for urgency
    strategyId: 'speed-focused',
    // Weights:
    // - Speed: 60%
    // - Price: 20%
    // - Quality: 20%
  });

  console.log('Fastest arrival will likely win');
  return window;
}
```

### 4. Quality Focused

Prioritizes highest-rated porters:

```typescript
async function useQualityFocusedStrategy(orderId: string) {
  const window = await client.bidding.openBiddingWindow.mutate({
    orderIds: [orderId],
    durationSec: 3600, // Longer window for quality porters
    strategyId: 'quality-focused',
    // Weights:
    // - Quality: 60%
    // - Price: 20%
    // - Speed: 20%
  });

  console.log('Highest-rated porter will likely win');
  return window;
}
```

### Custom Strategy (Admin)

```typescript
async function createCustomStrategy() {
  const strategy = await client.strategy.create.mutate({
    name: 'Custom Strategy',
    description: 'Emphasizes reliability for fragile items',
    parameters: {
      priceWeight: 0.25,
      speedWeight: 0.25,
      qualityWeight: 0.5, // Heavily weighted toward quality
      minimumRating: 4.5, // Only consider highly-rated porters
    },
  });

  console.log('Custom strategy created:', strategy.id);
  return strategy;
}
```

## Best Practices

### 1. Set Reasonable Bidding Durations

```typescript
function chooseBiddingDuration(urgency: 'immediate' | 'standard' | 'scheduled') {
  switch (urgency) {
    case 'immediate':
      return 900; // 15 minutes - quick turnaround
    case 'standard':
      return 1800; // 30 minutes - balanced
    case 'scheduled':
      return 3600; // 60 minutes - more bids
  }
}

async function openSmartBiddingWindow(orderId: string, urgency: string) {
  const duration = chooseBiddingDuration(urgency as any);

  return await client.bidding.openBiddingWindow.mutate({
    orderIds: [orderId],
    durationSec: duration,
    autoAcceptBestBid: urgency === 'immediate', // Auto-accept for urgent jobs
  });
}
```

### 2. Monitor Bidding Progress

```typescript
async function monitorBidding(biddingWindowId: string) {
  const checkInterval = 10000; // 10 seconds

  const interval = setInterval(async () => {
    try {
      const bids = await client.bidding.getActiveBidsForOrder.query({
        biddingWindowId,
      });

      console.log(`Current bids: ${bids.length}`);

      if (bids.length > 0) {
        const bestBid = bids[0]; // Sorted by score
        console.log(`Best bid: $${bestBid.amountCents / 100} by ${bestBid.porter.displayName}`);
      }

      // Check if window closed
      const window = await client.bidding.getWindow.query({ biddingWindowId });
      if (window.status === 'CLOSED') {
        console.log('Bidding window closed!');
        clearInterval(interval);
      }
    } catch (error) {
      console.error('Error monitoring bids:', error);
      clearInterval(interval);
    }
  }, checkInterval);

  return () => clearInterval(interval);
}
```

### 3. Handle Race Conditions

```typescript
async function acceptBidSafely(biddingWindowId: string, bidId: string) {
  try {
    // The API is race-safe - first accept wins
    const result = await client.bidding.acceptBid.mutate({
      biddingWindowId,
      bidId,
    });

    console.log('✅ Successfully accepted bid');
    return result;
  } catch (error) {
    if (error.data?.code === 'CONFLICT') {
      // Another user accepted a bid first
      console.log('❌ This bid was already accepted');

      // Get the winning bid
      const window = await client.bidding.getWindow.query({ biddingWindowId });
      console.log('Winning bid:', window.acceptedBid);
    }
    throw error;
  }
}
```

### 4. Notify Porters of New Opportunities

```typescript
async function notifyNearbyPortersOfBidding(orderId: string) {
  // Get order details
  const order = await client.orders.get.query({ orderId });

  // Find nearby porters
  const nearbyPorters = await client.porters.nearby.query({
    lat: order.pickup.lat,
    lng: order.pickup.lng,
    radiusMeters: 10000, // 10km
  });

  console.log(`Found ${nearbyPorters.length} nearby porters`);

  // Send notifications (via notification service)
  for (const porter of nearbyPorters) {
    await client.notification.send.mutate({
      recipientId: porter.id,
      channels: ['PUSH', 'IN_APP'],
      messageType: 'NEW_BIDDING_OPPORTUNITY',
      payload: {
        orderId,
        pickup: order.pickup.address,
        dropoff: order.dropoff.address,
        estimatedPriceCents: order.estimatedPriceCents,
      },
    });
  }

  console.log('Notifications sent to nearby porters');
}
```

### 5. Compare Bidding vs Fixed Price

```typescript
async function decidePricingStrategy(order: any) {
  const factors = {
    urgency: order.scheduledAt < new Date(Date.now() + 3600000), // Within 1 hour
    distance: calculateDistance(order.pickup, order.dropoff),
    complexity: order.items?.some((i) => i.requiresSpecialHandling),
  };

  if (factors.urgency) {
    console.log('Use fixed pricing for urgent orders');
    return 'FIXED';
  } else if (factors.distance > 50) {
    console.log('Use bidding for long-distance moves');
    return 'BIDDING';
  } else if (factors.complexity) {
    console.log('Use bidding to find specialized porters');
    return 'BIDDING';
  } else {
    console.log('Use fixed pricing for standard jobs');
    return 'FIXED';
  }
}
```

## Complete Example

### End-to-End Bidding Flow

```typescript
async function runCompleteBiddingFlow() {
  try {
    // 1. Create order
    console.log('1. Creating order...');
    const order = await client.orders.create.mutate({
      pickup: { lat: 37.7749, lng: -122.4194, address: '123 Market St' },
      dropoff: { lat: 37.7849, lng: -122.3974, address: '456 Mission St' },
      vehicleType: 'VAN',
      porterCount: 2,
    });

    // 2. Open bidding
    console.log('2. Opening bidding window...');
    const window = await client.bidding.openBiddingWindow.mutate({
      orderIds: [order.id],
      durationSec: 1800,
      strategyId: 'weighted-score-v1',
      minimumBidCents: 5000,
      autoAcceptBestBid: false, // Manual acceptance for this example
    });

    // 3. Monitor bids
    console.log('3. Waiting for bids...');
    const stopMonitoring = await monitorBidding(window.id);

    // 4. After some time, view all bids
    await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute

    console.log('4. Reviewing bids...');
    const bids = await viewBidsForOrder(window.id);

    if (bids.length === 0) {
      console.log('No bids received');
      return;
    }

    // 5. Accept best bid
    console.log('5. Accepting best bid...');
    const bestBid = bids[0];
    await acceptBid(window.id, bestBid.id);

    console.log('✅ Bidding complete! Order assigned.');
  } catch (error) {
    console.error('Bidding flow error:', error);
  }
}
```

## Next Steps

Continue learning about:

1. **[Porter Workflows](../05-porters/README.md)** - Porter-side bidding and job acceptance
2. **[Real-time Features](../06-realtime/README.md)** - Live bid notifications
3. **[Pricing & Payments](../08-pricing-payments/README.md)** - Payment processing for bids

## Quick Reference

```typescript
// Open bidding window
await client.bidding.openBiddingWindow.mutate({
  orderIds,
  durationSec,
  strategyId?,
  minimumBidCents?,
  autoAcceptBestBid?,
});

// Place bid
await client.bidding.placeBid.mutate({
  biddingWindowId,
  amountCents,
  estimatedArrivalMinutes,
  metadata?,
});

// Accept bid
await client.bidding.acceptBid.mutate({ biddingWindowId, bidId });

// Get active bids
await client.bidding.getActiveBidsForOrder.query({ biddingWindowId, page?, pageSize? });

// List strategies
await client.strategy.list.query();
```

---

**Ready to learn porter features?** Continue to **[Porter Workflows](../05-porters/README.md)** →
