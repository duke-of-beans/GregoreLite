/**
 * Conversation Store
 *
 * Sophisticated Zustand store for conversation management.
 * Includes persistence, optimistic updates, caching, and error recovery.
 */

import { create } from 'zustand';
import {
  ConversationRepository,
  Conversation,
  ConversationWithStats,
  ConversationListParams,
} from '../repositories';
import {
  saveToStorage,
  loadFromStorage,
  PersistOptions,
} from './middleware/persist';
import { connectDevtools, sendToDevtools } from './middleware/devtools';
import { createOptimisticManager } from './store-utils';
import { PaginatedResult } from '../repositories/types';

/**
 * Store state
 */
export interface ConversationState {
  // Data
  conversations: Map<string, ConversationWithStats>;
  activeConversationId: string | null;
  listCache: PaginatedResult<ConversationWithStats> | null;
  searchCache: Map<string, PaginatedResult<ConversationWithStats>>;

  // UI state
  isLoading: boolean;
  error: string | null;
  filters: {
    archived: boolean;
    pinned: boolean | null;
  };

  // Optimistic updates
  optimisticUpdates: ReturnType<typeof createOptimisticManager<Conversation>>;
}

/**
 * Store actions
 */
interface ConversationActions {
  // Repository instance
  repository: ConversationRepository;

  // Conversation operations
  createConversation: (data: {
    title: string;
    model: string;
    modelTier: 'haiku' | 'sonnet' | 'opus';
  }) => Promise<Conversation>;
  loadConversation: (id: string) => Promise<void>;
  updateTitle: (id: string, title: string) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;
  unarchiveConversation: (id: string) => Promise<void>;
  pinConversation: (id: string) => Promise<void>;
  unpinConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;

  // List operations
  loadConversations: (
    params?: Omit<ConversationListParams, 'page' | 'pageSize'>
  ) => Promise<void>;
  loadNextPage: () => Promise<void>;
  searchConversations: (query: string) => Promise<void>;

  // Active conversation
  setActiveConversation: (id: string | null) => void;
  getActiveConversation: () => ConversationWithStats | null;

  // Filters
  setFilters: (filters: Partial<ConversationState['filters']>) => void;
  toggleArchived: () => void;
  togglePinned: () => void;

  // Cache management
  invalidateCache: () => void;
  clearError: () => void;

  // Persistence
  hydrate: () => void;
  persist: () => void;

  // Reset
  reset: () => void;
}

/**
 * Store type
 */
type ConversationStore = ConversationState & ConversationActions;

/**
 * Initial state
 */
const initialState: ConversationState = {
  conversations: new Map(),
  activeConversationId: null,
  listCache: null,
  searchCache: new Map(),
  isLoading: false,
  error: null,
  filters: {
    archived: false,
    pinned: null,
  },
  optimisticUpdates: createOptimisticManager<Conversation>(),
};

/**
 * Persistence options
 */
const persistOptions: PersistOptions<ConversationState> = {
  name: 'gregore-conversations',
  version: 1,
  partialize: (state) => ({
    activeConversationId: state.activeConversationId,
    filters: state.filters,
  }),
};

/**
 * Create conversation store
 */
