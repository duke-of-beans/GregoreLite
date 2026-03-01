/**
 * ChatInterface Component
 *
 * GregLite strategic thread UI.
 * Single Claude model (Anthropic), no Ghost, no override policies.
 * Restores last session on boot. Maintains conversationId for multi-turn.
 * Phase 1 foundation — will evolve through Phase 2+ sprints.
 */

'use client';

import { useState, useEffect } from 'react';
import { Header } from '../ui/Header';
import { MessageList } from './MessageList';
import { InputField } from './InputField';
import { SendButton, type SendButtonState } from './SendButton';
import type { MessageProps } from './Message';

export function ChatInterface() {
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [input, setInput] = useState('');
  const [sendButtonState, setSendButtonState] = useState<SendButtonState>('normal');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  // Boot restore — runs once on mount
  useEffect(() => {
    let cancelled = false;

    async function bootRestore() {
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
            })
          );
          setMessages(restored);
          setConversationId(data.data.threadId);
        }
      } catch {
        // Restore failure is non-fatal — start fresh
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }

    void bootRestore();
    return () => { cancelled = true; };
  }, []);

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

      // Persist the thread ID for subsequent messages
      if (chatData?.conversationId && !conversationId) {
        setConversationId(chatData.conversationId);
      }

      const aiMessage: MessageProps = {
        role: 'assistant',
        content: chatData?.content ?? data?.content ?? 'No response',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setSendButtonState('approved');
      setTimeout(() => setSendButtonState('normal'), 1500);
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

  return (
    <div className="flex h-screen w-full flex-col bg-[var(--deep-space)]">
      <Header />

      <div className="flex-1 overflow-hidden">
        {restoring ? (
          <div className="flex h-full items-center justify-center text-[var(--ghost-text)] text-sm">
            Restoring session...
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
      </div>

      <div className="border-t border-[var(--shadow)] bg-[var(--deep-space)] px-6 py-4">
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
  );
}
