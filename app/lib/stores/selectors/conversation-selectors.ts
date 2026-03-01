/**
 * Optimized Selectors for Conversation Store
 *
 * Provides memoized, performance-monitored selectors for common queries.
 * Use these instead of inline selectors to prevent unnecessary re-renders.
 */

import { ConversationState } from '../conversation-store';
import { ConversationWithStats } from '../../repositories/conversation-repository';
import { memoize, memoizeArray, trackSelector } from '../performance';

/**
 * Get all conversations as array
 */
export const selectAllConversations = memoizeArray<
  ConversationState,
  ConversationWithStats
>(
  trackSelector('allConversations', (state) =>
    Array.from(state.conversations.values())
  )
);

/**
 * Get all non-archived conversations
 */
export const selectActiveConversations = memoizeArray<
  ConversationState,
  ConversationWithStats
>(
  trackSelector('activeConversations', (state) =>
    Array.from(state.conversations.values()).filter(
      (c: ConversationWithStats) => !c.archived
    )
  )
);

/**
 * Get all pinned conversations
 */
export const selectPinnedConversations = memoizeArray<
  ConversationState,
  ConversationWithStats
>(
  trackSelector('pinnedConversations', (state) =>
    Array.from(state.conversations.values()).filter(
      (c: ConversationWithStats) => c.pinned
    )
  )
);

/**
 * Get conversation by ID
 */
export const selectConversationById = (id: string) =>
  memoize<ConversationState, ConversationWithStats | undefined>(
    trackSelector(`conversationById:${id}`, (state) =>
      state.conversations.get(id)
    )
  );

/**
 * Get current active conversation ID
 */
export const selectActiveConversationId = memoize<
  ConversationState,
  string | null
>((state) => state.activeConversationId);

/**
 * Get current conversation
 */
export const selectCurrentConversation = memoize<
  ConversationState,
  ConversationWithStats | null
>(
  trackSelector('currentConversation', (state) => {
    if (!state.activeConversationId) return null;
    return state.conversations.get(state.activeConversationId) ?? null;
  })
);

/**
 * Get conversations sorted by last update
 */
export const selectConversationsByUpdate = memoizeArray<
  ConversationState,
  ConversationWithStats
>(
  trackSelector('conversationsByUpdate', (state) => {
    return Array.from(state.conversations.values())
      .filter((c: ConversationWithStats) => !c.archived)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  })
);

/**
 * Get recent conversations (last 10)
 */
export const selectRecentConversations = memoizeArray<
  ConversationState,
  ConversationWithStats
>(
  trackSelector('recentConversations', (state) => {
    return Array.from(state.conversations.values())
      .filter((c: ConversationWithStats) => !c.archived)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 10);
  })
);

/**
 * Get conversations filtered by model tier
 */
export const selectConversationsByTier = (tier: 'haiku' | 'sonnet' | 'opus') =>
  memoizeArray<ConversationState, ConversationWithStats>(
    trackSelector(`conversationsByTier:${tier}`, (state) =>
      Array.from(state.conversations.values()).filter(
        (c: ConversationWithStats) => c.modelTier === tier && !c.archived
      )
    )
  );

/**
 * Get total conversation statistics
 */
export const selectConversationStats = memoize<
  ConversationState,
  {
    total: number;
    active: number;
    archived: number;
    pinned: number;
    totalCost: number;
    totalTokens: number;
  }
>(
  trackSelector('conversationStats', (state) => {
    const allConversations = Array.from(state.conversations.values());
    return {
      total: allConversations.length,
      active: allConversations.filter((c: ConversationWithStats) => !c.archived)
        .length,
      archived: allConversations.filter(
        (c: ConversationWithStats) => c.archived
      ).length,
      pinned: allConversations.filter((c: ConversationWithStats) => c.pinned)
        .length,
      totalCost: allConversations.reduce(
        (sum: number, c: ConversationWithStats) => sum + c.totalCost,
        0
      ),
      totalTokens: allConversations.reduce(
        (sum: number, c: ConversationWithStats) => sum + c.totalTokens,
        0
      ),
    };
  })
);

/**
 * Check if loading
 */
export const selectIsLoading = memoize<ConversationState, boolean>(
  (state) => state.isLoading
);

/**
 * Get error
 */
export const selectError = memoize<ConversationState, string | null>(
  (state) => state.error
);

/**
 * Get current filters
 */
export const selectFilters = memoize<
  ConversationState,
  ConversationState['filters']
>((state) => state.filters);
