'use client';

import { useContextPanel } from '@/lib/context/context-provider';

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}

export function DecisionList() {
  const { state, loading } = useContextPanel();

  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--shadow)]">
        Recent Decisions
      </p>
      <div className="h-px bg-[var(--shadow)] opacity-50" />

      {loading ? (
        <div className="mt-2 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="h-2.5 w-full animate-pulse rounded bg-[var(--shadow)]" />
              <div className="mt-1 h-2 w-1/3 animate-pulse rounded bg-[var(--shadow)]" />
            </div>
          ))}
        </div>
      ) : state.recentDecisions.length === 0 ? (
        <p className="mt-2 text-[11px] text-[var(--mist)]">No decisions logged yet</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {state.recentDecisions.map((d) => (
            <li key={d.id}>
              <p
                className="truncate text-[11px] leading-tight text-[var(--ice-white)]"
                title={d.title}
              >
                {d.title}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--mist)]">
                {relativeTime(d.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
