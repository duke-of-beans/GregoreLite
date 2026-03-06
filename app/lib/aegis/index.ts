/**
 * AEGIS public API — Sprint 16.0
 *
 * Lifecycle:
 *   initAEGIS()          → check Tauri availability, start governor
 *   shutdownAEGIS()      → stop governor, log SUSPEND
 *
 * Override:
 *   overrideAEGISProfile() → forceEvaluate + log is_override=1 to KERNL
 *
 * Status:
 *   getAEGISStatus()     → { online: boolean; lastProfile: WorkloadProfile | null }
 *
 * Sprint 16.0: HTTP replaced with Tauri IPC. Dev mode falls back gracefully.
 */

import { logAegisSignal } from '@/lib/kernl/aegis-store';
import { ghostPause, ghostResume } from '@/lib/ghost/watcher-bridge';
import { pauseGhost, resumeGhost } from '@/lib/ghost/lifecycle';
import { AEGISGovernor } from './governor';
import { switchProfile as ipcSwitchProfile, isTauriAvailable } from './client';
import { AEGIS_PROFILE_MAP } from './types';
import type { WorkloadProfile } from './types';

// Profiles that require Ghost indexing to pause (intensive CPU/IO workloads)
const GHOST_PAUSE_PROFILES = new Set<WorkloadProfile>(['PARALLEL_BUILD', 'COUNCIL']);

export type { WorkloadProfile, AEGISState, AegisStatus, SystemMetrics, ProfileSummary, TimerState } from './types';
export { AEGIS_PROFILE_MAP } from './types';

// Re-export IPC client functions for direct use by components
export { getStatus, getMetrics, listProfiles, setTimer, cancelTimer, isTauriAvailable } from './client';

// ── Module-level state ────────────────────────────────────────────────────────

let _online = false;
let _governor: AEGISGovernor | null = null;

// ── Governor switch-profile callback ─────────────────────────────────────────

async function switchProfile(profile: WorkloadProfile): Promise<void> {
  // Send profile switch via Tauri IPC (no-op in dev mode)
  const aegisName = AEGIS_PROFILE_MAP[profile];
  await ipcSwitchProfile(aegisName);

  // Always log to KERNL regardless of Tauri availability
  logAegisSignal(profile, undefined, false);

  // Ghost Thread: pause during intensive profiles, resume otherwise.
  if (GHOST_PAUSE_PROFILES.has(profile)) {
    await ghostPause();
    pauseGhost();
  } else {
    await ghostResume();
    resumeGhost();
  }
}

function ensureGovernor(): AEGISGovernor {
  if (!_governor) {
    _governor = new AEGISGovernor(switchProfile);
  }
  return _governor;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/**
 * Check Tauri IPC availability, log STARTUP signal, start governor.
 * Returns true if AEGIS backend is reachable (Tauri running), false in dev mode.
 * Never throws — dev mode is a degraded-mode signal, not a fatal error.
 */
export async function initAEGIS(): Promise<boolean> {
  _online = await isTauriAvailable();

  // Always log STARTUP to KERNL regardless of AEGIS availability
  logAegisSignal('STARTUP', undefined, false);

  // Set governor's initial profile and start polling
  const gov = ensureGovernor();
  await gov.forceEvaluate('STARTUP');
  gov.start();

  return _online;
}

/**
 * Log SUSPEND signal to KERNL and stop the governor.
 * Idempotent — safe to call multiple times.
 */
export async function shutdownAEGIS(): Promise<void> {
  const gov = _governor;
  if (gov) {
    gov.stop();
    _governor = null;
  }
  logAegisSignal('SUSPEND', undefined, false);
  _online = false;
}

/** Current AEGIS online state and last signalled profile. */
export function getAEGISStatus(): { online: boolean; lastProfile: WorkloadProfile | null } {
  return {
    online: _online,
    lastProfile: _governor?.getLastProfile() ?? null,
  };
}

/**
 * Update the active worker count and trigger an AEGIS profile re-evaluation.
 * Called by the Session Scheduler whenever a session starts or ends.
 */
export async function updateWorkerCount(activeWorkers: number): Promise<void> {
  const gov = ensureGovernor();
  gov.updateState({ activeWorkers, hasActiveThread: true });
  await gov.forceEvaluate();
}

/**
 * Manually override the workload profile.
 * Bypasses anti-flap; logs is_override=1 in KERNL.
 */
export async function overrideAEGISProfile(
  profile: WorkloadProfile,
  sourceThread?: string,
): Promise<void> {
  const gov = ensureGovernor();
  await gov.forceEvaluate(profile);
  logAegisSignal(profile, sourceThread, true);
}
