/**
 * ThreadSearch Component — Sprint S9-08
 *
 * Search bar that slides in below the tab bar when Cmd+F is pressed
 * in the strategic thread. Client-side fast path filters current messages;
 * when <3 client matches, fires server-side FTS5 query for full history.
 *
 * Features:
 * - Real-time highlight as user types
 * - Arrow up/down to navigate matches
 * - Result count ("3 of 12")
 * - Escape closes and clears highlights
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MessageProps } from './Message';

export interface SearchMatch {
  messageIndex: number;
  /** Total count of matches within that message (for display) */
  count: number;
}

export interface ThreadSearchProps {
  /** Whether the search bar is visible */
  open: boolean;
  /** Close callback */
  onClose: () => void;
  /** Current messages array (for client-side filtering) */
  messages: MessageProps[];
  /** Thread ID for server-side FTS fallback */
  threadId: string | null;
  /** Called whenever the query or active match changes */
  onSearchChange: (query: string, matches: SearchMatch[], activeMatchIdx: number) => void;
}

/**
 * Count occurrences of `query` (case-insensitive) in `text`.
 */
function countMatches(text: string, query: string): number {
  if (!query) return 0;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let count = 0;
  let pos = 0;
  while (true) {
    pos = lower.indexOf(q, pos);
    if (pos === -1) break;
    count++;
    pos += q.length;
  }
  return count;
}

export function ThreadSearch({
  open,
  onClose,
  messages,
  threadId,
  onSearchChange,
}: ThreadSearchProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [serverHits, setServerHits] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when search opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [open]);

  // Client-side search
  useEffect(() => {
    if (!query.trim()) {
      setMatches([]);
      setActiveIdx(0);
      setServerHits(null);
      onSearchChange('', [], 0);
      return;
    }

    const q = query.trim();
    const clientMatches: SearchMatch[] = [];

    messages.forEach((msg, idx) => {
      const c = countMatches(msg.content, q);
      if (c > 0) {
        clientMatches.push({ messageIndex: idx, count: c });
      }
    });

    setMatches(clientMatches);
    const newActiveIdx = clientMatches.length > 0 ? 0 : 0;
    setActiveIdx(newActiveIdx);
    onSearchChange(q, clientMatches, newActiveIdx);

    // Server-side FTS fallback when <3 client matches
    const abortController = new AbortController();

    if (clientMatches.length < 3 && threadId && q.length >= 2) {
      fetch(`/api/threads/${encodeURIComponent(threadId)}/search?q=${encodeURIComponent(q)}&limit=50`, {
        signal: abortController.signal,
      })
        .then((res) => res.json())
        .then((body) => {
          const ids = (body.data as Array<{ id: string }>)?.map((r) => r.id) ?? [];
          setServerHits(ids);
        })
        .catch(() => {
          // Abort or network error — ignore
        });
    } else {
      setServerHits(null);
    }

    return () => abortController.abort();
  }, [query, messages, threadId, onSearchChange]);

  // Navigate matches
  const navigateMatch = useCallback(
    (direction: 1 | -1) => {
      if (matches.length === 0) return;
      setActiveIdx((prev) => {
        const next = (prev + direction + matches.length) % matches.length;
        onSearchChange(query.trim(), matches, next);
        return next;
      });
    },
    [matches, query, onSearchChange],
  );

  // Keyboard handler within search input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setQuery('');
        onClose();
      } else if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        navigateMatch(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateMatch(-1);
      }
    },
    [onClose, navigateMatch],
  );

  if (!open) return null;

  const totalClientMatches = matches.reduce((sum, m) => sum + m.count, 0);
  const serverExtra = serverHits ? serverHits.length : 0;
  const showServerIndicator = serverHits !== null && serverHits.length > totalClientMatches;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 16px',
        background: 'var(--elevated, #1a1f2e)',
        borderBottom: '1px solid var(--shadow, #2a3040)',
        flexShrink: 0,
      }}
    >
      {/* Search input */}
      <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search in thread…"
          style={{
            width: '100%',
            padding: '4px 8px',
            paddingRight: '70px',
            background: 'var(--deep-space, #0d1117)',
            border: '1px solid var(--shadow, #2a3040)',
            borderRadius: '4px',
            color: 'var(--ice-white, #e5e7eb)',
            fontSize: '13px',
            outline: 'none',
          }}
          aria-label="Search in thread"
        />
        {/* Match count badge */}
        {query.trim() && (
          <span
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '11px',
              color: totalClientMatches > 0 ? 'var(--frost, #9ca3af)' : 'var(--amber, #f59e0b)',
              whiteSpace: 'nowrap',
            }}
          >
            {totalClientMatches > 0
              ? `${activeIdx + 1} of ${totalClientMatches}`
              : 'No matches'}
          </span>
        )}
      </div>

      {/* Navigation arrows */}
      <button
        onClick={() => navigateMatch(-1)}
        disabled={matches.length === 0}
        style={{
          background: 'none',
          border: 'none',
          cursor: matches.length > 0 ? 'pointer' : 'default',
          color: matches.length > 0 ? 'var(--frost, #9ca3af)' : 'var(--ghost-text, #4a5568)',
          fontSize: '14px',
          padding: '2px 4px',
        }}
        title="Previous match (↑)"
        aria-label="Previous match"
      >
        ▲
      </button>
      <button
        onClick={() => navigateMatch(1)}
        disabled={matches.length === 0}
        style={{
          background: 'none',
          border: 'none',
          cursor: matches.length > 0 ? 'pointer' : 'default',
          color: matches.length > 0 ? 'var(--frost, #9ca3af)' : 'var(--ghost-text, #4a5568)',
          fontSize: '14px',
          padding: '2px 4px',
        }}
        title="Next match (↓)"
        aria-label="Next match"
      >
        ▼
      </button>

      {/* Server indicator */}
      {showServerIndicator && (
        <span style={{ fontSize: '10px', color: 'var(--cyan, #22d3ee)' }}>
          +{serverExtra} from history
        </span>
      )}

      {/* Close button */}
      <button
        onClick={() => {
          setQuery('');
          onClose();
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--mist, #888)',
          fontSize: '16px',
          padding: '2px 4px',
          lineHeight: 1,
        }}
        title="Close search (Esc)"
        aria-label="Close search"
      >
        ✕
      </button>
    </div>
  );
}
