/**
 * MessageList Component — Sprint S9-08 update
 *
 * Scrollable container for all messages with auto-scroll to bottom.
 * Now accepts highlightQuery + activeMatchIndex for in-thread search.
 * When activeMatchIndex changes, scrolls to the matching message.
 *
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 1.1
 */

'use client';

import { useEffect, useRef } from 'react';
import { Message, type MessageProps } from './Message';
import type { SearchMatch } from './ThreadSearch';

export interface MessageListProps {
  messages: MessageProps[];
  /** Current search query — passed to each Message for highlighting */
  highlightQuery?: string | undefined;
  /** Which messages matched the search (by message index) */
  searchMatches?: SearchMatch[] | undefined;
  /** Index into searchMatches[] for the currently active match */
  activeMatchIdx?: number | undefined;
  /** S9-20: Called when user clicks Edit on their last message */
  onEditMessage?: ((index: number) => void) | undefined;
  /** S9-20: Called when user clicks Regenerate on last assistant message */
  onRegenerate?: (() => void) | undefined;
}

export function MessageList({
  messages,
  highlightQuery,
  searchMatches,
  activeMatchIdx,
  onEditMessage,
  onRegenerate,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive (only when not searching)
  useEffect(() => {
    if (!highlightQuery && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, highlightQuery]);

  // Scroll to active match when it changes
  useEffect(() => {
    if (
      highlightQuery &&
      searchMatches &&
      searchMatches.length > 0 &&
      activeMatchIdx !== undefined &&
      scrollRef.current
    ) {
      const match = searchMatches[activeMatchIdx];
      if (!match) return;

      const el = scrollRef.current.querySelector(
        `[data-active-match="true"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightQuery, searchMatches, activeMatchIdx]);

  // S9-20: find last user and last assistant message indices for edit/regen buttons
  let lastUserIdx = -1;
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (lastUserIdx === -1 && messages[i]?.role === 'user') lastUserIdx = i;
    if (lastAssistantIdx === -1 && messages[i]?.role === 'assistant') lastAssistantIdx = i;
    if (lastUserIdx !== -1 && lastAssistantIdx !== -1) break;
  }

  // Build a Set of message indices that are matches for fast lookup
  const matchIndices = new Set(searchMatches?.map((m) => m.messageIndex));
  const activeMessageIndex =
    searchMatches && activeMatchIdx !== undefined
      ? searchMatches[activeMatchIdx]?.messageIndex
      : undefined;

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
              highlightQuery={
                highlightQuery && matchIndices.has(index)
                  ? highlightQuery
                  : undefined
              }
              isActiveMatch={index === activeMessageIndex}
              onEdit={index === lastUserIdx && onEditMessage ? () => onEditMessage(index) : undefined}
              onRegenerate={index === lastAssistantIdx && onRegenerate ? () => onRegenerate() : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
