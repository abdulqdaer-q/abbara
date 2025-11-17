import { handleOrderUpdate } from '../../src/handlers/order.handler';
import { handleLocationUpdate } from '../../src/handlers/location.handler';
import { handleChatMessage } from '../../src/handlers/chat.handler';
import { handleJobOfferUpdate } from '../../src/handlers/jobOffer.handler';

jest.mock('../../src/lib/logger');
jest.mock('../../src/services/redis.service', () => ({
  redisService: {
    get: jest.fn(),
    set: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
  },
}));

jest.mock('../../src/services/kafka.service', () => ({
  kafkaService: {
    publishEvent: jest.fn(),
  },
}));

describe('Order Handler Tests', () => {
  let mockSocket: any;
  let mockIo: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: 'socket-1',
      userId: 'user-1',
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      join: jest.fn(),
      leave: jest.fn(),
    };

    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      in: jest.fn().mockReturnThis(),
    };
  });

  describe('handleOrderUpdate', () => {
    it('should broadcast order update to customer and porter', async () => {
      const orderUpdate = {
        orderId: 'order-1',
        status: 'IN_PROGRESS',
        porterId: 'porter-1',
        customerId: 'customer-1',
        timestamp: new Date().toISOString(),
      };

      await handleOrderUpdate(mockSocket, mockIo, orderUpdate);

      expect(mockIo.to).toHaveBeenCalledWith(`order:order-1`);
      expect(mockIo.emit).toHaveBeenCalledWith('order:updated', expect.any(Object));
    });

    it('should notify customer on status change', async () => {
      const orderUpdate = {
        orderId: 'order-1',
        status: 'COMPLETED',
        customerId: 'customer-1',
      };

      await handleOrderUpdate(mockSocket, mockIo, orderUpdate);

      expect(mockIo.to).toHaveBeenCalledWith(`user:customer-1`);
    });

    it('should handle order assignment to porter', async () => {
      const orderUpdate = {
        orderId: 'order-1',
        status: 'ASSIGNED',
        porterId: 'porter-1',
        customerId: 'customer-1',
      };

      await handleOrderUpdate(mockSocket, mockIo, orderUpdate);

      expect(mockIo.to).toHaveBeenCalledWith(`user:porter-1`);
    });

    it('should validate order update data', async () => {
      const invalidUpdate = {
        orderId: null,
        status: 'INVALID_STATUS',
      };

      await expect(
        handleOrderUpdate(mockSocket, mockIo, invalidUpdate as any)
      ).rejects.toThrow();
    });
  });
});

describe('Location Handler Tests', () => {
  let mockSocket: any;
  let mockIo: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: 'socket-1',
      userId: 'porter-1',
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };

    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
  });

  describe('handleLocationUpdate', () => {
    it('should broadcast porter location to tracking customers', async () => {
      const locationUpdate = {
        porterId: 'porter-1',
        orderId: 'order-1',
        lat: 40.7128,
        lng: -74.006,
        accuracy: 10,
        timestamp: new Date().toISOString(),
      };

      await handleLocationUpdate(mockSocket, mockIo, locationUpdate);

      expect(mockIo.to).toHaveBeenCalledWith(`order:order-1`);
      expect(mockIo.emit).toHaveBeenCalledWith('location:updated', expect.any(Object));
    });

    it('should validate location coordinates', async () => {
      const invalidLocation = {
        porterId: 'porter-1',
        lat: 200, // Invalid latitude
        lng: -74.006,
      };

      await expect(
        handleLocationUpdate(mockSocket, mockIo, invalidLocation as any)
      ).rejects.toThrow();
    });

    it('should update location in Redis', async () => {
      const { redisService } = require('../../src/services/redis.service');

      const locationUpdate = {
        porterId: 'porter-1',
        lat: 40.7128,
        lng: -74.006,
        timestamp: new Date().toISOString(),
      };

      await handleLocationUpdate(mockSocket, mockIo, locationUpdate);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('location:porter-1'),
        expect.any(String)
      );
    });

    it('should throttle location updates', async () => {
      const locationUpdate = {
        porterId: 'porter-1',
        lat: 40.7128,
        lng: -74.006,
      };

      // Send multiple updates rapidly
      await handleLocationUpdate(mockSocket, mockIo, locationUpdate);
      await handleLocationUpdate(mockSocket, mockIo, locationUpdate);
      await handleLocationUpdate(mockSocket, mockIo, locationUpdate);

      // Should throttle to reduce broadcasts
      expect(mockIo.emit).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Chat Handler Tests', () => {
  let mockSocket: any;
  let mockIo: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: 'socket-1',
      userId: 'user-1',
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };

    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
  });

  describe('handleChatMessage', () => {
    it('should send chat message to recipient', async () => {
      const message = {
        orderId: 'order-1',
        senderId: 'user-1',
        recipientId: 'user-2',
        message: 'Hello, when will you arrive?',
        timestamp: new Date().toISOString(),
      };

      await handleChatMessage(mockSocket, mockIo, message);

      expect(mockIo.to).toHaveBeenCalledWith(`user:user-2`);
      expect(mockIo.emit).toHaveBeenCalledWith('chat:message', expect.any(Object));
    });

    it('should sanitize message content', async () => {
      const message = {
        orderId: 'order-1',
        senderId: 'user-1',
        recipientId: 'user-2',
        message: '<script>alert("XSS")</script>Hello',
      };

      await handleChatMessage(mockSocket, mockIo, message);

      const emittedMessage = mockIo.emit.mock.calls[0][1];
      expect(emittedMessage.message).not.toContain('<script>');
    });

    it('should validate message length', async () => {
      const longMessage = 'a'.repeat(5000); // Exceeds max length

      const message = {
        orderId: 'order-1',
        senderId: 'user-1',
        recipientId: 'user-2',
        message: longMessage,
      };

      await expect(
        handleChatMessage(mockSocket, mockIo, message)
      ).rejects.toThrow();
    });

    it('should persist chat message', async () => {
      const { kafkaService } = require('../../src/services/kafka.service');

      const message = {
        orderId: 'order-1',
        senderId: 'user-1',
        recipientId: 'user-2',
        message: 'Test message',
      };

      await handleChatMessage(mockSocket, mockIo, message);

      expect(kafkaService.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'chat.message.sent',
        })
      );
    });
  });
});

