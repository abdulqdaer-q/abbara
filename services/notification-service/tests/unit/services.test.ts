import { EmailService } from '../../src/services/emailService';
import { SmsService } from '../../src/services/smsService';
import { PushNotificationService } from '../../src/services/pushNotificationService';

// Mock dependencies
jest.mock('../../src/lib/logger');
jest.mock('../../src/lib/db', () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    notificationPreference: {
      findUnique: jest.fn(),
    },
  },
}));

describe('EmailService Tests', () => {
  let emailService: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService = new EmailService();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'This is a test email',
        templateId: 'welcome',
      });

      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('success', true);
    });

    it('should send email with template variables', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Order Confirmation',
        body: 'Your order #{{orderId}} is confirmed',
        templateId: 'order-confirmation',
        variables: {
          orderId: 'ORDER-123',
          customerName: 'John Doe',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should handle email sending failure', async () => {
      await expect(
        emailService.sendEmail({
          to: 'invalid-email',
          subject: 'Test',
          body: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should validate email format', async () => {
      await expect(
        emailService.sendEmail({
          to: 'not-an-email',
          subject: 'Test',
          body: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  describe('sendBulkEmail', () => {
    it('should send emails to multiple recipients', async () => {
      const recipients = [
        'user1@example.com',
        'user2@example.com',
        'user3@example.com',
      ];

      const result = await emailService.sendBulkEmail({
        recipients,
        subject: 'Bulk Email Test',
        body: 'This is a bulk email',
        templateId: 'newsletter',
      });

      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should handle partial failures in bulk send', async () => {
      const recipients = [
        'valid@example.com',
        'invalid-email',
        'another@example.com',
      ];

      const result = await emailService.sendBulkEmail({
        recipients,
        subject: 'Bulk Test',
        body: 'Test',
      });

      expect(result.sent).toBeLessThan(recipients.length);
      expect(result.failed).toBeGreaterThan(0);
    });
  });
});

describe('SmsService Tests', () => {
  let smsService: SmsService;

  beforeEach(() => {
    jest.clearAllMocks();
    smsService = new SmsService();
  });

  describe('sendSms', () => {
    it('should send SMS successfully', async () => {
      const result = await smsService.sendSms({
        to: '+1234567890',
        message: 'Your verification code is 123456',
      });

      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('success', true);
    });

    it('should send SMS with template', async () => {
      const result = await smsService.sendSms({
        to: '+1234567890',
        message: 'Your order {{orderId}} is on its way!',
        templateId: 'order-update',
        variables: {
          orderId: 'ORDER-123',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should validate phone number format', async () => {
      await expect(
        smsService.sendSms({
          to: 'invalid-phone',
          message: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should handle SMS sending failure', async () => {
      await expect(
        smsService.sendSms({
          to: '+0000000000', // Invalid number
          message: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  describe('sendVerificationCode', () => {
    it('should send verification code via SMS', async () => {
      const result = await smsService.sendVerificationCode({
        to: '+1234567890',
        code: '123456',
      });

      expect(result.success).toBe(true);
    });

    it('should generate code if not provided', async () => {
      const result = await smsService.sendVerificationCode({
        to: '+1234567890',
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('code');
      expect(result.code).toHaveLength(6);
    });
  });
});

describe('PushNotificationService Tests', () => {
  let pushService: PushNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    pushService = new PushNotificationService();
  });

  describe('sendPushNotification', () => {
    it('should send push notification successfully', async () => {
      const result = await pushService.sendPushNotification({
        userId: 'user-1',
        title: 'New Order',
        body: 'You have a new order!',
        data: {
          orderId: 'ORDER-123',
          type: 'order-created',
        },
      });

      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('success', true);
    });

    it('should send notification to specific device', async () => {
      const result = await pushService.sendPushNotification({
        deviceToken: 'device-token-123',
        title: 'Test Notification',
        body: 'This is a test',
      });

      expect(result.success).toBe(true);
    });

    it('should handle notification with action buttons', async () => {
      const result = await pushService.sendPushNotification({
        userId: 'user-1',
        title: 'New Bid',
        body: 'You received a new bid',
        data: {
          bidId: 'BID-123',
        },
        actions: [
          { id: 'accept', title: 'Accept' },
          { id: 'reject', title: 'Reject' },
        ],
      });

      expect(result.success).toBe(true);
    });

    it('should handle notification delivery failure', async () => {
      await expect(
        pushService.sendPushNotification({
          userId: 'nonexistent-user',
          title: 'Test',
          body: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  describe('sendBulkPushNotification', () => {
    it('should send notifications to multiple users', async () => {
      const result = await pushService.sendBulkPushNotification({
        userIds: ['user-1', 'user-2', 'user-3'],
        title: 'Announcement',
        body: 'Important announcement for all users',
      });

      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should handle partial failures', async () => {
      const result = await pushService.sendBulkPushNotification({
        userIds: ['user-1', 'invalid-user', 'user-3'],
        title: 'Test',
        body: 'Test',
      });

      expect(result.sent).toBeGreaterThan(0);
      expect(result.failed).toBeGreaterThan(0);
    });
  });
});

describe('Notification Preferences Tests', () => {
  const { prisma } = require('../../src/lib/db');

  it('should respect user notification preferences', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      userId: 'user-1',
      emailEnabled: false,
      smsEnabled: true,
      pushEnabled: true,
    });

    const emailService = new EmailService();

    // Should skip email if disabled
    await expect(
      emailService.sendEmail({
        to: 'user1@example.com',
        subject: 'Test',
        body: 'Test',
        respectPreferences: true,
        userId: 'user-1',
      })
    ).resolves.toHaveProperty('skipped', true);
  });

  it('should send notification if preferences allow', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      userId: 'user-1',
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
    });

    const smsService = new SmsService();

    const result = await smsService.sendSms({
      to: '+1234567890',
      message: 'Test',
      respectPreferences: true,
      userId: 'user-1',
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBeFalsy();
  });
});
