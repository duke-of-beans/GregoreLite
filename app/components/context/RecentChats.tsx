import { apiFetch } from '@/lib/api-client';
/**
 * RecentChats — Sprint 10.6 Task 6, wired to KERNL in Sprint 10.8 Task 4
 * Sprint 10.9 Task 1: Added rename/delete hover actions + tooltips.
 *
 * Collapsible section within ContextPanel showing last 10 conversations
 * sourced from KERNL threads (not ConversationRepository).
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await apiFetch('/api/threads');
      if (res.ok) {
        const body = (await res.json()) as ApiResponse;
        setThreads(body.data?.threads ?? []);
      }
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const startRename = (thread: ThreadItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(thread.id);
    setRenameValue(thread.title);
  };

  const commitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    setRenamingId(null);
    setThreads((prev) => prev.map((t) => t.id === id ? { ...t, title: trimmed } : t));
    try {
      await fetch(`/api/threads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch { /* silent — optimistic update already applied */ }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreads((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`/api/threads/${id}`, { method: 'DELETE' });
    } catch { /* silent — optimistic removal already done */ }
  };

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
            <div key={thread.id} className="group relative">
              {renamingId === thread.id ? (
                <div className="px-3 py-1.5">
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => void commitRename(thread.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename(thread.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="w-full rounded bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--ice-white)] outline outline-1 outline-[var(--cyan)]"
                  />
                </div>
              ) : (
                <button
                  onClick={() => onLoadThread(thread.id)}
                  className="w-full text-left px-3 py-1.5 pr-14 hover:bg-[var(--shadow)] transition-colors"
                  title={thread.title}
                >
                  <div className="text-[11px] font-medium text-[var(--ice-white)] truncate">{thread.title}</div>
                  <div className="text-[9px] text-[var(--mist)]">{timeAgo(thread.updatedAt)}</div>
                </button>
              )}
              {/* Hover action icons */}
              {renamingId !== thread.id && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => startRename(thread, e)}
                    className="rounded p-0.5 text-[var(--mist)] hover:text-[var(--frost)] transition-colors"
                    title="Rename thread"
                    aria-label="Rename thread"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => void handleDelete(thread.id, e)}
                    className="rounded p-0.5 text-[var(--mist)] hover:text-[var(--error)] transition-colors"
                    title="Delete thread"
                    aria-label="Delete thread"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
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
