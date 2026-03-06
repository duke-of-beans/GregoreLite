/**
 * AEGIS IPC Client — Sprint 16.0
 *
 * Replaces HTTP client (port 8743) with Tauri IPC invoke().
 * Dev mode fallback: when running `pnpm dev` without Tauri,
 * all calls return safe defaults instead of throwing.
 *
 * CRITICAL: AEGIS being unavailable (dev mode) is normal.
 * This client NEVER throws. Silent fallback is correct behavior.
 */

import type { AegisStatus, SystemMetrics, ProfileSummary, TimerState } from './types';

// ── Tauri detection ───────────────────────────────────────────────────────────

let _invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let _tauriChecked = false;

async function getInvoke() {
  if (_tauriChecked) return _invoke;
  _tauriChecked = true;
  try {
    // Dynamic import — only resolves inside Tauri WebView
    const tauri = await import('@tauri-apps/api/core');
    _invoke = tauri.invoke;
  } catch {
    _invoke = null;
  }
  return _invoke;
}

/** Returns true if running inside Tauri WebView. */
export async function isTauriAvailable(): Promise<boolean> {
  return (await getInvoke()) !== null;
}

// ── Dev mode defaults ─────────────────────────────────────────────────────────

const DEV_STATUS: AegisStatus = {
  active_profile: 'dev-mode',
  active_profile_display: 'Dev Mode',
  active_profile_color: '#666',
  profiles: [],
  timer: {
    active: false,
    target_profile: null,
    return_profile: null,
    started_at: null,
    duration_min: null,
    expires_at: null,
  },
  metrics: {
    timestamp: '',
    cpu_percent: 0,
    memory_percent: 0,
    memory_mb_used: 0,
    memory_mb_available: 0,
    power_plan: '',
  },
  version: 'dev',
};

const DEV_METRICS: SystemMetrics = {
  timestamp: '',
  cpu_percent: 0,
  memory_percent: 0,
  memory_mb_used: 0,
  memory_mb_available: 0,
  power_plan: '',
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get full AEGIS status: active profile, all profiles, timer, metrics.
 * Returns dev-mode defaults when running outside Tauri.
 */
export async function getStatus(): Promise<AegisStatus> {
  try {
    const invoke = await getInvoke();
    if (!invoke) return { ...DEV_STATUS, metrics: { ...DEV_STATUS.metrics, timestamp: new Date().toISOString() } };
    return (await invoke('aegis_status')) as AegisStatus;
  } catch {
    return { ...DEV_STATUS, metrics: { ...DEV_STATUS.metrics, timestamp: new Date().toISOString() } };
  }
}

/**
 * Switch to a named AEGIS profile.
 * No-op in dev mode.
 */
export async function switchProfile(name: string): Promise<void> {
  try {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('aegis_switch_profile', { name });
  } catch {
    // Silent failure — expected in dev mode
  }
}

/**
 * Get lightweight CPU/memory metrics only.
 * Returns zeroed defaults in dev mode.
 */
export async function getMetrics(): Promise<SystemMetrics> {
  try {
    const invoke = await getInvoke();
    if (!invoke) return { ...DEV_METRICS, timestamp: new Date().toISOString() };
    return (await invoke('aegis_metrics')) as SystemMetrics;
  } catch {
    return { ...DEV_METRICS, timestamp: new Date().toISOString() };
  }
}

/**
 * List all available profiles.
 * Returns empty array in dev mode.
 */
export async function listProfiles(): Promise<ProfileSummary[]> {
  try {
    const invoke = await getInvoke();
    if (!invoke) return [];
    return (await invoke('aegis_list_profiles')) as ProfileSummary[];
  } catch {
    return [];
  }
}

/**
 * Start a timed profile switch.
 * No-op in dev mode.
 */
export async function setTimer(
  targetProfile: string,
  returnProfile: string,
  durationMin: number,
): Promise<TimerState | null> {
  try {
    const invoke = await getInvoke();
    if (!invoke) return null;
    return (await invoke('aegis_set_timer', {
      targetProfile,
      returnProfile,
      durationMin,
    })) as TimerState;
  } catch {
    return null;
  }
}

/**
 * Cancel the active timer.
 * No-op in dev mode.
 */
export async function cancelTimer(): Promise<void> {
  try {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('aegis_cancel_timer');
  } catch {
    // Silent
  }
}

/**
 * Health check — always true in Tauri, always false in dev mode.
 * Kept for backward compatibility with existing callers.
 */
export async function checkHealth(): Promise<boolean> {
  return isTauriAvailable();
}
