import { z } from 'zod';

// Channel enums
export const ChannelSchema = z.enum(['push', 'email', 'sms', 'in_app', 'webhook']);

// Message type enums
export const MessageTypeSchema = z.enum([
  'order_created',
  'order_confirmed',
  'order_assigned',
  'order_started',
  'order_completed',
  'order_cancelled',
  'bid_received',
  'bid_accepted',
  'bid_rejected',
  'porter_arrived',
  'payment_completed',
  'promo_code_created',
  'system_announcement',
  'chat_message',
]);

// Priority enums
export const PrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']).transform((val) => {
  const priorityMap = { low: 0, normal: 1, high: 2, urgent: 3 };
  return priorityMap[val];
});

// ===== Notification Schemas =====

export const SendNotificationInputSchema = z.object({
  recipientId: z.string().uuid().optional(),
  recipientIds: z.array(z.string().uuid()).optional(),
  channels: z.array(ChannelSchema),
  messageType: MessageTypeSchema,
  payload: z.record(z.unknown()),
  priority: PrioritySchema.optional().default('normal' as const),
  metadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
}).refine(
  (data) => data.recipientId || (data.recipientIds && data.recipientIds.length > 0),
  {
    message: 'Either recipientId or recipientIds must be provided',
  }
);

export const GetNotificationHistoryInputSchema = z.object({
  userId: z.string().uuid(),
  messageType: MessageTypeSchema.optional(),
  status: z.enum(['queued', 'sent', 'failed', 'delivered', 'read']).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export const MarkNotificationsReadInputSchema = z.object({
  notificationIds: z.array(z.string().uuid()),
});

export const GetNotificationByIdInputSchema = z.object({
  notificationId: z.string().uuid(),
});

// ===== Messaging Schemas =====

export const SendInAppMessageInputSchema = z.object({
  recipientId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  messageType: z.enum(['text', 'image', 'location', 'system']).default('text'),
  relatedOrderId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const GetChatHistoryInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  otherUserId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
}).refine(
  (data) => data.conversationId || data.otherUserId,
  {
    message: 'Either conversationId or otherUserId must be provided',
  }
);

export const MarkMessagesReadInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  messageIds: z.array(z.string().uuid()).optional(),
}).refine(
  (data) => data.conversationId || (data.messageIds && data.messageIds.length > 0),
  {
    message: 'Either conversationId or messageIds must be provided',
  }
);

export const GetConversationInputSchema = z.object({
  conversationId: z.string().uuid(),
});

export const ListConversationsInputSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

// ===== Preferences Schemas =====

export const UpdatePreferencesInputSchema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  orderUpdatesEnabled: z.boolean().optional(),
  bidUpdatesEnabled: z.boolean().optional(),
  chatMessagesEnabled: z.boolean().optional(),
  promotionsEnabled: z.boolean().optional(),
  systemAlertsEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  quietHoursEnd: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  quietHoursTimezone: z.string().optional(),
});

export const RegisterDeviceTokenInputSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
  deviceInfo: z.record(z.unknown()).optional(),
});

export const UnregisterDeviceTokenInputSchema = z.object({
  token: z.string().min(1),
});

// ===== Broadcast Schemas =====

export const SendBroadcastInputSchema = z.object({
  filters: z.object({
    roles: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    userIds: z.array(z.string().uuid()).optional(),
  }).optional(),
  messageContent: z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(1000),
  }),
  channels: z.array(ChannelSchema),
  priority: PrioritySchema.optional().default('normal' as const),
  metadata: z.record(z.unknown()).optional(),
});

// Export types
export type SendNotificationInput = z.infer<typeof SendNotificationInputSchema>;
export type GetNotificationHistoryInput = z.infer<typeof GetNotificationHistoryInputSchema>;
export type MarkNotificationsReadInput = z.infer<typeof MarkNotificationsReadInputSchema>;
export type GetNotificationByIdInput = z.infer<typeof GetNotificationByIdInputSchema>;

export type SendInAppMessageInput = z.infer<typeof SendInAppMessageInputSchema>;
export type GetChatHistoryInput = z.infer<typeof GetChatHistoryInputSchema>;
export type MarkMessagesReadInput = z.infer<typeof MarkMessagesReadInputSchema>;
export type GetConversationInput = z.infer<typeof GetConversationInputSchema>;
export type ListConversationsInput = z.infer<typeof ListConversationsInputSchema>;

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesInputSchema>;
export type RegisterDeviceTokenInput = z.infer<typeof RegisterDeviceTokenInputSchema>;
export type UnregisterDeviceTokenInput = z.infer<typeof UnregisterDeviceTokenInputSchema>;

export type SendBroadcastInput = z.infer<typeof SendBroadcastInputSchema>;
