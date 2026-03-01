/**
 * ChatInterface Component — Sprint 2D update
 *
 * Layout: 2-panel (thread only) ↔ 3-panel (thread + artifact) — CSS animated.
 * After each assistant response, runs artifact detection. If an artifact is
 * found it is written to Zustand store (opens ArtifactPanel) and synced to KERNL.
 *
 * Phase 1 foundation carries through; Phase 2D adds artifact layer.
 */

'use client';

import { useState, useEffect } from 'react';
import { Header } from '../ui/Header';
import { MessageList } from './MessageList';
import { InputField } from './InputField';
import { SendButton, type SendButtonState } from './SendButton';
import { ArtifactPanel } from '../artifacts/ArtifactPanel';
import type { MessageProps } from './Message';
import { detectArtifact } from '@/lib/artifacts/detector';
import { useArtifactStore } from '@/lib/artifacts/store';
import { syncArtifact } from '@/lib/artifacts/kernl-sync';

export function ChatInterface() {
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [input, setInput] = useState('');
  const [sendButtonState, setSendButtonState] = useState<SendButtonState>('normal');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  const { activeArtifact, setArtifact, clearArtifact } = useArtifactStore();

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

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const data = await response.json();
      const chatData = data?.data;

      if (chatData?.conversationId && !conversationId) {
        setConversationId(chatData.conversationId);
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
  const panelOpen = activeArtifact !== null;

  return (
    <div className="flex h-screen w-full flex-col bg-[var(--deep-space)]">
      <Header />

      {/* ── Body: flex-row, splits into thread + artifact panel ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Strategic thread column ── */}
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

          {/* Input bar */}
          <div className="border-t border-[var(--shadow)] bg-[var(--deep-space)] px-6 py-4 flex-shrink-0">
            <div className="mx-auto max-w-4xl">
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
      </div>
    </div>
  );
}
