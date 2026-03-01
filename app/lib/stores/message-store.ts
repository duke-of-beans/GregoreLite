/**
 * Message Store
 *
 * Sophisticated message state management with streaming support.
 * Handles real-time message updates, token tracking, and attachments.
 */

import { create } from 'zustand';
import {
  MessageRepository,
  Message,
  CreateMessageData,
  TokenStats,
} from '../repositories';
import { saveToStorage } from './middleware/persist';
import { connectDevtools, sendToDevtools } from './middleware/devtools';
import { PaginatedResult } from '../repositories/types';

/**
 * Message store state
 */
export interface MessageState {
  // Data by conversation
  messagesByConversation: Map<string, Message[]>;
  loadingStates: Map<string, boolean>;
  tokenStats: Map<string, TokenStats>;

  // Streaming state
  isStreaming: boolean;
  streamingConversationId: string | null;
  streamBuffer: Message | null;

  // Search
  searchResults: Map<string, PaginatedResult<Message>>;

  // UI state
  error: string | null;
}

/**
 * Message store actions
 */
interface MessageActions {
  // Repository
  repository: MessageRepository;

  // Load messages
  loadMessages: (conversationId: string) => Promise<void>;
  loadMessagesStream: (conversationId: string) => AsyncGenerator<void>;

  // Create messages
  createMessage: (
    conversationId: string,
    data: Omit<CreateMessageData, 'conversationId'>
  ) => Promise<Message | null>;
  createMessageOptimistic: (
    conversationId: string,
    data: Omit<CreateMessageData, 'conversationId'>
  ) => string; // Returns optimistic ID

  // Update messages
  updateTokens: (
    messageId: string,
    data: { inputTokens?: number; outputTokens?: number; cost?: number }
  ) => Promise<void>;

  // Streaming
  startStreaming: (conversationId: string) => void;
  updateStreamBuffer: (content: string) => void;
  finalizeStream: () => void;
  cancelStream: () => void;

  // Token statistics
  loadTokenStats: (conversationId: string) => Promise<void>;
  getTokenStats: (conversationId: string) => TokenStats | null;

  // Search
  searchMessages: (conversationId: string, query: string) => Promise<void>;

  // Export
  exportConversation: (conversationId: string) => Promise<{
    messages: Message[];
    stats: TokenStats;
  } | null>;

  // Utilities
  getMessages: (conversationId: string) => Message[];
  getLatestMessage: (conversationId: string) => Message | null;
  isLoading: (conversationId: string) => boolean;
  clearError: () => void;

  // Persistence
  persist: () => void;

  // Reset
  reset: () => void;
  clearConversation: (conversationId: string) => void;
}

/**
 * Store type
 */
type MessageStore = MessageState & MessageActions;

/**
 * Initial state
 */
const initialState: MessageState = {
  messagesByConversation: new Map(),
  loadingStates: new Map(),
  tokenStats: new Map(),
  isStreaming: false,
  streamingConversationId: null,
  streamBuffer: null,
  searchResults: new Map(),
  error: null,
};

/**
 * DevTools
 */
const devtools =
  process.env.NODE_ENV === 'development'
    ? connectDevtools('MessageStore')
    : null;

/**
 * Create message store
 */
