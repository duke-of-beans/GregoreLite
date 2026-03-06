/**
 * Ghost Lifecycle — Startup, shutdown, pause/resume, component restart
 * Sprint 6F
 *
 * Orchestrates all Ghost components in the correct order:
 *
 * STARTUP (sequential, each step must complete before next):
 *   1. Load watch paths from KERNL settings
 *   2. Initialize ingest queue
 *   3. Prime Layer 4 privacy exclusion cache
 *   4. Start Rust filesystem watcher
 *   5. Start email poller (if connectors authenticated)
 *   6. Start interrupt scorer schedule
 *   7. Emit ghost:status-changed with state: 'running'
 *
 * SHUTDOWN (reverse order, 5-second hard timeout):
 *   1. Stop scorer schedule
 *   2. Stop email poller
 *   3. Stop filesystem watcher
 *   4. Drain / stop ingest queue
 *   5. Emit ghost:status-changed with state: 'stopped'
 *
 * DEGRADED MODE: if any startup step fails, the error is logged and the next
 * step proceeds. A partially-started Ghost is better than no Ghost.
 *
 * COMPONENT RESTART: a crashed component is marked degraded, then a single
 * restart is attempted after 30 seconds.
 */

import { startIngestQueue, stopIngestQueue, pauseIngestQueue, resumeIngestQueue } from './ingest';
import { startWatching, stopWatching } from './watcher-bridge';
import { startEmailPoller, stopEmailPoller, pauseEmailPoller, resumeEmailPoller } from './email/poller';
import { startScorerSchedule, stopScorerSchedule } from './scorer';
import {
  startRecallScheduler,
  stopRecallScheduler,
  pauseRecallScheduler,
  resumeRecallScheduler,
} from '@/lib/recall/scheduler';
import { getUserExclusions } from './privacy/layer4';
import { getDatabase } from '@/lib/kernl/database';
import {
  getGhostStatus,
  updateGhostStatus,
  addGhostStatusError,
  clearGhostStatusError,
  resetGhostStatus,
} from './status';
import { emitGhostError } from './ipc';

// ── Constants ─────────────────────────────────────────────────────────────────

const SHUTDOWN_TIMEOUT_MS = 5_000;
const COMPONENT_RESTART_DELAY_MS = 30_000;

// ── State ─────────────────────────────────────────────────────────────────────

let _started = false;
let _paused = false;

/** Tracks which components have exhausted their one restart attempt */
const _restartExhausted = new Set<string>();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Load watch paths from KERNL settings table. Falls back to empty array. */
function loadWatchPaths(): string[] {
  try {
    const db = getDatabase();
    const row = db
      .prepare(`SELECT value FROM kernl_settings WHERE key = 'ghost_watch_paths' LIMIT 1`)
      .get() as { value: string } | undefined;
    if (row?.value) {
      const parsed = JSON.parse(row.value) as unknown;
      if (Array.isArray(parsed)) return parsed as string[];
    }
  } catch (err) {
    console.warn('[ghost/lifecycle] Could not load watch paths from KERNL:', err);
  }
  return [];
}

/**
 * Run a startup step. On failure, logs the error, marks the component
 * degraded in GhostStatus, and returns false. Does NOT throw.
 */
