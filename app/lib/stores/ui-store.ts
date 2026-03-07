/**
 * UIStore - Interface State Management
 *
 * Manages ephemeral UI state:
 * - Sidebar state (open/closed, width)
 * - Theme preferences
 * - Modal/dialog state
 * - Command palette
 * - Notifications
 *
 * Part of Phase 1.3 - State Management
 * References: BUILD_PLAN.md checkpoint 1.3.4
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { StateCreator } from 'zustand';

// ============================================================================
// TYPES
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';

/** Receipt footer display preference (Sprint 17.0) */
export type ReceiptDetail = 'full' | 'compact' | 'minimal' | 'hidden';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string | undefined;
  duration?: number | undefined; // ms, undefined = persistent
  timestamp: number;
  dismissed: boolean;
  escalate?: boolean | undefined; // S9-15: when true, fires native OS toast via tray-bridge
}

export interface SidebarState {
  open: boolean;
  width: number;
  collapsed: boolean;
}

export interface ModalState {
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
}

export interface CommandPaletteState {
  open: boolean;
  query: string;
  recentCommands: string[];
}

// ============================================================================
// STORE STATE
// ============================================================================

export interface UIState {
  // Sidebar
  sidebar: SidebarState;

  // Theme
  theme: ThemeMode;

  // Modals/Dialogs
  modal: ModalState;

  // Command Palette
  commandPalette: CommandPaletteState;

  // Notifications
  notifications: Notification[];

  // Loading states
  loading: {
    global: boolean;
    areas: Record<string, boolean>;
  };

  // Focus management
  focusedElement: string | null;

  // Settings panel
  settingsOpen: boolean;

  // Sprint 15.0: Collapse tool/thinking blocks by default
  defaultCollapseToolBlocks: boolean;

  // Transit Map Z3 annotations toggle (default OFF — must be opted in)
  showTransitMetadata: boolean;

  // Sprint 17.0: Receipt footer display preference
  receiptDetail: ReceiptDetail;

  // Sprint 17.0: Orchestration Theater — true after first 5 messages, preference set
  orchestrationTheaterComplete: boolean;

  // Sprint 17.0: Total assistant messages received (lifetime, across conversations)
  theaterMessageCount: number;

  // Sprint 18.0: Memory Shimmer — show cyan glow on words matching KERNL memory
  shimmerEnabled: boolean;

  // Sprint 29.0: Quick Capture Pad — global floating hotkey input
  capturePadOpen: boolean;

  // Sprint 30.0: Status bar collapse (persisted)
  statusBarCollapsed: boolean;
}

// ============================================================================
// STORE ACTIONS
// ============================================================================

export interface UIActions {
  // Sidebar actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebarCollapsed: () => void;

  // Theme actions
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;

  // Modal actions
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  isModalOpen: (modalId: string) => boolean;

  // Command palette actions
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  setCommandQuery: (query: string) => void;
  addRecentCommand: (command: string) => void;

  // Notification actions
  addNotification: (
    notification: Omit<Notification, 'id' | 'timestamp' | 'dismissed'>
  ) => string;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  clearDismissedNotifications: () => void;

  // Loading actions
  setGlobalLoading: (loading: boolean) => void;
  setAreaLoading: (area: string, loading: boolean) => void;
  clearAreaLoading: (area: string) => void;

  // Focus management
  setFocusedElement: (elementId: string | null) => void;

  // Settings panel
  toggleSettings: () => void;
  setSettingsOpen: (open: boolean) => void;

  // Sprint 15.0: Collapse tool blocks preference
  setDefaultCollapseToolBlocks: (collapse: boolean) => void;
  toggleDefaultCollapseToolBlocks: () => void;

  // Transit Map Z3 annotations
  toggleTransitMetadata: () => void;
  setShowTransitMetadata: (show: boolean) => void;

  // Sprint 17.0: Receipt detail preference
  setReceiptDetail: (detail: ReceiptDetail) => void;

  // Sprint 17.0: Orchestration Theater completion
  setOrchestrationTheaterComplete: (complete: boolean) => void;

  // Sprint 17.0: Increment theater message count
  incrementTheaterMessageCount: () => void;

  // Sprint 18.0: Memory Shimmer toggle
  setShimmerEnabled: (enabled: boolean) => void;
  toggleShimmerEnabled: () => void;

  // Sprint 29.0: Quick Capture Pad
  openCapturePad: () => void;
  closeCapturePad: () => void;
  toggleCapturePad: () => void;

  // Sprint 30.0: Status bar collapse
  setStatusBarCollapsed: (collapsed: boolean) => void;
  toggleStatusBar: () => void;

  // Reset
  resetUI: () => void;
}