export const useMessageStore = create<MessageStore>((set, get) => {
  const repository = new MessageRepository();

  const sendAction = (actionName: string) => {
    if (devtools) {
      sendToDevtools(devtools, actionName, get());
    }
  };

  if (devtools) {
    devtools.init(get());
  }

  return {
    ...initialState,
    repository,

    // Load messages for conversation
    loadMessages: async (conversationId) => {
      const loadingStates = new Map(get().loadingStates);
      loadingStates.set(conversationId, true);
      set({ loadingStates, error: null });
      sendAction('loadMessages/pending');

      try {
        const result = repository.findByConversation(conversationId, {
          limit: 100,
          offset: 0,
          order: 'asc',
        });

        if (!result.ok) {
          throw result.error;
        }

        const messagesByConversation = new Map(get().messagesByConversation);
        messagesByConversation.set(conversationId, result.value);

        loadingStates.set(conversationId, false);
        set({ messagesByConversation, loadingStates });
        sendAction('loadMessages/fulfilled');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to load messages';

        loadingStates.set(conversationId, false);
        set({ loadingStates, error: errorMessage });
        sendAction('loadMessages/rejected');
      }
    },

    // Stream messages (for large conversations)
    loadMessagesStream: async function* (conversationId) {
      const loadingStates = new Map(get().loadingStates);
      loadingStates.set(conversationId, true);
      set({ loadingStates });
      sendAction('loadMessagesStream/start');

      try {
        const streamResult = repository.streamMessages(conversationId, 50);

        if (!streamResult.ok) {
          throw streamResult.error;
        }

        const stream = streamResult.value;
        const allMessages: Message[] = [];

        for (const chunk of stream) {
          allMessages.push(...chunk.messages);

          // Update state with current chunk
          const messagesByConversation = new Map(get().messagesByConversation);
          messagesByConversation.set(conversationId, [...allMessages]);
          set({ messagesByConversation });
          sendAction('loadMessagesStream/chunk');

          yield; // Allow UI to update

          if (!chunk.hasMore) break;
        }

        loadingStates.set(conversationId, false);
        set({ loadingStates });
        sendAction('loadMessagesStream/complete');
      } catch (error) {
        loadingStates.set(conversationId, false);
        set({
          loadingStates,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to stream messages',
        });
        sendAction('loadMessagesStream/error');
      }
    },

    // Create message
    createMessage: async (conversationId, data) => {
      sendAction('createMessage/pending');

      try {
        const result = repository.createMessage({
          ...data,
          conversationId,
        });

        if (!result.ok) {
          throw result.error;
        }

        const message = result.value;

        // Add to conversation
        const messagesByConversation = new Map(get().messagesByConversation);
        const existing = messagesByConversation.get(conversationId) || [];
        messagesByConversation.set(conversationId, [...existing, message]);

        set({ messagesByConversation });
        sendAction('createMessage/fulfilled');
        get().persist();

        return message;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create message';
        set({ error: errorMessage });
        sendAction('createMessage/rejected');
        return null;
      }
    },

    // Create message with optimistic update
    createMessageOptimistic: (conversationId, data) => {
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        conversationId,
        role: data.role,
        content: data.content,
        model: data.model || null,
        inputTokens: data.inputTokens || null,
        outputTokens: data.outputTokens || null,
        cost: data.cost || null,
        createdAt: new Date(),
      };

      // Add optimistically
      const messagesByConversation = new Map(get().messagesByConversation);
      const existing = messagesByConversation.get(conversationId) || [];
      messagesByConversation.set(conversationId, [
        ...existing,
        optimisticMessage,
      ]);

      set({ messagesByConversation });
      sendAction('createMessageOptimistic');

      // Create for real in background
      get()
        .createMessage(conversationId, data)
        .then((realMessage) => {
          if (realMessage) {
            // Replace optimistic with real
            const msgs = get().messagesByConversation.get(conversationId) || [];
            const updated = msgs.map((m) =>
              m.id === optimisticId ? realMessage : m
            );
            const newMap = new Map(get().messagesByConversation);
            newMap.set(conversationId, updated);
            set({ messagesByConversation: newMap });
          }
        })
        .catch(() => {
          // Remove optimistic on error
          const msgs = get().messagesByConversation.get(conversationId) || [];
          const filtered = msgs.filter((m) => m.id !== optimisticId);
          const newMap = new Map(get().messagesByConversation);
          newMap.set(conversationId, filtered);
          set({ messagesByConversation: newMap });
        });

      return optimisticId;
    },

    // Update token counts
    updateTokens: async (messageId, data) => {
      sendAction('updateTokens/pending');

      try {
        const result = repository.updateTokens(messageId, data);

        if (!result.ok) {
          throw result.error;
        }

        const updatedMessage = result.value;

        // Update in state
        const messagesByConversation = new Map(get().messagesByConversation);
        for (const [convId, messages] of messagesByConversation.entries()) {
          const updated = messages.map((m) =>
            m.id === messageId ? updatedMessage : m
          );
          if (updated !== messages) {
            messagesByConversation.set(convId, updated);
          }
        }

        set({ messagesByConversation });
        sendAction('updateTokens/fulfilled');
      } catch (error) {
        sendAction('updateTokens/rejected');
        throw error;
      }
    },

    // Start streaming
    startStreaming: (conversationId) => {
      set({
        isStreaming: true,
        streamingConversationId: conversationId,
        streamBuffer: null,
      });
      sendAction('startStreaming');
    },

    // Update stream buffer
    updateStreamBuffer: (content) => {
      const { streamingConversationId } = get();
      if (!streamingConversationId) return;

      set({
        streamBuffer: {
          id: 'streaming',
          conversationId: streamingConversationId,
          role: 'assistant',
          content,
          model: null,
          inputTokens: null,
          outputTokens: null,
          cost: null,
          createdAt: new Date(),
        },
      });
      sendAction('updateStreamBuffer');
    },

    // Finalize stream
    finalizeStream: () => {
      const { streamBuffer, streamingConversationId } = get();
      if (!streamBuffer || !streamingConversationId) return;

      // Create actual message
      get().createMessage(streamingConversationId, {
        role: 'assistant',
        content: streamBuffer.content,
      });

      set({
        isStreaming: false,
        streamingConversationId: null,
        streamBuffer: null,
      });
      sendAction('finalizeStream');
    },

    // Cancel stream
    cancelStream: () => {
      set({
        isStreaming: false,
        streamingConversationId: null,
        streamBuffer: null,
      });
      sendAction('cancelStream');
    },

    // Load token statistics
    loadTokenStats: async (conversationId) => {
      sendAction('loadTokenStats/pending');

      try {
        const result = repository.getTokenStats(conversationId);

        if (!result.ok) {
          throw result.error;
        }

        const tokenStats = new Map(get().tokenStats);
        tokenStats.set(conversationId, result.value);

        set({ tokenStats });
        sendAction('loadTokenStats/fulfilled');
      } catch (error) {
        sendAction('loadTokenStats/rejected');
      }
    },

    // Get token statistics
    getTokenStats: (conversationId) => {
      return get().tokenStats.get(conversationId) || null;
    },

    // Search messages
    searchMessages: async (conversationId, query) => {
      sendAction('searchMessages/pending');

      try {
        const result = repository.searchMessages({
          conversationId,
          query,
          page: 1,
          pageSize: 50,
        });

        if (!result.ok) {
          throw result.error;
        }

        const searchResults = new Map(get().searchResults);
        searchResults.set(conversationId, result.value);

        set({ searchResults });
        sendAction('searchMessages/fulfilled');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Search failed';
        set({ error: errorMessage });
        sendAction('searchMessages/rejected');
      }
    },

    // Export conversation
    exportConversation: async (conversationId) => {
      sendAction('exportConversation/pending');

      try {
        const result = repository.exportConversation(conversationId);

        if (!result.ok) {
          throw result.error;
        }

        sendAction('exportConversation/fulfilled');
        return result.value;
      } catch (error) {
        sendAction('exportConversation/rejected');
        return null;
      }
    },

    // Get messages for conversation
    getMessages: (conversationId) => {
      const { messagesByConversation, streamBuffer, streamingConversationId } =
        get();

      const messages = messagesByConversation.get(conversationId) || [];

      // Include stream buffer if streaming this conversation
      if (streamingConversationId === conversationId && streamBuffer) {
        return [...messages, streamBuffer];
      }

      return messages;
    },

    // Get latest message
    getLatestMessage: (conversationId): Message | null => {
      const messages = get().getMessages(conversationId);
      if (messages.length === 0) return null;
      const lastMessage = messages[messages.length - 1];
      return lastMessage || null;
    },

    // Check loading state
    isLoading: (conversationId) => {
      return get().loadingStates.get(conversationId) || false;
    },

    // Clear error
    clearError: () => {
      set({ error: null });
      sendAction('clearError');
    },

    // Persist state
    persist: () => {
      // Only persist minimal state (not full message data)
      const state = get();
      saveToStorage(
        'gregore-messages',
        {
          // Don't persist full messages - they're loaded from DB
          tokenStats: Object.fromEntries(state.tokenStats),
        },
        {
          version: 1,
        }
      );
    },

    // Reset store
    reset: () => {
      set(initialState);
      sendAction('reset');
    },

    // Clear conversation data
    clearConversation: (conversationId) => {
      const messagesByConversation = new Map(get().messagesByConversation);
      const loadingStates = new Map(get().loadingStates);
      const tokenStats = new Map(get().tokenStats);

      messagesByConversation.delete(conversationId);
      loadingStates.delete(conversationId);
      tokenStats.delete(conversationId);

      set({ messagesByConversation, loadingStates, tokenStats });
      sendAction('clearConversation');
    },
  };
});
