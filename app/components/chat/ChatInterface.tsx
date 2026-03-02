/**
 * ChatInterface Component — Sprint 2E update
 *
 * Adds tab navigation: [★ Strategic] [⚙ Workers] [🗺 War Room]
 * Cmd+W opens War Room tab from anywhere in the app.
 *
 * Layout: 2-panel (thread only) ↔ 3-panel (thread + artifact) — CSS animated.
 * After each assistant response, runs artifact detection. If an artifact is
 * found it is written to Zustand store (opens ArtifactPanel) and synced to KERNL.
 *
 * Phase 1 foundation carries through; Phase 2D adds artifact layer;
 * Phase 2E adds War Room tab.
 */

'use client';

import { useState, useEffect } from 'react';
import { Header } from '../ui/Header';
import { MessageList } from './MessageList';
import { InputField } from './InputField';
import { SendButton, type SendButtonState } from './SendButton';
import { ArtifactPanel } from '../artifacts/ArtifactPanel';
import { JobQueue } from '../jobs/JobQueue';
import { WarRoom } from '../war-room';
import type { MessageProps } from './Message';
import { detectArtifact } from '@/lib/artifacts/detector';
import { useArtifactStore } from '@/lib/artifacts/store';
import { syncArtifact } from '@/lib/artifacts/kernl-sync';
import { useDecisionGateStore } from '@/lib/stores/decision-gate-store';
import { GatePanel } from '@/components/decision-gate';
import { useGhostStore } from '@/lib/stores/ghost-store';

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
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [input, setInput] = useState('');
  const [sendButtonState, setSendButtonState] = useState<SendButtonState>('normal');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('strategic');

  const { activeArtifact, setArtifact, clearArtifact } = useArtifactStore();
  const { trigger: gateTrigger } = useDecisionGateStore();
  const { ghostContextActive, clearGhostContextActive, setActiveThreadId } = useGhostStore();

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 'w') {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'warroom' ? 'strategic' : 'warroom'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Boot sequence ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function bootSequence() {
      // Fire bootstrap non-blocking
      void fetch('/api/bootstrap', { method: 'POST' }).then((res) => {
        if (!res.ok) console.warn('[boot] Bootstrap returned', res.status);
        else res.json().then((d) => console.log('[boot] Bootstrap complete', d?.data?.coldStartMs + 'ms')).catch(() => null);
      }).catch((err) => console.warn('[boot] Bootstrap fetch failed:', err));

      // Restore last session
      try {
        const res = await fetch('/api/restore');
        if (!res.ok) return;

        const data = await res.json();
        if (cancelled) return;

        if (data?.data?.restored && data.data.messages?.length > 0) {
          const restored: MessageProps[] = data.data.messages.map(
            (m: { role: 'user' | 'assistant'; content: string; timestamp: number }) => ({
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp),
            }),
          );
          setMessages(restored);
          setConversationId(data.data.threadId);
          setActiveThreadId(data.data.threadId);
        }
      } catch {
        // Non-fatal — start fresh
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }

    void bootSequence();
    return () => { cancelled = true; };
  }, []);

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!input.trim()) return;

    const messageText = input;
    setInput('');
    // Ghost context is consumed when the user sends the next message
    clearGhostContextActive();

    const userMessage: MessageProps = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
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
        // Decision gate is active — the gate panel should already be visible
        // from the Zustand store (set by the previous fire-and-forget analyze()).
        // If somehow the store is empty (e.g. page reload), show a safe error.
        const data = await response.json() as { error: string; reason?: string };
        const errorMessage: MessageProps = {
          role: 'assistant',
          content: `⚠ Decision Gate active — ${data.reason ?? 'approve or dismiss the gate before continuing'}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setSendButtonState('normal');
        return;
      }

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const data = await response.json();
      const chatData = data?.data;

      if (chatData?.conversationId && !conversationId) {
        setConversationId(chatData.conversationId);
        setActiveThreadId(chatData.conversationId);
      }

      const responseContent: string = chatData?.content ?? data?.content ?? 'No response';
      const threadId: string = chatData?.conversationId ?? conversationId ?? '';

      const aiMessage: MessageProps = {
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setSendButtonState('approved');
      setTimeout(() => setSendButtonState('normal'), 1500);

      // ── Artifact detection ─────────────────────────────────────────────
      const artifact = detectArtifact(responseContent);
      if (artifact) {
        artifact.threadId = threadId;
        setArtifact(artifact);
        // Fire-and-forget KERNL sync — non-blocking
        void syncArtifact(artifact, threadId);
      }
    } catch (error) {
      const errorMessage: MessageProps = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setSendButtonState('normal');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const panelOpen = activeArtifact !== null && activeTab === 'strategic';

  return (
    <div className="flex h-screen w-full flex-col bg-[var(--deep-space)]">
      <Header />

      {/* ── Tab bar ── */}
      <div className="flex items-center border-b border-[var(--shadow)] bg-[var(--elevated)] px-4 flex-shrink-0">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                active
                  ? 'border-[var(--cyan)] text-[var(--ice-white)]'
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
              {/* Message list */}
              <div className="flex-1 overflow-hidden">
                {restoring ? (
                  <div className="flex h-full items-center justify-center text-[var(--ghost-text)] text-sm">
                    Restoring session…
                  </div>
                ) : (
                  <MessageList messages={messages} />
                )}
              </div>

              {/* Decision Gate panel — slides in above input, pushes it down */}
              {gateTrigger && (
                <GatePanel threadId={conversationId} trigger={gateTrigger} />
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
                        onClick={clearGhostContextActive}
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
    </div>
  );
}
