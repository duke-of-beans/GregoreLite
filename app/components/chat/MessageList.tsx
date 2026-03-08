'use client';
/**
 * MessageList Component — Sprint S9-08 update
 *
 * Scrollable container for all messages with auto-scroll to bottom.
 * Now accepts highlightQuery + activeMatchIndex for in-thread search.
 * When activeMatchIndex changes, scrolls to the matching message.
 *
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 1.1
 */


import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Message, type MessageProps } from './Message';
import type { SearchMatch } from './ThreadSearch';
import { ScrollToBottom } from './ScrollToBottom';
import { CustomScrollbar } from './CustomScrollbar';
import { ScrollbarLandmarks } from '@/components/transit/ScrollbarLandmarks';
import { ThinkingIndicator } from './ThinkingIndicator';
import { useDensityStore, DENSITY_CONFIG } from '@/lib/stores/density-store';
import { useUIStore } from '@/lib/stores/ui-store';
import type { EnrichedEvent } from '@/lib/transit/types';
import { EventDetailPanel } from '@/components/transit/EventDetailPanel';
import { captureClientEvent } from '@/lib/transit/client';

export interface MessageListProps {
  messages: MessageProps[];
  /** Transit Map: active thread ID for scrollbar landmark events */
  conversationId?: string | undefined;
  /** Show Transit Map Z3 annotations (model badge, tokens, cost, event markers) */
  showTransitMetadata?: boolean | undefined;
  /** Pre-fetched transit events from ChatInterface (avoids double-fetch in Transit tab) */
  events?: EnrichedEvent[] | undefined;
  /** When set, smooth-scroll to the message at this index (click-to-scroll from SubwayMap) */
  scrollToIndex?: number | undefined;
  /** Called when the user scrolls, reporting the estimated center-visible message index */
  onActiveIndexChange?: ((index: number) => void) | undefined;
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
  conversationId,
  showTransitMetadata,
  events: propEvents,
  scrollToIndex,
  onActiveIndexChange,
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

  // Sprint 17.0: Orchestration Theater — expand receipts for first 5 messages
  const orchestrationTheaterComplete = useUIStore((s) => s.orchestrationTheaterComplete);
  const theaterMessageCount = useUIStore((s) => s.theaterMessageCount);

  // Density
  const density = useDensityStore((s) => s.density);
  const autoScroll = useDensityStore((s) => s.autoScroll);
  const setDensity = useDensityStore((s) => s.setDensity);
  const config = DENSITY_CONFIG[density];

