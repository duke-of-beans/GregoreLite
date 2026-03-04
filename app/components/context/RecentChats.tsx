/**
 * RecentChats — Sprint 10.6 Task 6, wired to KERNL in Sprint 10.8 Task 4
 *
 * Collapsible section within ContextPanel showing last 10 conversations
 * sourced from KERNL threads (not ConversationRepository).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface ThreadItem {
  id: string;
  title: string;
  updatedAt: string;
}

interface ApiResponse {
  data?: {
    threads?: ThreadItem[];
  };
}

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
    return `${diffDay}d ago`;
  } catch {
    return '';
  }
}

export interface RecentChatsProps {
  onLoadThread: (conversationId: string) => void;
  onSeeAll: () => void;
}

export function RecentChats({ onLoadThread, onSeeAll }: RecentChatsProps) {
  const [expanded, setExpanded] = useState(true);
  const [threads, setThreads] = useState<ThreadItem[]>([]);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/threads');
      if (res.ok) {
        const body = (await res.json()) as ApiResponse;
        setThreads(body.data?.threads ?? []);
      }
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  return (
    <div className="border-b border-[var(--shadow)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--mist)] hover:text-[var(--frost)] transition-colors"
      >
        <span>Recent Chats</span>
        <span className="text-[var(--ghost-text)]">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="pb-2">
          {threads.length === 0 && (
            <div className="px-3 py-2 text-[10px] text-[var(--ghost-text)]">No conversations yet</div>
          )}
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => onLoadThread(thread.id)}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--shadow)] transition-colors"
            >
              <div className="text-[11px] font-medium text-[var(--ice-white)] truncate">{thread.title}</div>
              <div className="text-[9px] text-[var(--mist)]">{timeAgo(thread.updatedAt)}</div>
            </button>
          ))}
          {threads.length > 0 && (
            <button onClick={onSeeAll} className="w-full px-3 py-1.5 text-[10px] text-[var(--cyan)] hover:text-[var(--ice-white)] transition-colors text-left">
              See all (Cmd+[)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
