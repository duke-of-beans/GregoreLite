'use client';

import { useContextPanel } from '@/lib/context/context-provider';

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m active';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m active`;
  if (minutes > 0) return `${minutes}m active`;
  return 'just started';
}

export function SessionSection() {
  const { state, loading } = useContextPanel();

  if (loading) {
    return (
      <div className="px-4 py-2">
        <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--shadow)]" />
        <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-[var(--shadow)]" />
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <p className="text-xs font-semibold text-[var(--frost)]">
        Session #{state.sessionNumber}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--mist)]">
        {formatDuration(state.sessionDurationMs)}
      </p>
    </div>
  );
}
