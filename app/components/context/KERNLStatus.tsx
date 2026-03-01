'use client';

import { useContextPanel } from '@/lib/context/context-provider';

const STATUS_CONFIG = {
  indexed: { dot: 'bg-[var(--success)]', label: 'indexed', title: 'KERNL index is up to date' },
  indexing: { dot: 'bg-[var(--warning)] animate-pulse', label: 'indexing', title: 'KERNL is indexing...' },
  error: { dot: 'bg-[var(--error)]', label: 'error', title: 'KERNL index error' },
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
        <span className="font-medium text-[var(--frost)]">KERNL</span>
        {'  '}
        {cfg.label}
      </span>
    </div>
  );
}
