/**
 * Stores - Barrel Export
 *
 * Central export point for all Zustand stores.
 * Import stores from here to maintain clean dependency graph.
 *
 * Usage:
 *   import { useConversationStore, useMessageStore, useUIStore } from '@/lib/stores';
 */

// ============================================================================
// STORES
// ============================================================================

export { useConversationStore } from './conversation-store';
export { useMessageStore } from './message-store';
export { useUIStore } from './ui-store';
export {
  useSuggestionStore,
  selectSuggestionCount,
  selectSuggestions,
} from './suggestion-store';
export type { SuggestionStore } from './suggestion-store';

// ============================================================================
// UI STORE TYPES & SELECTORS
// ============================================================================

export type {
  UIState,
  UIActions,
  UIStore,
  ThemeMode,
  NotificationType,
  Notification,
  SidebarState,
  ModalState,
  CommandPaletteState,
} from './ui-store';

export {
  selectSidebarOpen,
  selectSidebarWidth,
  selectSidebarCollapsed,
  selectTheme,
  selectActiveModal,
  selectModalData,
  selectCommandPaletteOpen,
  selectCommandQuery,
  selectRecentCommands,
  selectActiveNotifications,
  selectGlobalLoading,
  selectAreaLoading,
  selectFocusedElement,
  useTheme,
  useSidebar,
  useNotifications,
  useGlobalLoading,
} from './ui-store';
