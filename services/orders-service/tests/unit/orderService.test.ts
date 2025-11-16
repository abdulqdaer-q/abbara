import { isStatusTransitionAllowed } from '../../src/services/orderService';
import { OrderStatus } from '@prisma/client';

describe('OrderService Unit Tests', () => {
  describe('isStatusTransitionAllowed', () => {
    it('should allow CREATED -> ASSIGNED transition', () => {
      expect(
        isStatusTransitionAllowed(OrderStatus.CREATED, OrderStatus.ASSIGNED)
      ).toBe(true);
    });

    it('should allow ASSIGNED -> ACCEPTED transition', () => {
      expect(
        isStatusTransitionAllowed(OrderStatus.ASSIGNED, OrderStatus.ACCEPTED)
      ).toBe(true);
    });

    it('should not allow COMPLETED -> CREATED transition', () => {
      expect(
        isStatusTransitionAllowed(OrderStatus.COMPLETED, OrderStatus.CREATED)
      ).toBe(false);
    });

    it('should not allow CANCELLED -> ACCEPTED transition', () => {
      expect(
        isStatusTransitionAllowed(OrderStatus.CANCELLED, OrderStatus.ACCEPTED)
      ).toBe(false);
    });

    it('should allow full happy path: CREATED -> ASSIGNED -> ACCEPTED -> ARRIVED -> LOADED -> EN_ROUTE -> DELIVERED -> COMPLETED', () => {
      expect(
        isStatusTransitionAllowed(OrderStatus.CREATED, OrderStatus.ASSIGNED)
      ).toBe(true);
      expect(
        isStatusTransitionAllowed(OrderStatus.ASSIGNED, OrderStatus.ACCEPTED)
      ).toBe(true);
      expect(
        isStatusTransitionAllowed(OrderStatus.ACCEPTED, OrderStatus.ARRIVED)
      ).toBe(true);
      expect(
        isStatusTransitionAllowed(OrderStatus.ARRIVED, OrderStatus.LOADED)
      ).toBe(true);
      expect(
        isStatusTransitionAllowed(OrderStatus.LOADED, OrderStatus.EN_ROUTE)
      ).toBe(true);
      expect(
        isStatusTransitionAllowed(OrderStatus.EN_ROUTE, OrderStatus.DELIVERED)
      ).toBe(true);
      expect(
        isStatusTransitionAllowed(OrderStatus.DELIVERED, OrderStatus.COMPLETED)
      ).toBe(true);
    });
  });
});
