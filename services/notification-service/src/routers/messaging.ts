import { router, protectedProcedure } from '../trpc';
import {
  SendInAppMessageInputSchema,
  GetChatHistoryInputSchema,
  MarkMessagesReadInputSchema,
  GetConversationInputSchema,
  ListConversationsInputSchema,
} from '../types/zodSchemas';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { trackActiveConversation } from '../lib/redis';

export const messagingRouter = router({
  /**
   * Send an in-app message to another user
   */
  sendMessage: protectedProcedure
    .input(SendInAppMessageInputSchema)
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Sending in-app message', {
        recipientId: input.recipientId,
        senderId: ctx.user.id,
      });

      // Find or create conversation between users
      const conversation = await findOrCreateConversation(
        ctx.db,
        ctx.user.id,
        input.recipientId,
        input.relatedOrderId
      );

      // Create message
      const message = await ctx.db.inAppMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: ctx.user.id,
          recipientId: input.recipientId,
          content: input.content,
          messageType: input.messageType,
          relatedOrderId: input.relatedOrderId,
          metadata: input.metadata,
        },
      });

      // Update conversation's last message timestamp and unread count
      const senderIndex = conversation.participants.indexOf(ctx.user.id);
      const recipientIndex = conversation.participants.indexOf(input.recipientId);

      await ctx.db.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          ...(recipientIndex === 0 && { unreadCountUser1: { increment: 1 } }),
          ...(recipientIndex === 1 && { unreadCountUser2: { increment: 1 } }),
        },
      });

      // Track sender's active conversation
      await trackActiveConversation(ctx.user.id, conversation.id);

      ctx.logger.info('In-app message sent successfully', {
        messageId: message.id,
        conversationId: conversation.id,
        correlationId: ctx.correlationId,
      });

      return {
        success: true,
        message,
        conversationId: conversation.id,
      };
    }),

  /**
   * Get chat history for a conversation
   */
  getChatHistory: protectedProcedure
    .input(GetChatHistoryInputSchema)
    .query(async ({ input, ctx }) => {
      ctx.logger.info('Getting chat history', { input, userId: ctx.user.id });

      let conversationId = input.conversationId;

      // If conversationId not provided, find it by other user ID
      if (!conversationId && input.otherUserId) {
        const conversation = await ctx.db.conversation.findFirst({
          where: {
            participants: {
              hasEvery: [ctx.user.id, input.otherUserId],
            },
          },
        });

        if (!conversation) {
          // No conversation exists yet
          return {
            messages: [],
            total: 0,
            limit: input.limit,
            offset: input.offset,
            conversationId: null,
          };
        }

        conversationId = conversation.id;
      }

      if (!conversationId) {
        throw new NotFoundError('Conversation', 'unknown');
      }

      // Verify user is participant in conversation
      const conversation = await ctx.db.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new NotFoundError('Conversation', conversationId);
      }

      if (!conversation.participants.includes(ctx.user.id)) {
        throw new ForbiddenError('You are not a participant in this conversation');
      }

      // Get messages
      const [messages, total] = await Promise.all([
        ctx.db.inAppMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.inAppMessage.count({ where: { conversationId } }),
      ]);

      return {
        messages: messages.reverse(), // Reverse to show oldest first
        total,
        limit: input.limit,
        offset: input.offset,
        conversationId,
      };
    }),

  /**
   * Mark messages as read
   */
  markAsRead: protectedProcedure
    .input(MarkMessagesReadInputSchema)
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Marking messages as read', { input, userId: ctx.user.id });

      let messageIds: string[] = [];

      if (input.conversationId) {
        // Mark all unread messages in conversation as read
        const messages = await ctx.db.inAppMessage.findMany({
          where: {
            conversationId: input.conversationId,
            recipientId: ctx.user.id,
            readStatus: false,
          },
          select: { id: true },
        });

        messageIds = messages.map((m) => m.id);

        // Reset unread count for user in conversation
        const conversation = await ctx.db.conversation.findUnique({
          where: { id: input.conversationId },
        });

        if (conversation) {
          const userIndex = conversation.participants.indexOf(ctx.user.id);

          await ctx.db.conversation.update({
            where: { id: input.conversationId },
            data: {
              ...(userIndex === 0 && { unreadCountUser1: 0 }),
              ...(userIndex === 1 && { unreadCountUser2: 0 }),
            },
          });
        }
      } else if (input.messageIds) {
        messageIds = input.messageIds;
      }

      if (messageIds.length === 0) {
        return {
          success: true,
          updatedCount: 0,
        };
      }

      // Update messages
      const result = await ctx.db.inAppMessage.updateMany({
        where: {
          id: { in: messageIds },
          recipientId: ctx.user.id,
        },
        data: {
          readStatus: true,
          readAt: new Date(),
        },
      });

      ctx.logger.info('Messages marked as read', {
        count: result.count,
        correlationId: ctx.correlationId,
      });

      return {
        success: true,
        updatedCount: result.count,
      };
    }),

  /**
   * Get conversation details
   */
  getConversation: protectedProcedure
    .input(GetConversationInputSchema)
    .query(async ({ input, ctx }) => {
      ctx.logger.info('Getting conversation', {
        conversationId: input.conversationId,
        userId: ctx.user.id,
      });

      const conversation = await ctx.db.conversation.findUnique({
        where: { id: input.conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Get last message
          },
        },
      });

      if (!conversation) {
        throw new NotFoundError('Conversation', input.conversationId);
      }

      if (!conversation.participants.includes(ctx.user.id)) {
        throw new ForbiddenError('You are not a participant in this conversation');
      }

      // Get unread count for current user
      const userIndex = conversation.participants.indexOf(ctx.user.id);
      const unreadCount =
        userIndex === 0 ? conversation.unreadCountUser1 : conversation.unreadCountUser2;

      return {
        ...conversation,
        unreadCount,
      };
    }),

  /**
   * List all conversations for current user
   */
  listConversations: protectedProcedure
    .input(ListConversationsInputSchema)
    .query(async ({ input, ctx }) => {
      ctx.logger.info('Listing conversations', { userId: ctx.user.id });

      const [conversations, total] = await Promise.all([
        ctx.db.conversation.findMany({
          where: {
            participants: {
              has: ctx.user.id,
            },
          },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1, // Get last message
            },
          },
          orderBy: { lastMessageAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.conversation.count({
          where: {
            participants: {
              has: ctx.user.id,
            },
          },
        }),
      ]);

      // Add unread count for each conversation
      const conversationsWithUnread = conversations.map((conv) => {
        const userIndex = conv.participants.indexOf(ctx.user.id);
        const unreadCount =
          userIndex === 0 ? conv.unreadCountUser1 : conv.unreadCountUser2;

        return {
          ...conv,
          unreadCount,
        };
      });

      return {
        conversations: conversationsWithUnread,
        total,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /**
   * Get total unread message count for current user
   */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    ctx.logger.info('Getting unread message count', { userId: ctx.user.id });

    const conversations = await ctx.db.conversation.findMany({
      where: {
        participants: {
          has: ctx.user.id,
        },
      },
    });

    let totalUnread = 0;
    conversations.forEach((conv) => {
      const userIndex = conv.participants.indexOf(ctx.user.id);
      totalUnread += userIndex === 0 ? conv.unreadCountUser1 : conv.unreadCountUser2;
    });

    return { count: totalUnread };
  }),
});

/**
 * Helper function to find or create a conversation between two users
 */
async function findOrCreateConversation(
  db: any,
  userId1: string,
  userId2: string,
  relatedOrderId?: string
) {
  // Try to find existing conversation
  let conversation = await db.conversation.findFirst({
    where: {
      participants: {
        hasEvery: [userId1, userId2],
      },
    },
  });

  if (!conversation) {
    // Create new conversation
    conversation = await db.conversation.create({
      data: {
        participants: [userId1, userId2],
        relatedOrderId,
        lastMessageAt: new Date(),
      },
    });
  }

  return conversation;
}
