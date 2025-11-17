# Admin Management

Learn how to build administrative features for managing users, porters, orders, vehicle types, promo codes, analytics, and platform settings.

## 📋 Table of Contents

- [Overview](#overview)
- [User Management](#user-management)
- [Porter Verification](#porter-verification)
- [Order Management](#order-management)
- [Vehicle Types](#vehicle-types)
- [Promo Codes](#promo-codes)
- [Analytics](#analytics)
- [Platform Settings](#platform-settings)

## Overview

The Admin Management service provides RBAC (Role-Based Access Control) with these roles:

- **SUPER_ADMIN** - Full platform access
- **ADMIN** - Most administrative functions
- **OPERATIONS** - Order and porter management
- **FINANCE** - Payment and financial operations
- **SUPPORT** - User support functions

## User Management

### List Users

```typescript
import { client } from '../client';

async function listUsers() {
  try {
    const users = await client.users.list.query({
      page: 1,
      pageSize: 50,
      filters: {
        role: 'CUSTOMER', // Filter by role
        status: 'ACTIVE', // Filter by status
      },
    });

    console.log(`Total users: ${users.total}`);
    console.log(`Showing: ${users.data.length}\n`);

    users.data.forEach((user) => {
      console.log(`${user.displayName} (${user.email})`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Status: ${user.status}`);
      console.log(`  Joined: ${user.createdAt}`);
      console.log();
    });

    return users;
  } catch (error) {
    console.error('Failed to list users:', error);
    throw error;
  }
}
```

### Get User Details

```typescript
async function getUserDetails(userId: string) {
  const user = await client.users.get.query({ userId });

  console.log('User Details:');
  console.log('ID:', user.id);
  console.log('Name:', user.displayName);
  console.log('Email:', user.email);
  console.log('Phone:', user.phone);
  console.log('Role:', user.role);
  console.log('Status:', user.status);
  console.log('Email Verified:', user.emailVerified);
  console.log('Phone Verified:', user.phoneVerified);
  console.log('Created:', user.createdAt);
  console.log('Last Login:', user.lastLoginAt);

  if (user.role === 'PORTER') {
    console.log('\nPorter Info:');
    console.log('Verification Status:', user.porterProfile.verificationStatus);
    console.log('Total Jobs:', user.porterProfile.totalJobs);
    console.log('Rating:', user.porterProfile.averageRating);
  }

  return user;
}
```

### Update User Status

```typescript
async function suspendUser(userId: string, reason: string) {
  try {
    const user = await client.users.updateStatus.mutate({
      userId,
      status: 'SUSPENDED',
      reason,
    });

    console.log('✅ User suspended');
    console.log('Reason:', reason);

    return user;
  } catch (error) {
    console.error('Failed to suspend user:', error);
    throw error;
  }
}

async function activateUser(userId: string) {
  const user = await client.users.updateStatus.mutate({
    userId,
    status: 'ACTIVE',
  });

  console.log('✅ User activated');
  return user;
}

async function deleteUser(userId: string) {
  const user = await client.users.updateStatus.mutate({
    userId,
    status: 'DELETED',
    reason: 'User requested account deletion',
  });

  console.log('✅ User deleted');
  return user;
}
```

### Update User Role

```typescript
async function promoteToAdmin(userId: string) {
  const user = await client.users.updateRole.mutate({
    userId,
    role: 'ADMIN',
  });

  console.log(`✅ User promoted to ADMIN`);
  return user;
}

async function changeUserRole(userId: string, newRole: string) {
  const user = await client.users.updateRole.mutate({
    userId,
    role: newRole,
  });

  console.log(`✅ User role changed to ${newRole}`);
  return user;
}
```

## Porter Verification

### Get Pending Verifications

```typescript
async function getPendingVerifications() {
  try {
    const documents = await client.porters.getPendingDocuments.query({
      skip: 0,
      take: 20,
    });

    console.log(`${documents.length} pending verifications:\n`);

    documents.forEach((doc) => {
      console.log(`Porter: ${doc.porter.displayName}`);
      console.log(`  Email: ${doc.porter.email}`);
      console.log(`  Phone: ${doc.porter.phone}`);
      console.log(`  Submitted: ${doc.submittedAt}`);
      console.log(`  Documents: ${doc.documents.length}`);
      console.log();
    });

    return documents;
  } catch (error) {
    console.error('Failed to get pending verifications:', error);
    throw error;
  }
}
```

### Verify Porter Documents

```typescript
async function verifyPorterDocument(documentId: string, approved: boolean, notes?: string) {
  try {
    const result = await client.porters.verifyDocument.mutate({
      documentId,
      approved,
      notes,
    });

    if (approved) {
      console.log('✅ Document approved');
    } else {
      console.log('❌ Document rejected');
      console.log('Reason:', notes);
    }

    return result;
  } catch (error) {
    console.error('Failed to verify document:', error);
    throw error;
  }
}
```

### Approve/Reject Porter

```typescript
async function approvePorter(porterId: string) {
  // Verify all documents first
  const porter = await client.users.get.query({ userId: porterId });

  const allDocuments = porter.porterProfile.documents;

  for (const doc of allDocuments) {
    await client.porters.verifyDocument.mutate({
      documentId: doc.id,
      approved: true,
      notes: 'Document verified',
    });
  }

  console.log('✅ Porter approved and can start accepting jobs');
}

async function rejectPorter(porterId: string, reason: string) {
  const porter = await client.users.get.query({ userId: porterId });

  const allDocuments = porter.porterProfile.documents;

  for (const doc of allDocuments) {
    await client.porters.verifyDocument.mutate({
      documentId: doc.id,
      approved: false,
      notes: reason,
    });
  }

  console.log('❌ Porter verification rejected');
  console.log('Reason:', reason);
}
```

## Order Management

### List All Orders

```typescript
async function listAllOrders() {
  const orders = await client.orders.list.query({
    page: 1,
    pageSize: 100,
    filters: {
      status: 'ACTIVE', // Show active orders
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        end: new Date(),
      },
    },
  });

  console.log(`Total orders: ${orders.total}`);
  console.log(`Active orders: ${orders.data.length}\n`);

  orders.data.forEach((order) => {
    console.log(`Order #${order.id}`);
    console.log(`  Customer: ${order.customer.displayName}`);
    console.log(`  Porter: ${order.porter?.displayName || 'Unassigned'}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Price: $${order.finalPriceCents / 100}`);
    console.log();
  });

  return orders;
}
```

### Get Order Details

```typescript
async function getOrderDetails(orderId: string) {
  const order = await client.orders.get.query({ orderId });

  console.log('Order Details:');
  console.log('ID:', order.id);
  console.log('Status:', order.status);
  console.log('Customer:', order.customer.displayName, `(${order.customer.email})`);

  if (order.assignedPorters.length > 0) {
    console.log('Porters:');
    order.assignedPorters.forEach((porter) => {
      console.log(`  - ${porter.displayName} (${porter.phone})`);
    });
  }

  console.log('Pickup:', order.pickup.address);
  console.log('Dropoff:', order.dropoff.address);
  console.log('Vehicle:', order.vehicleType);
  console.log('Price:', `$${order.finalPriceCents / 100}`);
  console.log('Payment Status:', order.paymentStatus);
  console.log('Created:', order.createdAt);

  return order;
}
```

### Override Order

```typescript
async function cancelOrderByAdmin(orderId: string, reason: string) {
  const result = await client.admin.overrideOrder.mutate({
    orderId,
    action: 'CANCEL',
    reason,
  });

  console.log('✅ Order cancelled by admin');
  console.log('Reason:', reason);

  return result;
}

async function reassignOrder(orderId: string, newPorterId: string) {
  const result = await client.admin.overrideOrder.mutate({
    orderId,
    action: 'REASSIGN',
    reason: 'Admin reassignment',
    data: {
      newPorterId,
    },
  });

  console.log('✅ Order reassigned');
  return result;
}
```

### Get Order Audit Trail

```typescript
async function getOrderAuditTrail(orderId: string) {
  const audit = await client.admin.getAuditTrail.query({ orderId });

  console.log(`Audit Trail for Order ${orderId}:\n`);

  audit.forEach((entry) => {
    console.log(`[${entry.timestamp}] ${entry.action}`);
    console.log(`  Actor: ${entry.actor.displayName} (${entry.actor.role})`);
    console.log(`  Changes:`, entry.changes);
    if (entry.reason) {
      console.log(`  Reason: ${entry.reason}`);
    }
    console.log();
  });

  return audit;
}
```

## Vehicle Types

### List Vehicle Types

```typescript
async function listVehicleTypes() {
  const vehicleTypes = await client.vehicleTypes.list.query();

  console.log(`${vehicleTypes.length} vehicle types:\n`);

  vehicleTypes.forEach((vt) => {
    console.log(`${vt.name} (${vt.code})`);
    console.log(`  Description: ${vt.description}`);
    console.log(`  Max Weight: ${vt.config.maxWeightLbs} lbs`);
    console.log(`  Max Volume: ${vt.config.maxVolumeCubicFt} cu ft`);
    console.log(`  Max Porters: ${vt.config.maxPorters}`);
    console.log(`  Base Rate: $${vt.config.baseRateCents / 100}`);
    console.log(`  Enabled: ${vt.enabled ? 'Yes' : 'No'}`);
    console.log();
  });

  return vehicleTypes;
}
```

### Create Vehicle Type

```typescript
async function createVehicleType() {
  const vehicleType = await client.vehicleTypes.create.mutate({
    name: 'Cargo Van',
    code: 'CARGO_VAN',
    description: 'Large cargo van for heavy items',
    config: {
      maxWeightLbs: 3000,
      maxVolumeCubicFt: 500,
      maxPorters: 2,
      baseRateCents: 5000, // $50
      perKmRateCents: 150, // $1.50/km
      perMinuteRateCents: 50, // $0.50/min
    },
  });

  console.log('✅ Vehicle type created');
  console.log('ID:', vehicleType.id);

  return vehicleType;
}
```

### Update Vehicle Type

```typescript
async function updateVehicleType(vehicleTypeId: string, version: number) {
  const updated = await client.vehicleTypes.update.mutate({
    vehicleTypeId,
    config: {
      baseRateCents: 5500, // Increase base rate to $55
      perKmRateCents: 160, // Increase to $1.60/km
    },
    version, // Optimistic locking
  });

  console.log('✅ Vehicle type updated');
  return updated;
}
```

### Disable Vehicle Type

```typescript
async function disableVehicleType(vehicleTypeId: string) {
  await client.vehicleTypes.delete.mutate({ vehicleTypeId });

  console.log('✅ Vehicle type disabled');
}
```

## Promo Codes

### List Promo Codes

```typescript
async function listPromoCodes() {
  const promoCodes = await client.promoCodes.list.query({
    filters: {
      active: true, // Only active codes
    },
  });

  console.log(`${promoCodes.length} promo codes:\n`);

  promoCodes.forEach((promo) => {
    console.log(`${promo.code}`);
    console.log(`  Type: ${promo.discountType}`);
    console.log(`  Value: ${promo.value}${promo.discountType === 'PERCENTAGE' ? '%' : ' cents'}`);
    console.log(`  Used: ${promo.usedCount}/${promo.usageLimit || '∞'}`);
    console.log(`  Valid: ${promo.validFrom} - ${promo.validUntil}`);
    console.log(`  Status: ${promo.status}`);
    console.log();
  });

  return promoCodes;
}
```

### Create Promo Code

```typescript
async function createPromoCode() {
  const promo = await client.promoCodes.create.mutate({
    code: 'SPRING2024',
    discountType: 'PERCENTAGE',
    value: 25, // 25% off
    usageLimit: 500,
    maxDiscountCents: 5000, // Max $50 discount
    minOrderCents: 3000, // Min order $30
    validFrom: new Date('2024-03-01'),
    validUntil: new Date('2024-05-31'),
    description: 'Spring promotion - 25% off',
  });

  console.log('✅ Promo code created');
  console.log('Code:', promo.code);

  return promo;
}

async function createFixedAmountPromo() {
  const promo = await client.promoCodes.create.mutate({
    code: 'SAVE20',
    discountType: 'FIXED_AMOUNT',
    value: 2000, // $20 off
    usageLimit: 1000,
    minOrderCents: 5000, // Min order $50
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    description: '$20 off your order',
  });

  console.log('✅ Fixed amount promo created');
  return promo;
}
```

### Update Promo Code

```typescript
async function updatePromoCode(promoCodeId: string) {
  const promo = await client.promoCodes.update.mutate({
    promoCodeId,
    config: {
      usageLimit: 1000, // Increase limit
      validUntil: new Date('2024-12-31'), // Extend validity
    },
  });

  console.log('✅ Promo code updated');
  return promo;
}
```

### Disable Promo Code

```typescript
async function disablePromoCode(promoCodeId: string) {
  await client.promoCodes.disable.mutate({ promoCodeId });

  console.log('✅ Promo code disabled');
}
```

## Analytics

### Get Dashboard Summary

```typescript
async function getDashboardSummary() {
  const summary = await client.analytics.getDashboardSummary.query();

  console.log('📊 Dashboard Summary:\n');

  console.log('Orders:');
  console.log(`  Total: ${summary.orders.total}`);
  console.log(`  Today: ${summary.orders.today}`);
  console.log(`  This Week: ${summary.orders.thisWeek}`);
  console.log(`  This Month: ${summary.orders.thisMonth}`);

  console.log('\nRevenue:');
  console.log(`  Total: $${summary.revenue.totalCents / 100}`);
  console.log(`  Today: $${summary.revenue.todayCents / 100}`);
  console.log(`  This Week: $${summary.revenue.thisWeekCents / 100}`);
  console.log(`  This Month: $${summary.revenue.thisMonthCents / 100}`);

  console.log('\nUsers:');
  console.log(`  Total: ${summary.users.total}`);
  console.log(`  Customers: ${summary.users.customers}`);
  console.log(`  Porters: ${summary.users.porters}`);
  console.log(`  Active Porters: ${summary.users.activePorters}`);

  console.log('\nPerformance:');
  console.log(`  Avg Order Value: $${summary.performance.avgOrderValueCents / 100}`);
  console.log(`  Avg Rating: ${summary.performance.avgRating}/5`);
  console.log(`  Completion Rate: ${summary.performance.completionRate}%`);

  return summary;
}
```

### Get Analytics for Date Range

```typescript
async function getAnalytics(startDate: Date, endDate: Date) {
  const analytics = await client.analytics.get.query({
    dateRange: {
      start: startDate,
      end: endDate,
    },
  });

  console.log(`📊 Analytics (${startDate.toDateString()} - ${endDate.toDateString()}):\n`);

  console.log('Orders:', analytics.orderCount);
  console.log('Revenue:', `$${analytics.revenueCents / 100}`);
  console.log('Avg Order Value:', `$${analytics.avgOrderValueCents / 100}`);
  console.log('New Customers:', analytics.newCustomers);
  console.log('New Porters:', analytics.newPorters);

  console.log('\nTop Performing Porters:');
  analytics.topPorters.forEach((porter, index) => {
    console.log(`${index + 1}. ${porter.name} - ${porter.jobsCompleted} jobs, ${porter.rating}/5`);
  });

  console.log('\nPopular Vehicle Types:');
  analytics.vehicleTypeStats.forEach((stat) => {
    console.log(`  ${stat.type}: ${stat.count} orders ($${stat.revenueCents / 100})`);
  });

  return analytics;
}
```

### Get Order Statistics

```typescript
async function getOrderStatistics() {
  const stats = await client.admin.getStatistics.query({
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date(),
    },
  });

  console.log('📈 Order Statistics (Last 30 days):\n');

  console.log('By Status:');
  Object.entries(stats.byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('\nBy Vehicle Type:');
  Object.entries(stats.byVehicleType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\nAverage Times:');
  console.log(`  Acceptance: ${stats.avgAcceptanceMinutes} minutes`);
  console.log(`  Completion: ${stats.avgCompletionMinutes} minutes`);

  return stats;
}
```

## Platform Settings

### List Settings

```typescript
async function listSettings() {
  const settings = await client.settings.list.query();

  console.log('⚙️ Platform Settings:\n');

  settings.forEach((setting) => {
    console.log(`${setting.key}`);
    console.log(`  Value: ${JSON.stringify(setting.value)}`);
    console.log(`  Description: ${setting.description}`);
    console.log(`  Updated: ${setting.updatedAt}`);
    console.log();
  });

  return settings;
}
```

### Get Setting

```typescript
async function getSetting(key: string) {
  const setting = await client.settings.get.query({ key });

  console.log(`Setting: ${key}`);
  console.log(`Value:`, setting.value);

  return setting;
}
```

### Update Setting

```typescript
async function updateSetting(key: string, value: any) {
  const setting = await client.settings.update.mutate({
    key,
    value,
  });

  console.log(`✅ Setting updated: ${key}`);
  console.log(`New value:`, value);

  return setting;
}

// Examples
async function updatePlatformSettings() {
  // Update commission rate
  await updateSetting('platform.commissionRate', 0.15); // 15%

  // Update service fee
  await updateSetting('platform.serviceFee', 500); // $5

  // Update minimum order amount
  await updateSetting('orders.minimumAmountCents', 2000); // $20

  // Update max distance
  await updateSetting('orders.maxDistanceKm', 100); // 100 km

  console.log('✅ All settings updated');
}
```

## Best Practices

### 1. Audit Logging

```typescript
async function performAdminAction(action: string, data: any) {
  console.log(`[AUDIT] ${action} by ${getCurrentAdmin().email}`);
  console.log('Data:', data);

  // Perform action
  const result = await executeAction(action, data);

  // Log result
  console.log(`[AUDIT] ${action} completed successfully`);

  return result;
}
```

### 2. Permission Checking

```typescript
function requirePermission(requiredRole: string) {
  const currentUser = getCurrentAdmin();

  const roleHierarchy = {
    SUPER_ADMIN: 5,
    ADMIN: 4,
    OPERATIONS: 3,
    FINANCE: 2,
    SUPPORT: 1,
  };

  if (roleHierarchy[currentUser.role] < roleHierarchy[requiredRole]) {
    throw new Error('Insufficient permissions');
  }
}

// Usage
async function deleteUser(userId: string) {
  requirePermission('ADMIN'); // Only ADMIN or SUPER_ADMIN can delete

  await client.users.updateStatus.mutate({ userId, status: 'DELETED' });
}
```

### 3. Bulk Operations

```typescript
async function bulkSuspendUsers(userIds: string[], reason: string) {
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      client.users.updateStatus.mutate({
        userId,
        status: 'SUSPENDED',
        reason,
      })
    )
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`✅ Suspended ${successful} users`);
  console.log(`❌ Failed ${failed} users`);

  return results;
}
```

## Next Steps

You've completed all the API tutorials! Here's what to do next:

1. **Build your application** using these tutorials as reference
2. **Review the [Main README](../../README.md)** for deployment guides
3. **Check [Sequence Diagrams](../SEQUENCE_DIAGRAMS.md)** for workflow understanding
4. **Explore service READMEs** for detailed API documentation

## Quick Reference

```typescript
// User management
await client.users.list.query({ page, pageSize, filters? });
await client.users.get.query({ userId });
await client.users.updateStatus.mutate({ userId, status, reason? });
await client.users.updateRole.mutate({ userId, role });

// Porter verification
await client.porters.getPendingDocuments.query({ skip, take });
await client.porters.verifyDocument.mutate({ documentId, approved, notes? });

// Order management
await client.orders.list.query({ page, pageSize, filters? });
await client.admin.overrideOrder.mutate({ orderId, action, reason });
await client.admin.getAuditTrail.query({ orderId });

// Vehicle types
await client.vehicleTypes.list.query();
await client.vehicleTypes.create.mutate({ name, code, description, config });

// Promo codes
await client.promoCodes.list.query({ filters? });
await client.promoCodes.create.mutate({ code, discountType, value, ... });

// Analytics
await client.analytics.getDashboardSummary.query();
await client.analytics.get.query({ dateRange });

// Settings
await client.settings.list.query();
await client.settings.update.mutate({ key, value });
```

---

**🎉 Congratulations!** You've completed all MoveNow API tutorials!
