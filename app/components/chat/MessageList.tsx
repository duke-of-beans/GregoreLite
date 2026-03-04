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

import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, type MessageProps } from './Message';
import type { SearchMatch } from './ThreadSearch';
import { ScrollToBottom } from './ScrollToBottom';
import { CustomScrollbar } from './CustomScrollbar';
import { ThinkingIndicator } from './ThinkingIndicator';
import { useDensityStore, DENSITY_CONFIG } from '@/lib/stores/density-store';

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
  /** Shows thinking indicator while waiting for response stream to start */
  isWaitingForResponse?: boolean | undefined;
}

export function MessageList({
  messages,
  highlightQuery,
  searchMatches,
  activeMatchIdx,
  onEditMessage,
  onRegenerate,
  isWaitingForResponse,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewContent, setHasNewContent] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);

  // Density
  const density = useDensityStore((s) => s.density);
  const autoScroll = useDensityStore((s) => s.autoScroll);
  const setDensity = useDensityStore((s) => s.setDensity);
  const config = DENSITY_CONFIG[density];

  // Hydration-safe density sync
  useEffect(() => {
    const stored = localStorage.getItem('greglite-density');
    if (stored === 'compact' || stored === 'comfortable' || stored === 'spacious') {
      setDensity(stored);
    }
  }, [setDensity]);

  // IntersectionObserver to detect if user is at bottom
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const atBottom = entry?.isIntersecting ?? false;
        setIsAtBottom(atBottom);
        if (atBottom) setHasNewContent(false);
      },
      { root: container, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // ResizeObserver for container height (scrollbar landmarks)
  useEffect(() => {
    if (!scrollRef.current) return;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) setContainerHeight(entry.contentRect.height);
    });
    resizeObserver.observe(scrollRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Auto-scroll on new messages (only when at bottom and autoScroll enabled)
  useEffect(() => {
    if (isAtBottom && autoScroll && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    } else if (!isAtBottom && messages.length > 0) {
      setHasNewContent(true);
    }
  }, [messages, isAtBottom, autoScroll]);

  // Scroll to active search match when it changes
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
      const el = scrollRef.current.querySelector('[data-active-match="true"]');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightQuery, searchMatches, activeMatchIdx]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  // S9-20: find last user and last assistant message indices
  let lastUserIdx = -1;
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (lastUserIdx === -1 && messages[i]?.role === 'user') lastUserIdx = i;
    if (lastAssistantIdx === -1 && messages[i]?.role === 'assistant') lastAssistantIdx = i;
    if (lastUserIdx !== -1 && lastAssistantIdx !== -1) break;
  }

  const matchIndices = new Set(searchMatches?.map((m) => m.messageIndex));
  const activeMessageIndex =
    searchMatches && activeMatchIdx !== undefined
      ? searchMatches[activeMatchIdx]?.messageIndex
      : undefined;

  return (
    <div
      ref={scrollRef}
      className="relative flex-1 overflow-y-auto px-6 py-4"
      role="log"
      aria-label="Message history"
      aria-live="polite"
      style={{
        '--msg-font-size': config.fontSize,
        '--msg-line-height': config.lineHeight,
        '--msg-gap': config.gap,
        '--msg-padding': config.padding,
        '--msg-role-size': config.roleLabelSize,
      } as React.CSSProperties}
    >
      {/* Scrollbar landmarks */}
      <CustomScrollbar messages={messages} containerHeight={containerHeight} />

      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mb-4 text-4xl">💬</div>
            <h2 className="mb-2 text-xl font-semibold text-[var(--ice-white)]">
              Start a conversation
            </h2>
            <p className="text-[var(--frost)]">
              Type a message below to begin chatting with GregLite
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex flex-col" style={{ gap: 'var(--msg-gap, 12px)' }}>
            {messages.map((message, index) => (
              <Message
                key={index}
                role={message.role}
                content={message.content}
                timestamp={message.timestamp}
                isStreaming={message.isStreaming}
                model={message.model}
                tokens={message.tokens}
                costUsd={message.costUsd}
                latencyMs={message.latencyMs}
                blocks={message.blocks}
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

            {/* Thinking indicator — shown when waiting for stream to start */}
            {isWaitingForResponse && (
              <ThinkingIndicator />
            )}
          </div>
        </div>
      )}

      {/* Bottom sentinel for IntersectionObserver */}
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden />

      {/* Floating scroll-to-bottom button */}
      <ScrollToBottom
        visible={!isAtBottom}
        hasNewContent={hasNewContent}
        onClick={scrollToBottom}
      />
    </div>
  );
}
