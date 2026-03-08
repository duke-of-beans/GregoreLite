import { apiFetch } from '@/lib/api-client';
/**
 * ChatSidebar — Sprint 10.5 Task 2
 *
 * Persistent 240px collapsible left panel showing the last 20 conversations.
 * Collapsed state shrinks to a 48px strip with only the expand caret at the top.
 * Collapse state persisted to localStorage key 'greglite-sidebar-collapsed'.
 *
 * Props:
 *   onLoadThread(conversationId) — already wired in ChatInterface.handleLoadThread
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

/** Lightweight relative-time formatter — avoids date-fns dep for a single use */
function timeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    const diffMo = Math.floor(diffDay / 30);
    if (diffMo < 12) return `${diffMo}mo ago`;
    return `${Math.floor(diffMo / 12)}y ago`;
  } catch {
    return '';
  }
}

interface Conversation {
  id: string;
  title: string;
  lastMessageAt: string;
  preview: string;
}

interface ApiResponse {
  data?: {
    conversations?: Conversation[];
  };
}

export interface ChatSidebarProps {
  onLoadThread: (conversationId: string) => void;
}

const STORAGE_KEY = 'greglite-sidebar-collapsed';

export function ChatSidebar({ onLoadThread }: ChatSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true');
    setMounted(true);
  }, []);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/conversations?page=1&pageSize=20');
      if (res.ok) {
        const body = (await res.json()) as ApiResponse;
        setConversations(body.data?.conversations ?? []);
      }
    } catch {
      // fail silently — sidebar is non-blocking UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // ── Collapsed state: 48px strip, expand caret pinned to top ──────────────
  if (collapsed) {
    return (
      <div
        className="flex flex-col flex-shrink-0 border-r border-[var(--shadow)] bg-[var(--elevated)]"
        style={{ width: '48px', opacity: mounted ? 1 : 0, transition: 'opacity 150ms ease' }}
      >
        {/* Expand caret — always at the very top of the strip */}
        <button
          onClick={toggleCollapse}
          className="flex items-center justify-center flex-shrink-0 text-[var(--mist)] hover:text-[var(--frost)] transition-colors"
          style={{ height: '40px', width: '48px' }}
          title="Expand conversation sidebar"
          aria-label="Expand sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    );
  }

  // ── Expanded state: 240px panel ───────────────────────────────────────────
  return (
    <div
      className="flex flex-col flex-shrink-0 border-r border-[var(--shadow)] bg-[var(--elevated)] overflow-hidden"
      style={{ width: '240px', opacity: mounted ? 1 : 0, transition: 'opacity 150ms ease' }}
    >
      {/* Header row: label + collapse caret — pinned to top */}
      <div className="flex items-center justify-between flex-shrink-0 border-b border-[var(--shadow)]" style={{ height: '40px', padding: '0 12px' }}>
        <span className="text-[10px] font-semibold text-[var(--mist)] uppercase tracking-widest">
          Recents
        </span>
        <button
          onClick={toggleCollapse}
          className="flex items-center justify-center text-[var(--mist)] hover:text-[var(--frost)] transition-colors rounded"
          style={{ height: '24px', width: '24px' }}
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Conversation list — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 && (
          <div className="px-3 py-4 text-[11px] text-[var(--ghost-text)]">
            Loading…
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="px-3 py-4 text-[11px] text-[var(--ghost-text)]">
            No conversations yet
          </div>
        )}

        {conversations.map((conv) => {
          const relativeDate = timeAgo(conv.lastMessageAt);

          return (
            <button
              key={conv.id}
              onClick={() => { onLoadThread(conv.id); }}
              className="w-full text-left hover:bg-[var(--shadow)] border-b border-[var(--shadow)] transition-colors"
              style={{ padding: '8px 12px', display: 'block' }}
            >
              <div
                className="text-[11px] font-medium text-[var(--ice-white)] truncate"
                style={{ maxWidth: '216px' }}
              >
                {conv.title || 'Untitled'}
              </div>

              {relativeDate && (
                <div className="text-[10px] text-[var(--mist)]" style={{ marginTop: '2px' }}>
                  {relativeDate}
                </div>
              )}

              {conv.preview && (
                <div
                  className="text-[10px] text-[var(--ghost-text)] truncate"
                  style={{ marginTop: '2px', maxWidth: '216px' }}
                >
                  {conv.preview}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
