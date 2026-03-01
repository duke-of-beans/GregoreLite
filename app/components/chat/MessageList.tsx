/**
 * MessageList Component
 * 
 * Scrollable container for all messages with auto-scroll to bottom.
 * Part of Phase 5.0 P0 Foundation.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 1.1
 */

'use client';

import { useEffect, useRef } from 'react';
import { Message, type MessageProps } from './Message';

export interface MessageListProps {
  messages: MessageProps[];
}

export function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-6 py-4"
      role="log"
      aria-label="Message history"
      aria-live="polite"
    >
      {messages.length === 0 ? (
        /* Empty State */
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mb-4 text-4xl">💬</div>
            <h2 className="mb-2 text-xl font-semibold text-[var(--ice-white)]">
              Start a conversation
            </h2>
            <p className="text-[var(--frost)]">
              Type a message below to begin chatting with GREGORE
            </p>
          </div>
        </div>
      ) : (
        /* Message List */
        <div className="flex flex-col gap-4">
          {messages.map((message, index) => (
            <Message
              key={index}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
            />
          ))}
        </div>
      )}
    </div>
  );
}