export type UIStore = UIState & UIActions;

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: UIState = {
  sidebar: {
    open: true,
    width: 280,
    collapsed: false,
  },

  theme: 'system',

  modal: {
    activeModal: null,
    modalData: null,
  },

  commandPalette: {
    open: false,
    query: '',
    recentCommands: [],
  },

  notifications: [],

  loading: {
    global: false,
    areas: {},
  },

  focusedElement: null,

  settingsOpen: false,
  defaultCollapseToolBlocks: false,
  showTransitMetadata: false,
  receiptDetail: 'compact',
  orchestrationTheaterComplete: false,
  theaterMessageCount: 0,
  shimmerEnabled: true,

  // Sprint 29.0
  capturePadOpen: false,

  // Sprint 30.0
  statusBarCollapsed: false,
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

const createUISlice: StateCreator<UIStore> = (set, get) => ({
  ...initialState,

  // ========================================================================
  // SIDEBAR ACTIONS
  // ========================================================================

  toggleSidebar: () => {
    set((state) => ({
      sidebar: {
        ...state.sidebar,
        open: !state.sidebar.open,
      },
    }));
  },

  setSidebarOpen: (open: boolean) => {
    set((state) => ({
      sidebar: {
        ...state.sidebar,
        open,
      },
    }));
  },

  setSidebarWidth: (width: number) => {
    // Clamp width between 200-600px
    const clampedWidth = Math.max(200, Math.min(600, width));

    set((state) => ({
      sidebar: {
        ...state.sidebar,
        width: clampedWidth,
      },
    }));
  },

  toggleSidebarCollapsed: () => {
    set((state) => ({
      sidebar: {
        ...state.sidebar,
        collapsed: !state.sidebar.collapsed,
      },
    }));
  },

  // ========================================================================
  // THEME ACTIONS
  // ========================================================================

  setTheme: (theme: ThemeMode) => {
    set({ theme });
  },

  toggleTheme: () => {
    const current = get().theme;

    // Cycle: system → light → dark → system
    const next: ThemeMode =
      current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';

    set({ theme: next });
  },

  // ========================================================================
  // MODAL ACTIONS
  // ========================================================================

  openModal: (modalId: string, data?: Record<string, unknown>) => {
    set({
      modal: {
        activeModal: modalId,
        modalData: data || null,
      },
    });
  },

  closeModal: () => {
    set({
      modal: {
        activeModal: null,
        modalData: null,
      },
    });
  },

  isModalOpen: (modalId: string) => {
    return get().modal.activeModal === modalId;
  },

  // ========================================================================
  // COMMAND PALETTE ACTIONS
  // ========================================================================

  openCommandPalette: () => {
    set((state) => ({
      commandPalette: {
        ...state.commandPalette,
        open: true,
        query: '', // Clear query on open
      },
    }));
  },

  closeCommandPalette: () => {
    set((state) => ({
      commandPalette: {
        ...state.commandPalette,
        open: false,
      },
    }));
  },

  toggleCommandPalette: () => {
    set((state) => ({
      commandPalette: {
        ...state.commandPalette,
        open: !state.commandPalette.open,
        query: !state.commandPalette.open ? '' : state.commandPalette.query,
      },
    }));
  },

  setCommandQuery: (query: string) => {
    set((state) => ({
      commandPalette: {
        ...state.commandPalette,
        query,
      },
    }));
  },

  addRecentCommand: (command: string) => {
    set((state) => {
      const recent = state.commandPalette.recentCommands;

      // Remove if already exists (move to front)
      const filtered = recent.filter((cmd) => cmd !== command);

      // Add to front, limit to 10 recent commands
      const updated = [command, ...filtered].slice(0, 10);

      return {
        commandPalette: {
          ...state.commandPalette,
          recentCommands: updated,
        },
      };
    });
  },

  // ========================================================================
  // NOTIFICATION ACTIONS
  // ========================================================================

  addNotification: (notification) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      dismissed: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications],
    }));

    // Auto-dismiss if duration specified
    if (notification.duration) {
      setTimeout(() => {
        get().dismissNotification(id);
      }, notification.duration);
    }

    return id;
  },

  dismissNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.map((notif) =>
        notif.id === id ? { ...notif, dismissed: true } : notif
      ),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },

  clearDismissedNotifications: () => {
    set((state) => ({
      notifications: state.notifications.filter((notif) => !notif.dismissed),
    }));
  },

  // ========================================================================
  // LOADING ACTIONS
  // ========================================================================

  setGlobalLoading: (loading: boolean) => {
    set((state) => ({
      loading: {
        ...state.loading,
        global: loading,
      },
    }));
  },

  setAreaLoading: (area: string, loading: boolean) => {
    set((state) => ({
      loading: {
        ...state.loading,
        areas: {
          ...state.loading.areas,
          [area]: loading,
        },
      },
    }));
  },

  clearAreaLoading: (area: string) => {
    set((state) => {
      const { [area]: _, ...rest } = state.loading.areas;
      return {
        loading: {
          ...state.loading,
          areas: rest,
        },
      };
    });
  },

  // ========================================================================
  // FOCUS MANAGEMENT
  // ========================================================================

  setFocusedElement: (elementId: string | null) => {
    set({ focusedElement: elementId });
  },

  // ========================================================================
  // SETTINGS PANEL
  // ========================================================================

  toggleSettings: () => {
    set((state) => ({ settingsOpen: !state.settingsOpen }));
  },

  setSettingsOpen: (open: boolean) => {
    set({ settingsOpen: open });
  },

  // ========================================================================
  // SPRINT 15.0: COLLAPSE TOOL BLOCKS PREFERENCE
  // ========================================================================

  setDefaultCollapseToolBlocks: (collapse: boolean) => {
    set({ defaultCollapseToolBlocks: collapse });
  },

  toggleDefaultCollapseToolBlocks: () => {
    set((state) => ({ defaultCollapseToolBlocks: !state.defaultCollapseToolBlocks }));
  },

  // ========================================================================
  // TRANSIT MAP ANNOTATIONS
  // ========================================================================

  toggleTransitMetadata: () => {
    set((state) => ({ showTransitMetadata: !state.showTransitMetadata }));
  },

  setShowTransitMetadata: (show: boolean) => {
    set({ showTransitMetadata: show });
  },

  // ========================================================================
  // SPRINT 17.0: RECEIPT DETAIL + ORCHESTRATION THEATER
  // ========================================================================

  setReceiptDetail: (detail: ReceiptDetail) => {
    set({ receiptDetail: detail });
  },

  setOrchestrationTheaterComplete: (complete: boolean) => {
    set({ orchestrationTheaterComplete: complete });
  },

  incrementTheaterMessageCount: () => {
    set((state) => ({ theaterMessageCount: state.theaterMessageCount + 1 }));
  },

  // ========================================================================
  // SPRINT 18.0: MEMORY SHIMMER
  // ========================================================================

  setShimmerEnabled: (enabled: boolean) => {
    set({ shimmerEnabled: enabled });
  },

  toggleShimmerEnabled: () => {
    set((state) => ({ shimmerEnabled: !state.shimmerEnabled }));
  },

  // ========================================================================
  // SPRINT 29.0: QUICK CAPTURE PAD
  // ========================================================================

  openCapturePad: () => {
    set({ capturePadOpen: true });
  },

  closeCapturePad: () => {
    set({ capturePadOpen: false });
  },

  toggleCapturePad: () => {
    set((state) => ({ capturePadOpen: !state.capturePadOpen }));
  },

  // ========================================================================
  // SPRINT 30.0: STATUS BAR COLLAPSE
  // ========================================================================

  setStatusBarCollapsed: (collapsed: boolean) => {
    set({ statusBarCollapsed: collapsed });
  },

  toggleStatusBar: () => {
    set((state) => ({ statusBarCollapsed: !state.statusBarCollapsed }));
  },

  // ========================================================================
  // RESET
  // ========================================================================

  resetUI: () => {
    set(initialState);
  },
});

