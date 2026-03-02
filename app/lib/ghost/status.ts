/**
 * Ghost Status — GhostStatus type and broadcaster
 * Sprint 6F
 *
 * GhostStatus is the single source of truth for Ghost lifecycle state.
 * The lifecycle module writes to _currentStatus; the frontend reads it
 * via the ghost:status-changed IPC event.
 *
 * getGhostStatus()      — read current snapshot
 * updateGhostStatus()   — partial update + emit
 * resetGhostStatus()    — set back to stopped state (used in shutdown)
 * addGhostStatusError() — append a component error (state stays as-is)
 * clearGhostStatusError() — remove error on successful restart
 */

import { emitGhostStatus } from './ipc';
import { isPollerRunning } from './email/poller';
import { getQueueDepth } from './ingest';
import { getActiveSuggestions } from './scorer';

// ── Type ──────────────────────────────────────────────────────────────────────

export interface GhostStatus {
  state: 'starting' | 'running' | 'paused' | 'degraded' | 'stopped' | 'error';
  watcherActive: boolean;
  emailConnectors: { gmail: boolean; outlook: boolean };
  ingestQueueDepth: number;
  lastIngestAt: number | null;
  lastScorerRunAt: number | null;
  activeSuggestions: number;
  errors: { component: string; message: string }[];
}

// ── Module-level singleton ────────────────────────────────────────────────────

const _defaultStatus: GhostStatus = {
  state: 'stopped',
  watcherActive: false,
  emailConnectors: { gmail: false, outlook: false },
  ingestQueueDepth: 0,
  lastIngestAt: null,
  lastScorerRunAt: null,
  activeSuggestions: 0,
  errors: [],
};

let _currentStatus: GhostStatus = { ..._defaultStatus };

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the current Ghost status snapshot (defensive copy). */
export function getGhostStatus(): GhostStatus {
  return { ..._currentStatus };
}

/**
 * Merge a partial update into the current status, refresh live stats
 * (queue depth, active suggestions, email connector liveness), then
 * emit ghost:status-changed.
 */
export function updateGhostStatus(patch: Partial<GhostStatus>): void {
  _currentStatus = {
    ..._currentStatus,
    ...patch,
    // Always refresh live stats from source of truth
    ingestQueueDepth: getQueueDepth(),
    activeSuggestions: getActiveSuggestions().length,
    emailConnectors: {
      gmail: isPollerRunning(),
      outlook: isPollerRunning(),
    },
  };
  emitGhostStatus(_currentStatus);
}

/**
 * Append an error to the status errors array.
 * Does not overwrite state — caller decides if state should become 'degraded'.
 */
export function addGhostStatusError(component: string, message: string): void {
  const errors = [
    ..._currentStatus.errors.filter((e) => e.component !== component),
    { component, message },
  ];
  updateGhostStatus({ errors });
}

/** Remove error entry for a component (called on successful restart). */
export function clearGhostStatusError(component: string): void {
  const errors = _currentStatus.errors.filter((e) => e.component !== component);
  updateGhostStatus({ errors });
}

/** Reset to stopped state. Called at the end of shutdown. */
export function resetGhostStatus(): void {
  _currentStatus = { ..._defaultStatus };
  emitGhostStatus(_currentStatus);
}