async function tryStep(name: string, fn: () => Promise<void> | void): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ghost/lifecycle] Startup step "${name}" failed: ${message}`);
    addGhostStatusError(name, message);
    emitGhostError(name, message);
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start all Ghost components in order.
 * Idempotent — safe to call multiple times.
 */
export async function startGhost(): Promise<void> {
  if (_started) return;
  _started = true;
  _paused = false;

  updateGhostStatus({ state: 'starting', errors: [] });
  console.log('[ghost/lifecycle] Starting Ghost...');

  // Step 1: Load watch paths
  const watchPaths = loadWatchPaths();
  console.log(`[ghost/lifecycle] Watch paths: ${watchPaths.length > 0 ? watchPaths.join(', ') : '(none configured)'}`);

  // Step 2: Initialize ingest queue
  await tryStep('ingest-queue', () => startIngestQueue());

  // Step 3: Prime Layer 4 privacy exclusion cache
  await tryStep('privacy-layer4', () => {
    // getUserExclusions() reads from DB and populates the 5-min in-memory cache
    getUserExclusions();
  });

  // Step 4: Start Rust filesystem watcher
  const watcherOk = await tryStep('watcher', async () => {
    await startWatching(watchPaths.length > 0 ? watchPaths : undefined);
  });
  if (watcherOk) {
    updateGhostStatus({ watcherActive: true });
  }

  // Step 5: Start email poller (if any connector has authenticated)
  await tryStep('email-poller', () => startEmailPoller());

  // Step 6: Start interrupt scorer schedule
  await tryStep('scorer', () => startScorerSchedule());

  // Step 6b: Start recall scheduler (ambient memory)
  await tryStep('recall-scheduler', () => startRecallScheduler());

  // Step 7: Determine final state
  const status = getGhostStatus();
  const hasDegraded = status.errors.length > 0;
  updateGhostStatus({ state: hasDegraded ? 'degraded' : 'running' });
  console.log(`[ghost/lifecycle] Ghost started (state: ${hasDegraded ? 'degraded' : 'running'})`);
}

/**
 * Stop all Ghost components in reverse order.
 * Enforces a 5-second hard timeout — if components don't shut down in time,
 * we close anyway and log the timeout.
 */
export async function stopGhost(): Promise<void> {
  if (!_started) return;

  console.log('[ghost/lifecycle] Stopping Ghost...');
  updateGhostStatus({ state: 'stopped' });

  const shutdown = async (): Promise<void> => {
    // Step 1: Stop scorer
    try { stopScorerSchedule(); } catch (err) {
      console.warn('[ghost/lifecycle] Scorer stop error:', err);
    }

    // Step 1b: Stop recall scheduler
    try { stopRecallScheduler(); } catch (err) {
      console.warn('[ghost/lifecycle] Recall scheduler stop error:', err);
    }

    // Step 2: Stop email poller
    try { stopEmailPoller(); } catch (err) {
      console.warn('[ghost/lifecycle] Email poller stop error:', err);
    }

    // Step 3: Stop filesystem watcher
    try { await stopWatching(); } catch (err) {
      console.warn('[ghost/lifecycle] Watcher stop error:', err);
    }

    // Step 4: Stop ingest queue (items are retained in memory)
    try { stopIngestQueue(); } catch (err) {
      console.warn('[ghost/lifecycle] Ingest queue stop error:', err);
    }
  };

  // Race: shutdown vs hard timeout
  await Promise.race([
    shutdown(),
    new Promise<void>((resolve) =>
      setTimeout(() => {
        console.warn('[ghost/lifecycle] Shutdown timeout (5s) — forcing close');
        resolve();
      }, SHUTDOWN_TIMEOUT_MS),
    ),
  ]);

  _started = false;
  _paused = false;

  // Step 5: Emit stopped status
  resetGhostStatus();
  console.log('[ghost/lifecycle] Ghost stopped');
}

/**
 * Pause all Ghost components. Called when AEGIS enters PARALLEL_BUILD or COUNCIL.
 * Idempotent.
 */
export function pauseGhost(): void {
  if (_paused) return;
  _paused = true;
  console.log('[ghost/lifecycle] Pausing Ghost components...');

  try { pauseEmailPoller(); } catch { /* best effort */ }
  try { pauseIngestQueue(); } catch { /* best effort */ }
  try { pauseRecallScheduler(); } catch { /* best effort */ }
  // Scorer and watcher self-pause via AEGIS signal reads — no explicit call needed

  updateGhostStatus({ state: 'paused' });
}

/**
 * Resume all Ghost components. Called when AEGIS leaves a pause profile.
 * Idempotent.
 */
export function resumeGhost(): void {
  if (!_paused) return;
  _paused = false;
  console.log('[ghost/lifecycle] Resuming Ghost components...');

  try { resumeEmailPoller(); } catch { /* best effort */ }
  try { resumeIngestQueue(); } catch { /* best effort */ }
  try { resumeRecallScheduler(); } catch { /* best effort */ }

  const status = getGhostStatus();
  const hasDegraded = status.errors.length > 0;
  updateGhostStatus({ state: hasDegraded ? 'degraded' : 'running' });
}

/**
 * Attempt one restart of a named component after a 30-second delay.
 * If the restart also fails, the component stays degraded until app restart.
 * Each component gets exactly one restart attempt per app session.
 */
export async function restartComponent(
  name: string,
  startFn: () => Promise<void>,
): Promise<void> {
  if (_restartExhausted.has(name)) {
    console.warn(`[ghost/lifecycle] Component "${name}" already exhausted restart — staying degraded`);
    return;
  }

  console.log(`[ghost/lifecycle] Scheduling restart for "${name}" in ${COMPONENT_RESTART_DELAY_MS / 1000}s...`);
  await new Promise<void>((resolve) => setTimeout(resolve, COMPONENT_RESTART_DELAY_MS));

  _restartExhausted.add(name);
  try {
    await startFn();
    clearGhostStatusError(name);
    console.log(`[ghost/lifecycle] Component "${name}" restarted successfully`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ghost/lifecycle] Component "${name}" restart failed: ${message}`);
    addGhostStatusError(name, `Restart failed: ${message}`);
    emitGhostError(name, `Restart failed: ${message}`);
  }
}

/** Whether Ghost is currently running (started and not stopped). */
export function isGhostRunning(): boolean {
  return _started;
}

/** Whether Ghost is currently paused. */
export function isGhostPaused(): boolean {
  return _paused;
}
