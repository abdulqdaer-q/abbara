import { z } from 'zod';
import {
  CreateOrderInput,
  LocationSchema,
  VehicleTypeSchema,
  PaymentMethodSchema,
  OrderStatusSchema,
} from '@movenow/common';

/**
 * Auth schemas
 */
export const LoginInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RefreshTokenInputSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const LogoutInputSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Order schemas
 */
export const CreateOrderInputSchema = CreateOrderInput.extend({
  idempotencyKey: z.string().optional(),
});

export const GetOrderInputSchema = z.string().uuid('Invalid order ID');

export const ListOrdersInputSchema = z.object({
  status: OrderStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const CancelOrderInputSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  reason: z.string().max(500).optional(),
});

/**
 * Porter schemas
 */
export const NearbyPortersInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(100).max(50000).default(5000),
  vehicleType: VehicleTypeSchema.optional(),
});

export const GetPorterInputSchema = z.string().uuid('Invalid porter ID');

export const SubscribeToJobsInputSchema = z.object({
  porterId: z.string().uuid('Invalid porter ID'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Payment schemas
 */
export const CreatePaymentIntentInputSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  method: PaymentMethodSchema,
  idempotencyKey: z.string().optional(),
});

export const ConfirmPaymentInputSchema = z.object({
  paymentIntentId: z.string().min(1),
});

/**
 * Realtime schemas
 */
export const SubscribeToNamespaceInputSchema = z.object({
  namespace: z.enum(['client', 'porter']),
  token: z.string().min(1),
});

/**
 * Admin schemas
 */
export const GetUserInputSchema = z.string().uuid('Invalid user ID');

export const ListUsersInputSchema = z.object({
  role: z.enum(['client', 'porter', 'admin', 'superadmin']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const UpdateUserRoleInputSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['client', 'porter', 'admin', 'superadmin']),
});

export const GetSystemStatsInputSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
});
