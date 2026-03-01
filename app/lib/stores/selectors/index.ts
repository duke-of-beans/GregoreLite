/**
 * Optimized Store Selectors
 *
 * Barrel export for all memoized, performance-monitored selectors.
 * Use these in React components to prevent unnecessary re-renders.
 *
 * @example
 * ```tsx
 * import { selectActiveConversations } from '@/lib/stores/selectors';
 * import { useConversationStore } from '@/lib/stores';
 *
 * function ConversationList() {
 *   // ✅ Good: Memoized selector
 *   const conversations = useConversationStore(selectActiveConversations);
 *
 *   // ❌ Bad: Inline selector (creates new reference on every render)
 *   const conversations = useConversationStore(state =>
 *     Array.from(state.conversations.values()).filter(c => !c.archived)
 *   );
 * }
 * ```
 */

// Conversation selectors
export {
  selectAllConversations,
  selectActiveConversations,
  selectPinnedConversations,
  selectConversationById,
  selectActiveConversationId,
  selectCurrentConversation,
  selectConversationsByUpdate,
  selectRecentConversations,
  selectConversationsByTier,
  selectConversationStats,
  selectFilters,
  selectIsLoading as selectConversationIsLoading,
  selectError as selectConversationError,
} from './conversation-selectors';

// Message selectors
export {
  selectMessagesByConversation,
  selectUserMessages,
  selectAssistantMessages,
  selectLastMessage,
  selectIsStreaming,
  selectStreamingConversationId,
  selectStreamBuffer,
  selectIsLoading as selectMessageIsLoading,
  selectError as selectMessageError,
  selectMessageStats,
  selectTokenStats,
} from './message-selectors';

// Performance utilities
export {
  getSelectorMetrics,
  clearSelectorMetrics,
  logSelectorMetrics,
} from '../performance';
