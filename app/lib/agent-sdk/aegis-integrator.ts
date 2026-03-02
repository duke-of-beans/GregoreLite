/**
 * AEGIS Integrator — Sprint 7E
 *
 * Bridge between the Session Scheduler and the AEGIS governor.
 * Called by scheduler.ts whenever the active session count changes.
 *
 * Profile transitions (via AEGISGovernor.determineProfile):
 *   0 workers  → DEEP_FOCUS
 *   1–2        → COWORK_BATCH
 *   3+         → PARALLEL_BUILD (Ghost Thread is paused automatically by
 *                                 switchProfile in aegis/index.ts)
 *
 * Note: the existing switchProfile callback in aegis/index.ts handles the
 * Ghost pause/resume transition for PARALLEL_BUILD — no duplication here.
 */

import { updateWorkerCount } from '@/lib/aegis';

/**
 * Notify AEGIS of a new active-worker count.
 * The AEGIS governor re-evaluates immediately and emits a profile signal if
 * the derived profile has changed (dedup handled by the governor).
 *
 * This function is intentionally fire-and-forget: AEGIS being offline must
 * never block session spawning.
 */
export function notifyWorkerCountChanged(activeWorkers: number): void {
  updateWorkerCount(activeWorkers).catch((err: unknown) => {
    // AEGIS offline — log only, do not propagate
    console.warn('[AEGISIntegrator] updateWorkerCount failed:', err);
  });
}
