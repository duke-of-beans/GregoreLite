/**
 * Thread Tabs Store — Sprint S9-01
 *
 * Per-tab state isolation for multi-thread support. Each tab holds its own
 * messages, conversationId, ghost context, and artifact state independently.
 * ChatInterface reads from the active tab entry instead of local useState.
 *
 * Persistence: tab layout saved to KERNL settings table. Messages recovered
 * from KERNL threads on reload via restoreTabMessages().
 */

import { create } from 'zustand';
import type { MessageProps, MessageBlock } from '@/components/chat/Message';
import type { Artifact } from '@/lib/artifacts/types';
import type { GhostContextActive } from './ghost-store';
import {
  saveTabLayout,
  loadTabLayout,
  restoreTabMessages,
  type PersistedTabLayout,
} from '@/lib/kernl/thread-tabs';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ThreadTab {
  id: string;
  kernlThreadId: string;
  title: string;
  messages: MessageProps[];
  conversationId: string | null;
  ghostContextActive: GhostContextActive | null;
  artifact: Artifact | null;
  /** True while this tab's messages are being restored from KERNL */
  restoring: boolean;
}

interface ThreadTabsState {
  tabs: ThreadTab[];
  activeTabId: string | null;
  /** True during initial layout load from KERNL */
  initializing: boolean;
}

interface ThreadTabsActions {
  /** Initialize tabs from KERNL persisted layout or create default */
  initialize: () => Promise<void>;
  /** Create a new tab with the given title. Returns the new tab. */
  createTab: (title?: string) => Promise<ThreadTab>;
  /** Close a tab by ID. Switches to nearest tab if active. */
  closeTab: (tabId: string) => void;
  /** Switch active tab */
  setActiveTab: (tabId: string) => void;
  /** Rename a tab */
  renameTab: (tabId: string, title: string) => void;
  /** Update messages for a specific tab */
  setTabMessages: (tabId: string, messages: MessageProps[]) => void;
  /** Append a message to a specific tab */
  appendMessage: (tabId: string, message: MessageProps) => void;
  /** Set conversationId for a tab (after first chat API response) */
  setTabConversationId: (tabId: string, conversationId: string) => void;
  /** Set ghost context active for a tab */
  setTabGhostContext: (tabId: string, ctx: GhostContextActive | null) => void;
  /** Set artifact for a tab */
  setTabArtifact: (tabId: string, artifact: Artifact | null) => void;
  /** Update streaming message content and optional blocks (in progress) */
  updateStreamingMessage: (tabId: string, content: string, blocks?: MessageBlock[]) => void;
  /** Finalize streaming message with metadata */
  finalizeStreamingMessage: (tabId: string, content: string, meta: {
    model?: string; tokens?: number; costUsd?: number; latencyMs?: number;
  }, blocks?: MessageBlock[]) => void;
  /** Get the currently active tab (convenience) */
  getActiveTab: () => ThreadTab | null;
  /** Persist current layout to KERNL */
  persistLayout: () => void;
}