  // Transit Map — events shared from ChatInterface when in Transit tab (no double-fetch).
  // Falls back to an internal fetch when used standalone (Strategic tab, etc.).
  const [fetchedEvents, setFetchedEvents] = useState<EnrichedEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Only fetch internally when propEvents is not provided
  useEffect(() => {
    if (propEvents !== undefined) return; // parent owns the data
    if (!conversationId) {
      setFetchedEvents([]);
      return;
    }
    let cancelled = false;
    const doFetch = async () => {
      try {
        const res = await fetch(
          `/api/transit/events?conversationId=${encodeURIComponent(conversationId)}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { events: EnrichedEvent[] };
        if (!cancelled) setFetchedEvents(data.events ?? []);
      } catch {
        // Non-blocking — transit telemetry never breaks the chat
      }
    };
    void doFetch();
    return () => { cancelled = true; };
  }, [propEvents, conversationId, messages.length]);

  // Resolved event list: prefer prop (Transit tab shared fetch) over internal fetch
  const transitEvents = propEvents ?? fetchedEvents;

  // Click-to-scroll from SubwayMap station click
  useEffect(() => {
    if (scrollToIndex === undefined || !scrollRef.current) return undefined;
    const msg = messages[scrollToIndex];
    if (!msg?.id) return undefined;
    const el = scrollRef.current.querySelector(`#message-${msg.id}`);
    if (!el) return undefined;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Brief highlight flash — CSS transition on outline
    (el as HTMLElement).style.outline = '2px solid var(--cyan)';
    (el as HTMLElement).style.borderRadius = '6px';
    const timer = setTimeout(() => {
      (el as HTMLElement).style.outline = '';
      (el as HTMLElement).style.borderRadius = '';
    }, 900);
    return () => clearTimeout(timer);
  }, [scrollToIndex, messages]);

  // Build Map<message_id, EnrichedEvent[]> for O(1) per-message lookup
  const eventsMap = useMemo(() => {
    const map = new Map<string, EnrichedEvent[]>();
    for (const e of transitEvents) {
      if (!e.message_id) continue;
      const arr = map.get(e.message_id) ?? [];
      arr.push(e);
      map.set(e.message_id, arr);
    }
    return map;
  }, [transitEvents]);

  // Selected event object for EventDetailPanel
  const selectedEvent = selectedEventId
    ? (transitEvents.find((e) => e.id === selectedEventId) ?? null)
    : null;

  const handleAnnotationAdd = async (eventId: string, note: string) => {
    try {
      const res = await fetch(`/api/transit/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addAnnotation: note }),
      });
      if (res.ok && conversationId) {
        // Re-fetch to get updated annotations
        const updated = await fetch(
          `/api/transit/events?conversationId=${encodeURIComponent(conversationId)}`,
        );
        if (updated.ok) {
          const data = (await updated.json()) as { events: EnrichedEvent[] };
          setFetchedEvents(data.events ?? []);
        }
      }
    } catch {
      // Non-blocking
    }
  };

  // Task 12: Mark a message as a manual subway station landmark
  const handleMarkAsLandmark = useCallback(
    async (messageId: string, name: string, icon: string) => {
      if (!conversationId) return;
      captureClientEvent({
        conversation_id: conversationId,
        event_type: 'transit.manual_station',
        category: 'cognitive',
        payload: { name, icon, message_id: messageId },
      });
      // Re-fetch transit events so the new station appears immediately
      try {
        const res = await fetch(
          `/api/transit/events?conversationId=${encodeURIComponent(conversationId)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { events: EnrichedEvent[] };
          setFetchedEvents(data.events ?? []);
        }
      } catch {
        // Non-blocking
      }
    },
    [conversationId],
  );

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

  // Sprint 17.0: Theater — force-expand receipts while theater is active
  // Theater prompt shows on the last assistant message once theaterMessageCount >= 5
  const theaterActive = !orchestrationTheaterComplete;
  const theaterPromptReady = theaterActive && theaterMessageCount >= 5;

  const matchIndices = new Set(searchMatches?.map((m) => m.messageIndex));
  const activeMessageIndex =
    searchMatches && activeMatchIdx !== undefined
      ? searchMatches[activeMatchIdx]?.messageIndex
      : undefined;

  // Report visible center message index to parent (for subway active-station sync)
  const handleScroll = () => {
    if (!onActiveIndexChange || !scrollRef.current || messages.length === 0) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const scrollable = scrollHeight - clientHeight;
    if (scrollable <= 0) return;
    const fraction = scrollTop / scrollable;
    const index = Math.round(fraction * (messages.length - 1));
    onActiveIndexChange(Math.max(0, Math.min(index, messages.length - 1)));
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="relative flex-1 min-h-0 overflow-y-auto px-6 py-4"
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
      {/* Scrollbar landmarks — heuristic layer (message content inspection) */}
      <CustomScrollbar messages={messages} containerHeight={containerHeight} />

      {/* Scrollbar landmarks — Transit Map layer (conversation_events driven, shared fetch) */}
      <ScrollbarLandmarks
        conversationId={conversationId}
        messageCount={messages.length}
        scrollContainerRef={scrollRef}
        events={transitEvents}
      />

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
                id={message.id}
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
                messageEvents={message.id ? (eventsMap.get(message.id) ?? []) : []}
                showTransitMetadata={showTransitMetadata}
                onMarkerClick={(eventId) => setSelectedEventId(eventId)}
                onMarkAsLandmark={
                  message.id
                    ? (msgId, name, icon) => void handleMarkAsLandmark(msgId, name, icon)
                    : undefined
                }
                forceReceiptExpanded={
                  message.role === 'assistant' && theaterActive ? true : undefined
                }
                showOrchestrationPrompt={
                  index === lastAssistantIdx && theaterPromptReady ? true : undefined
                }
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

      {/* Transit Map — Event Detail Panel (portals outside scroll container) */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => setSelectedEventId(null)}
        onAnnotationAdd={(eventId, note) => void handleAnnotationAdd(eventId, note)}
      />
    </div>
  );
}
