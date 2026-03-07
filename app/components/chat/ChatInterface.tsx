/**
 * ChatInterface Component — Sprint S9-01 update
 *
 * Multi-thread tabs: per-tab state isolation via thread-tabs-store.
 * Messages, conversationId, ghost context, and artifact are all per-tab.
 * Tab navigation: [★ Strategic] [⚙ Workers] [🗺 War Room]
 * Thread tab bar appears below main tabs when multiple strategic threads open.
 *
 * Cmd+W toggles War Room. Cmd+N creates new thread tab.
 *
 * Layout: 2-panel (thread only) ↔ 3-panel (thread + artifact) — CSS animated.
 * After each assistant response, runs artifact detection. If an artifact is
 * found it is written to the active tab's state and synced to KERNL.
 */

'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { MessageSquare, Cpu, LayoutGrid, GitBranch, FolderKanban } from 'lucide-react';
import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard';
import { Header } from '../ui/Header';
import { MessageList } from './MessageList';
import { InputField } from './InputField';
import { ShimmerOverlay } from './ShimmerOverlay';
import { MemoryCard } from './MemoryCard';
import { SendButton, type SendButtonState } from './SendButton';
import { useShimmerMatches } from '@/lib/hooks/useShimmerMatches';
import type { ShimmerMatch } from '@/lib/memory/shimmer-query';
import { ArtifactPanel } from '../artifacts/ArtifactPanel';
import { JobQueue } from '../jobs/JobQueue';
import { WarRoom } from '../war-room';
import type { MessageProps } from './Message';
import { detectArtifact } from '@/lib/artifacts/detector';
import { syncArtifact } from '@/lib/artifacts/kernl-sync';
import { useDecisionGateStore } from '@/lib/stores/decision-gate-store';
import { GatePanel } from '@/components/decision-gate';
import { useGhostStore } from '@/lib/stores/ghost-store';
import {
  useThreadTabsStore,
  selectActiveTabId,
  selectActiveTabMessages,
  selectActiveTabConversationId,
  selectActiveTabArtifact,
  selectActiveTabGhostContext,
  selectActiveTabRestoring,
} from '@/lib/stores/thread-tabs-store';

import { ThreadTabBar } from './ThreadTabBar';
import { CommandPalette } from '../ui/CommandPalette';
import { StatusBar } from '../ui/StatusBar';
import { MorningBriefing } from '../morning-briefing/MorningBriefing';
import { registerBuiltins } from '@/lib/command-registry/commands';
import { ThreadSearch, type SearchMatch } from './ThreadSearch';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { InspectorDrawer } from '../inspector/InspectorDrawer';
import { startTrayBridge, stopTrayBridge } from '@/lib/notifications/tray-bridge';
import { DecisionBrowser } from '../decisions/DecisionBrowser';
import { ArtifactLibrary } from '../artifacts/ArtifactLibrary';
import { CaptureInbox } from '@/components/capture/CaptureInbox';
import { generateTitle } from '@/lib/chat/auto-title';
import { captureClientEvent } from '@/lib/transit/client';
import { useDensityStore } from '@/lib/stores/density-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { SubwayMap } from '@/components/transit/SubwayMap';
import { SankeyView } from '@/components/transit/SankeyView';
import { ZoomController, ZoomIndicator } from '@/components/transit/ZoomController';
// ZoomLevel type used internally by ZoomController render props
import type { SankeyNode } from '@/lib/transit/sankey';
import type { EnrichedEvent } from '@/lib/transit/types';
import type { Station } from '@/lib/transit/types';
import type { ProcessingEvent } from './ProcessingStatus';
import type { MessageBlock } from './Message';

type ActiveTab = 'portfolio' | 'strategic' | 'workers' | 'warroom' | 'transit';

interface TabDef {
  id: ActiveTab;
  label: string;
  icon: ReactNode;
  tooltip: string;
  shortcut?: string;
}

const TABS: TabDef[] = [
  {
    id: 'portfolio',
    label: 'Projects',
    icon: <FolderKanban className="h-4 w-4" />,
    tooltip: 'Portfolio command center — all your projects in one view',
  },
  {
    id: 'strategic',
    label: 'Strategic',
    icon: <MessageSquare className="h-4 w-4" />,
    tooltip: 'Your main conversation with Greg',
  },
  {
    id: 'workers',
    label: 'Workers',
    icon: <Cpu className="h-4 w-4" />,
    tooltip: 'Automated background tasks — code generation, testing, research',
  },
  {
    id: 'warroom',
    label: 'Task Board',
    icon: <LayoutGrid className="h-4 w-4" />,
    tooltip: 'Visual status of all running and queued worker tasks',
    shortcut: 'Cmd+W',
  },
  {
    id: 'transit',
    label: 'Map',
    icon: <GitBranch className="h-4 w-4" />,
    tooltip: 'Visual timeline of your conversation\'s key moments',
    shortcut: 'Cmd+T',
  },
];