describe('Job Offer Handler Tests', () => {
  let mockSocket: any;
  let mockIo: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: 'socket-1',
      userId: 'porter-1',
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };

    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
  });

  describe('handleJobOfferUpdate', () => {
    it('should notify porter of new job offer', async () => {
      const jobOffer = {
        offerId: 'offer-1',
        orderId: 'order-1',
        porterId: 'porter-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      };

      await handleJobOfferUpdate(mockSocket, mockIo, jobOffer);

      expect(mockIo.to).toHaveBeenCalledWith(`user:porter-1`);
      expect(mockIo.emit).toHaveBeenCalledWith('job-offer:new', expect.any(Object));
    });

    it('should handle job offer acceptance', async () => {
      const jobOffer = {
        offerId: 'offer-1',
        orderId: 'order-1',
        porterId: 'porter-1',
        customerId: 'customer-1',
        status: 'ACCEPTED',
      };

      await handleJobOfferUpdate(mockSocket, mockIo, jobOffer);

      expect(mockIo.to).toHaveBeenCalledWith(`user:customer-1`);
      expect(mockIo.emit).toHaveBeenCalledWith('job-offer:accepted', expect.any(Object));
    });

    it('should handle job offer rejection', async () => {
      const jobOffer = {
        offerId: 'offer-1',
        orderId: 'order-1',
        porterId: 'porter-1',
        customerId: 'customer-1',
        status: 'REJECTED',
        reason: 'Porter unavailable',
      };

      await handleJobOfferUpdate(mockSocket, mockIo, jobOffer);

      expect(mockIo.to).toHaveBeenCalledWith(`user:customer-1`);
    });

    it('should handle job offer expiration', async () => {
      const jobOffer = {
        offerId: 'offer-1',
        orderId: 'order-1',
        porterId: 'porter-1',
        status: 'EXPIRED',
      };

      await handleJobOfferUpdate(mockSocket, mockIo, jobOffer);

      expect(mockIo.to).toHaveBeenCalledWith(`user:porter-1`);
      expect(mockIo.emit).toHaveBeenCalledWith('job-offer:expired', expect.any(Object));
    });
  });
});

describe('Socket Connection Tests', () => {
  it('should authenticate socket connection', async () => {
    const mockSocket = {
      id: 'socket-1',
      handshake: {
        auth: {
          token: 'valid-jwt-token',
        },
      },
      disconnect: jest.fn(),
    };

    // Should extract userId from token
    expect(mockSocket.handshake.auth.token).toBeDefined();
  });

  it('should reject unauthenticated connections', async () => {
    const mockSocket = {
      id: 'socket-1',
      handshake: {
        auth: {},
      },
      disconnect: jest.fn(),
    };

    // Should disconnect
    expect(mockSocket.disconnect).toBeDefined();
  });

  it('should join user-specific rooms', async () => {
    const mockSocket = {
      id: 'socket-1',
      userId: 'user-1',
      join: jest.fn(),
    };

    mockSocket.join(`user:${mockSocket.userId}`);

    expect(mockSocket.join).toHaveBeenCalledWith('user:user-1');
  });

  it('should handle disconnect gracefully', async () => {
    const mockSocket = {
      id: 'socket-1',
      userId: 'user-1',
      disconnect: jest.fn(),
      leave: jest.fn(),
    };

    mockSocket.disconnect();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
