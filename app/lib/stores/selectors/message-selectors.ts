/**
 * Optimized Selectors for Message Store
 *
 * Provides memoized, performance-monitored selectors for message queries.
 */

import { MessageState } from '../message-store';
import { Message, TokenStats } from '../../repositories/message-repository';
import { memoize, memoizeArray, trackSelector } from '../performance';

/**
 * Get messages for specific conversation
 */
export const selectMessagesByConversation = (conversationId: string) =>
  memoizeArray<MessageState, Message>(
    trackSelector(
      `messagesByConversation:${conversationId}`,
      (state) => state.messagesByConversation.get(conversationId) || []
    )
  );

/**
 * Get user messages for conversation
 */
export const selectUserMessages = (conversationId: string) =>
  memoizeArray<MessageState, Message>(
    trackSelector(`userMessages:${conversationId}`, (state) => {
      const messages = state.messagesByConversation.get(conversationId) || [];
      return messages.filter((m: Message) => m.role === 'user');
    })
  );

/**
 * Get assistant messages for conversation
 */
export const selectAssistantMessages = (conversationId: string) =>
  memoizeArray<MessageState, Message>(
    trackSelector(`assistantMessages:${conversationId}`, (state) => {
      const messages = state.messagesByConversation.get(conversationId) || [];
      return messages.filter((m: Message) => m.role === 'assistant');
    })
  );

/**
 * Get last message for conversation
 */
export const selectLastMessage = (conversationId: string) =>
  memoize<MessageState, Message | null>(
    trackSelector(`lastMessage:${conversationId}`, (state) => {
      const messages = state.messagesByConversation.get(conversationId) || [];
      if (messages.length === 0) return null;
      return messages[messages.length - 1] ?? null;
    })
  );

/**
 * Get streaming state
 */
export const selectIsStreaming = memoize<MessageState, boolean>(
  (state) => state.isStreaming
);

/**
 * Get streaming conversation ID
 */
export const selectStreamingConversationId = memoize<
  MessageState,
  string | null
>((state) => state.streamingConversationId);

/**
 * Get stream buffer
 */
export const selectStreamBuffer = memoize<MessageState, Message | null>(
  (state) => state.streamBuffer
);

/**
 * Check if conversation is loading
 */
export const selectIsLoading = (conversationId: string) =>
  memoize<MessageState, boolean>(
    (state) => state.loadingStates.get(conversationId) || false
  );

/**
 * Get error
 */
export const selectError = memoize<MessageState, string | null>(
  (state) => state.error
);

/**
 * Get message statistics for conversation
 */
export const selectMessageStats = (conversationId: string) =>
  memoize<
    MessageState,
    {
      total: number;
      userCount: number;
      assistantCount: number;
      totalTokens: number;
      totalCost: number;
    }
  >(
    trackSelector(`messageStats:${conversationId}`, (state) => {
      const messages = state.messagesByConversation.get(conversationId) || [];
      return {
        total: messages.length,
        userCount: messages.filter((m: Message) => m.role === 'user').length,
        assistantCount: messages.filter((m: Message) => m.role === 'assistant')
          .length,
        totalTokens: messages.reduce(
          (sum: number, m: Message) =>
            sum + ((m.inputTokens || 0) + (m.outputTokens || 0)),
          0
        ),
        totalCost: messages.reduce(
          (sum: number, m: Message) => sum + (m.cost || 0),
          0
        ),
      };
    })
  );

/**
 * Get token stats for conversation
 */
export const selectTokenStats = (conversationId: string) =>
  memoize<MessageState, TokenStats | null>((state) => {
    const stats = state.tokenStats.get(conversationId);
    return stats || null;
  });
