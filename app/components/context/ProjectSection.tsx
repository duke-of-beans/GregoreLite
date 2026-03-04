'use client';

/**
 * ProjectSection — Sprint 10.9 Task 3
 * "No active project" now renders as dimmed italic placeholder, not a heading.
 * Active project name shows with tooltip on overflow.
 */

import { useState, useRef, useCallback } from 'react';
import { useContextPanel } from '@/lib/context/context-provider';
import { ProjectSwitcher } from './ProjectSwitcher';

const MAX_PATH_CHARS = 30;

function truncatePath(path: string | null): string {
  if (!path) return '';
  if (path.length <= MAX_PATH_CHARS) return path;
  return '…' + path.slice(-(MAX_PATH_CHARS - 1));
}

export function ProjectSection() {
  const { state, loading } = useContextPanel();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const handleSwitch = useCallback((_projectId: string) => {
    window.dispatchEvent(new CustomEvent('greglite:context-refresh'));
  }, []);

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
      <div className="px-4 py-3">
        <p className="text-[11px] italic text-[var(--mist)] opacity-60">No active project</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3" ref={anchorRef}>
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--mist)] opacity-60">
        Project
      </p>
      <div
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => setSwitcherOpen((prev) => !prev)}
        title={state.activeProject.name}
      >
        <span
          className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--cyan)]"
          title="Active project"
        />
        <span className="truncate text-sm font-medium text-[var(--ice-white)] group-hover:text-[var(--cyan)] transition-colors">
          {state.activeProject.name}
        </span>
        <span className="text-[10px] text-[var(--mist)] group-hover:text-[var(--frost)] transition-colors ml-auto">▾</span>
      </div>
      {state.activeProject.path && (
        <p
          className="ml-4 mt-0.5 font-mono text-[10px] text-[var(--mist)] truncate"
          title={state.activeProject.path}
        >
          {truncatePath(state.activeProject.path)}
        </p>
      )}

      {switcherOpen && state.activeProject && (
        <ProjectSwitcher
          currentProjectId={state.activeProject.id}
          anchorEl={anchorRef.current}
          onClose={() => setSwitcherOpen(false)}
          onSwitch={handleSwitch}
        />
      )}
    </div>
  );
}
