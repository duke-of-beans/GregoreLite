/**
 * AEGIS public API — Sprint 2C
 *
 * Lifecycle:
 *   initAEGIS()   → health check, log STARTUP, start governor
 *   shutdownAEGIS() → stop governor, log SUSPEND
 *
 * Override:
 *   overrideAEGISProfile() → forceEvaluate + log is_override=1 to KERNL
 *
 * Status:
 *   getAEGISStatus() → { online: boolean; lastProfile: WorkloadProfile | null }
 */

import { logAegisSignal } from '@/lib/kernl/aegis-store';
import { AEGISGovernor } from './governor';
import type { WorkloadProfile } from './types';

export type { WorkloadProfile, AEGISState } from './types';
export { AEGIS_PROFILE_MAP } from './types';

// ── Config ────────────────────────────────────────────────────────────────────

const AEGIS_BASE_URL: string = process.env['AEGIS_URL'] ?? 'http://localhost:8999';

// ── Module-level state ────────────────────────────────────────────────────────

let _online = false;
let _governor: AEGISGovernor | null = null;

// ── Governor switch-profile callback ─────────────────────────────────────────

async function switchProfile(profile: WorkloadProfile): Promise<void> {
  try {
    await fetch(`${AEGIS_BASE_URL}/setprofile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    });
  } catch {
    // AEGIS offline — KERNl log still happens below
  }
  logAegisSignal(profile, undefined, false);
}

function ensureGovernor(): AEGISGovernor {
  if (!_governor) {
    _governor = new AEGISGovernor(switchProfile);
  }
  return _governor;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/**
 * Health-check AEGIS, log STARTUP signal to KERNL, start governor.
 * Returns true if AEGIS HTTP server is reachable, false otherwise.
 * Never throws — offline AEGIS is a degraded-mode signal, not a fatal error.
 */
export async function initAEGIS(): Promise<boolean> {
  try {
    const res = await fetch(`${AEGIS_BASE_URL}/health`);
    _online = res.ok;
  } catch {
    _online = false;
  }

  // Always log STARTUP to KERNL regardless of AEGIS health
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
