'use client';

/**
 * GhostStatusBadge — Sprint 6G
 *
 * Small status indicator for the context panel footer.
 * Shows a coloured eye icon + state label.
 * Clicking opens the Privacy Dashboard.
 *
 * Colors: green = running, amber = paused|degraded, grey = stopped|null
 */


import type { GhostStatus } from '@/lib/ghost/status';

interface Props {
  status: GhostStatus | null;
  onClick?: () => void;
}

function stateColor(state: GhostStatus['state'] | undefined): string {
  if (!state || state === 'stopped' || state === 'error') return 'text-gray-400';
  if (state === 'running') return 'text-green-500';
  return 'text-amber-500';
}

function stateLabel(state: GhostStatus['state'] | undefined): string {
  if (!state || state === 'stopped') return 'Off';
  if (state === 'running') return 'Running';
  if (state === 'paused') return 'Paused';
  if (state === 'degraded') return 'Degraded';
  if (state === 'starting') return 'Starting';
  return 'Error';
}

export function GhostStatusBadge({ status, onClick }: Props) {
  const color = stateColor(status?.state);
  const label = stateLabel(status?.state);

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium hover:bg-white/5 transition-colors ${color}`}
      title="Ghost Thread status — click to open Privacy Dashboard"
    >
      {/* Eye icon */}
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path d="M10 3C5 3 1.73 7.11 1.05 9.78a1 1 0 000 .44C1.73 12.89 5 17 10 17s8.27-4.11 8.95-6.78a1 1 0 000-.44C18.27 7.11 15 3 10 3zm0 11a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
      <span>Ghost</span>
      <span className="opacity-70">·</span>
      <span>{label}</span>
    </button>
  );
}
