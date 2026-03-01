/**
 * AEGIS Throttle — reads the latest AEGIS workload profile from KERNL
 * and maps it to an indexer ThrottleMode.
 *
 * Profile → Mode mapping (§5.6):
 *   BUILD_SPRINT, COUNCIL, PARALLEL_BUILD → SKIP  (don't run at all)
 *   DEEP_FOCUS, CODE_GEN                 → HALF   (250ms budget)
 *   IDLE, STARTUP, COWORK_BATCH, RESEARCH → FULL   (500ms budget)
 *
 * @module lib/indexer/aegis-throttle
 */

import { getLatestAegisSignal } from '@/lib/kernl/aegis-store';
import type { ThrottleMode } from './types';

const SKIP_PROFILES = new Set(['BUILD_SPRINT', 'COUNCIL', 'PARALLEL_BUILD']);
const HALF_PROFILES = new Set(['DEEP_FOCUS', 'CODE_GEN']);

/**
 * Determine the current indexer throttle mode from the latest AEGIS signal.
 * If no signal exists, defaults to FULL (treat as IDLE).
 */
export function getThrottle(): ThrottleMode {
  const signal = getLatestAegisSignal();
  const profile = signal?.profile ?? 'IDLE';

  if (SKIP_PROFILES.has(profile)) return 'SKIP';
  if (HALF_PROFILES.has(profile)) return 'HALF';
  return 'FULL';
}
