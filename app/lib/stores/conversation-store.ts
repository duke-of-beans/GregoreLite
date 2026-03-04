/**
 * Conversation Store
 *
 * Sophisticated Zustand store for conversation management.
 * Includes persistence, optimistic updates, caching, and error recovery.
 *
 * NOTE: All database operations go through API routes via conversation-client.
 * This keeps server-only modules (better-sqlite3, fs) out of the browser bundle.
 */

import { create } from 'zustand';
import {
  createConversation as apiCreate,
  getConversation as apiGet,
  updateTitle as apiUpdateTitle,
  archiveConversation as apiArchive,
  unarchiveConversation as apiUnarchive,
  pinConversation as apiPin,
  unpinConversation as apiUnpin,
  deleteConversation as apiDelete,
  listConversations as apiList,
  searchConversations as apiSearch,
  type ConversationWithStats,
  type PaginatedResult,
} from '../api/conversation-client';
import {
  saveToStorage,
  loadFromStorage,
  PersistOptions,
} from './middleware/persist';
import { connectDevtools, sendToDevtools } from './middleware/devtools';

/**
 * Conversation entity (re-exported for downstream consumers)
 */
export type { ConversationWithStats } from '../api/conversation-client';

export interface Conversation {
  id: string;
  title: string;
  model: string;
  modelTier: 'haiku' | 'sonnet' | 'opus';
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  pinned: boolean;
  totalTokens: number;
  totalCost: number;
}

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
}

/**
 * Store actions
 */
interface ConversationActions {
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
  loadConversations: (params?: {
    archived?: boolean;
    pinned?: boolean | null;
  }) => Promise<void>;
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
  // Devtools connection
  const devtools =
    typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
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

    // Create conversation
    createConversation: async (data) => {
      set({ isLoading: true, error: null });
      sendAction('createConversation/pending');

      try {
        const convWithStats = await apiCreate(data);

        set((state) => ({
          conversations: new Map(state.conversations).set(
            convWithStats.id,
            convWithStats
          ),
          activeConversationId: convWithStats.id,
          isLoading: false,
          listCache: null, // Invalidate cache
        }));

        get().persist();
        sendAction('createConversation/fulfilled');

        return {
          id: convWithStats.id,
          title: convWithStats.title,
          model: convWithStats.model,
          modelTier: convWithStats.modelTier,
          createdAt: convWithStats.createdAt,
          updatedAt: convWithStats.updatedAt,
          archived: convWithStats.archived,
          pinned: convWithStats.pinned,
          totalTokens: convWithStats.totalTokens,
          totalCost: convWithStats.totalCost,
        };
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
        const conv = await apiGet(id);

        set((state) => ({
          conversations: new Map(state.conversations).set(id, conv),
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
        await apiUpdateTitle(id, title);

        // Reload to get accurate stats
        try {
          const updated = await apiGet(id);
          set((state) => ({
            conversations: new Map(state.conversations).set(id, updated),
            listCache: null,
          }));
        } catch {
          // If reload fails, optimistic state is fine
          set({ listCache: null });
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
        await apiArchive(id);
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
        await apiUnarchive(id);
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
        await apiPin(id);
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
        await apiUnpin(id);
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
        await apiDelete(id);

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
        const result = await apiList({
          page: 1,
          pageSize: 50,
          archived: filters.archived,
          pinned: filters.pinned,
          ...params,
        });

        // Update conversations map
        const newConversations = new Map(get().conversations);
        result.items.forEach((conv) => {
          newConversations.set(conv.id, conv);
        });

        set({
          conversations: newConversations,
          listCache: result,
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
        const result = await apiList({
          page: listCache.page + 1,
          pageSize: listCache.pageSize,
          archived: filters.archived,
          pinned: filters.pinned,
        });

        // Merge with existing
        const newConversations = new Map(get().conversations);
        result.items.forEach((conv) => {
          newConversations.set(conv.id, conv);
        });

        set({
          conversations: newConversations,
          listCache: result,
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
        const result = await apiSearch({
          query,
          page: 1,
          pageSize: 50,
        });

        // Update cache
        const searchCache = new Map(get().searchCache);
        searchCache.set(query, result);

        // Update conversations map
        const newConversations = new Map(get().conversations);
        result.items.forEach((conv) => {
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
