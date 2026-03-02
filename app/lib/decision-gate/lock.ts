/**
 * Decision Gate — Lock State
 *
 * Module-level singleton tracking whether a decision gate is active.
 * API call enforcement (HTTP 423) is wired in Sprint 4B.
 *
 * Dismissal rules (§8 blueprint):
 *   - dismissLock() increments dismissCount and releases if count < 3
 *   - isMandatory() returns true once dismissCount >= 3 (cannot dismiss again)
 *   - releaseLock() is called when David approves — logs and clears state
 */

import type { DecisionLockState, GateTrigger } from './types';

// ─── Module-level singleton ───────────────────────────────────────────────────

let state: DecisionLockState = {
  locked: false,
  trigger: null,
  reason: '',
  dismissCount: 0,
  lockedAt: null,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Activate the decision lock.
 * Increments dismissCount if already locked (re-trigger on same conversation).
 * Sprint 4B: blocks all Claude API calls while locked.
 */
export function acquireLock(trigger: GateTrigger, reason: string): void {
  state = {
    locked: true,
    trigger,
    reason,
    dismissCount: state.dismissCount, // preserve prior dismissal history
    lockedAt: Date.now(),
  };
}

/**
 * Release the lock on David's explicit approval.
 * Resets all state including dismissal count — clean slate for next gate.
 * Sprint 4B: logs the approval to KERNL decision registry.
 */
export function releaseLock(): void {
  state = {
    locked: false,
    trigger: null,
    reason: '',
    dismissCount: 0,
    lockedAt: null,
  };
}

/**
 * Dismiss the lock without formal approval.
 * Increments dismissCount and releases the lock IF count stays below 3.
 * Once dismissCount reaches 3, isMandatory() returns true and this call
 * still increments the counter but does NOT release (Sprint 4B enforces this).
 */
export function dismissLock(): void {
  const newCount = state.dismissCount + 1;
  if (newCount >= 3) {
    // Mandatory — keep locked, only increment counter
    state = {
      ...state,
      dismissCount: newCount,
    };
  } else {
    // Under threshold — release but remember the dismissal
    state = {
      locked: false,
      trigger: state.trigger,
      reason: state.reason,
      dismissCount: newCount,
      lockedAt: null,
    };
  }
}

/** Current snapshot of lock state (read-only copy). */
export function getLockState(): DecisionLockState {
  return { ...state };
}

/**
 * Returns true when dismissCount >= 3.
 * At this point the gate cannot be dismissed — David must approve or override.
 */
export function isMandatory(): boolean {
  return state.dismissCount >= 3;
}

/**
 * Reset lock state entirely — used in tests and on app restart.
 * Not exported from module public API (index.ts) — internal use only.
 */
export function _resetLockState(): void {
  state = {
    locked: false,
    trigger: null,
    reason: '',
    dismissCount: 0,
    lockedAt: null,
  };
}