export type ThreadTabsStore = ThreadTabsState & ThreadTabsActions;

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TABS = 8;
const WARN_TABS = 6;

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function generateThreadId(): string {
  return `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useThreadTabsStore = create<ThreadTabsStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  initializing: true,

  initialize: async () => {
    const layout = await loadTabLayout();

    if (layout && layout.tabs.length > 0) {
      // Restore from KERNL
      const tabs: ThreadTab[] = layout.tabs.map((pt) => ({
        id: pt.id,
        kernlThreadId: pt.kernlThreadId,
        title: pt.title,
        messages: [],
        conversationId: pt.conversationId,
        ghostContextActive: null,
        artifact: null,
        restoring: true,
      }));

      set({ tabs, activeTabId: layout.activeTabId, initializing: false });

      // Restore messages for each tab in background
      for (const tab of tabs) {
        restoreTabMessages(tab.kernlThreadId).then((msgs) => {
          const restored: MessageProps[] = msgs.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp),
          }));
          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.id === tab.id ? { ...t, messages: restored, restoring: false } : t
            ),
          }));
        });
      }
    } else {
      // First boot — create default Strategic tab
      const tab: ThreadTab = {
        id: generateTabId(),
        kernlThreadId: generateThreadId(),
        title: 'Strategic',
        messages: [],
        conversationId: null,
        ghostContextActive: null,
        artifact: null,
        restoring: false,
      };
      set({ tabs: [tab], activeTabId: tab.id, initializing: false });
      get().persistLayout();
    }
  },

  createTab: async (title?: string) => {
    const state = get();
    if (state.tabs.length >= MAX_TABS) {
      console.warn(`[thread-tabs] Max tabs (${MAX_TABS}) reached`);
      const fallback = state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0];
      if (!fallback) throw new Error('[thread-tabs] No tabs exist at MAX_TABS — impossible state');
      return fallback;
    }

    if (state.tabs.length >= WARN_TABS) {
      console.info(`[thread-tabs] ${state.tabs.length}/${MAX_TABS} tabs open`);
    }

    const tab: ThreadTab = {
      id: generateTabId(),
      kernlThreadId: generateThreadId(),
      title: title ?? `Thread ${state.tabs.length + 1}`,
      messages: [],
      conversationId: null,
      ghostContextActive: null,
      artifact: null,
      restoring: false,
    };

    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }));

    get().persistLayout();
    return tab;
  },

  closeTab: (tabId: string) => {
    const state = get();
    if (state.tabs.length <= 1) return; // Don't close last tab

    const idx = state.tabs.findIndex((t) => t.id === tabId);
    const newTabs = state.tabs.filter((t) => t.id !== tabId);

    let newActiveId = state.activeTabId;
    if (state.activeTabId === tabId) {
      // Switch to nearest tab
      const newIdx = Math.min(idx, newTabs.length - 1);
      newActiveId = newTabs[newIdx]?.id ?? newTabs[0]?.id ?? null;
    }

    set({ tabs: newTabs, activeTabId: newActiveId });
    get().persistLayout();
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId });
    get().persistLayout();
  },

  renameTab: (tabId: string, title: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
    }));
    get().persistLayout();
  },

  setTabMessages: (tabId: string, messages: MessageProps[]) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, messages } : t)),
    }));
  },

  appendMessage: (tabId: string, message: MessageProps) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, messages: [...t.messages, message] } : t
      ),
    }));
  },

  setTabConversationId: (tabId: string, conversationId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, conversationId } : t
      ),
    }));
    get().persistLayout();
  },

  setTabGhostContext: (tabId: string, ctx: GhostContextActive | null) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, ghostContextActive: ctx } : t
      ),
    }));
  },

  setTabArtifact: (tabId: string, artifact: Artifact | null) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, artifact } : t
      ),
    }));
  },

  updateStreamingMessage: (tabId: string, content: string, blocks?: MessageBlock[]) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab || tab.messages.length === 0) return state;
      const messages = [...tab.messages];
      const lastIdx = messages.length - 1;
      messages[lastIdx] = { ...messages[lastIdx]!, content, isStreaming: true, ...(blocks && { blocks }) };
      return {
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, messages } : t
        ),
      };
    });
  },

  finalizeStreamingMessage: (tabId: string, content: string, meta: {
    model?: string;
    tokens?: number;
    costUsd?: number;
    latencyMs?: number;
  }, blocks?: MessageBlock[]) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab || tab.messages.length === 0) return state;
      const messages = [...tab.messages];
      const lastIdx = messages.length - 1;
      messages[lastIdx] = {
        ...messages[lastIdx]!,
        content,
        isStreaming: false,
        model: meta.model,
        tokens: meta.tokens,
        costUsd: meta.costUsd,
        latencyMs: meta.latencyMs,
        ...(blocks && { blocks }),
      };
      return {
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, messages } : t
        ),
      };
    });
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId) ?? null;
  },

  persistLayout: () => {
    const { tabs, activeTabId } = get();
    const layout: PersistedTabLayout = {
      tabs: tabs.map((t) => ({
        id: t.id,
        kernlThreadId: t.kernlThreadId,
        conversationId: t.conversationId,
        title: t.title,
      })),
      activeTabId: activeTabId ?? tabs[0]?.id ?? '',
    };
    void saveTabLayout(layout);
  },
}));

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectActiveTab = (state: ThreadTabsStore) =>
  state.tabs.find((t) => t.id === state.activeTabId) ?? null;

// ── Stable selectors for individual active-tab fields ─────────────────────
// These return primitives or referentially-stable defaults so Zustand's
// Object.is equality check doesn't see a "new" value on every call.
//
// CRITICAL: fallback values MUST be module-level constants, NOT inline
// literals like `?? []` which create a new reference every call.
//
// We cache the last result per-selector so that getServerSnapshot returns
// the same reference as getSnapshot (React 18+ requirement for
// useSyncExternalStore). Without this, Next.js SSR triggers:
// "The result of getServerSnapshot should be cached to avoid an infinite loop"

const EMPTY_MESSAGES: MessageProps[] = [];

function makeStableSelector<T>(extract: (tab: ThreadTab) => T, fallback: T) {
  let lastActiveTabId: string | null | undefined;
  let lastTabs: ThreadTab[] | undefined;
  let lastResult: T = fallback;

  return (state: ThreadTabsStore): T => {
    // Fast path: if tabs array ref AND activeTabId haven't changed, return cached
    if (state.tabs === lastTabs && state.activeTabId === lastActiveTabId) {
      return lastResult;
    }
    lastTabs = state.tabs;
    lastActiveTabId = state.activeTabId;

    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    const result = tab ? extract(tab) : fallback;
    lastResult = result;
    return result;
  };
}

export const selectActiveTabId = makeStableSelector<string | null>((t) => t.id, null);
export const selectActiveTabMessages = makeStableSelector<MessageProps[]>((t) => t.messages, EMPTY_MESSAGES);
export const selectActiveTabConversationId = makeStableSelector<string | null>((t) => t.conversationId, null);
export const selectActiveTabArtifact = makeStableSelector<Artifact | null>((t) => t.artifact, null);
export const selectActiveTabGhostContext = makeStableSelector<GhostContextActive | null>((t) => t.ghostContextActive, null);
export const selectActiveTabRestoring = makeStableSelector<boolean>((t) => t.restoring, false);
export const selectActiveTabKernlThreadId = makeStableSelector<string | null>((t) => t.kernlThreadId, null);

export const selectTabCount = (state: ThreadTabsStore) => state.tabs.length;

export const selectIsAtTabLimit = (state: ThreadTabsStore) =>
  state.tabs.length >= MAX_TABS;

export const selectIsNearTabLimit = (state: ThreadTabsStore) =>
  state.tabs.length >= WARN_TABS;
