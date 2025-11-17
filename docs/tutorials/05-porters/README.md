# Porter Workflows

Learn how to build porter-facing features including onboarding, verification, availability management, job acceptance, and earnings tracking.

## 📋 Table of Contents

- [Overview](#overview)
- [Porter Registration & Verification](#porter-registration--verification)
- [Availability Management](#availability-management)
- [Job Acceptance](#job-acceptance)
- [Location Tracking](#location-tracking)
- [Earnings & Withdrawals](#earnings--withdrawals)
- [Best Practices](#best-practices)

## Overview

Porters are service providers who fulfill moving jobs. The porter workflow includes:

1. **Registration** - Sign up as a porter
2. **Verification** - Submit documents for approval
3. **Availability** - Go online/offline
4. **Job Offers** - Receive and accept job offers
5. **Job Execution** - Complete the move
6. **Earnings** - Track income and request withdrawals

## Porter Registration & Verification

### Register as Porter

```typescript
import { client, setAuthToken } from '../client';

async function registerAsPorter() {
  try {
    // Step 1: Register user account with PORTER role
    const authResult = await client.auth.register.mutate({
      email: 'porter@example.com',
      phone: '+14155551234',
      password: 'SecurePassword123!',
      displayName: 'John Porter',
      role: 'PORTER',
    });

    setAuthToken(authResult.accessToken);
    console.log('✅ Porter account created');

    // Step 2: Create porter profile
    const profile = await client.porters.registerPorterProfile.mutate({
      firstName: 'John',
      lastName: 'Porter',
      phone: '+14155551234',
      vehicleType: 'VAN',
      vehicleModel: '2020 Ford Transit',
      vehicleColor: 'White',
      licensePlate: 'ABC123',
    });

    console.log('✅ Porter profile created');
    console.log('Profile ID:', profile.id);

    return { auth: authResult, profile };
  } catch (error) {
    console.error('Porter registration failed:', error);
    throw error;
  }
}
```

### Submit Verification Documents

```typescript
async function submitVerificationDocuments(porterId: string) {
  try {
    // Upload documents to storage first
    const documentsData = [
      {
        type: 'DRIVERS_LICENSE',
        frontUrl: await uploadDocument('license-front.jpg'),
        backUrl: await uploadDocument('license-back.jpg'),
        expiryDate: '2026-12-31',
      },
      {
        type: 'VEHICLE_REGISTRATION',
        frontUrl: await uploadDocument('registration.jpg'),
        expiryDate: '2025-06-30',
      },
      {
        type: 'INSURANCE',
        frontUrl: await uploadDocument('insurance.jpg'),
        expiryDate: '2025-12-31',
        policyNumber: 'INS-123456',
      },
      {
        type: 'BACKGROUND_CHECK',
        frontUrl: await uploadDocument('background-check.pdf'),
      },
    ];

    const verification = await client.porters.submitVerificationDocuments.mutate({
      porterId,
      documents: documentsData,
    });

    console.log('✅ Verification documents submitted');
    console.log('Status:', verification.status); // PENDING
    console.log('Submitted at:', verification.submittedAt);

    return verification;
  } catch (error) {
    console.error('Document submission failed:', error);
    throw error;
  }
}

// Helper function to upload documents
async function uploadDocument(filename: string): Promise<string> {
  // Upload to your storage service (S3, Cloudinary, etc.)
  // Return the public URL
  return `https://storage.example.com/documents/${filename}`;
}
```

### Check Verification Status

```typescript
async function checkVerificationStatus(porterId: string) {
  try {
    const status = await client.porters.getVerificationStatus.query({
      porterId,
    });

    console.log('Verification Status:', status.status);

    switch (status.status) {
      case 'PENDING':
        console.log('⏳ Documents under review');
        console.log('Submitted:', status.submittedAt);
        break;
      case 'APPROVED':
        console.log('✅ Verified! You can start accepting jobs');
        console.log('Approved at:', status.approvedAt);
        break;
      case 'REJECTED':
        console.log('❌ Verification rejected');
        console.log('Reason:', status.rejectionReason);
        console.log('You can resubmit documents');
        break;
      case 'NOT_SUBMITTED':
        console.log('📝 Please submit verification documents');
        break;
    }

    return status;
  } catch (error) {
    console.error('Failed to check status:', error);
    throw error;
  }
}
```

### Get Porter Profile

```typescript
async function getPorterProfile(porterId: string) {
  const profile = await client.porters.getPorterProfile.query({ porterId });

  console.log('Porter Profile:');
  console.log('Name:', `${profile.firstName} ${profile.lastName}`);
  console.log('Rating:', `${profile.averageRating}/5`);
  console.log('Total Jobs:', profile.totalJobs);
  console.log('Completed Jobs:', profile.completedJobs);
  console.log('Vehicle:', `${profile.vehicleType} - ${profile.vehicleModel}`);
  console.log('Verification Status:', profile.verificationStatus);
  console.log('Available:', profile.isAvailable);

  return profile;
}
```

## Availability Management

### Set Availability Online

```typescript
async function goOnline(porterId: string) {
  try {
    // Get current location
    const location = await getCurrentLocation();

    const availability = await client.porters.setAvailability.mutate({
      porterId,
      online: true,
      location: {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      },
    });

    console.log('✅ You are now ONLINE');
    console.log('Location:', `${location.lat}, ${location.lng}`);
    console.log('Ready to receive job offers!');

    return availability;
  } catch (error) {
    console.error('Failed to go online:', error);
    throw error;
  }
}

async function goOffline(porterId: string) {
  const availability = await client.porters.setAvailability.mutate({
    porterId,
    online: false,
  });

  console.log('✅ You are now OFFLINE');
  console.log('You will not receive job offers');

  return availability;
}
```

### Check Availability Status

```typescript
async function checkAvailability(porterId: string) {
  const availability = await client.porters.getAvailability.query({
    porterId,
  });

  console.log('Availability Status:');
  console.log('Online:', availability.isAvailable);
  console.log('Last Location:', availability.lastKnownLocation);
  console.log('Last Updated:', availability.lastUpdatedAt);

  return availability;
}
```

### Toggle Availability

```typescript
async function toggleAvailability(porterId: string) {
  // Get current status
  const current = await client.porters.getAvailability.query({ porterId });

  // Toggle
  const newStatus = !current.isAvailable;

  if (newStatus) {
    await goOnline(porterId);
  } else {
    await goOffline(porterId);
  }

  return newStatus;
}
```

## Job Acceptance

### Receive Job Offers

Job offers come through WebSocket notifications:

```typescript
import { io } from 'socket.io-client';

async function listenForJobOffers(porterId: string, authToken: string) {
  const socket = io('http://localhost:3002/porter', {
    auth: { token: authToken },
  });

  socket.on('connect', () => {
    console.log('✅ Connected to job notification system');
  });

  socket.on('job:offer:received', async (offer) => {
    console.log('🔔 New job offer!');
    console.log('Order ID:', offer.orderId);
    console.log('Pickup:', offer.pickup.address);
    console.log('Dropoff:', offer.dropoff.address);
    console.log('Price:', `$${offer.priceCents / 100}`);
    console.log('Distance:', `${offer.distanceKm} km`);
    console.log('Expires in:', `${offer.expiresInSeconds} seconds`);

    // Show notification to porter
    showJobOfferNotification(offer);
  });

  socket.on('job:offer:expired', (data) => {
    console.log('⏰ Job offer expired:', data.offerId);
  });

  return socket;
}
```

### Accept Job Offer

```typescript
async function acceptJobOffer(offerId: string, porterId: string) {
  try {
    // Use idempotency key to prevent duplicate accepts
    const idempotencyKey = `accept-${offerId}-${Date.now()}`;

    const result = await client.porters.acceptJob.mutate({
      offerId,
      porterId,
      idempotencyKey,
    });

    console.log('✅ Job accepted!');
    console.log('Order ID:', result.orderId);
    console.log('Pickup:', result.order.pickup.address);
    console.log('Customer:', result.order.customer.displayName);
    console.log('Customer Phone:', result.order.customer.phone);

    // Navigate to active job screen
    navigateToActiveJob(result.orderId);

    return result;
  } catch (error) {
    if (error.data?.code === 'CONFLICT') {
      console.error('❌ Job already accepted by another porter');
    } else if (error.data?.code === 'GONE') {
      console.error('❌ Job offer expired');
    }
    throw error;
  }
}
```

### Reject Job Offer

```typescript
async function rejectJobOffer(offerId: string, porterId: string, reason?: string) {
  try {
    await client.porters.rejectJob.mutate({
      offerId,
      porterId,
      reason: reason || 'Not available',
    });

    console.log('✅ Job offer rejected');
  } catch (error) {
    console.error('Failed to reject offer:', error);
  }
}
```

### Smart Job Acceptance (Auto-criteria)

```typescript
interface JobAcceptanceCriteria {
  minPriceCents: number;
  maxDistanceKm: number;
  preferredVehicleTypes: string[];
  autoAccept: boolean;
}

async function evaluateJobOffer(
  offer: any,
  criteria: JobAcceptanceCriteria
): Promise<'accept' | 'reject' | 'review'> {
  // Check price
  if (offer.priceCents < criteria.minPriceCents) {
    console.log('❌ Price too low');
    return 'reject';
  }

  // Check distance
  if (offer.distanceKm > criteria.maxDistanceKm) {
    console.log('❌ Distance too far');
    return 'reject';
  }

  // Check vehicle type
  if (
    criteria.preferredVehicleTypes.length > 0 &&
    !criteria.preferredVehicleTypes.includes(offer.vehicleType)
  ) {
    console.log('⚠️ Not preferred vehicle type');
    return 'review';
  }

  // All criteria met
  if (criteria.autoAccept) {
    console.log('✅ Auto-accepting job');
    return 'accept';
  }

  return 'review';
}

// Usage
socket.on('job:offer:received', async (offer) => {
  const criteria = {
    minPriceCents: 5000, // $50
    maxDistanceKm: 20,
    preferredVehicleTypes: ['VAN', 'TRUCK'],
    autoAccept: true,
  };

  const decision = await evaluateJobOffer(offer, criteria);

  if (decision === 'accept') {
    await acceptJobOffer(offer.id, porterId);
  } else if (decision === 'reject') {
    await rejectJobOffer(offer.id, porterId, 'Does not meet criteria');
  } else {
    // Show to porter for manual decision
    showJobOfferForReview(offer);
  }
});
```

## Location Tracking

### Update Location During Job

```typescript
async function updateLocationDuringJob(porterId: string, orderId: string) {
  try {
    const location = await getCurrentLocation();

    await client.porters.updateLocation.mutate({
      porterId,
      lat: location.lat,
      lng: location.lng,
      accuracy: location.accuracy,
      orderId, // Associate with active order
    });

    console.log('📍 Location updated');
  } catch (error) {
    if (error.data?.code === 'TOO_MANY_REQUESTS') {
      console.log('⏱️ Rate limited - wait before next update');
    }
    console.error('Location update failed:', error);
  }
}
```

### Continuous Location Updates

```typescript
function startLocationTracking(porterId: string, orderId: string) {
  const updateInterval = 10000; // 10 seconds

  const intervalId = setInterval(async () => {
    try {
      await updateLocationDuringJob(porterId, orderId);
    } catch (error) {
      console.error('Location update error:', error);
    }
  }, updateInterval);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    console.log('📍 Location tracking stopped');
  };
}

// Usage
const stopTracking = startLocationTracking(porterId, orderId);

// Later, when job is complete
stopTracking();
```

### Location Permissions

```typescript
async function requestLocationPermission() {
  if ('geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        });
      });

      console.log('✅ Location permission granted');
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (error) {
      console.error('❌ Location permission denied');
      throw error;
    }
  } else {
    throw new Error('Geolocation not supported');
  }
}

async function getCurrentLocation() {
  return await requestLocationPermission();
}
```

## Earnings & Withdrawals

### Get Earnings Summary

```typescript
async function getEarningsSummary(porterId: string) {
  try {
    const earnings = await client.porters.getEarningsSummary.query({
      porterId,
    });

    console.log('💰 Earnings Summary:');
    console.log('Total Earned:', `$${earnings.totalEarnedCents / 100}`);
    console.log('Available Balance:', `$${earnings.availableBalanceCents / 100}`);
    console.log('Pending:', `$${earnings.pendingCents / 100}`);
    console.log('Withdrawn:', `$${earnings.totalWithdrawnCents / 100}`);
    console.log();
    console.log('This Week:', `$${earnings.weeklyEarningsCents / 100}`);
    console.log('This Month:', `$${earnings.monthlyEarningsCents / 100}`);
    console.log('Total Jobs:', earnings.totalJobs);
    console.log('Average per Job:', `$${earnings.averageEarningPerJobCents / 100}`);

    return earnings;
  } catch (error) {
    console.error('Failed to get earnings:', error);
    throw error;
  }
}
```

### Request Withdrawal

```typescript
async function requestWithdrawal(porterId: string, amountCents: number) {
  try {
    const idempotencyKey = `withdraw-${porterId}-${Date.now()}`;

    const withdrawal = await client.porters.requestWithdrawal.mutate({
      porterId,
      amountCents,
      idempotencyKey,
    });

    console.log('✅ Withdrawal requested');
    console.log('Amount:', `$${withdrawal.amountCents / 100}`);
    console.log('Status:', withdrawal.status);
    console.log('Expected:', withdrawal.expectedDate);

    return withdrawal;
  } catch (error) {
    if (error.data?.code === 'BAD_REQUEST') {
      if (error.message.includes('insufficient')) {
        console.error('❌ Insufficient balance');
      } else if (error.message.includes('minimum')) {
        console.error('❌ Below minimum withdrawal amount');
      }
    }
    throw error;
  }
}
```

### Withdrawal with Validation

```typescript
async function requestWithdrawalSafely(porterId: string, amountCents: number) {
  // Get current balance
  const earnings = await getEarningsSummary(porterId);

  // Validation
  const minWithdrawal = 2000; // $20
  const maxWithdrawal = earnings.availableBalanceCents;

  if (amountCents < minWithdrawal) {
    throw new Error(`Minimum withdrawal is $${minWithdrawal / 100}`);
  }

  if (amountCents > maxWithdrawal) {
    throw new Error(
      `Insufficient balance. Available: $${maxWithdrawal / 100}`
    );
  }

  // Request withdrawal
  return await requestWithdrawal(porterId, amountCents);
}
```

## Best Practices

### 1. Handle Job Offer Expiry

```typescript
function handleJobOfferWithTimeout(offer: any, porterId: string) {
  const expiryMs = offer.expiresInSeconds * 1000;

  // Show notification with countdown
  const timeoutId = setTimeout(() => {
    console.log('⏰ Job offer expired');
    hideJobOfferNotification(offer.id);
  }, expiryMs);

  // If accepted, clear timeout
  window.addEventListener('job-accepted', () => {
    clearTimeout(timeoutId);
  });

  return timeoutId;
}
```

### 2. Optimize Battery During Location Tracking

```typescript
function startOptimizedLocationTracking(porterId: string, orderId: string) {
  // Use different intervals based on order status
  let updateInterval = 10000; // Default: 10 seconds

  const getUpdateInterval = async () => {
    const order = await client.orders.get.query({ orderId });

    switch (order.status) {
      case 'ACCEPTED':
        return 30000; // 30 sec - not urgent yet
      case 'ARRIVED':
        return 60000; // 60 sec - waiting at location
      case 'EN_ROUTE':
        return 10000; // 10 sec - customer tracking
      default:
        return 30000;
    }
  };

  let intervalId: NodeJS.Timeout;

  const updateTracking = async () => {
    await updateLocationDuringJob(porterId, orderId);

    // Adjust interval based on status
    updateInterval = await getUpdateInterval();

    clearInterval(intervalId);
    intervalId = setInterval(updateTracking, updateInterval);
  };

  updateTracking();

  return () => clearInterval(intervalId);
}
```

### 3. Offline Job Queue

```typescript
class OfflineJobQueue {
  private queue: any[] = [];

  async addToQueue(action: string, data: any) {
    this.queue.push({ action, data, timestamp: Date.now() });
    localStorage.setItem('jobQueue', JSON.stringify(this.queue));
  }

  async processQueue() {
    while (this.queue.length > 0) {
      const item = this.queue[0];

      try {
        switch (item.action) {
          case 'updateLocation':
            await client.porters.updateLocation.mutate(item.data);
            break;
          case 'updateStatus':
            await client.orders.changeStatus.mutate(item.data);
            break;
        }

        // Success - remove from queue
        this.queue.shift();
        localStorage.setItem('jobQueue', JSON.stringify(this.queue));
      } catch (error) {
        console.error('Failed to process queue item:', error);
        break; // Stop processing on error
      }
    }
  }
}

// Usage
const queue = new OfflineJobQueue();

// When online
navigator.onLine && queue.processQueue();

// When action fails
catch (error) {
  if (!navigator.onLine) {
    await queue.addToQueue('updateLocation', locationData);
  }
}
```

### 4. Performance Monitoring

```typescript
async function trackPorterMetrics(porterId: string) {
  const startTime = Date.now();

  // Get all metrics
  const [earnings, profile, availability] = await Promise.all([
    client.porters.getEarningsSummary.query({ porterId }),
    client.porters.getPorterProfile.query({ porterId }),
    client.porters.getAvailability.query({ porterId }),
  ]);

  const loadTime = Date.now() - startTime;

  console.log('📊 Porter Dashboard Metrics:');
  console.log('Load Time:', `${loadTime}ms`);
  console.log('Online:', availability.isAvailable);
  console.log('Rating:', profile.averageRating);
  console.log('Jobs Today:', earnings.todayJobsCount);
  console.log('Earnings Today:', `$${earnings.todayEarningsCents / 100}`);
}
```

## Next Steps

Continue with:

1. **[Real-time Features](../06-realtime/README.md)** - WebSocket job notifications
2. **[Pricing & Payments](../08-pricing-payments/README.md)** - Understanding payment flow
3. **[Admin Management](../09-admin/README.md)** - Admin porter verification

## Quick Reference

```typescript
// Register porter
await client.porters.registerPorterProfile.mutate({ firstName, lastName, vehicleType });

// Submit verification
await client.porters.submitVerificationDocuments.mutate({ porterId, documents });

// Set availability
await client.porters.setAvailability.mutate({ porterId, online, location? });

// Accept job
await client.porters.acceptJob.mutate({ offerId, porterId, idempotencyKey });

// Update location
await client.porters.updateLocation.mutate({ porterId, lat, lng, orderId? });

// Get earnings
await client.porters.getEarningsSummary.query({ porterId });

// Request withdrawal
await client.porters.requestWithdrawal.mutate({ porterId, amountCents, idempotencyKey });
```

---

**Ready for real-time features?** Continue to **[Real-time Features](../06-realtime/README.md)** →
