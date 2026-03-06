'use client';

import { useContextPanel } from '@/lib/context/context-provider';

const STATUS_CONFIG = {
  indexed: { dot: 'bg-[var(--success)]', label: 'ready', title: 'Memory index is up to date' },
  indexing: { dot: 'bg-[var(--warning)] animate-pulse', label: 'syncing', title: 'Memory is syncing...' },
  error: { dot: 'bg-[var(--error)]', label: 'error', title: 'Memory index error — check Settings' },
} as const;

export function KERNLStatus() {
  const { state, loading } = useContextPanel();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-1">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--shadow)]" />
        <div className="h-2.5 w-20 animate-pulse rounded bg-[var(--shadow)]" />
      </div>
    );
  }

  const cfg = STATUS_CONFIG[state.kernlStatus];

  return (
    <div className="flex items-center gap-2 px-4 py-1" title={cfg.title}>
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />
      <span className="text-[11px] text-[var(--mist)]">
        <span className="font-medium text-[var(--frost)]">Memory</span>
        {'  '}
        {cfg.label}
      </span>
    </div>
  );
}