// ============================================================================
// STORE CREATION
// ============================================================================

export const useUIStore = create<UIStore>()(
  devtools(
    persist(createUISlice, {
      name: 'gregore-ui-storage',

      // Only persist certain fields
      partialize: (state) => ({
        sidebar: state.sidebar,
        theme: state.theme,
        defaultCollapseToolBlocks: state.defaultCollapseToolBlocks,
        receiptDetail: state.receiptDetail,
        orchestrationTheaterComplete: state.orchestrationTheaterComplete,
        theaterMessageCount: state.theaterMessageCount,
        shimmerEnabled: state.shimmerEnabled,
        commandPalette: {
          // Don't persist open state or query
          open: false,
          query: '',
          recentCommands: state.commandPalette.recentCommands,
        },
        statusBarCollapsed: state.statusBarCollapsed,
        // Don't persist notifications, modals, loading states, or focus
      }),
    }),
    { name: 'UIStore' }
  )
);

// ============================================================================
// SELECTORS (for optimized component subscriptions)
// ============================================================================

export const selectSidebarOpen = (state: UIStore) => state.sidebar.open;
export const selectSidebarWidth = (state: UIStore) => state.sidebar.width;
export const selectSidebarCollapsed = (state: UIStore) =>
  state.sidebar.collapsed;

export const selectTheme = (state: UIStore) => state.theme;

export const selectActiveModal = (state: UIStore) => state.modal.activeModal;
export const selectModalData = (state: UIStore) => state.modal.modalData;

export const selectCommandPaletteOpen = (state: UIStore) =>
  state.commandPalette.open;
export const selectCommandQuery = (state: UIStore) =>
  state.commandPalette.query;
export const selectRecentCommands = (state: UIStore) =>
  state.commandPalette.recentCommands;

export const selectActiveNotifications = (state: UIStore) =>
  state.notifications.filter((n) => !n.dismissed);

export const selectGlobalLoading = (state: UIStore) => state.loading.global;
export const selectAreaLoading = (area: string) => (state: UIStore) =>
  state.loading.areas[area] || false;

export const selectFocusedElement = (state: UIStore) => state.focusedElement;

export const selectCapturePadOpen = (state: UIStore) => state.capturePadOpen;

// ============================================================================
// HOOKS (convenience wrappers)
// ============================================================================

export const useTheme = () => useUIStore(selectTheme);
export const useSidebar = () => useUIStore((state) => state.sidebar);
export const useNotifications = () => useUIStore(selectActiveNotifications);
export const useGlobalLoading = () => useUIStore(selectGlobalLoading);
