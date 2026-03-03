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

import { useState, useEffect, useCallback } from 'react';
import { Header } from '../ui/Header';
import { MessageList } from './MessageList';
import { InputField } from './InputField';
import { SendButton, type SendButtonState } from './SendButton';
import { ArtifactPanel } from '../artifacts/ArtifactPanel';
import { JobQueue } from '../jobs/JobQueue';
import { WarRoom } from '../war-room';
import type { MessageProps } from './Message';
import { detectArtifact } from '@/lib/artifacts/detector';
import { syncArtifact } from '@/lib/artifacts/kernl-sync';
import { useDecisionGateStore } from '@/lib/stores/decision-gate-store';
import { GatePanel } from '@/components/decision-gate';
import { useGhostStore } from '@/lib/stores/ghost-store';
import { useThreadTabsStore, selectActiveTab } from '@/lib/stores/thread-tabs-store';
import { ThreadTabBar } from './ThreadTabBar';
import { CommandPalette } from '../ui/CommandPalette';
import { StatusBar } from '../ui/StatusBar';
import { MorningBriefing } from '../morning-briefing/MorningBriefing';
import { registerBuiltins } from '@/lib/command-registry/commands';
import { ThreadSearch, type SearchMatch } from './ThreadSearch';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { SettingsPanel } from '../settings/SettingsPanel';

type ActiveTab = 'strategic' | 'workers' | 'warroom';

interface TabDef {
  id: ActiveTab;
  label: string;
  icon: string;
  shortcut?: string;
}

const TABS: TabDef[] = [
  { id: 'strategic', label: 'Strategic', icon: '★' },
  { id: 'workers',   label: 'Workers',   icon: '⚙' },
  { id: 'warroom',   label: 'War Room',  icon: '🗺', shortcut: 'Cmd+W' },
];

export function ChatInterface() {
  const [input, setInput] = useState('');
  const [sendButtonState, setSendButtonState] = useState<SendButtonState>('normal');
  const [activeTab, setActiveTab] = useState<ActiveTab>('strategic');
  const [showBriefing, setShowBriefing] = useState(false);

  // ── S9-12: Chat history panel state ─────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── S9-13: Settings panel state ───────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── In-thread search state (S9-08) ─────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);

  // Thread tabs store — per-tab state
  const threadTab = useThreadTabsStore(selectActiveTab);
  const initializeTabs = useThreadTabsStore((s) => s.initialize);
  const tabInitializing = useThreadTabsStore((s) => s.initializing);
  const appendMessage = useThreadTabsStore((s) => s.appendMessage);
  const setTabConversationId = useThreadTabsStore((s) => s.setTabConversationId);
  const setTabGhostContext = useThreadTabsStore((s) => s.setTabGhostContext);
  const setTabArtifact = useThreadTabsStore((s) => s.setTabArtifact);
  const setTabMessages = useThreadTabsStore((s) => s.setTabMessages);
  const createTab = useThreadTabsStore((s) => s.createTab);

  const { trigger: gateTrigger } = useDecisionGateStore();
  const { setActiveThreadId } = useGhostStore();

  // Sync ghost store's activeThreadId when thread tab changes
  useEffect(() => {
    if (threadTab?.conversationId) {
      setActiveThreadId(threadTab.conversationId);
    }
  }, [threadTab?.conversationId, setActiveThreadId]);

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
      // Cmd+F — open in-thread search (only in strategic tab)
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
        setSettingsOpen((prev) => !prev);
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

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || !threadTab) return;

    const messageText = input;
    const tabId = threadTab.id;
    const conversationId = threadTab.conversationId;

    setInput('');
    // Clear ghost context on send
    setTabGhostContext(tabId, null);

    const userMessage: MessageProps = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    appendMessage(tabId, userMessage);
    setSendButtonState('checking');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          ...(conversationId && { conversationId }),
        }),
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
        return;
      }

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const data = await response.json();
      const chatData = data?.data;

      if (chatData?.conversationId && !conversationId) {
        setTabConversationId(tabId, chatData.conversationId);
        setActiveThreadId(chatData.conversationId);
      }

      const responseContent: string = chatData?.content ?? data?.content ?? 'No response';
      const threadId: string = chatData?.conversationId ?? conversationId ?? '';

      const aiMessage: MessageProps = {
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
      };

      appendMessage(tabId, aiMessage);
      setSendButtonState('approved');
      setTimeout(() => setSendButtonState('normal'), 1500);

      // ── Artifact detection ─────────────────────────────────────────────
      const artifact = detectArtifact(responseContent);
      if (artifact) {
        artifact.threadId = threadId;
        setTabArtifact(tabId, artifact);
        void syncArtifact(artifact, threadId);
      }
    } catch (error) {
      const errorMessage: MessageProps = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      appendMessage(tabId, errorMessage);
      setSendButtonState('normal');
    }
  }, [input, threadTab, appendMessage, setTabConversationId, setActiveThreadId, setTabGhostContext, setTabArtifact]);

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
  const messages = threadTab?.messages ?? [];
  const activeArtifact = threadTab?.artifact ?? null;
  const ghostContextActive = threadTab?.ghostContextActive ?? null;
  const restoring = tabInitializing || (threadTab?.restoring ?? false);
  const panelOpen = activeArtifact !== null && activeTab === 'strategic';

  const clearArtifact = () => {
    if (threadTab) setTabArtifact(threadTab.id, null);
  };

  const clearGhostContext = () => {
    if (threadTab) setTabGhostContext(threadTab.id, null);
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
              title={tab.shortcut ? `${tab.label} (${tab.shortcut})` : tab.label}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Body: content area based on active tab ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── War Room ── */}
        {activeTab === 'warroom' && (
          <div className="flex flex-1 overflow-hidden">
            <WarRoom />
          </div>
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
                threadId={threadTab?.kernlThreadId ?? null}
                onSearchChange={handleSearchChange}
              />

              {/* Message list */}
              <div className="flex-1 overflow-hidden">
                {restoring ? (
                  <div className="flex h-full items-center justify-center text-[var(--ghost-text)] text-sm">
                    Restoring session…
                  </div>
                ) : (
                  <MessageList
                    messages={messages}
                    highlightQuery={searchQuery || undefined}
                    searchMatches={searchMatches.length > 0 ? searchMatches : undefined}
                    activeMatchIdx={activeMatchIdx}
                  />
                )}
              </div>

              {/* Decision Gate panel — slides in above input, pushes it down */}
              {gateTrigger && (
                <GatePanel threadId={threadTab?.conversationId ?? null} trigger={gateTrigger} />
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
                    <div className="flex-1">
                      <InputField
                        value={input}
                        onChange={setInput}
                        onSubmit={handleSubmit}
                        disabled={sendButtonState === 'checking' || restoring}
                        placeholder="Type message..."
                      />
                    </div>
                    <SendButton
                      state={sendButtonState}
                      onClick={handleSubmit}
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
      </div>

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

      <StatusBar />
    </div>
  );
}
