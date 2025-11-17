import { ForbiddenError } from '../lib/errors';
import { AdminRole } from '../types/schemas';

/**
 * Role hierarchy and permissions matrix
 */
const roleHierarchy: Record<AdminRole, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  OPERATIONS: 3,
  FINANCE: 2,
  SUPPORT: 1,
};

/**
 * Permission definitions
 */
export enum Permission {
  // User management
  VIEW_USERS = 'view_users',
  UPDATE_USER_STATUS = 'update_user_status',
  DELETE_USER = 'delete_user',

  // Porter verification
  VERIFY_PORTER = 'verify_porter',
  REJECT_PORTER = 'reject_porter',

  // Vehicle type management
  CREATE_VEHICLE_TYPE = 'create_vehicle_type',
  UPDATE_VEHICLE_TYPE = 'update_vehicle_type',
  DELETE_VEHICLE_TYPE = 'delete_vehicle_type',

  // Promo code management
  CREATE_PROMO_CODE = 'create_promo_code',
  UPDATE_PROMO_CODE = 'update_promo_code',
  DELETE_PROMO_CODE = 'delete_promo_code',

  // Order management
  VIEW_ORDERS = 'view_orders',
  UPDATE_ORDER = 'update_order',
  CANCEL_ORDER = 'cancel_order',

  // Analytics
  VIEW_ANALYTICS = 'view_analytics',
  EXPORT_ANALYTICS = 'export_analytics',

  // Platform settings
  UPDATE_PLATFORM_SETTINGS = 'update_platform_settings',

  // Admin management
  CREATE_ADMIN = 'create_admin',
  UPDATE_ADMIN = 'update_admin',
  DELETE_ADMIN = 'delete_admin',
}

/**
 * Role-based permissions mapping
 */
const rolePermissions: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission), // All permissions

  ADMIN: [
    Permission.VIEW_USERS,
    Permission.UPDATE_USER_STATUS,
    Permission.VERIFY_PORTER,
    Permission.REJECT_PORTER,
    Permission.CREATE_VEHICLE_TYPE,
    Permission.UPDATE_VEHICLE_TYPE,
    Permission.DELETE_VEHICLE_TYPE,
    Permission.CREATE_PROMO_CODE,
    Permission.UPDATE_PROMO_CODE,
    Permission.DELETE_PROMO_CODE,
    Permission.VIEW_ORDERS,
    Permission.UPDATE_ORDER,
    Permission.CANCEL_ORDER,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_ANALYTICS,
    Permission.UPDATE_PLATFORM_SETTINGS,
  ],

  OPERATIONS: [
    Permission.VIEW_USERS,
    Permission.VERIFY_PORTER,
    Permission.REJECT_PORTER,
    Permission.VIEW_ORDERS,
    Permission.UPDATE_ORDER,
    Permission.VIEW_ANALYTICS,
  ],

  FINANCE: [
    Permission.VIEW_USERS,
    Permission.VIEW_ORDERS,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_ANALYTICS,
    Permission.CREATE_PROMO_CODE,
    Permission.UPDATE_PROMO_CODE,
  ],

  SUPPORT: [
    Permission.VIEW_USERS,
    Permission.VIEW_ORDERS,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: AdminRole, permission: Permission): boolean {
  const permissions = rolePermissions[role] || [];
  return permissions.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: AdminRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: AdminRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Require specific permission or throw error
 */
export function requirePermission(role: AdminRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(
      `Your role (${role}) does not have permission to perform this action (${permission})`
    );
  }
}

/**
 * Require any of the specified permissions or throw error
 */
export function requireAnyPermission(role: AdminRole, permissions: Permission[]): void {
  if (!hasAnyPermission(role, permissions)) {
    throw new ForbiddenError(
      `Your role (${role}) does not have any of the required permissions`
    );
  }
}

/**
 * Require all of the specified permissions or throw error
 */
export function requireAllPermissions(role: AdminRole, permissions: Permission[]): void {
  if (!hasAllPermissions(role, permissions)) {
    throw new ForbiddenError(
      `Your role (${role}) does not have all of the required permissions`
    );
  }
}

/**
 * Check if a role is higher or equal in hierarchy
 */
export function isRoleHigherOrEqual(role: AdminRole, targetRole: AdminRole): boolean {
  return roleHierarchy[role] >= roleHierarchy[targetRole];
}

/**
 * Require role to be higher or equal in hierarchy
 */
export function requireRoleHigherOrEqual(role: AdminRole, targetRole: AdminRole): void {
  if (!isRoleHigherOrEqual(role, targetRole)) {
    throw new ForbiddenError(
      `Your role (${role}) is not authorized to manage ${targetRole} level accounts`
    );
  }
}