export const useConversationStore = create<ConversationStore>((set, get) => {
  // Repository instance
  const repository = new ConversationRepository();

  // Devtools connection
  const devtools =
    process.env.NODE_ENV === 'development'
      ? connectDevtools('ConversationStore')
      : null;

  // Helper to send action to devtools
  const sendAction = (actionName: string) => {
    if (devtools) {
      sendToDevtools(devtools, actionName, get());
    }
  };

  // Initialize devtools
  if (devtools) {
    devtools.init(get());
  }

  return {
    ...initialState,
    repository,

    // Create conversation
    createConversation: async (data) => {
      set({ isLoading: true, error: null });
      sendAction('createConversation/pending');

      try {
        const result = repository.createConversation(data);

        if (!result.ok) {
          throw result.error;
        }

        const conversation = result.value;

        // Load full stats
        const statsResult = repository.findByIdWithStats(conversation.id);
        if (statsResult.ok) {
          const convWithStats = statsResult.value;

          set((state) => ({
            conversations: new Map(state.conversations).set(
              conversation.id,
              convWithStats
            ),
            activeConversationId: conversation.id,
            isLoading: false,
            listCache: null, // Invalidate cache
          }));

          get().persist();
          sendAction('createConversation/fulfilled');
        }

        return conversation;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to create conversation';

        set({ isLoading: false, error: errorMessage });
        sendAction('createConversation/rejected');
        throw error;
      }
    },

    // Load conversation by ID
    loadConversation: async (id) => {
      // Check cache first
      const cached = get().conversations.get(id);
      if (cached) {
        set({ activeConversationId: id });
        sendAction('loadConversation/fromCache');
        return;
      }

      set({ isLoading: true, error: null });
      sendAction('loadConversation/pending');

      try {
        const result = repository.findByIdWithStats(id);

        if (!result.ok) {
          throw result.error;
        }

        set((state) => ({
          conversations: new Map(state.conversations).set(id, result.value),
          activeConversationId: id,
          isLoading: false,
        }));

        get().persist();
        sendAction('loadConversation/fulfilled');
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to load conversation';

        set({ isLoading: false, error: errorMessage });
        sendAction('loadConversation/rejected');
      }
    },

    // Update title
    updateTitle: async (id, title) => {
      // Optimistic update
      const current = get().conversations.get(id);
      if (current) {
        const optimisticConv = { ...current, title };
        set((state) => ({
          conversations: new Map(state.conversations).set(id, optimisticConv),
        }));
      }

      sendAction('updateTitle/pending');

      try {
        const result = repository.updateTitle(id, title);

        if (!result.ok) {
          throw result.error;
        }

        // Reload to get accurate stats
        const statsResult = repository.findByIdWithStats(id);
        if (statsResult.ok) {
          set((state) => ({
            conversations: new Map(state.conversations).set(
              id,
              statsResult.value
            ),
            listCache: null,
          }));
        }

        get().persist();
        sendAction('updateTitle/fulfilled');
      } catch (error) {
        // Rollback optimistic update
        if (current) {
          set((state) => ({
            conversations: new Map(state.conversations).set(id, current),
          }));
        }

        const errorMessage =
          error instanceof Error ? error.message : 'Failed to update title';
        set({ error: errorMessage });
        sendAction('updateTitle/rejected');
        throw error;
      }
    },

    // Archive conversation
    archiveConversation: async (id) => {
      const current = get().conversations.get(id);
      if (current) {
        set((state) => ({
          conversations: new Map(state.conversations).set(id, {
            ...current,
            archived: true,
          }),
        }));
      }

      sendAction('archiveConversation/pending');

      try {
        const result = repository.archive(id);
        if (!result.ok) throw result.error;

        set({ listCache: null });
        get().persist();
        sendAction('archiveConversation/fulfilled');
      } catch (error) {
        if (current) {
          set((state) => ({
            conversations: new Map(state.conversations).set(id, current),
          }));
        }
        sendAction('archiveConversation/rejected');
        throw error;
      }
    },

    // Unarchive conversation
    unarchiveConversation: async (id) => {
      const current = get().conversations.get(id);
      if (current) {
        set((state) => ({
          conversations: new Map(state.conversations).set(id, {
            ...current,
            archived: false,
          }),
        }));
      }

      sendAction('unarchiveConversation/pending');

      try {
        const result = repository.unarchive(id);
        if (!result.ok) throw result.error;

        set({ listCache: null });
        get().persist();
        sendAction('unarchiveConversation/fulfilled');
      } catch (error) {
        if (current) {
          set((state) => ({
            conversations: new Map(state.conversations).set(id, current),
          }));
        }
        sendAction('unarchiveConversation/rejected');
        throw error;
      }
    },

    // Pin conversation
    pinConversation: async (id) => {
      const current = get().conversations.get(id);
      if (current) {
        set((state) => ({
          conversations: new Map(state.conversations).set(id, {
            ...current,
            pinned: true,
          }),
        }));
      }

      sendAction('pinConversation/pending');

      try {
        const result = repository.pin(id);
        if (!result.ok) throw result.error;

        set({ listCache: null });
        get().persist();
        sendAction('pinConversation/fulfilled');
      } catch (error) {
        if (current) {
          set((state) => ({
            conversations: new Map(state.conversations).set(id, current),
          }));
        }
        sendAction('pinConversation/rejected');
        throw error;
      }
    },

    // Unpin conversation
    unpinConversation: async (id) => {
      const current = get().conversations.get(id);
      if (current) {
        set((state) => ({
          conversations: new Map(state.conversations).set(id, {
            ...current,
            pinned: false,
          }),
        }));
      }

      sendAction('unpinConversation/pending');

      try {
        const result = repository.unpin(id);
        if (!result.ok) throw result.error;

        set({ listCache: null });
        get().persist();
        sendAction('unpinConversation/fulfilled');
      } catch (error) {
        if (current) {
          set((state) => ({
            conversations: new Map(state.conversations).set(id, current),
          }));
        }
        sendAction('unpinConversation/rejected');
        throw error;
      }
    },

    // Delete conversation
    deleteConversation: async (id) => {
      sendAction('deleteConversation/pending');

      try {
        const result = repository.delete(id);
        if (!result.ok) throw result.error;

        set((state) => {
          const newConversations = new Map(state.conversations);
          newConversations.delete(id);

          return {
            conversations: newConversations,
            activeConversationId:
              state.activeConversationId === id
                ? null
                : state.activeConversationId,
            listCache: null,
          };
        });

        get().persist();
        sendAction('deleteConversation/fulfilled');
      } catch (error) {
        sendAction('deleteConversation/rejected');
        throw error;
      }
    },

    // Load conversations list
    loadConversations: async (params = {}) => {
      set({ isLoading: true, error: null });
      sendAction('loadConversations/pending');

      try {
        const { filters } = get();
        const listParams: ConversationListParams = {
          page: 1,
          pageSize: 50,
          archived: filters.archived,
          ...(params as Partial<ConversationListParams>),
        };

        if (filters.pinned !== null) {
          listParams.pinned = filters.pinned;
        }

        const result = repository.listConversations(listParams);

        if (!result.ok) {
          throw result.error;
        }

        // Update conversations map
        const newConversations = new Map(get().conversations);
        result.value.items.forEach((conv) => {
          newConversations.set(conv.id, conv);
        });

        set({
          conversations: newConversations,
          listCache: result.value,
          isLoading: false,
        });

        sendAction('loadConversations/fulfilled');
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to load conversations';

        set({ isLoading: false, error: errorMessage });
        sendAction('loadConversations/rejected');
      }
    },

    // Load next page
    loadNextPage: async () => {
      const { listCache, filters } = get();
      if (!listCache || !listCache.hasNext) return;

      set({ isLoading: true });
      sendAction('loadNextPage/pending');

      try {
        const listParams: ConversationListParams = {
          page: listCache.page + 1,
          pageSize: listCache.pageSize,
          archived: filters.archived,
        };

        if (filters.pinned !== null) {
          listParams.pinned = filters.pinned;
        }

        const result = repository.listConversations(listParams);

        if (!result.ok) throw result.error;

        // Merge with existing
        const newConversations = new Map(get().conversations);
        result.value.items.forEach((conv) => {
          newConversations.set(conv.id, conv);
        });

        set({
          conversations: newConversations,
          listCache: result.value,
          isLoading: false,
        });

        sendAction('loadNextPage/fulfilled');
      } catch (error) {
        set({ isLoading: false });
        sendAction('loadNextPage/rejected');
      }
    },

    // Search conversations
    searchConversations: async (query) => {
      set({ isLoading: true, error: null });
      sendAction('searchConversations/pending');

      try {
        const result = repository.searchConversations({
          query,
          page: 1,
          pageSize: 50,
        });

        if (!result.ok) throw result.error;

        // Update cache
        const searchCache = new Map(get().searchCache);
        searchCache.set(query, result.value);

        // Update conversations map
        const newConversations = new Map(get().conversations);
        result.value.items.forEach((conv) => {
          newConversations.set(conv.id, conv);
        });

        set({
          conversations: newConversations,
          searchCache,
          isLoading: false,
        });

        sendAction('searchConversations/fulfilled');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to search';

        set({ isLoading: false, error: errorMessage });
        sendAction('searchConversations/rejected');
      }
    },

    // Set active conversation
    setActiveConversation: (id) => {
      set({ activeConversationId: id });
      get().persist();
      sendAction('setActiveConversation');
    },

    // Get active conversation
    getActiveConversation: () => {
      const { activeConversationId, conversations } = get();
      if (!activeConversationId) return null;
      return conversations.get(activeConversationId) || null;
    },

    // Set filters
    setFilters: (filters) => {
      set((state) => ({
        filters: { ...state.filters, ...filters },
        listCache: null, // Invalidate cache
      }));
      get().persist();
      sendAction('setFilters');
    },

    // Toggle archived filter
    toggleArchived: () => {
      set((state) => ({
        filters: { ...state.filters, archived: !state.filters.archived },
        listCache: null,
      }));
      get().persist();
      sendAction('toggleArchived');
    },

    // Toggle pinned filter
    togglePinned: () => {
      set((state) => ({
        filters: {
          ...state.filters,
          pinned:
            state.filters.pinned === null
              ? true
              : state.filters.pinned
                ? false
                : null,
        },
        listCache: null,
      }));
      get().persist();
      sendAction('togglePinned');
    },

    // Invalidate cache
    invalidateCache: () => {
      set({ listCache: null, searchCache: new Map() });
      sendAction('invalidateCache');
    },

    // Clear error
    clearError: () => {
      set({ error: null });
      sendAction('clearError');
    },

    // Hydrate from storage
    hydrate: () => {
      const persisted = loadFromStorage<ConversationState>(
        persistOptions.name,
        persistOptions
      );

      if (persisted) {
        set({
          activeConversationId: persisted.activeConversationId ?? null,
          filters: persisted.filters || initialState.filters,
        });
        sendAction('hydrate');
      }
    },

    // Persist to storage
    persist: () => {
      saveToStorage(persistOptions.name, get(), persistOptions);
    },

    // Reset store
    reset: () => {
      set(initialState);
      sendAction('reset');
    },
  };
});

// Hydrate on initialization
if (typeof window !== 'undefined') {
  useConversationStore.getState().hydrate();
}
