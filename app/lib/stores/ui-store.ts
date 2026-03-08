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

  // Sprint 37.0: Settings panel active tab
  settingsActiveTab: string;

  // Sprint 38.0: Onboarding tour
  tourCompleted: boolean;  // persisted — never re-fires without explicit reset
  tourStep: number;        // session-only current step index (0-based)
  tourActive: boolean;     // session-only whether tour tooltip is visible
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

  // Sprint 37.0: Settings panel active tab
  setSettingsActiveTab: (tab: string) => void;

  // Sprint 38.0: Onboarding tour
  startTour: () => void;
  advanceTour: () => void;   // step++ or completeTour() if step >= 7
  skipTour: () => void;      // same as completeTour — marks done, hides tour
  completeTour: () => void;  // marks tourCompleted, clears tourActive
  resetTour: () => void;     // clears tourCompleted so tour fires again

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

  // Sprint 37.0: Settings active tab
  settingsActiveTab: 'appearance',

  // Sprint 38.0: Onboarding tour
  tourCompleted: false,
  tourStep: 0,
  tourActive: false,
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
  // SPRINT 37.0: SETTINGS ACTIVE TAB
  // ========================================================================

  setSettingsActiveTab: (tab: string) => {
    set({ settingsActiveTab: tab });
  },

  // ========================================================================
  // SPRINT 38.0: ONBOARDING TOUR
  // ========================================================================

  startTour: () => {
    set({ tourActive: true, tourStep: 0 });
  },

  advanceTour: () => {
    const { tourStep } = get();
    const TOTAL_STEPS = 8;
    if (tourStep >= TOTAL_STEPS - 1) {
      // Last step — complete tour
      set({ tourActive: false, tourCompleted: true, tourStep: 0 });
    } else {
      set({ tourStep: tourStep + 1 });
    }
  },

  skipTour: () => {
    set({ tourActive: false, tourCompleted: true, tourStep: 0 });
  },

  completeTour: () => {
    set({ tourActive: false, tourCompleted: true, tourStep: 0 });
  },

  resetTour: () => {
    set({ tourCompleted: false, tourActive: false, tourStep: 0 });
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
        // Sprint 37.0: settings active tab persists
        settingsActiveTab: state.settingsActiveTab,
        // Sprint 38.0: tourCompleted persists — never re-fires without explicit reset
        tourCompleted: state.tourCompleted,
        // Don't persist notifications, modals, loading states, tourStep, or tourActive
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

// Sprint 38.0: Tour selectors
export const selectTourCompleted = (state: UIStore) => state.tourCompleted;
export const selectTourActive = (state: UIStore) => state.tourActive;
export const selectTourStep = (state: UIStore) => state.tourStep;

// ============================================================================
// HOOKS (convenience wrappers)
// ============================================================================

export const useTheme = () => useUIStore(selectTheme);
export const useSidebar = () => useUIStore((state) => state.sidebar);
export const useNotifications = () => useUIStore(selectActiveNotifications);
export const useGlobalLoading = () => useUIStore(selectGlobalLoading);
