# Authentication & User Management

Learn how to implement authentication, user registration, and profile management in your MoveNow application.

## 📋 Table of Contents

- [Overview](#overview)
- [User Registration](#user-registration)
- [Login Flow](#login-flow)
- [Token Management](#token-management)
- [Password Reset](#password-reset)
- [Profile Management](#profile-management)
- [Role-Based Access](#role-based-access)
- [Best Practices](#best-practices)

## Overview

MoveNow uses JWT (JSON Web Tokens) for authentication with:

- **Access tokens** - Short-lived (15 minutes), used for API requests
- **Refresh tokens** - Long-lived (7 days), used to get new access tokens
- **Role-based authorization** - Different permissions for customers, porters, and admins

### Authentication Flow

```
1. User registers → Access + Refresh tokens
2. User logs in → Access + Refresh tokens
3. Access token expires → Use refresh token to get new access token
4. Refresh token expires → User must log in again
```

## User Registration

### Register a New Customer

```typescript
import { client, setAuthToken } from '../client';

async function registerCustomer() {
  try {
    const result = await client.auth.register.mutate({
      email: 'john.doe@example.com',
      password: 'SecurePassword123!',
      displayName: 'John Doe',
      role: 'CUSTOMER', // Optional, defaults to CUSTOMER
    });

    console.log('Registration successful!');
    console.log('User ID:', result.user.id);
    console.log('Access Token:', result.accessToken);
    console.log('Refresh Token:', result.refreshToken);

    // Save tokens for future requests
    setAuthToken(result.accessToken);

    // Store refresh token securely (e.g., secure storage, httpOnly cookie)
    localStorage.setItem('refreshToken', result.refreshToken);

    return result;
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
}
```

### Register with Phone Number

```typescript
async function registerWithPhone() {
  try {
    const result = await client.auth.register.mutate({
      phone: '+1234567890',
      password: 'SecurePassword123!',
      displayName: 'Jane Smith',
    });

    console.log('Registration successful!');
    return result;
  } catch (error) {
    if (error.data?.code === 'CONFLICT') {
      console.error('Phone number already registered');
    }
    throw error;
  }
}
```

### Register a Porter

```typescript
async function registerPorter() {
  try {
    // Step 1: Register as user with PORTER role
    const result = await client.auth.register.mutate({
      email: 'porter@example.com',
      password: 'SecurePassword123!',
      displayName: 'Mike Porter',
      role: 'PORTER',
    });

    setAuthToken(result.accessToken);

    // Step 2: Submit verification documents (required for porters)
    const verification = await client.porters.submitVerification.mutate({
      documents: [
        {
          type: 'DRIVERS_LICENSE',
          url: 'https://storage.example.com/license.jpg',
        },
        {
          type: 'VEHICLE_REGISTRATION',
          url: 'https://storage.example.com/registration.jpg',
        },
        {
          type: 'INSURANCE',
          url: 'https://storage.example.com/insurance.jpg',
        },
      ],
    });

    console.log('Porter registered and verification submitted');
    console.log('Status:', verification.status); // PENDING

    return { user: result, verification };
  } catch (error) {
    console.error('Porter registration failed:', error);
    throw error;
  }
}
```

### Input Validation

The API validates all registration inputs:

```typescript
// Email format validation
email: 'invalid-email' // ❌ Will fail

// Password requirements
password: 'weak' // ❌ Too short
password: 'nouppercaseornumber' // ❌ Must have uppercase and number
password: 'SecurePass123!' // ✅ Valid

// Display name
displayName: '' // ❌ Required
displayName: 'ab' // ❌ Too short (min 2 chars)
displayName: 'John Doe' // ✅ Valid
```

## Login Flow

### Basic Login

```typescript
async function login(email: string, password: string) {
  try {
    const result = await client.auth.login.mutate({
      email,
      password,
    });

    console.log('Login successful!');
    console.log('User:', result.user);
    console.log('Role:', result.user.role);

    // Set access token for API requests
    setAuthToken(result.accessToken);

    // Store refresh token
    localStorage.setItem('refreshToken', result.refreshToken);

    return result;
  } catch (error) {
    if (error.data?.code === 'UNAUTHORIZED') {
      console.error('Invalid email or password');
    }
    throw error;
  }
}
```

### Login with Phone

```typescript
async function loginWithPhone(phone: string, password: string) {
  try {
    const result = await client.auth.login.mutate({
      phone,
      password,
    });

    setAuthToken(result.accessToken);
    localStorage.setItem('refreshToken', result.refreshToken);

    return result;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}
```

### Complete Login Example

```typescript
import { client, setAuthToken } from '../client';

interface LoginCredentials {
  emailOrPhone: string;
  password: string;
}

async function performLogin(credentials: LoginCredentials) {
  try {
    // Determine if input is email or phone
    const isEmail = credentials.emailOrPhone.includes('@');

    const result = await client.auth.login.mutate({
      ...(isEmail
        ? { email: credentials.emailOrPhone }
        : { phone: credentials.emailOrPhone }),
      password: credentials.password,
    });

    // Save tokens
    setAuthToken(result.accessToken);
    localStorage.setItem('refreshToken', result.refreshToken);

    // Save user info
    localStorage.setItem('user', JSON.stringify(result.user));

    console.log(`✅ Welcome back, ${result.user.displayName}!`);
    return result;
  } catch (error) {
    console.error('❌ Login failed');
    throw error;
  }
}

// Usage
performLogin({
  emailOrPhone: 'john@example.com',
  password: 'SecurePassword123!',
});
```

## Token Management

### Refreshing Access Tokens

Access tokens expire after 15 minutes. Use refresh tokens to get new ones:

```typescript
async function refreshAccessToken() {
  try {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const result = await client.auth.refresh.mutate({
      refreshToken,
    });

    // Update access token
    setAuthToken(result.accessToken);

    // Optionally, update refresh token if rotated
    if (result.refreshToken) {
      localStorage.setItem('refreshToken', result.refreshToken);
    }

    console.log('✅ Token refreshed successfully');
    return result.accessToken;
  } catch (error) {
    console.error('❌ Token refresh failed - user needs to log in again');
    // Clear stored tokens
    localStorage.removeItem('refreshToken');
    setAuthToken(null);
    throw error;
  }
}
```

### Automatic Token Refresh

Implement automatic token refresh before expiration:

```typescript
let refreshTimeout: NodeJS.Timeout | null = null;

function scheduleTokenRefresh(expiresIn: number) {
  // Refresh 1 minute before expiration
  const refreshTime = (expiresIn - 60) * 1000;

  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }

  refreshTimeout = setTimeout(async () => {
    try {
      await refreshAccessToken();
    } catch (error) {
      console.error('Auto-refresh failed:', error);
      // Redirect to login
    }
  }, refreshTime);
}

// After login or refresh
const result = await client.auth.login.mutate({ email, password });
setAuthToken(result.accessToken);
scheduleTokenRefresh(900); // 15 minutes = 900 seconds
```

### Intercepting 401 Errors

Automatically refresh when receiving 401 Unauthorized:

```typescript
import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from '@trpc/client';

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

const client = createTRPCProxyClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
      async headers() {
        const token = getAuthToken();
        return {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        };
      },
      async fetch(url, options) {
        try {
          return await fetch(url, options);
        } catch (error) {
          if (error instanceof Response && error.status === 401) {
            // Token expired, try refresh
            if (!isRefreshing) {
              isRefreshing = true;
              refreshPromise = refreshAccessToken();
            }

            try {
              await refreshPromise;
              // Retry original request
              return await fetch(url, options);
            } catch (refreshError) {
              // Refresh failed, redirect to login
              window.location.href = '/login';
              throw refreshError;
            } finally {
              isRefreshing = false;
              refreshPromise = null;
            }
          }
          throw error;
        }
      },
    }),
  ],
});
```

### Logout

```typescript
async function logout() {
  try {
    const refreshToken = localStorage.getItem('refreshToken');

    if (refreshToken) {
      // Revoke refresh token on server
      await client.auth.logout.mutate({
        refreshToken,
        revokeAll: false, // Set to true to revoke all user sessions
      });
    }

    // Clear local tokens
    setAuthToken(null);
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    console.log('✅ Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    // Clear tokens anyway
    setAuthToken(null);
    localStorage.removeItem('refreshToken');
  }
}
```

### Logout from All Devices

```typescript
async function logoutFromAllDevices() {
  try {
    const refreshToken = localStorage.getItem('refreshToken');

    await client.auth.logout.mutate({
      refreshToken: refreshToken || undefined,
      revokeAll: true, // Revoke all refresh tokens for this user
    });

    setAuthToken(null);
    localStorage.removeItem('refreshToken');

    console.log('✅ Logged out from all devices');
  } catch (error) {
    console.error('Logout failed:', error);
  }
}
```

## Password Reset

### Request Password Reset

```typescript
async function requestPasswordReset(email: string) {
  try {
    await client.auth.requestPasswordReset.mutate({
      email,
    });

    console.log('✅ Password reset email sent');
    console.log('Check your inbox for instructions');
  } catch (error) {
    if (error.data?.code === 'NOT_FOUND') {
      // Don't reveal if email exists (security best practice)
      console.log('✅ If that email exists, a reset link was sent');
    } else {
      console.error('Password reset request failed:', error);
    }
  }
}
```

### Reset Password with Token

```typescript
async function resetPassword(token: string, newPassword: string) {
  try {
    const result = await client.auth.confirmPasswordReset.mutate({
      token,
      newPassword,
    });

    console.log('✅ Password reset successful');

    // Automatically log in with new tokens
    setAuthToken(result.accessToken);
    localStorage.setItem('refreshToken', result.refreshToken);

    return result;
  } catch (error) {
    if (error.data?.code === 'BAD_REQUEST') {
      console.error('Invalid or expired reset token');
    } else if (error.message.includes('password')) {
      console.error('Password does not meet requirements');
    }
    throw error;
  }
}
```

### Complete Password Reset Flow

```typescript
// Step 1: User requests reset (on login page)
async function handleForgotPassword(email: string) {
  await requestPasswordReset(email);
  // Show success message
  console.log('Check your email for reset instructions');
}

// Step 2: User clicks link in email and lands on reset page
// URL: https://yourapp.com/reset-password?token=abc123...

// Step 3: User submits new password
async function handlePasswordReset(token: string, newPassword: string) {
  try {
    const result = await resetPassword(token, newPassword);

    // User is now logged in with new password
    console.log('Password reset and logged in!');

    // Redirect to dashboard
    window.location.href = '/dashboard';
  } catch (error) {
    console.error('Reset failed:', error);
    // Show error message
  }
}
```

## Profile Management

### Get User Profile

```typescript
async function getMyProfile() {
  try {
    const profile = await client.users.getProfile.query();

    console.log('User Profile:');
    console.log('ID:', profile.id);
    console.log('Name:', profile.displayName);
    console.log('Email:', profile.email);
    console.log('Phone:', profile.phone);
    console.log('Role:', profile.role);
    console.log('Avatar:', profile.avatarUrl);
    console.log('Created:', profile.createdAt);

    return profile;
  } catch (error) {
    console.error('Failed to get profile:', error);
    throw error;
  }
}
```

### Update Profile

```typescript
async function updateProfile(updates: {
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
}) {
  try {
    const updatedProfile = await client.users.updateProfile.mutate(updates);

    console.log('✅ Profile updated successfully');
    return updatedProfile;
  } catch (error) {
    if (error.data?.code === 'CONFLICT') {
      console.error('Email or phone already in use');
    }
    throw error;
  }
}

// Usage
await updateProfile({
  displayName: 'John Updated Doe',
  avatarUrl: 'https://cdn.example.com/avatars/john.jpg',
});
```

### Get Public Profile (Other Users)

```typescript
async function getUserPublicProfile(userId: string) {
  try {
    const profile = await client.users.getPublicProfile.query({ userId });

    // Public profiles have limited information
    console.log('Public Profile:');
    console.log('Name:', profile.displayName);
    console.log('Avatar:', profile.avatarUrl);
    // Email and phone are NOT included in public profiles

    return profile;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    throw error;
  }
}
```

### Search Users

```typescript
async function searchUsers(query: string) {
  try {
    const users = await client.users.search.query({
      query,
      limit: 10,
    });

    console.log(`Found ${users.length} users:`);
    users.forEach((user) => {
      console.log(`- ${user.displayName} (${user.role})`);
    });

    return users;
  } catch (error) {
    console.error('User search failed:', error);
    throw error;
  }
}
```

## Role-Based Access

### Understanding Roles

MoveNow has three main user roles:

- **CUSTOMER** - Can create orders, make payments
- **PORTER** - Can accept jobs, update status
- **ADMIN** - Can manage users, configure platform

### Checking User Role

```typescript
async function checkUserRole() {
  const profile = await client.users.getProfile.query();

  switch (profile.role) {
    case 'CUSTOMER':
      console.log('User can create and manage orders');
      break;
    case 'PORTER':
      console.log('User can accept jobs and manage deliveries');
      break;
    case 'ADMIN':
      console.log('User has administrative privileges');
      break;
  }

  return profile.role;
}
```

### Role-Based UI Rendering

```typescript
async function renderDashboard() {
  const profile = await client.users.getProfile.query();

  if (profile.role === 'CUSTOMER') {
    // Show customer dashboard
    showCustomerDashboard();
  } else if (profile.role === 'PORTER') {
    // Show porter dashboard
    showPorterDashboard();
  } else if (profile.role === 'ADMIN') {
    // Show admin dashboard
    showAdminDashboard();
  }
}
```

## Best Practices

### 1. Secure Token Storage

```typescript
// ❌ Don't store in localStorage (vulnerable to XSS)
localStorage.setItem('accessToken', token);

// ✅ Store in memory or httpOnly cookies
let accessToken: string | null = null;

export function setAuthToken(token: string | null) {
  accessToken = token;
}

// ✅ For refresh tokens, use secure storage
// - Mobile: Secure keychain/keystore
// - Web: httpOnly cookies (server-side)
```

### 2. Handle Token Expiration Gracefully

```typescript
// ✅ Always handle 401 errors
try {
  const data = await client.orders.list.query();
} catch (error) {
  if (error.data?.code === 'UNAUTHORIZED') {
    // Try to refresh
    try {
      await refreshAccessToken();
      // Retry the request
      return await client.orders.list.query();
    } catch (refreshError) {
      // Redirect to login
      redirectToLogin();
    }
  }
}
```

### 3. Validate Passwords Client-Side

```typescript
function validatePassword(password: string): string[] {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain a special character');
  }

  return errors;
}
```

### 4. Implement Session Management

```typescript
class AuthManager {
  private refreshTimer: NodeJS.Timeout | null = null;

  async login(email: string, password: string) {
    const result = await client.auth.login.mutate({ email, password });
    setAuthToken(result.accessToken);
    this.scheduleRefresh();
    return result;
  }

  async logout() {
    await client.auth.logout.mutate({
      refreshToken: localStorage.getItem('refreshToken') || undefined,
    });
    this.clearSession();
  }

  private scheduleRefresh() {
    // Refresh every 14 minutes (token expires in 15)
    this.refreshTimer = setInterval(async () => {
      try {
        await refreshAccessToken();
      } catch (error) {
        this.clearSession();
        redirectToLogin();
      }
    }, 14 * 60 * 1000);
  }

  private clearSession() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    setAuthToken(null);
    localStorage.clear();
  }
}
```

## Next Steps

Now that you understand authentication, continue with:

1. **[Order Management](../03-orders/README.md)** - Create and manage orders
2. **[Porter Workflows](../05-porters/README.md)** - Porter-specific features
3. **[Real-time Features](../06-realtime/README.md)** - WebSocket authentication

## Quick Reference

```typescript
// Register
await client.auth.register.mutate({ email, password, displayName });

// Login
await client.auth.login.mutate({ email, password });

// Refresh token
await client.auth.refresh.mutate({ refreshToken });

// Logout
await client.auth.logout.mutate({ refreshToken, revokeAll: false });

// Get profile
await client.users.getProfile.query();

// Update profile
await client.users.updateProfile.mutate({ displayName, avatarUrl });

// Password reset
await client.auth.requestPasswordReset.mutate({ email });
await client.auth.confirmPasswordReset.mutate({ token, newPassword });
```

---

**Ready to create orders?** Continue to **[Order Management](../03-orders/README.md)** →
