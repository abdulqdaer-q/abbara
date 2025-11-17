# Pricing & Payments

Learn how to estimate prices, create payment intents, handle pricing rules, and process payments in the MoveNow platform.

## 📋 Table of Contents

- [Overview](#overview)
- [Price Estimation](#price-estimation)
- [Payment Processing](#payment-processing)
- [Pricing Rules](#pricing-rules)
- [Price Snapshots](#price-snapshots)
- [Best Practices](#best-practices)

## Overview

The pricing system in MoveNow consists of:

- **Dynamic pricing** - Based on distance, time, demand
- **Rule-based pricing** - Configurable pricing rules
- **Price snapshots** - Immutable price records
- **Payment intents** - Stripe-compatible payment flow

### Pricing Components

```
Final Price =
  Base Fare
  + (Distance × Per-KM Rate)
  + (Duration × Per-Minute Rate)
  + (Porter Count × Porter Fee)
  + Item Surcharges
  + Multi-Stop Fees
  + Peak Multiplier
  + Geo Multiplier
  - Promo Discount
  + Service Fee
  + Tax
```

## Price Estimation

### Basic Price Estimate

```typescript
import { client } from '../client';

async function estimatePrice() {
  try {
    const estimate = await client.pricing.estimatePrice.query({
      pickup: {
        address: '123 Market St, San Francisco, CA',
        lat: 37.7749,
        lng: -122.4194,
      },
      dropoff: {
        address: '456 Mission St, San Francisco, CA',
        lat: 37.7849,
        lng: -122.3974,
      },
      vehicleType: 'VAN',
      porterCount: 2,
    });

    console.log('💰 Price Estimate:');
    console.log('Base Fare:', `$${estimate.baseFareCents / 100}`);
    console.log('Distance:', `${estimate.distanceKm} km`);
    console.log('Distance Cost:', `$${estimate.distanceCostCents / 100}`);
    console.log('Duration:', `${estimate.durationMinutes} minutes`);
    console.log('Time Cost:', `$${estimate.timeCostCents / 100}`);
    console.log('Porter Fee:', `$${estimate.porterFeeCents / 100} × ${estimate.porterCount}`);
    console.log('Service Fee:', `$${estimate.serviceFeeCents / 100}`);
    console.log('Tax:', `$${estimate.taxCents / 100}`);
    console.log('─────────────────────');
    console.log('TOTAL:', `$${estimate.totalCents / 100}`);

    return estimate;
  } catch (error) {
    console.error('Price estimation failed:', error);
    throw error;
  }
}
```

### Estimate with Items

```typescript
async function estimatePriceWithItems() {
  const estimate = await client.pricing.estimatePrice.query({
    pickup: {
      address: '123 Home St, San Francisco, CA',
      lat: 37.7749,
      lng: -122.4194,
    },
    dropoff: {
      address: '456 New Home Ave, Oakland, CA',
      lat: 37.8044,
      lng: -122.2711,
    },
    vehicleType: 'TRUCK',
    porterCount: 3,
    items: [
      {
        name: 'Piano',
        quantity: 1,
        weight: 500,
        size: 'LARGE',
        requiresSpecialHandling: true,
      },
      {
        name: 'Sofa',
        quantity: 2,
        weight: 150,
        size: 'MEDIUM',
      },
      {
        name: 'Box',
        quantity: 20,
        weight: 30,
        size: 'SMALL',
      },
    ],
  });

  console.log('Item Surcharges:');
  estimate.itemSurcharges?.forEach((surcharge) => {
    console.log(`  ${surcharge.itemName}: $${surcharge.amountCents / 100}`);
  });

  console.log('Total with items:', `$${estimate.totalCents / 100}`);

  return estimate;
}
```

### Estimate with Multi-Stops

```typescript
async function estimateMultiStopPrice() {
  const estimate = await client.pricing.estimatePrice.query({
    pickup: {
      address: '123 Start Location, SF',
      lat: 37.7749,
      lng: -122.4194,
    },
    additionalStops: [
      {
        address: '456 Stop 1, SF',
        lat: 37.7849,
        lng: -122.3974,
        type: 'PICKUP',
      },
      {
        address: '789 Stop 2, Oakland',
        lat: 37.8044,
        lng: -122.2711,
        type: 'DROPOFF',
      },
    ],
    dropoff: {
      address: '999 Final Stop, Berkeley',
      lat: 37.8715,
      lng: -122.2730,
    },
    vehicleType: 'VAN',
    porterCount: 2,
  });

  console.log('Multi-stop fee:', `$${estimate.multiStopFeeCents / 100}`);
  console.log('Total stops:', estimate.totalStops);
  console.log('Total distance:', `${estimate.distanceKm} km`);
  console.log('Total:', `$${estimate.totalCents / 100}`);

  return estimate;
}
```

### Scheduled Order Pricing

```typescript
async function estimateScheduledPrice() {
  const scheduledDate = new Date('2024-12-25T18:00:00'); // Christmas evening

  const estimate = await client.pricing.estimatePrice.query({
    pickup: { lat: 37.7749, lng: -122.4194, address: '123 Market St' },
    dropoff: { lat: 37.7849, lng: -122.3974, address: '456 Mission St' },
    vehicleType: 'VAN',
    porterCount: 2,
    scheduledAt: scheduledDate,
  });

  if (estimate.peakMultiplier && estimate.peakMultiplier > 1) {
    console.log(`⚠️ Peak pricing: ${estimate.peakMultiplier}x`);
    console.log(`Reason: ${estimate.peakReason}`);
  }

  console.log('Total:', `$${estimate.totalCents / 100}`);

  return estimate;
}
```

### Promo Code Pricing

```typescript
async function estimateWithPromoCode(promoCode: string) {
  const estimate = await client.pricing.estimatePrice.query({
    pickup: { lat: 37.7749, lng: -122.4194, address: '123 Market St' },
    dropoff: { lat: 37.7849, lng: -122.3974, address: '456 Mission St' },
    vehicleType: 'VAN',
    porterCount: 2,
    promoCode,
  });

  if (estimate.promoDiscountCents > 0) {
    console.log('✅ Promo code applied!');
    console.log('Discount:', `$${estimate.promoDiscountCents / 100}`);
    console.log('Original price:', `$${(estimate.totalCents + estimate.promoDiscountCents) / 100}`);
    console.log('Discounted price:', `$${estimate.totalCents / 100}`);
  } else {
    console.log('❌ Promo code invalid or not applicable');
  }

  return estimate;
}
```

## Payment Processing

### Create Payment Intent

```typescript
async function createPaymentIntent(orderId: string) {
  try {
    const paymentIntent = await client.payments.createPaymentIntent.mutate({
      orderId,
      method: 'CARD', // or 'CASH', 'WALLET'
    });

    console.log('💳 Payment Intent Created:');
    console.log('Intent ID:', paymentIntent.id);
    console.log('Amount:', `$${paymentIntent.amountCents / 100}`);
    console.log('Status:', paymentIntent.status);
    console.log('Client Secret:', paymentIntent.clientSecret);

    // Use client secret with Stripe SDK
    return paymentIntent;
  } catch (error) {
    console.error('Payment intent creation failed:', error);
    throw error;
  }
}
```

### Complete Payment with Stripe

```typescript
import { loadStripe } from '@stripe/stripe-js';

async function processPayment(orderId: string) {
  // Step 1: Create payment intent
  const paymentIntent = await createPaymentIntent(orderId);

  // Step 2: Load Stripe
  const stripe = await loadStripe('pk_test_your_publishable_key');

  if (!stripe) {
    throw new Error('Stripe failed to load');
  }

  // Step 3: Confirm payment
  const result = await stripe.confirmCardPayment(paymentIntent.clientSecret, {
    payment_method: {
      card: cardElement, // Stripe card element
      billing_details: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    },
  });

  if (result.error) {
    console.error('❌ Payment failed:', result.error.message);
    throw result.error;
  }

  console.log('✅ Payment successful!');
  console.log('Payment Intent:', result.paymentIntent);

  return result.paymentIntent;
}
```

### Cash Payment

```typescript
async function processCashPayment(orderId: string) {
  const paymentIntent = await client.payments.createPaymentIntent.mutate({
    orderId,
    method: 'CASH',
  });

  console.log('💵 Cash payment selected');
  console.log('Amount to collect:', `$${paymentIntent.amountCents / 100}`);
  console.log('Porter will collect payment upon delivery');

  return paymentIntent;
}
```

### Check Payment Status

```typescript
async function checkPaymentStatus(orderId: string) {
  const order = await client.orders.get.query({ orderId });

  console.log('Payment Status:', order.paymentStatus);

  switch (order.paymentStatus) {
    case 'PENDING':
      console.log('⏳ Payment not yet processed');
      break;
    case 'PROCESSING':
      console.log('🔄 Payment being processed');
      break;
    case 'SUCCEEDED':
      console.log('✅ Payment successful');
      break;
    case 'FAILED':
      console.log('❌ Payment failed');
      break;
    case 'REFUNDED':
      console.log('💸 Payment refunded');
      break;
  }

  return order.paymentStatus;
}
```

## Pricing Rules

### Get Active Pricing Rules

```typescript
async function getPricingRules() {
  const rules = await client.admin.listRules.query({
    enabled: true,
  });

  console.log(`Found ${rules.length} active pricing rules:\n`);

  rules.forEach((rule) => {
    console.log(`${rule.name} (${rule.ruleType})`);
    console.log(`  Priority: ${rule.priority}`);
    console.log(`  Vehicle Types: ${rule.vehicleTypes.join(', ')}`);
    console.log(`  Config:`, rule.config);
    console.log();
  });

  return rules;
}
```

### Create Pricing Rule (Admin)

```typescript
async function createBaseF areRule() {
  const rule = await client.admin.createRule.mutate({
    name: 'Standard Base Fare',
    ruleType: 'BASE_FARE',
    priority: 1,
    vehicleTypes: ['SEDAN', 'VAN', 'TRUCK'],
    config: {
      sedan: 1500, // $15
      van: 2000, // $20
      truck: 3000, // $30
    },
  });

  console.log('✅ Base fare rule created');
  return rule;
}

async function createPeakHourRule() {
  const rule = await client.admin.createRule.mutate({
    name: 'Rush Hour Multiplier',
    ruleType: 'PEAK_MULTIPLIER',
    priority: 10,
    vehicleTypes: ['SEDAN', 'VAN', 'TRUCK'],
    config: {
      multiplier: 1.5, // 1.5x during peak
      timeRanges: [
        { start: '07:00', end: '09:00' }, // Morning rush
        { start: '17:00', end: '19:00' }, // Evening rush
      ],
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    },
  });

  console.log('✅ Peak hour rule created');
  return rule;
}

async function createPromoCodeRule() {
  const rule = await client.admin.createRule.mutate({
    name: 'Holiday Promo - 20% Off',
    ruleType: 'PROMO_DISCOUNT',
    priority: 5,
    vehicleTypes: ['SEDAN', 'VAN', 'TRUCK'],
    config: {
      code: 'HOLIDAY20',
      discountType: 'PERCENTAGE',
      discountValue: 20, // 20%
      maxDiscountCents: 5000, // Max $50
      minOrderCents: 3000, // Min order $30
      validFrom: '2024-12-01',
      validUntil: '2024-12-31',
      usageLimit: 1000,
    },
  });

  console.log('✅ Promo code rule created');
  return rule;
}
```

### Update Pricing Rule (Admin)

```typescript
async function updatePricingRule(ruleId: string) {
  const rule = await client.admin.updateRule.mutate({
    ruleId,
    config: {
      multiplier: 1.8, // Increase peak multiplier
    },
  });

  console.log('✅ Rule updated');
  return rule;
}
```

### Toggle Pricing Rule (Admin)

```typescript
async function enableRule(ruleId: string) {
  await client.admin.toggleRule.mutate({
    ruleId,
    enabled: true,
  });

  console.log('✅ Rule enabled');
}

async function disableRule(ruleId: string) {
  await client.admin.toggleRule.mutate({
    ruleId,
    enabled: false,
  });

  console.log('✅ Rule disabled');
}
```

## Price Snapshots

### Create Price Snapshot

```typescript
async function savePriceSnapshot(orderId: string) {
  // Get price estimate
  const estimate = await client.pricing.estimatePrice.query({
    pickup: { lat: 37.7749, lng: -122.4194, address: '123 Market St' },
    dropoff: { lat: 37.7849, lng: -122.3974, address: '456 Mission St' },
    vehicleType: 'VAN',
    porterCount: 2,
  });

  // Persist snapshot
  const snapshot = await client.pricing.persistPriceSnapshot.mutate({
    orderId,
    estimate,
    idempotencyKey: `snapshot-${orderId}-${Date.now()}`,
  });

  console.log('✅ Price snapshot saved');
  console.log('Snapshot ID:', snapshot.id);
  console.log('Locked price:', `$${snapshot.totalCents / 100}`);

  return snapshot;
}
```

### Get Price Snapshot

```typescript
async function getPriceSnapshot(orderId: string) {
  const snapshot = await client.pricing.getPriceSnapshot.query({
    orderId,
  });

  console.log('📸 Price Snapshot:');
  console.log('Created:', snapshot.createdAt);
  console.log('Locked Total:', `$${snapshot.totalCents / 100}`);
  console.log('Breakdown:', snapshot.breakdown);

  return snapshot;
}
```

### Preview Price Change

```typescript
async function previewPriceChange(orderId: string) {
  // Preview what would happen if order changes
  const preview = await client.pricing.previewPriceChange.query({
    orderId,
    changedFields: {
      additionalStops: [
        {
          address: '789 Extra Stop, SF',
          lat: 37.7900,
          lng: -122.4100,
          type: 'PICKUP',
        },
      ],
    },
  });

  console.log('💡 Price Change Preview:');
  console.log('Original:', `$${preview.originalPriceCents / 100}`);
  console.log('New:', `$${preview.newPriceCents / 100}`);
  console.log('Difference:', `$${preview.differenceCents / 100}`);
  console.log('Changes:', preview.changes);

  return preview;
}
```

## Best Practices

### 1. Always Show Price Before Order Creation

```typescript
async function createOrderWithPriceConfirmation(orderData: any) {
  // Step 1: Estimate price
  const estimate = await client.pricing.estimatePrice.query({
    pickup: orderData.pickup,
    dropoff: orderData.dropoff,
    vehicleType: orderData.vehicleType,
    porterCount: orderData.porterCount,
    items: orderData.items,
    scheduledAt: orderData.scheduledAt,
  });

  // Step 2: Show to user
  console.log(`Estimated price: $${estimate.totalCents / 100}`);

  // Step 3: Get confirmation
  const confirmed = await getUserConfirmation(
    `The estimated price is $${estimate.totalCents / 100}. Continue?`
  );

  if (!confirmed) {
    return null;
  }

  // Step 4: Create order with snapshot
  const order = await client.orders.create.mutate(orderData);

  // Step 5: Save price snapshot
  await client.pricing.persistPriceSnapshot.mutate({
    orderId: order.id,
    estimate,
  });

  return order;
}
```

### 2. Handle Price Changes Gracefully

```typescript
async function handlePriceIncrease(orderId: string, newEstimate: any) {
  const snapshot = await client.pricing.getPriceSnapshot.query({ orderId });

  const increase = newEstimate.totalCents - snapshot.totalCents;

  if (increase > 0) {
    console.log(`⚠️ Price increased by $${increase / 100}`);

    // Notify customer
    await client.notification.send.mutate({
      recipientId: customerId,
      channels: ['PUSH', 'EMAIL'],
      messageType: 'PRICE_INCREASE',
      payload: {
        orderId,
        originalPrice: snapshot.totalCents,
        newPrice: newEstimate.totalCents,
        reason: 'Additional services requested',
      },
    });

    // Require new confirmation
    const confirmed = await getUserConfirmation(
      `Price has increased to $${newEstimate.totalCents / 100}. Continue?`
    );

    return confirmed;
  }

  return true;
}
```

### 3. Implement Price Caching

```typescript
class PriceCache {
  private cache: Map<string, { estimate: any; timestamp: number }> = new Map();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  getCacheKey(params: any): string {
    return JSON.stringify({
      pickup: params.pickup,
      dropoff: params.dropoff,
      vehicleType: params.vehicleType,
      porterCount: params.porterCount,
    });
  }

  async getEstimate(params: any): Promise<any> {
    const key = this.getCacheKey(params);
    const cached = this.cache.get(key);

    // Check cache
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log('✅ Using cached price');
      return cached.estimate;
    }

    // Fetch new estimate
    const estimate = await client.pricing.estimatePrice.query(params);

    // Cache it
    this.cache.set(key, {
      estimate,
      timestamp: Date.now(),
    });

    return estimate;
  }

  clearCache() {
    this.cache.clear();
  }
}
```

### 4. Show Price Breakdown

```typescript
function displayPriceBreakdown(estimate: any) {
  console.log('💰 Price Breakdown:\n');

  const breakdown = [
    { label: 'Base Fare', value: estimate.baseFareCents },
    {
      label: `Distance (${estimate.distanceKm} km)`,
      value: estimate.distanceCostCents,
    },
    {
      label: `Time (${estimate.durationMinutes} min)`,
      value: estimate.timeCostCents,
    },
    {
      label: `Porters (${estimate.porterCount})`,
      value: estimate.porterFeeCents,
    },
  ];

  if (estimate.itemSurchargesCents > 0) {
    breakdown.push({ label: 'Item Surcharges', value: estimate.itemSurchargesCents });
  }

  if (estimate.multiStopFeeCents > 0) {
    breakdown.push({ label: 'Multi-Stop Fee', value: estimate.multiStopFeeCents });
  }

  if (estimate.peakMultiplier > 1) {
    const peakAmount =
      estimate.totalCents - estimate.totalCents / estimate.peakMultiplier;
    breakdown.push({
      label: `Peak Hour (${estimate.peakMultiplier}x)`,
      value: peakAmount,
    });
  }

  breakdown.push({ label: 'Service Fee', value: estimate.serviceFeeCents });
  breakdown.push({ label: 'Tax', value: estimate.taxCents });

  if (estimate.promoDiscountCents > 0) {
    breakdown.push({
      label: '🎉 Promo Discount',
      value: -estimate.promoDiscountCents,
    });
  }

  // Display
  breakdown.forEach(({ label, value }) => {
    const sign = value < 0 ? '-' : '';
    console.log(`${label.padEnd(30)} ${sign}$${Math.abs(value) / 100}`);
  });

  console.log('─'.repeat(40));
  console.log(`${'TOTAL'.padEnd(30)} $${estimate.totalCents / 100}`);
}
```

## Next Steps

Continue with:

1. **[Notifications](../07-notifications/README.md)** - Payment notifications
2. **[Admin Management](../09-admin/README.md)** - Pricing configuration
3. **[Bidding System](../04-bidding/README.md)** - Dynamic pricing via bidding

## Quick Reference

```typescript
// Estimate price
await client.pricing.estimatePrice.query({
  pickup,
  dropoff,
  vehicleType,
  porterCount,
  items?,
  additionalStops?,
  scheduledAt?,
  promoCode?,
});

// Create payment intent
await client.payments.createPaymentIntent.mutate({ orderId, method });

// Save price snapshot
await client.pricing.persistPriceSnapshot.mutate({ orderId, estimate, idempotencyKey });

// Get price snapshot
await client.pricing.getPriceSnapshot.query({ orderId });

// Preview price change
await client.pricing.previewPriceChange.query({ orderId, changedFields });
```

---

**Continue to** **[Notifications](../07-notifications/README.md)** →
