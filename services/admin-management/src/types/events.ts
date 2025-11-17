/**
 * Event types for Admin Management Service
 * These events are published to the event bus for other services to consume
 */

export enum AdminEventType {
  // User Management Events
  USER_STATUS_UPDATED = 'admin.user.status_updated',

  // Porter Verification Events
  PORTER_VERIFIED = 'admin.porter.verified',
  PORTER_VERIFICATION_REJECTED = 'admin.porter.verification_rejected',

  // Promo Code Events
  PROMO_CODE_CREATED = 'admin.promo_code.created',
  PROMO_CODE_UPDATED = 'admin.promo_code.updated',
  PROMO_CODE_DISABLED = 'admin.promo_code.disabled',

  // Vehicle Type Events
  VEHICLE_TYPE_CREATED = 'admin.vehicle_type.created',
  VEHICLE_TYPE_UPDATED = 'admin.vehicle_type.updated',
  VEHICLE_TYPE_DELETED = 'admin.vehicle_type.deleted',

  // Order Events
  ORDER_UPDATED = 'admin.order.updated',

  // Platform Settings Events
  PLATFORM_SETTING_UPDATED = 'admin.platform_setting.updated',
}

export interface BaseAdminEvent {
  type: AdminEventType;
  timestamp: Date;
  correlationId: string;
  actorId: string; // Admin user ID
}

// ========================================
// User Management Events
// ========================================

export interface UserStatusUpdatedEvent extends BaseAdminEvent {
  type: AdminEventType.USER_STATUS_UPDATED;
  userId: string;
  oldStatus: string;
  newStatus: string;
  reason: string;
}

// ========================================
// Porter Verification Events
// ========================================

export interface PorterVerifiedEvent extends BaseAdminEvent {
  type: AdminEventType.PORTER_VERIFIED;
  porterId: string;
  documentId: string;
  documentType: string;
  reviewNotes?: string;
}

export interface PorterVerificationRejectedEvent extends BaseAdminEvent {
  type: AdminEventType.PORTER_VERIFICATION_REJECTED;
  porterId: string;
  documentId: string;
  documentType: string;
  reviewNotes?: string;
}

// ========================================
// Promo Code Events
// ========================================

export interface PromoCodeCreatedEvent extends BaseAdminEvent {
  type: AdminEventType.PROMO_CODE_CREATED;
  promoCodeId: string;
  code: string;
  discountType: string;
  discountValue: number;
  eligibleRoles: string[];
  startDate: Date;
  endDate: Date;
}

export interface PromoCodeUpdatedEvent extends BaseAdminEvent {
  type: AdminEventType.PROMO_CODE_UPDATED;
  promoCodeId: string;
  code: string;
  changes: Record<string, any>;
}

export interface PromoCodeDisabledEvent extends BaseAdminEvent {
  type: AdminEventType.PROMO_CODE_DISABLED;
  promoCodeId: string;
  code: string;
}

// ========================================
// Vehicle Type Events
// ========================================

export interface VehicleTypeCreatedEvent extends BaseAdminEvent {
  type: AdminEventType.VEHICLE_TYPE_CREATED;
  vehicleTypeId: string;
  name: string;
  maxLoadKg: number;
  pricingMultiplier: number;
}

export interface VehicleTypeUpdatedEvent extends BaseAdminEvent {
  type: AdminEventType.VEHICLE_TYPE_UPDATED;
  vehicleTypeId: string;
  name: string;
  changes: Record<string, any>;
}

export interface VehicleTypeDeletedEvent extends BaseAdminEvent {
  type: AdminEventType.VEHICLE_TYPE_DELETED;
  vehicleTypeId: string;
  name: string;
}

// ========================================
// Order Events
// ========================================

export interface OrderUpdatedEvent extends BaseAdminEvent {
  type: AdminEventType.ORDER_UPDATED;
  orderId: string;
  userId: string;
  changes: Record<string, any>;
  reason: string;
}

// ========================================
// Platform Settings Events
// ========================================

export interface PlatformSettingUpdatedEvent extends BaseAdminEvent {
  type: AdminEventType.PLATFORM_SETTING_UPDATED;
  settingKey: string;
  oldValue: string;
  newValue: string;
}

// ========================================
// Event Union Type
// ========================================

export type AdminDomainEvent =
  | UserStatusUpdatedEvent
  | PorterVerifiedEvent
  | PorterVerificationRejectedEvent
  | PromoCodeCreatedEvent
  | PromoCodeUpdatedEvent
  | PromoCodeDisabledEvent
  | VehicleTypeCreatedEvent
  | VehicleTypeUpdatedEvent
  | VehicleTypeDeletedEvent
  | OrderUpdatedEvent
  | PlatformSettingUpdatedEvent;
