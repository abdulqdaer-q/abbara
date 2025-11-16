import { z } from 'zod';

// ========================================
// Admin User Schemas
// ========================================

export const AdminRoleSchema = z.enum([
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS',
  'FINANCE',
  'SUPPORT',
]);

export const AdminStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']);

// ========================================
// User Management Schemas
// ========================================

export const UserRoleSchema = z.enum(['CLIENT', 'PORTER', 'ADMIN', 'SUPER_ADMIN']);
export const UserStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'DELETED']);
export const VerificationStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'RESUBMITTED']);

export const ListUsersInputSchema = z.object({
  role: UserRoleSchema.optional(),
  status: UserStatusSchema.optional(),
  verificationStatus: VerificationStatusSchema.optional(),
  searchQuery: z.string().optional(),
  registrationDateFrom: z.date().optional(),
  registrationDateTo: z.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const GetUserInputSchema = z.object({
  userId: z.string().uuid(),
});

export const UpdateUserStatusInputSchema = z.object({
  userId: z.string().uuid(),
  newStatus: UserStatusSchema,
  reason: z.string().min(1).max(500),
});

// ========================================
// Porter Verification Schemas
// ========================================

export const DocumentTypeSchema = z.enum([
  'DRIVERS_LICENSE',
  'VEHICLE_REGISTRATION',
  'INSURANCE',
  'BACKGROUND_CHECK',
  'PROFILE_PHOTO',
]);

export const VerifyPorterDocumentInputSchema = z.object({
  porterId: z.string().uuid(),
  documentId: z.string().uuid(),
  verificationStatus: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().max(1000).optional(),
});

// ========================================
// Vehicle Type Schemas
// ========================================

export const VehicleTypeStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'DEPRECATED']);

export const CreateVehicleTypeInputSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  maxLoadKg: z.number().int().min(1).max(10000),
  pricingMultiplier: z.number().min(0.1).max(10),
});

export const UpdateVehicleTypeInputSchema = z.object({
  vehicleTypeId: z.string().uuid(),
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  maxLoadKg: z.number().int().min(1).max(10000).optional(),
  pricingMultiplier: z.number().min(0.1).max(10).optional(),
  status: VehicleTypeStatusSchema.optional(),
  version: z.number().int(), // For optimistic locking
});

export const DeleteVehicleTypeInputSchema = z.object({
  vehicleTypeId: z.string().uuid(),
});

// ========================================
// Promo Code Schemas
// ========================================

export const DiscountTypeSchema = z.enum(['PERCENTAGE', 'FIXED']);
export const PromoCodeStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']);

export const CreatePromoCodeInputSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  discountType: DiscountTypeSchema,
  discountValue: z.number().min(0),
  usageLimit: z.number().int().min(1).optional(),
  eligibleRoles: z.array(UserRoleSchema),
  startDate: z.date(),
  endDate: z.date(),
}).refine((data) => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
}).refine((data) => {
  if (data.discountType === 'PERCENTAGE') {
    return data.discountValue <= 100;
  }
  return true;
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discountValue'],
});

export const UpdatePromoCodeInputSchema = z.object({
  promoCodeId: z.string().uuid(),
  discountType: DiscountTypeSchema.optional(),
  discountValue: z.number().min(0).optional(),
  usageLimit: z.number().int().min(1).optional(),
  eligibleRoles: z.array(UserRoleSchema).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  status: PromoCodeStatusSchema.optional(),
  version: z.number().int(), // For optimistic locking
});

export const DeletePromoCodeInputSchema = z.object({
  promoCodeId: z.string().uuid(),
});

// ========================================
// Order Management Schemas
// ========================================

