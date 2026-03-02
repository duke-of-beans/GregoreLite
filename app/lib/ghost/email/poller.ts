/**
 * poller.ts — 15-minute email polling cadence for Ghost Thread
 * Sprint 6B
 *
 * Polls Gmail and Graph connectors on a 15-minute interval.
 * Skips polling when AEGIS is in PARALLEL_BUILD or COUNCIL profile.
 * Skips connectors that have not been connected (no ghost_email_state row).
 * Surfaces a Decision Gate suggestion after 5 consecutive connector errors.
 */

import { getLatestAegisSignal } from '@/lib/kernl/aegis-store';
import { getDatabase } from '@/lib/kernl/database';
import { logDecision } from '@/lib/kernl/decision-store';

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/** AEGIS profiles under which email polling is suppressed */
const GHOST_PAUSE_PROFILES = new Set(['PARALLEL_BUILD', 'COUNCIL']);

/** Consecutive error count that triggers a Decision Gate credential warning */
const ERROR_GATE_THRESHOLD = 5;

// ── Interval handle ───────────────────────────────────────────────────────────

let _pollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Explicit lifecycle pause flag (set by Ghost lifecycle manager).
 * Distinct from the AEGIS-signal-based self-pause inside runPoll().
 * When true, runPoll() returns immediately without polling.
 */
let _explicitPause = false;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the 15-minute email poller.
 * Safe to call multiple times — idempotent.
 */
export function startEmailPoller(): void {
  if (_pollInterval !== null) return;
  _pollInterval = setInterval(() => {
    runPoll().catch((err: unknown) => {
      console.error('[ghost/poller] Unhandled poll error:', err);
    });
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the poller and clear the interval.
 * Safe to call when not started — no-op.
 */
export function stopEmailPoller(): void {
  if (_pollInterval !== null) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
  _explicitPause = false;
}

/** Whether the poller interval is currently active */
export function isPollerRunning(): boolean {
  return _pollInterval !== null && !_explicitPause;
}

/**
 * Explicitly pause polling (called by Ghost lifecycle manager on AEGIS profile change).
 * The interval timer keeps running so the poller resumes naturally; each tick
 * checks _explicitPause and returns early if set.
 */
export function pauseEmailPoller(): void {
  _explicitPause = true;
}

/**
 * Resume polling after an explicit pause.
 * Idempotent — no-op if not paused.
 */
export function resumeEmailPoller(): void {
  _explicitPause = false;
}

// ── Poll orchestration ────────────────────────────────────────────────────────

async function runPoll(): Promise<void> {
  // Skip if explicitly paused by the lifecycle manager
  if (_explicitPause) {
    return;
  }
  // Skip if AEGIS is in a pause profile (self-pause via signal read)
  if (isGhostPaused()) {
    return;
  }

  // Poll each provider independently — one failure does not skip the other
  await Promise.allSettled([
    pollProvider('gmail'),
    pollProvider('outlook'),
  ]);
}

function isGhostPaused(): boolean {
  try {
    const signal = getLatestAegisSignal();
    if (signal && GHOST_PAUSE_PROFILES.has(signal.profile)) {
      console.log(`[ghost/poller] Skipping email poll — AEGIS ${signal.profile} active`);
      return true;
    }
    return false;
  } catch {
    // AEGIS unavailable — proceed with poll
    return false;
  }
}

// ── Per-provider polling ──────────────────────────────────────────────────────

async function pollProvider(provider: 'gmail' | 'outlook'): Promise<void> {
  // Check ghost_email_state to see if this provider has ever connected
  const stateRow = getConnectorState(provider);
  if (!stateRow) return; // not connected — skip silently

  try {
    if (provider === 'gmail') {
      // Dynamic import avoids circular dependency risk when index.ts imports both
      // poller and gmail. Also defers the import until a poll actually fires.
      const { getGmailConnector } = await import('./gmail');
      // getGmailConnector() throws if singleton not initialized in this process.
      // That means the app restarted after a previous connect. Caller must re-init.
      const connector = getGmailConnector();
      const messages = await connector.poll();
      if (messages.length > 0) {
        console.log(`[ghost/poller] Gmail: ${messages.length} new message(s) ready for indexing`);
      }
    } else {
      const { getGraphConnector } = await import('./graph');
      const connector = getGraphConnector();
      const messages = await connector.poll();
      if (messages.length > 0) {
        console.log(`[ghost/poller] Graph: ${messages.length} new message(s) ready for indexing`);
      }
    }
    // poll() calls upsertEmailState() on success which resets error_count to 0
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[ghost/poller] ${provider} poll error: ${errorMsg}`);

    // Re-read state after connector's incrementErrorCount() ran in the catch
    const updatedState = getConnectorState(provider);
    if (updatedState && updatedState.error_count >= ERROR_GATE_THRESHOLD) {
      surfaceCredentialGate(provider, updatedState.account, updatedState.error_count);
    }
  }
}

// ── KERNL state helpers ───────────────────────────────────────────────────────

interface EmailStateRow {
  account: string;
  error_count: number;
  connected_at: number | null;
}

function getConnectorState(provider: 'gmail' | 'outlook'): EmailStateRow | null {
  try {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT account, error_count, connected_at
         FROM ghost_email_state
         WHERE provider = ? AND connected_at IS NOT NULL
         LIMIT 1`,
      )
      .get(provider) as EmailStateRow | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

// ── Decision Gate ─────────────────────────────────────────────────────────────

function surfaceCredentialGate(
  provider: string,
  account: string,
  errorCount: number,
): void {
  try {
    logDecision({
      category: 'infrastructure',
      title: `Ghost email connector credential check — ${provider}`,
      rationale: `The ${provider} email connector for account "${account}" has failed ${errorCount} consecutive polls. OAuth tokens may have expired or been revoked. Re-authentication via initiateOAuth() is recommended to restore email intelligence.`,
      alternatives: [
        'Re-authenticate via Settings > Connections',
        'Disable the connector if email access is no longer needed',
        'Check network connectivity and API quota limits',
      ],
      impact: 'low',
    });
    console.warn(
      `[ghost/poller] Decision Gate: ${provider} connector has ${errorCount} consecutive errors — credentials may need renewal`,
    );
  } catch (gateErr) {
    // Best effort — do not throw from the poller over a logging failure
    console.error('[ghost/poller] Failed to log Decision Gate:', gateErr);
  }
}
