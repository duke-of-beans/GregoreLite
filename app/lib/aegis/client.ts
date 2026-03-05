/**
 * AEGIS HTTP Client — Sprint 2C
 *
 * Fire-and-forget HTTP client for AEGIS v2.0 status server.
 *
 * Real API shape (read from D:\Dev\aegis\src\status\server.ts):
 *   POST /switch  { profile: string }  — switch workload profile
 *   GET  /health  → { alive: boolean } — liveness check
 *
 * Port: 8743 (status_window.port in aegis-config.yaml).
 * Override via AEGIS_STATUS_PORT env var.
 *
 * CRITICAL: AEGIS being offline is a normal operating condition.
 * This client NEVER throws. Silent failure is the correct behavior.
 * GregLite must work regardless of AEGIS state.
 */

import { AEGIS_PROFILE_MAP, type WorkloadProfile } from './types';

// Port read from aegis-config.yaml: status_window.port = 8743
// Configurable via env var for flexibility across environments.
const AEGIS_PORT = parseInt(process.env.AEGIS_STATUS_PORT ?? '8743', 10);

const AEGIS_BASE = `http://localhost:${AEGIS_PORT}`;
const REQUEST_TIMEOUT_MS = 2000;

// Log the offline warning once, not on every call
let _offlineWarned = false;

/**
 * Send a workload profile switch to AEGIS.
 * Maps GregLite WorkloadProfile → AEGIS native profile name.
 * Fire-and-forget: never throws, logs warning if AEGIS is offline.
 */
export async function switchProfile(profile: WorkloadProfile): Promise<void> {
  const aegisProfile = AEGIS_PROFILE_MAP[profile];
  try {
    await fetch(`${AEGIS_BASE}/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: aegisProfile }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // AEGIS offline or unreachable — log once, never throw.
    // This is expected when AEGIS hasn't been started.
    if (!_offlineWarned) {
      console.warn(`[aegis:client] AEGIS offline — could not switch to ${aegisProfile} (${profile}). Suppressing further warnings.`);
      _offlineWarned = true;
    }
  }
}

/**
 * Check if AEGIS is reachable.
 * Returns false on any network error — never throws.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AEGIS_BASE}/health`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Expose the configured port for status bar display */
export function getAegisPort(): number {
  return AEGIS_PORT;
}
