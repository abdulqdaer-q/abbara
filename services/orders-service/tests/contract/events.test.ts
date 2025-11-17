import {
  OrderCreatedEventSchema,
  OrderUpdatedEventSchema,
  OrderAssignedEventSchema,
  PorterOfferedEventSchema,
  OrderStatusChangedEventSchema,
  OrderCancelledEventSchema,
  OrderCompletedEventSchema,
  WaypointStatusChangedEventSchema,
  EvidenceUploadedEventSchema,
  OrderEventType,
  OrderCreatedEvent,
  OrderStatusChangedEvent,
} from '@movenow/common';

describe('Event Schema Contract Tests', () => {
  describe('OrderCreatedEvent', () => {
    it('should validate correct OrderCreatedEvent', () => {
      const event: OrderCreatedEvent = {
        type: OrderEventType.ORDER_CREATED,
        eventId: 'evt-123',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-456',
        version: '1.0',
        orderId: 'order-789',
        customerId: 'customer-123',
        pickupSummary: {
          address: '123 Main St',
          lat: 40.7128,
          lng: -74.0060,
        },
        dropoffSummary: {
          address: '456 Oak Ave',
          lat: 40.7589,
          lng: -73.9851,
        },
        priceCents: 5000,
        currency: 'USD',
        porterCountRequested: 2,
        vehicleType: 'van',
        isBusinessOrder: false,
        isRecurring: false,
      };

      const result = OrderCreatedEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should reject invalid OrderCreatedEvent - missing required fields', () => {
      const invalidEvent = {
        type: OrderEventType.ORDER_CREATED,
        eventId: 'evt-123',
        // Missing timestamp, correlationId, etc.
      };

      const result = OrderCreatedEventSchema.safeParse(invalidEvent);
      expect(result.success).toBe(false);
    });

    it('should accept OrderCreatedEvent with optional scheduledAt', () => {
      const event = {
        type: OrderEventType.ORDER_CREATED,
        eventId: 'evt-123',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-456',
        version: '1.0',
        orderId: 'order-789',
        customerId: 'customer-123',
        pickupSummary: {
          address: '123 Main St',
          lat: 40.7128,
          lng: -74.0060,
        },
        dropoffSummary: {
          address: '456 Oak Ave',
          lat: 40.7589,
          lng: -73.9851,
        },
        priceCents: 5000,
        currency: 'USD',
        porterCountRequested: 1,
        vehicleType: 'sedan',
        scheduledAt: new Date().toISOString(),
        isBusinessOrder: false,
        isRecurring: false,
      };

      const result = OrderCreatedEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('OrderUpdatedEvent', () => {
    it('should validate correct OrderUpdatedEvent', () => {
      const event = {
        type: OrderEventType.ORDER_UPDATED,
        eventId: 'evt-124',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-457',
        version: '1.0',
        orderId: 'order-789',
        customerId: 'customer-123',
        changedFields: ['specialInstructions', 'scheduledAt'],
        newValues: {
          specialInstructions: 'Please call on arrival',
          scheduledAt: new Date().toISOString(),
        },
      };

      const result = OrderUpdatedEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('OrderAssignedEvent', () => {
    it('should validate correct OrderAssignedEvent', () => {
      const event = {
        type: OrderEventType.ORDER_ASSIGNED,
        eventId: 'evt-125',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-458',
        version: '1.0',
        orderId: 'order-789',
        customerId: 'customer-123',
        assignments: [
          {
            porterId: 'porter-456',
            status: 'ACCEPTED',
            assignedAt: new Date().toISOString(),
          },
        ],
        porterCountAssigned: 1,
      };

      const result = OrderAssignedEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should validate multiple porter assignments', () => {
      const event = {
        type: OrderEventType.ORDER_ASSIGNED,
        eventId: 'evt-126',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-459',
        version: '1.0',
        orderId: 'order-789',
        customerId: 'customer-123',
        assignments: [
          {
            porterId: 'porter-456',
            status: 'ACCEPTED',
            assignedAt: new Date().toISOString(),
          },
          {
            porterId: 'porter-789',
            status: 'ACCEPTED',
            assignedAt: new Date().toISOString(),
          },
        ],
        porterCountAssigned: 2,
      };

      const result = OrderAssignedEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('PorterOfferedEvent', () => {
    it('should validate correct PorterOfferedEvent', () => {
      const event = {
        type: OrderEventType.PORTER_OFFERED,
        eventId: 'evt-127',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-460',
        version: '1.0',
        orderId: 'order-789',
        porterId: 'porter-456',
        offeredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        earningsCents: 4000,
      };

      const result = PorterOfferedEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('OrderStatusChangedEvent', () => {
    it('should validate correct OrderStatusChangedEvent', () => {
      const event: OrderStatusChangedEvent = {
        type: OrderEventType.ORDER_STATUS_CHANGED,
        eventId: 'evt-128',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-461',
        version: '1.0',
        orderId: 'order-789',
        customerId: 'customer-123',
        previousStatus: 'ASSIGNED',
        newStatus: 'ACCEPTED',
        actorId: 'porter-456',
        actorType: 'porter',
      };

      const result = OrderStatusChangedEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should validate OrderStatusChangedEvent with location', () => {
      const event = {
        type: OrderEventType.ORDER_STATUS_CHANGED,
        eventId: 'evt-129',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-462',
        version: '1.0',
        orderId: 'order-789',
        customerId: 'customer-123',
        previousStatus: 'ACCEPTED',
        newStatus: 'ARRIVED',
        actorId: 'porter-456',
        actorType: 'porter',
        location: {
          lat: 40.7128,
          lng: -74.0060,
        },
      };

      const result = OrderStatusChangedEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status values', () => {
      const event = {
        type: OrderEventType.ORDER_STATUS_CHANGED,
        eventId: 'evt-130',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-463',
        version: '1.0',
        orderId: 'order-789',
        customerId: 'customer-123',
        previousStatus: 'INVALID_STATUS',
        newStatus: 'ACCEPTED',
        actorId: 'porter-456',
        actorType: 'porter',
      };

      const result = OrderStatusChangedEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });

  describe('OrderCancelledEvent', () => {
    it('should validate correct OrderCancelledEvent', () => {
      const event = {
        type: OrderEventType.ORDER_CANCELLED,
        eventId: 'evt-131',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-464',
        version: '1.0',
        orderId: 'order-789',
        customerId: 'customer-123',
        cancelledBy: 'customer-123',
        cancelledByType: 'customer',
        reason: 'CUSTOMER_REQUEST',
        cancelledAt: new Date().toISOString(),
        cancellationFeeCents: 0,
        refundCents: 5000,
      };

      const result = OrderCancelledEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should validate with cancellation fee', () => {
      const event = {
        type: OrderEventType.ORDER_CANCELLED,
        eventId: 'evt-132',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-465',
        version: '1.0',
        orderId: 'order-789',
        customerId: 'customer-123',
        cancelledBy: 'customer-123',
        cancelledByType: 'customer',
        reason: 'CUSTOMER_REQUEST',
        reasonText: 'Changed my mind',
        cancelledAt: new Date().toISOString(),
        cancellationFeeCents: 1000,
        refundCents: 4000,
      };

      const result = OrderCancelledEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('OrderCompletedEvent', () => {
    it('should validate correct OrderCompletedEvent', () => {
      const event = {
        type: OrderEventType.ORDER_COMPLETED,
        eventId: 'evt-133',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-466',
        version: '1.0',
        orderId: 'order-789',
        customerId: 'customer-123',
        porterIds: ['porter-456'],
        completedAt: new Date().toISOString(),
        finalPriceCents: 5000,
        durationMinutes: 45,
        distanceKm: 12.5,
      };

      const result = OrderCompletedEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('WaypointStatusChangedEvent', () => {
    it('should validate correct WaypointStatusChangedEvent', () => {
      const event = {
        type: OrderEventType.WAYPOINT_STATUS_CHANGED,
        eventId: 'evt-134',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-467',
        version: '1.0',
        orderId: 'order-789',
        waypointId: 'waypoint-123',
        waypointSequence: 0,
        previousStatus: 'PENDING',
        newStatus: 'ARRIVED',
        porterId: 'porter-456',
      };

      const result = WaypointStatusChangedEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('EvidenceUploadedEvent', () => {
    it('should validate correct EvidenceUploadedEvent', () => {
      const event = {
        type: OrderEventType.EVIDENCE_UPLOADED,
        eventId: 'evt-135',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-468',
        version: '1.0',
        orderId: 'order-789',
        evidenceId: 'evidence-123',
        evidenceType: 'PRE_MOVE',
        url: 'https://storage.example.com/evidence/photo.jpg',
        checksum: 'sha256-abc123',
        uploadedBy: 'porter-456',
        uploadedAt: new Date().toISOString(),
      };

      const result = EvidenceUploadedEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  describe('Event Type Enum', () => {
    it('should have all required event types', () => {
      expect(OrderEventType.ORDER_CREATED).toBe('order.created');
      expect(OrderEventType.ORDER_UPDATED).toBe('order.updated');
      expect(OrderEventType.ORDER_ASSIGNED).toBe('order.assigned');
      expect(OrderEventType.PORTER_OFFERED).toBe('porter.offered');
      expect(OrderEventType.PORTER_OFFER_EXPIRED).toBe('porter.offer.expired');
      expect(OrderEventType.ORDER_STATUS_CHANGED).toBe('order.status.changed');
      expect(OrderEventType.ORDER_CANCELLED).toBe('order.cancelled');
      expect(OrderEventType.ORDER_COMPLETED).toBe('order.completed');
      expect(OrderEventType.WAYPOINT_STATUS_CHANGED).toBe('waypoint.status.changed');
      expect(OrderEventType.EVIDENCE_UPLOADED).toBe('evidence.uploaded');
    });
  });
});
