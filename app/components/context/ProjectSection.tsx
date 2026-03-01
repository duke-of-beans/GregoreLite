'use client';

import { useContextPanel } from '@/lib/context/context-provider';

const MAX_PATH_CHARS = 30;

function truncatePath(path: string | null): string {
  if (!path) return '';
  if (path.length <= MAX_PATH_CHARS) return path;
  // Keep last N chars so the meaningful end stays visible
  return '…' + path.slice(-(MAX_PATH_CHARS - 1));
}

export function ProjectSection() {
  const { state, loading } = useContextPanel();

  if (loading) {
    return (
      <div className="px-4 py-3">
        <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--shadow)]" />
        <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-[var(--shadow)]" />
      </div>
    );
  }

  if (!state.activeProject) {
    return (
      <div className="px-4 py-3 text-xs text-[var(--mist)]">
        No active project
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--cyan)]"
          title="Active project"
        />
        <span className="truncate text-sm font-medium text-[var(--ice-white)]">
          {state.activeProject.name}
        </span>
      </div>
      {state.activeProject.path && (
        <p className="ml-4 mt-0.5 font-mono text-[10px] text-[var(--mist)]">
          {truncatePath(state.activeProject.path)}
        </p>
      )}
    </div>
  );
}