export const OrderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const ViewOrdersInputSchema = z.object({
  status: OrderStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  porterId: z.string().uuid().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const UpdateOrderAdminInputSchema = z.object({
  orderId: z.string().uuid(),
  status: OrderStatusSchema.optional(),
  assignedPorters: z.array(z.string().uuid()).optional(),
  specialInstructions: z.string().max(1000).optional(),
  reason: z.string().min(1).max(500),
});

// ========================================
// Analytics Schemas
// ========================================

export const MetricsTypeSchema = z.enum([
  'ORDERS',
  'REVENUE',
  'RATINGS',
  'PORTER_ACTIVITY',
  'USER_GROWTH',
  'PROMO_USAGE',
]);

export const ViewAnalyticsInputSchema = z.object({
  metricsType: MetricsTypeSchema,
  dateFrom: z.date(),
  dateTo: z.date(),
  groupBy: z.enum(['DAY', 'WEEK', 'MONTH']).default('DAY'),
  filters: z.record(z.string(), z.any()).optional(),
});

// ========================================
// Platform Settings Schemas
// ========================================

export const UpdatePlatformSettingInputSchema = z.object({
  settingKey: z.string().min(1).max(100),
  value: z.string().min(1).max(1000),
  description: z.string().max(500).optional(),
});

// ========================================
// Response Schemas
// ========================================

export const PaginationMetaSchema = z.object({
  currentPage: z.number().int(),
  totalPages: z.number().int(),
  totalItems: z.number().int(),
  itemsPerPage: z.number().int(),
});

export const UserSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  verificationStatus: VerificationStatusSchema,
  createdAt: z.date(),
  lastActiveAt: z.date().nullable(),
});

export const UserDetailSchema = UserSummarySchema.extend({
  walletBalance: z.number(),
  totalOrders: z.number(),
  totalSpent: z.number(),
  averageRating: z.number().nullable(),
  updatedAt: z.date(),
});

export const VehicleTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  maxLoadKg: z.number(),
  pricingMultiplier: z.number(),
  status: VehicleTypeStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
});

export const PromoCodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  discountType: DiscountTypeSchema,
  discountValue: z.number(),
  usageLimit: z.number().nullable(),
  usageCount: z.number(),
  eligibleRoles: z.array(z.string()),
  startDate: z.date(),
  endDate: z.date(),
  status: PromoCodeStatusSchema,
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
});

export const OrderSummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: OrderStatusSchema,
  pickupAddress: z.string(),
  dropoffAddress: z.string(),
  vehicleType: z.string(),
  porterCount: z.number(),
  priceCents: z.number(),
  assignedPorters: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const PlatformSettingSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  description: z.string().nullable(),
  updatedBy: z.string(),
  updatedAt: z.date(),
  version: z.number(),
});

export const AnalyticsDataSchema = z.object({
  labels: z.array(z.string()),
  datasets: z.array(z.object({
    label: z.string(),
    data: z.array(z.number()),
  })),
  summary: z.record(z.string(), z.any()),
});

// ========================================
// Type Exports
// ========================================

export type AdminRole = z.infer<typeof AdminRoleSchema>;
export type AdminStatus = z.infer<typeof AdminStatusSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type VehicleTypeStatus = z.infer<typeof VehicleTypeStatusSchema>;
export type DiscountType = z.infer<typeof DiscountTypeSchema>;
export type PromoCodeStatus = z.infer<typeof PromoCodeStatusSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type MetricsType = z.infer<typeof MetricsTypeSchema>;

// Input types
export type ListUsersInput = z.infer<typeof ListUsersInputSchema>;
export type GetUserInput = z.infer<typeof GetUserInputSchema>;
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusInputSchema>;
export type VerifyPorterDocumentInput = z.infer<typeof VerifyPorterDocumentInputSchema>;
export type CreateVehicleTypeInput = z.infer<typeof CreateVehicleTypeInputSchema>;
export type UpdateVehicleTypeInput = z.infer<typeof UpdateVehicleTypeInputSchema>;
export type DeleteVehicleTypeInput = z.infer<typeof DeleteVehicleTypeInputSchema>;
export type CreatePromoCodeInput = z.infer<typeof CreatePromoCodeInputSchema>;
export type UpdatePromoCodeInput = z.infer<typeof UpdatePromoCodeInputSchema>;
export type DeletePromoCodeInput = z.infer<typeof DeletePromoCodeInputSchema>;
export type ViewOrdersInput = z.infer<typeof ViewOrdersInputSchema>;
export type UpdateOrderAdminInput = z.infer<typeof UpdateOrderAdminInputSchema>;
export type ViewAnalyticsInput = z.infer<typeof ViewAnalyticsInputSchema>;
export type UpdatePlatformSettingInput = z.infer<typeof UpdatePlatformSettingInputSchema>;

// Output types
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;
export type UserDetail = z.infer<typeof UserDetailSchema>;
export type VehicleType = z.infer<typeof VehicleTypeSchema>;
export type PromoCode = z.infer<typeof PromoCodeSchema>;
export type OrderSummary = z.infer<typeof OrderSummarySchema>;
export type PlatformSetting = z.infer<typeof PlatformSettingSchema>;
export type AnalyticsData = z.infer<typeof AnalyticsDataSchema>;
