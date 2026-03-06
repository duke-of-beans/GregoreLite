/**
 * ScrollbarLandmarks — Sprint 11.3
 * Transit Map Phase B: Scrollbar overlay showing conversation events as colored ticks.
 *
 * Reads from /api/transit/events (conversation_events table via registry).
 * Renders a positioned overlay on the scrollbar track — pointer-events: none
 * so native scroll is NEVER affected. Individual landmarks have pointer-events: auto
 * for tooltip hover only.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.4, §5
 */

'use client';

import { useState, useEffect } from 'react';
import type { EnrichedEvent } from '@/lib/transit/types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ScrollbarLandmarksProps {
  /** Active thread ID. Undefined = not yet assigned (new conversation) */
  conversationId: string | undefined;
  /** Total messages in the conversation — triggers re-fetch when it changes */
  messageCount: number;
  /** The scrollable container element — used to confirm overlay is mounted */
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  /**
   * Pre-fetched events from MessageList (avoids double-fetch).
   * When provided, the internal fetch is skipped entirely.
   */
  events?: EnrichedEvent[] | undefined;
  /**
   * Sprint 22.0 — Called when user clicks a landmark tick.
   * Receives the message_index of the clicked event.
   * Optional: the component also scrolls scrollContainerRef directly.
   */
  onScrollToMessage?: (messageIndex: number) => void;
}

// ── Filter evaluator ──────────────────────────────────────────────────────────

/**
 * Safely evaluates a scrollbar filter expression.
 * Only supports the pattern: `payload.<key> === '<value>'`
 * Unknown patterns pass through (include the event).
 * No eval() — purely regex-based pattern matching.
 *
 * Exported for unit testing.
 */
export function evaluateFilter(filter: string, payload: Record<string, unknown>): boolean {
  const match = filter.match(/^payload\.(\w+)\s*===\s*['"](.+?)['"]$/);
  if (!match || !match[1] || !match[2]) return true; // Unknown pattern → include
  return payload[match[1]] === match[2];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ScrollbarLandmarks({
  conversationId,
  messageCount,
  scrollContainerRef,
  events: propEvents,
  onScrollToMessage,
}: ScrollbarLandmarksProps) {
  const [fetchedEvents, setFetchedEvents] = useState<EnrichedEvent[]>([]);

  // Only fetch internally when no events are passed as props.
  // When MessageList shares its events, we skip this entirely.
  useEffect(() => {
    if (propEvents !== undefined) return; // parent owns the data
    if (!conversationId) {
      setFetchedEvents([]);
      return;
    }

    let cancelled = false;

    const fetchEvents = async () => {
      try {
        const res = await fetch(
          `/api/transit/events?conversationId=${encodeURIComponent(conversationId)}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { events: EnrichedEvent[] };
        if (!cancelled) {
          setFetchedEvents(data.events ?? []);
        }
      } catch {
        // Non-blocking — landmark display is optional, never throws
      }
    };

    void fetchEvents();
    return () => { cancelled = true; };
  }, [conversationId, messageCount, propEvents]);

  const events = propEvents ?? fetchedEvents;

  // Don't render until we have a conversation, events, and a container
  if (!conversationId || events.length === 0 || !scrollContainerRef.current) {
    return null;
  }

  // Filter to only events that have scrollbar config in the registry
  // and pass any payload filter expression
  const landmarkEvents = events.filter((e) => {
    if (!e.config?.scrollbar) return false;
    const { filter } = e.config.scrollbar;
    if (filter) return evaluateFilter(filter, e.payload);
    return true;
  });

  if (landmarkEvents.length === 0) return null;

  const totalEventsForFallback = events.length;

  return (
    // Container: absolute, stacked on right side over scrollbar track.
    // pointer-events: none so the native scrollbar is NEVER blocked.
    // z-index 20 — above scroll content, below modals/dialogs.
    <div
      className="absolute right-0 top-0 bottom-0 w-3 pointer-events-none z-20"
      aria-hidden
    >
      {landmarkEvents.map((e, idx) => {
        const sb = e.config!.scrollbar!;

        // Positioning: prefer message_index / total_messages for accuracy.
        // Fall back to event order fraction if no message_index is available.
        let position: number;
        if (typeof e.message_index === 'number' && e.total_messages > 1) {
          position = e.message_index / (e.total_messages - 1);
        } else if (typeof e.message_index === 'number' && e.total_messages === 1) {
          position = 0.5;
        } else {
          // Session-level event or no message index — position by event order
          const evIdx = events.indexOf(e);
          position = totalEventsForFallback <= 1 ? 0.5 : evIdx / (totalEventsForFallback - 1);
        }

        // Clamp to [0, 1] to avoid overflowing the container
        const clamped = Math.min(1, Math.max(0, position));

        const tooltip = `${e.config?.name ?? e.event_type} — ${new Date(e.created_at).toLocaleTimeString()}`;

        // Tick is clickable when message_index is available
        const isClickable = typeof e.message_index === 'number';

        return (
          <div
            key={e.id}
            // pointer-events: auto on the landmark itself — enables tooltip hover
            // and click-to-scroll without affecting the scrollbar drag behavior
            className="landmark-tick"
            style={{
              position: 'absolute',
              right: 0,
              top: `${clamped * 100}%`,
              width: '100%',
              height: `${sb.height}px`,
              backgroundColor: sb.color,
              '--landmark-opacity': sb.opacity,
              '--landmark-delay': `${idx * 20}ms`,
              borderRadius: '1px',
              pointerEvents: 'auto',
              cursor: isClickable ? 'pointer' : 'default',
            } as React.CSSProperties}
            title={tooltip}
            onClick={isClickable ? () => {
              const messageIndex = e.message_index as number;
              // Notify parent (optional enhancement)
              onScrollToMessage?.(messageIndex);
              // Scroll directly via scrollContainerRef — works without MessageList wiring
              const container = scrollContainerRef.current;
              if (container) {
                const scrollable = container.scrollHeight - container.clientHeight;
                if (scrollable > 0) {
                  container.scrollTo({ top: clamped * scrollable, behavior: 'smooth' });
                }
              }
            } : undefined}
            role={isClickable ? 'button' : undefined}
            aria-label={isClickable ? `Jump to: ${tooltip}` : undefined}
          />
        );
      })}
    </div>
  );
}
