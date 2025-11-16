import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { CORRELATION_ID_HEADER } from './correlation';

/**
 * Generic tRPC client factory for internal service-to-service communication
 * Uses httpBatchLink for efficient batching of multiple requests
 */
export function createInternalTRPCClient<TRouter>(
  serviceUrl: string,
  correlationId?: string
) {
  return createTRPCProxyClient<TRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: serviceUrl,
        headers: () => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          if (correlationId) {
            headers[CORRELATION_ID_HEADER] = correlationId;
          }

          return headers;
        },
        // Timeout for internal service calls
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });
        },
      }),
    ],
  });
}

/**
 * Type-safe service client definitions
 * These would normally import actual router types from each service
 * For now, we define minimal interfaces
 */

// Auth Service Router Interface
export interface AuthServiceRouter {
  login: {
    mutate: (input: { email: string; password: string }) => Promise<{
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        email: string;
        role: string;
      };
    }>;
  };
  refresh: {
    mutate: (input: { refreshToken: string }) => Promise<{
      accessToken: string;
      refreshToken: string;
    }>;
  };
  logout: {
    mutate: (input: { refreshToken: string }) => Promise<{ success: boolean }>;
  };
  verifyToken: {
    query: (input: { token: string }) => Promise<{
      valid: boolean;
      userId?: string;
      email?: string;
      role?: string;
    }>;
  };
}

// Orders Service Router Interface
export interface OrdersServiceRouter {
  createOrder: {
    mutate: (input: {
      userId: string;
      pickup: { address: string; lat: number; lng: number };
      dropoff: { address: string; lat: number; lng: number };
      vehicleType: string;
      porterCount: number;
      scheduledAt?: Date;
      priceCents: number;
      notes?: string;
    }) => Promise<{ orderId: string }>;
  };
  getOrder: {
    query: (orderId: string) => Promise<{
      id: string;
      userId: string;
      status: string;
      pickup: { address: string; lat: number; lng: number };
      dropoff: { address: string; lat: number; lng: number };
      vehicleType: string;
      porterCount: number;
      priceCents: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  };
  listOrders: {
    query: (input: { userId?: string; status?: string; limit?: number; offset?: number }) => Promise<{
      orders: Array<{
        id: string;
        userId: string;
        status: string;
        pickup: { address: string };
        dropoff: { address: string };
        priceCents: number;
        createdAt: Date;
      }>;
      total: number;
    }>;
  };
  cancelOrder: {
    mutate: (input: { orderId: string; userId: string; reason?: string }) => Promise<{
      success: boolean;
      refundCents?: number;
    }>;
  };
}

// Pricing Service Router Interface
export interface PricingServiceRouter {
  estimate: {
    query: (input: {
      pickup: { lat: number; lng: number };
      dropoff: { lat: number; lng: number };
      vehicleType: string;
      porterCount: number;
    }) => Promise<{
      totalCents: number;
      breakdown: {
        baseFare: number;
        distanceFare: number;
        porterFee: number;
        surge?: number;
      };
      estimatedDuration: number;
      distanceMeters: number;
    }>;
  };
}

// Porters Service Router Interface
export interface PortersServiceRouter {
  nearby: {
    query: (input: {
      lat: number;
      lng: number;
      radiusMeters?: number;
      vehicleType?: string;
    }) => Promise<
      Array<{
        id: string;
        name: string;
        lat: number;
        lng: number;
        vehicleType: string;
        rating: number;
        distanceMeters: number;
      }>
    >;
  };
  getPorter: {
    query: (porterId: string) => Promise<{
      id: string;
      name: string;
      vehicleType: string;
      rating: number;
      completedOrders: number;
    }>;
  };
}

// Payments Service Router Interface
export interface PaymentsServiceRouter {
  createPaymentIntent: {
    mutate: (input: {
      orderId: string;
      amountCents: number;
      method: 'card' | 'wallet' | 'cash';
      userId: string;
    }) => Promise<{
      paymentIntentId: string;
      clientSecret?: string;
      walletHoldId?: string;
      status: string;
    }>;
  };
  confirmPayment: {
    mutate: (input: { paymentIntentId: string }) => Promise<{
      success: boolean;
      transactionId: string;
    }>;
  };
}

// Notifications Service Router Interface
export interface NotificationsServiceRouter {
  sendNotification: {
    mutate: (input: {
      userId: string;
      type: string;
      title: string;
      message: string;
      data?: Record<string, unknown>;
    }) => Promise<{ success: boolean; notificationId: string }>;
  };
}

/**
 * Service clients registry
 */
export interface ServiceClients {
  auth: ReturnType<typeof createInternalTRPCClient<AuthServiceRouter>>;
  orders: ReturnType<typeof createInternalTRPCClient<OrdersServiceRouter>>;
  pricing: ReturnType<typeof createInternalTRPCClient<PricingServiceRouter>>;
  porters: ReturnType<typeof createInternalTRPCClient<PortersServiceRouter>>;
  payments: ReturnType<typeof createInternalTRPCClient<PaymentsServiceRouter>>;
  notifications: ReturnType<typeof createInternalTRPCClient<NotificationsServiceRouter>>;
}
