import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requirePermission,
  Permission,
} from '../../src/middleware/rbac';
import { ForbiddenError } from '../../src/lib/errors';

describe('RBAC Middleware', () => {
  describe('hasPermission', () => {
    it('should allow SUPER_ADMIN all permissions', () => {
      expect(hasPermission('SUPER_ADMIN', Permission.VIEW_USERS)).toBe(true);
      expect(hasPermission('SUPER_ADMIN', Permission.DELETE_USER)).toBe(true);
      expect(hasPermission('SUPER_ADMIN', Permission.UPDATE_PLATFORM_SETTINGS)).toBe(true);
    });

    it('should allow ADMIN most permissions', () => {
      expect(hasPermission('ADMIN', Permission.VIEW_USERS)).toBe(true);
      expect(hasPermission('ADMIN', Permission.UPDATE_USER_STATUS)).toBe(true);
      expect(hasPermission('ADMIN', Permission.CREATE_PROMO_CODE)).toBe(true);
    });

    it('should restrict SUPPORT role', () => {
      expect(hasPermission('SUPPORT', Permission.VIEW_USERS)).toBe(true);
      expect(hasPermission('SUPPORT', Permission.VIEW_ORDERS)).toBe(true);
      expect(hasPermission('SUPPORT', Permission.UPDATE_USER_STATUS)).toBe(false);
      expect(hasPermission('SUPPORT', Permission.DELETE_USER)).toBe(false);
    });

    it('should restrict OPERATIONS role', () => {
      expect(hasPermission('OPERATIONS', Permission.VIEW_USERS)).toBe(true);
      expect(hasPermission('OPERATIONS', Permission.VERIFY_PORTER)).toBe(true);
      expect(hasPermission('OPERATIONS', Permission.UPDATE_ORDER)).toBe(true);
      expect(hasPermission('OPERATIONS', Permission.CREATE_PROMO_CODE)).toBe(false);
    });

    it('should restrict FINANCE role', () => {
      expect(hasPermission('FINANCE', Permission.VIEW_ANALYTICS)).toBe(true);
      expect(hasPermission('FINANCE', Permission.CREATE_PROMO_CODE)).toBe(true);
      expect(hasPermission('FINANCE', Permission.VERIFY_PORTER)).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if role has any of the permissions', () => {
      expect(
        hasAnyPermission('OPERATIONS', [Permission.VIEW_USERS, Permission.DELETE_USER])
      ).toBe(true);
    });

    it('should return false if role has none of the permissions', () => {
      expect(
        hasAnyPermission('SUPPORT', [Permission.DELETE_USER, Permission.CREATE_ADMIN])
      ).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if role has all permissions', () => {
      expect(
        hasAllPermissions('SUPER_ADMIN', [Permission.VIEW_USERS, Permission.DELETE_USER])
      ).toBe(true);
    });

    it('should return false if role is missing any permission', () => {
      expect(
        hasAllPermissions('SUPPORT', [Permission.VIEW_USERS, Permission.DELETE_USER])
      ).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should not throw for valid permission', () => {
      expect(() => {
        requirePermission('ADMIN', Permission.VIEW_USERS);
      }).not.toThrow();
    });

    it('should throw ForbiddenError for missing permission', () => {
      expect(() => {
        requirePermission('SUPPORT', Permission.DELETE_USER);
      }).toThrow(ForbiddenError);
    });
  });
});