export function ChatInterface() {
  const [input, setInput] = useState('');
  const [sendButtonState, setSendButtonState] = useState<SendButtonState>('normal');
  const [activeTab, setActiveTab] = useState<ActiveTab>('strategic');
  const [showBriefing, setShowBriefing] = useState(false);

  // ── S9-12: Chat history panel state ─────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── S9-13: Settings panel state (lifted to ui-store for Header gear icon — Sprint 10.8)
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);

  // ── Transit Map Z3 annotations toggle (Sprint 11.4)
  const showTransitMetadata = useUIStore((s) => s.showTransitMetadata);

  // ── Transit Map Z2 events — fetched once here, shared with SubwayMap + MessageList
  // Single source of truth: no double-fetch between SubwayMap and MessageList.
  const [transitEvents, setTransitEvents] = useState<EnrichedEvent[]>([]);
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const [scrollToIndex, setScrollToIndex] = useState<number | undefined>(undefined);

  const handleStationClick = (station: Station) => {
    setScrollToIndex(station.messageIndex);
    setActiveStationId(station.id);
  };

  const handleActiveIndexChange = (index: number) => {
    // No-op placeholder — activeStationId could be updated here
    // using nearest-station lookup once UX is validated
    void index;
  };

  // ── S9-14: Inspector drawer state ─────────────────────────────────────────
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // ── S9-16: Decision Browser state ──────────────────────────────────────────
  const [decisionsOpen, setDecisionsOpen] = useState(false);

  // ── S9-17: Artifact Library state ─────────────────────────────────────────
  const [artifactLibraryOpen, setArtifactLibraryOpen] = useState(false);
  const [captureInboxOpen, setCaptureInboxOpen] = useState(false);

  // ── In-thread search state (S9-08) ─────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);

  // ── SSE streaming state (Sprint 10.6) ───────────────────────────────────
  const abortControllerRef = useRef<AbortController | null>(null);
  const [_isStreaming, setIsStreaming] = useState(false);
  const [_processingEvents, setProcessingEvents] = useState<ProcessingEvent[]>([]);

  // Thread tabs store — per-tab state (stable individual selectors to prevent render loops)
  const activeTabId = useThreadTabsStore(selectActiveTabId);
  const activeMessages = useThreadTabsStore(selectActiveTabMessages);
  const activeConversationId = useThreadTabsStore(selectActiveTabConversationId);
  const activeArtifact = useThreadTabsStore(selectActiveTabArtifact);
  const activeGhostContext = useThreadTabsStore(selectActiveTabGhostContext);
  const activeRestoring = useThreadTabsStore(selectActiveTabRestoring);
  const initializeTabs = useThreadTabsStore((s) => s.initialize);
  const tabInitializing = useThreadTabsStore((s) => s.initializing);
  const appendMessage = useThreadTabsStore((s) => s.appendMessage);
  const setTabConversationId = useThreadTabsStore((s) => s.setTabConversationId);
  const setTabGhostContext = useThreadTabsStore((s) => s.setTabGhostContext);
  const setTabArtifact = useThreadTabsStore((s) => s.setTabArtifact);
  const setTabMessages = useThreadTabsStore((s) => s.setTabMessages);
  const createTab = useThreadTabsStore((s) => s.createTab);
  const renameTab = useThreadTabsStore((s) => s.renameTab);
  const updateStreamingMessage = useThreadTabsStore((s) => s.updateStreamingMessage);
  const finalizeStreamingMessage = useThreadTabsStore((s) => s.finalizeStreamingMessage);

  const gateTrigger = useDecisionGateStore((s) => s.trigger);
  const setActiveThreadId = useGhostStore((s) => s.setActiveThreadId);

  // ── Sprint 18.0: Memory Shimmer ───────────────────────────────────────────
  const shimmerEnabled = useUIStore((s) => s.shimmerEnabled);
  const [activeMemoryCard, setActiveMemoryCard] = useState<{
    match: ShimmerMatch;
    position: { x: number; y: number };
  } | null>(null);
  const shimmerMatches = useShimmerMatches(input, activeConversationId ?? '', shimmerEnabled);

  // Sync ghost store's activeThreadId when thread tab changes
  useEffect(() => {
    if (activeConversationId) {
      setActiveThreadId(activeConversationId);
    }
  }, [activeConversationId, setActiveThreadId]);

  // Sprint 17.0 Task 6+8: Sync gate trigger → send button state
  // When gate fires, button transitions to 'warning'; clearing gate returns to 'normal'
  useEffect(() => {
    if (gateTrigger) {
      // Mandatory gate (3+ dismissals) → veto; otherwise → warning
      setSendButtonState('warning');
    } else {
      // Only reset to normal if not currently streaming or checking
      setSendButtonState((prev: SendButtonState) =>
        prev === 'warning' || prev === 'veto' ? 'normal' : prev
      );
    }
  }, [gateTrigger]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 'w') {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'warroom' ? 'strategic' : 'warroom'));
      }
      if (meta && e.key === 'n') {
        e.preventDefault();
        void createTab();
        setActiveTab('strategic');
      }
      // Cmd+F — open in-thread search (only in strategic tab; portfolio has no search)
      if (meta && e.key === 'f') {
        e.preventDefault();
        if (activeTab === 'strategic') {
          setSearchOpen(true);
        }
      }
      // Cmd+[ — open chat history panel (S9-12)
      if (meta && e.key === '[') {
        e.preventDefault();
        setHistoryOpen((prev) => !prev);
      }
      // Cmd+, — open settings panel (S9-13)
      if (meta && e.key === ',') {
        e.preventDefault();
        useUIStore.getState().toggleSettings();
      }
      // Cmd+I — open inspector drawer (S9-14)
      if (meta && e.key === 'i') {
        e.preventDefault();
        setInspectorOpen((prev) => !prev);
      }
      // Cmd+D — open decision browser (S9-16)
      if (meta && e.key === 'd') {
        e.preventDefault();
        setDecisionsOpen((prev) => !prev);
      }
      // Cmd+L — open artifact library (S9-17)
      if (meta && e.key === 'l') {
        e.preventDefault();
        setArtifactLibraryOpen((prev) => !prev);
      }
      // Cmd+E — edit last user message (S9-20)
      if (meta && e.key === 'e') {
        e.preventDefault();
        handleEditLastMessage();
      }
      // Cmd+R — regenerate last assistant response (S9-20)
      if (meta && e.key === 'r') {
        e.preventDefault();
        handleRegenerate();
      }
      // Cmd+Shift+= — increase density (more compact)
      if (meta && e.shiftKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        useDensityStore.getState().cycleDensity('up');
      }
      // Cmd+Shift+- — decrease density (more spacious)
      if (meta && e.shiftKey && e.key === '-') {
        e.preventDefault();
        useDensityStore.getState().cycleDensity('down');
      }
      // Cmd+Shift+M — toggle Transit Map Z3 annotation layer
      if (meta && e.shiftKey && e.key === 'm') {
        e.preventDefault();
        useUIStore.getState().toggleTransitMetadata();
      }
      // Cmd+T — switch to Transit tab
      if (meta && !e.shiftKey && e.key === 't') {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'transit' ? 'strategic' : 'transit'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [createTab, activeTab]);

  // ── Boot sequence ────────────────────────────────────────────────────────
  useEffect(() => {
    // Fire bootstrap non-blocking
    void fetch('/api/bootstrap', { method: 'POST' }).then((res) => {
      if (!res.ok) console.warn('[boot] Bootstrap returned', res.status);
      else res.json().then((d) => console.log('[boot] Bootstrap complete', d?.data?.coldStartMs + 'ms')).catch(() => null);
    }).catch((err) => console.warn('[boot] Bootstrap fetch failed:', err));

    // Initialize thread tabs from KERNL
    void initializeTabs();

    // Register command palette built-in commands
    registerBuiltins();

    // Check if morning briefing should show
    void fetch('/api/morning-briefing')
      .then((res) => res.json())
      .then((body) => {
        if (body.data && !body.data.alreadyShown) {
          setShowBriefing(true);
        }
      })
      .catch(() => null);

    // S9-15: Start tray bridge (native notifications + badge)
    startTrayBridge();
    return () => { stopTrayBridge(); };
  }, [initializeTabs]);

  // ── S9-12: Load a conversation from history into a new tab ──────────────
  const handleLoadThread = useCallback(async (conversationId: string) => {
    // If current tab has no messages, reuse it; otherwise create a new tab
    const currentTab = useThreadTabsStore.getState().getActiveTab();
    let targetTabId: string;

    if (currentTab && currentTab.messages.length === 0 && !currentTab.conversationId) {
      targetTabId = currentTab.id;
    } else {
      const newTab = await createTab('Loaded Thread');
      targetTabId = newTab.id;
    }

    // Set conversation ID on the tab
    setTabConversationId(targetTabId, conversationId);

    // Fetch conversation detail (includes messages) and populate the tab
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (res.ok) {
        const body = await res.json() as {
          data?: {
            messages?: Array<{ id: string; role: string; content: string; createdAt: string; model?: string; tokens?: number; cost?: number }>;
          };
        };
        if (body.data?.messages) {
          const msgs: MessageProps[] = body.data.messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.createdAt),
          }));
          setTabMessages(targetTabId, msgs);
        }
      }
    } catch (err) {
      console.warn('[chat-history] Failed to load messages:', err);
    }

    setActiveTab('strategic');
  }, [createTab, setTabConversationId, setTabMessages]);

  // ── Listen for ContextPanel custom events (Sprint 10.6D) ──────────────
  useEffect(() => {
    const handleLoadThreadEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.conversationId) {
        void handleLoadThread(detail.conversationId);
      }
    };
    const handleOpenHistoryEvent = () => {
      setHistoryOpen(true);
    };
    // Sprint 10.9 Task 7: logo click creates a new thread tab
    const handleNewThreadEvent = () => {
      void createTab();
      setActiveTab('strategic');
    };
    // Sprint 10.9 Task 12: StatusBar job count click switches to workers tab
    const handleSwitchTabEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ tab: ActiveTab }>).detail;
      if (detail?.tab) setActiveTab(detail.tab);
    };
    // Sprint 29.0 — open capture inbox from command palette / tray
    const handleOpenCaptureInboxEvent = () => setCaptureInboxOpen(true);

    window.addEventListener('greglite:load-thread', handleLoadThreadEvent);
    window.addEventListener('greglite:open-history', handleOpenHistoryEvent);
    window.addEventListener('greglite:new-thread', handleNewThreadEvent);
    window.addEventListener('greglite:switch-tab', handleSwitchTabEvent);
    document.addEventListener('greglite:open-capture-inbox', handleOpenCaptureInboxEvent);
    return () => {
      window.removeEventListener('greglite:load-thread', handleLoadThreadEvent);
      window.removeEventListener('greglite:open-history', handleOpenHistoryEvent);
      window.removeEventListener('greglite:new-thread', handleNewThreadEvent);
      window.removeEventListener('greglite:switch-tab', handleSwitchTabEvent);
      document.removeEventListener('greglite:open-capture-inbox', handleOpenCaptureInboxEvent);
    };
  }, [handleLoadThread, createTab]);

  // ── S9-20: Edit last message — restore to input, truncate from that point ──
  const handleEditMessage = useCallback((messageIndex: number) => {
    if (!activeTabId) return;
    const msg = activeMessages[messageIndex];
    if (!msg || msg.role !== 'user') return;

    // Restore content to input
    setInput(msg.content);

    // Remove this message and everything after it from the tab
    const truncated = activeMessages.slice(0, messageIndex);
    setTabMessages(activeTabId, truncated);

    // Truncate from KERNL asynchronously (best-effort)
    if (activeConversationId) {
      void fetch(`/api/threads/${activeConversationId}/truncate-after/${encodeURIComponent('__from_index_' + messageIndex)}`, {
        method: 'DELETE',
      }).catch(() => null);
    }

    // Transit Map: quality.edit_resend — fire-and-forget, never blocks UI
    if (activeConversationId) {
      captureClientEvent({
        conversation_id: activeConversationId,
        event_type: 'quality.edit_resend',
        category: 'quality',
        payload: { message_index: messageIndex },
      });
    }
  }, [activeTabId, activeMessages, activeConversationId, setTabMessages]);

  const handleEditLastMessage = useCallback(() => {
    if (!activeTabId) return;
    for (let i = activeMessages.length - 1; i >= 0; i--) {
      if (activeMessages[i]?.role === 'user') {
        handleEditMessage(i);
        return;
      }
    }
  }, [activeTabId, activeMessages, handleEditMessage]);

  const handleRegenerate = useCallback(() => {
    if (!activeTabId) return;
    // Find last assistant message and last user message before it
    let lastAssistantIdx = -1;
    let lastUserContent = '';
    for (let i = activeMessages.length - 1; i >= 0; i--) {
      if (lastAssistantIdx === -1 && activeMessages[i]?.role === 'assistant') {
        lastAssistantIdx = i;
      }
      if (lastAssistantIdx !== -1 && activeMessages[i]?.role === 'user') {
        lastUserContent = activeMessages[i]?.content ?? '';
        break;
      }
    }
    if (lastAssistantIdx === -1 || !lastUserContent) return;

    // Remove last assistant message
    const truncated = activeMessages.slice(0, lastAssistantIdx);
    setTabMessages(activeTabId, truncated);

    // Transit Map: quality.regeneration — fire-and-forget, never blocks UI
    const regenConvId = useThreadTabsStore.getState().getActiveTab()?.conversationId;
    if (regenConvId) {
      captureClientEvent({
        conversation_id: regenConvId,
        event_type: 'quality.regeneration',
        category: 'quality',
        payload: {},
      });
    }

    // Re-send the last user message
    setInput(lastUserContent);
    // Auto-submit after a tick so input state updates
    setTimeout(() => {
      const submitBtn = document.querySelector<HTMLButtonElement>('[data-send-button]');
      submitBtn?.click();
    }, 50);
  }, [activeTabId, activeMessages, setTabMessages]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      // Transit Map: quality.interruption — fire-and-forget, never blocks UI
      const convId = useThreadTabsStore.getState().getActiveTab()?.conversationId;
      if (convId) {
        captureClientEvent({
          conversation_id: convId,
          event_type: 'quality.interruption',
          category: 'quality',
          payload: {},
        });
      }
    }
  }, []);

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || !activeTabId) return;

    const messageText = input;
    const tabId = activeTabId;
    const conversationId = activeConversationId;

    setInput('');
    setTabGhostContext(tabId, null);

    const userMessage: MessageProps = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    appendMessage(tabId, userMessage);
    setSendButtonState('checking');

    let fullContent = '';

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          ...(conversationId && { conversationId }),
        }),
        signal: controller.signal,
      });

      if (response.status === 423) {
        const data = await response.json() as { error: string; reason?: string };
        const errorMessage: MessageProps = {
          role: 'assistant',
          content: `⚠ Decision Gate active — ${data.reason ?? 'approve or dismiss the gate before continuing'}`,
          timestamp: new Date(),
        };
        appendMessage(tabId, errorMessage);
        setSendButtonState('normal');
        setIsStreaming(false);
        abortControllerRef.current = null;
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // ── SSE Stream Consumer ───────────────────────────────────────────
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamConversationId = conversationId;
      let sseBuffer = '';

      // Block-based content tracking
      let blocks: MessageBlock[] = [];
      let currentTextBlock = '';

      // Add empty streaming message placeholder
      const streamingMsg: MessageProps = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      appendMessage(tabId, streamingMsg);
      setSendButtonState('streaming');
      setIsStreaming(true);
      setProcessingEvents([]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });

        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'meta' && event.conversationId) {
              streamConversationId = event.conversationId;
              if (!conversationId) {
                setTabConversationId(tabId, event.conversationId);
                setActiveThreadId(event.conversationId);

                const newConvId = event.conversationId;
                void generateTitle(messageText).then((title) => {
                  if (title && title !== 'Untitled') {
                    renameTab(tabId, title);
                    void fetch(`/api/conversations/${newConvId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title }),
                    }).catch(() => null);
                  }
                });
              }
            }

            if (event.type === 'text_delta') {
              // Clear processing events when text starts flowing
              setProcessingEvents([]);
              currentTextBlock += event.text;
              fullContent += event.text;
              const displayBlocks = [...blocks, { type: 'text' as const, content: currentTextBlock }];
              updateStreamingMessage(tabId, fullContent, displayBlocks);
            }

            if (event.type === 'thinking') {
              setProcessingEvents(prev => [...prev, { type: 'thinking', startTime: Date.now() }]);
              if (currentTextBlock) {
                blocks.push({ type: 'text', content: currentTextBlock });
                currentTextBlock = '';
              }
              blocks.push({ type: 'thinking', content: event.thinking, metadata: {} });
            }

            if (event.type === 'tool_use') {
              setProcessingEvents(prev => [...prev, { type: 'tool_use', name: event.name, startTime: Date.now() }]);
              if (currentTextBlock) {
                blocks.push({ type: 'text', content: currentTextBlock });
                currentTextBlock = '';
              }
              blocks.push({
                type: 'tool_use',
                content: JSON.stringify(event.input, null, 2),
                metadata: { name: event.name },
              });
            }

            if (event.type === 'done') {
              setProcessingEvents([]);
              // Flush remaining text block
              if (currentTextBlock) {
                blocks.push({ type: 'text', content: currentTextBlock });
                currentTextBlock = '';
              }
              finalizeStreamingMessage(tabId, fullContent, {
                model: event.model,
                tokens: event.usage?.totalTokens,
                costUsd: event.costUsd,
                latencyMs: event.latencyMs,
              }, blocks.length > 0 ? blocks : undefined);
              // Sprint 17.0 Task 5: Orchestration Theater — increment lifetime message count
              if (!useUIStore.getState().orchestrationTheaterComplete) {
                useUIStore.getState().incrementTheaterMessageCount();
              }

              const artifact = detectArtifact(fullContent);
              if (artifact) {
                artifact.threadId = streamConversationId ?? '';
                setTabArtifact(tabId, artifact);
                void syncArtifact(artifact, streamConversationId ?? '');

                // Transit Map: cognitive.artifact_generated — fire-and-forget
                if (streamConversationId) {
                  captureClientEvent({
                    conversation_id: streamConversationId,
                    event_type: 'cognitive.artifact_generated',
                    category: 'cognitive',
                    payload: {
                      artifact_type: artifact.type,
                      language: artifact.language,
                      line_count: artifact.content.split('\n').length,
                      was_opened_in_panel: true,
                    },
                  });
                }
              }
            }

            if (event.type === 'error') {
              setProcessingEvents([]);
              updateStreamingMessage(tabId, `Error: ${event.error}`);
              finalizeStreamingMessage(tabId, `Error: ${event.error}`, {});
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }

      setIsStreaming(false);
      abortControllerRef.current = null;
      setSendButtonState('approved');
      setTimeout(() => setSendButtonState('normal'), 1500);
    } catch (error) {
      setIsStreaming(false);
      abortControllerRef.current = null;
      setProcessingEvents([]);

      if (error instanceof DOMException && error.name === 'AbortError') {
        // User stopped generation — keep partial content
        if (fullContent) {
          finalizeStreamingMessage(tabId, fullContent, {});
        }
        setSendButtonState('normal');
        return;
      }

      const errorMessage: MessageProps = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      appendMessage(tabId, errorMessage);
      setSendButtonState('normal');
    }
  }, [input, activeTabId, activeConversationId, appendMessage, setTabConversationId,
      setActiveThreadId, setTabGhostContext, setTabArtifact, renameTab,
      updateStreamingMessage, finalizeStreamingMessage]);

  // ── Search callbacks (S9-08) ──────────────────────────────────────────────
  const handleSearchChange = useCallback(
    (query: string, matches: SearchMatch[], activeIdx: number) => {
      setSearchQuery(query);
      setSearchMatches(matches);
      setActiveMatchIdx(activeIdx);
    },
    [],
  );

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchMatches([]);
    setActiveMatchIdx(0);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  const messages = activeMessages;

  // ── Transit Map Z2 — fetch events once, share with SubwayMap + MessageList ──
  // Placed after store selectors so activeConversationId and messages are in scope.
  useEffect(() => {
    if (!activeConversationId) { setTransitEvents([]); return; }
    let cancelled = false;
    void fetch(`/api/transit/events?conversationId=${encodeURIComponent(activeConversationId)}`)
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((data: { events: EnrichedEvent[] }) => {
        if (!cancelled) setTransitEvents(data.events ?? []);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [activeConversationId, messages.length]);

  const ghostContextActive = activeGhostContext;
  const restoring = tabInitializing || activeRestoring;
  const panelOpen = activeArtifact !== null && activeTab === 'strategic';

  const clearArtifact = () => {
    if (activeTabId) setTabArtifact(activeTabId, null);
  };

  const clearGhostContext = () => {
    if (activeTabId) setTabGhostContext(activeTabId, null);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-[var(--deep-space)]">
      <Header />
      <CommandPalette />

      {/* ── Morning Briefing (shows on first cold start of the day) ── */}
      {showBriefing && (
        <MorningBriefing onDismiss={() => setShowBriefing(false)} />
      )}

      {/* ── Main tab bar ── */}
      <div className="flex items-center border-b border-[var(--shadow)] bg-[var(--elevated)] px-4 flex-shrink-0">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                active
                  ? 'border-[var(--cyan)] text-[var(--ice-white)] active'
                  : 'border-transparent text-[var(--mist)] hover:text-[var(--frost)]',
              ].join(' ')}
              aria-selected={active}
              role="tab"
              title={tab.shortcut ? `${tab.tooltip} (${tab.shortcut})` : tab.tooltip}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span className="hidden lg:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Body: sidebar + content area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Tab content (War Room / Workers / Strategic) ── */}
        <div className="flex flex-1 overflow-hidden">

        {/* ── Portfolio tab — standalone dashboard, no input/messages ── */}
        {activeTab === 'portfolio' && (
          <div className="flex flex-1 overflow-hidden">
            <PortfolioDashboard />
          </div>
        )}

        {/* ── War Room ── */}
        {activeTab === 'warroom' && (
          <div className="flex flex-1 overflow-hidden">
            <WarRoom />
          </div>
        )}

        {/* ── Transit tab — ZoomController wraps Z1 Sankey / Z2 Subway / Z3 Messages ── */}
        {activeTab === 'transit' && (
          <ZoomController shortcutsActive={activeTab === 'transit'}>
            {({ zoomLevel, setZoomLevel, zoomToSegment, focusIndex: zoomFocusIndex, isTransitioning, previousZoom }) => (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Zoom indicator bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 12px',
                  borderBottom: '1px solid var(--shadow)',
                  background: 'var(--elevated)',
                  flexShrink: 0,
                  fontSize: 11,
                  color: 'var(--mist)',
                }}>
                  <ZoomIndicator zoomLevel={zoomLevel} onSetZoom={setZoomLevel} />
                  <span style={{ opacity: 0.5 }}>
                    {zoomLevel === 'Z1' ? 'Topology' : zoomLevel === 'Z2' ? 'Route' : 'Detail'}
                  </span>
                </div>

                {/* Z1: Sankey view — full conversation topology */}
                {(zoomLevel === 'Z1' || previousZoom === 'Z1') && (
                  <div style={{
                    flex: zoomLevel === 'Z1' ? '0 0 30%' : 0,
                    minHeight: zoomLevel === 'Z1' ? 160 : 0,
                    borderBottom: '1px solid var(--shadow)',
                    overflow: 'hidden',
                    opacity: zoomLevel === 'Z1' ? 1 : 0,
                    transition: `opacity ${300}ms ease-in-out`,
                  }}>
                    <SankeyView
                      events={transitEvents}
                      totalMessages={messages.length}
                      onSegmentClick={(node: SankeyNode) => {
                        setScrollToIndex(node.messageIndexStart);
                        zoomToSegment(node.messageIndexStart);
                      }}
                    />
                  </div>
                )}

                {/* Z2: Subway map — route with named stations */}
                {(zoomLevel === 'Z2' || previousZoom === 'Z2' || zoomLevel === 'Z1') && (
                  <div style={{
                    flex: zoomLevel === 'Z2' ? '0 0 25%' : zoomLevel === 'Z1' ? '0 0 20%' : 0,
                    minHeight: zoomLevel === 'Z2' || zoomLevel === 'Z1' ? 140 : 0,
                    borderBottom: '1px solid var(--shadow)',
                    overflow: 'hidden',
                    opacity: zoomLevel === 'Z2' || zoomLevel === 'Z1' ? 1 : 0,
                    transition: `opacity ${300}ms ease-in-out`,
                  }}>
                    <SubwayMap
                      conversationId={activeConversationId ?? undefined}
                      events={transitEvents}
                      totalMessages={messages.length}
                      activeStationId={activeStationId}
                      onStationClick={handleStationClick}
                      onMarkerClick={() => { /* EventDetailPanel handles via MessageList */ }}
                    />
                  </div>
                )}

                {/* Messages — fills remaining space, transit metadata always on */}
                <div
                  className="flex-1 overflow-hidden flex flex-col min-h-0"
                  data-transit-messages
                  style={{
                    opacity: isTransitioning ? 0.7 : 1,
                    transition: `opacity ${300}ms ease-in-out`,
                  }}
                >
                  <MessageList
                    messages={messages}
                    conversationId={activeConversationId ?? undefined}
                    showTransitMetadata={true}
                    events={transitEvents}
                    scrollToIndex={zoomFocusIndex ?? scrollToIndex}
                    onActiveIndexChange={handleActiveIndexChange}
                    onEditMessage={handleEditMessage}
                    onRegenerate={handleRegenerate}
                    isWaitingForResponse={sendButtonState === 'checking'}
                  />
                </div>
              </div>
            )}
          </ZoomController>
        )}

        {/* ── Workers tab ── */}
        {activeTab === 'workers' && (
          <div className="flex flex-1 overflow-hidden">
            <JobQueue />
          </div>
        )}

        {/* ── Strategic thread column ── */}
        {activeTab === 'strategic' && (
          <>
            <div
              className={[
                'flex flex-col overflow-hidden transition-[width] duration-300 ease-in-out',
                panelOpen ? 'w-[60%]' : 'w-full',
              ].join(' ')}
            >
              {/* Thread tab bar — only when multiple tabs open */}
              <ThreadTabBar />

              {/* In-thread search bar (S9-08) — slides in below tab bar */}
              <ThreadSearch
                open={searchOpen}
                onClose={handleSearchClose}
                messages={messages}
                threadId={activeConversationId}
                onSearchChange={handleSearchChange}
              />

              {/* Message list — min-h-0 prevents flex child from overflowing (Sprint 10.8 Task 9) */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {restoring ? (
                  <div className="flex h-full items-center justify-center text-[var(--ghost-text)] text-sm">
                    Restoring session…
                  </div>
                ) : (
                  <MessageList
                    messages={messages}
                    conversationId={activeConversationId ?? undefined}
                    showTransitMetadata={showTransitMetadata}
                    highlightQuery={searchQuery || undefined}
                    searchMatches={searchMatches.length > 0 ? searchMatches : undefined}
                    activeMatchIdx={activeMatchIdx}
                    onEditMessage={handleEditMessage}
                    onRegenerate={handleRegenerate}
                    isWaitingForResponse={sendButtonState === 'checking'}
                  />
                )}
              </div>

              {/* Decision Gate panel — slides in above input, pushes it down */}
              {gateTrigger && (
                <GatePanel threadId={activeConversationId} trigger={gateTrigger} />
              )}

              {/* Input bar */}
              <div className="border-t border-[var(--shadow)] bg-[var(--deep-space)] px-6 py-4 flex-shrink-0">
                <div className="mx-auto max-w-4xl">
                  {/* Ghost context active indicator */}
                  {ghostContextActive && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '8px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: 'var(--ghost-card-bg, #1a1f2e)',
                        border: '1px solid var(--ghost-card-border, #2a3040)',
                      }}
                    >
                      <svg
                        width="10" height="10" viewBox="0 0 20 20" fill="currentColor"
                        style={{ color: 'var(--teal-400, #2dd4bf)', flexShrink: 0 }}
                        aria-hidden
                      >
                        <path d="M10 3C5 3 1.73 7.11 1.05 9.78a1 1 0 000 .44C1.73 12.89 5 17 10 17s8.27-4.11 8.95-6.78a1 1 0 000-.44C18.27 7.11 15 3 10 3zm0 11a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z" />
                      </svg>
                      <span style={{ fontSize: '10px', color: 'var(--teal-400, #2dd4bf)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Ghost context active — {ghostContextActive.source}
                      </span>
                      <button
                        onClick={clearGhostContext}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--mist, #888)', fontSize: '12px', lineHeight: 1, flexShrink: 0 }}
                        title="Dismiss Ghost context"
                        aria-label="Dismiss Ghost context"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <div className="flex items-end gap-3">
                    <div className={`flex-1${sendButtonState === 'checking' ? ' ghost-analyzing' : ''}`}>
                      <InputField
                        value={input}
                        onChange={setInput}
                        onSubmit={handleSubmit}
                        disabled={sendButtonState === 'checking' || restoring}
                        placeholder="Type message..."
                      >
                        {shimmerEnabled && shimmerMatches.length > 0 && (
                          <ShimmerOverlay
                            matches={shimmerMatches}
                            inputText={input}
                            onMatchClick={(match, e) => {
                              setActiveMemoryCard({
                                match,
                                position: { x: e.clientX, y: e.clientY },
                              });
                            }}
                          />
                        )}
                      </InputField>
                    </div>
                    <SendButton
                      state={sendButtonState}
                      onClick={handleSubmit}
                      onStop={handleStop}
                      disabled={!input.trim() || restoring}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Artifact panel (animated in/out) ── */}
            <div
              className={[
                'flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out',
                panelOpen ? 'w-[40%]' : 'w-0',
              ].join(' ')}
            >
              {activeArtifact && (
                <ArtifactPanel artifact={activeArtifact} onClose={clearArtifact} />
              )}
            </div>
          </>
        )}
        </div>{/* end tab content wrapper */}
      </div>{/* end body */}

      {/* S9-12: Chat History Panel */}
      <ChatHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onLoadThread={handleLoadThread}
      />

      {/* S9-13: Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* S9-14: Inspector Drawer */}
      <InspectorDrawer
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
      />

      {/* S9-16: Decision Browser */}
      <DecisionBrowser
        open={decisionsOpen}
        onClose={() => setDecisionsOpen(false)}
        onOpenThread={handleLoadThread}
      />

      {/* S9-17: Artifact Library */}
      <ArtifactLibrary
        open={artifactLibraryOpen}
        onClose={() => setArtifactLibraryOpen(false)}
        onSelectArtifact={(id) => {
          // TODO: Phase 10 — load artifact into active tab by ID
          console.log('[artifact-library] Selected artifact:', id);
          setArtifactLibraryOpen(false);
        }}
      />

      {/* Sprint 29.0: Capture Inbox */}
      <CaptureInbox
        open={captureInboxOpen}
        onClose={() => setCaptureInboxOpen(false)}
      />

      {/* Sprint 18.0: Memory Card popover */}
      {activeMemoryCard && (
        <MemoryCard
          match={activeMemoryCard.match}
          position={activeMemoryCard.position}
          onClose={() => setActiveMemoryCard(null)}
          onNavigate={(sourceId) => {
            void handleLoadThread(sourceId);
            setActiveMemoryCard(null);
          }}
        />
      )}

      <StatusBar />
    </div>
  );
}
