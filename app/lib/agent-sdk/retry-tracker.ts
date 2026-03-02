/**
 * retry-tracker.ts — SHIM Per-File Retry Counter — Phase 7G
 *
 * Tracks SHIM calls per (session, file) pair in memory and logs every call
 * to shim_session_log. Detects the SHIM_LOOP condition: N consecutive calls
 * on the same file with no quality improvement, where N is the configurable
 * ceiling from budget_config.shim_retry_ceiling (default: 3).
 *
 * Key pattern: `{manifestId}:{filePath}`
 *
 * When triggerLoop is true callers must:
 *   1. Write 'blocked' to job_state
 *   2. Post escalation message to the strategic thread
 *   3. Return SHIM_LOOP_SENTINEL as the tool result so the agent sees it
 *
 * BLUEPRINT §4.3.4 (SHIM loop failure mode)
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '../kernl/database';
import { getBudgetConfigNumber } from './budget-enforcer';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ShimRetryStatus {
  callCount: number;
  improved: boolean;    // true when scoreAfter > scoreBefore
  triggerLoop: boolean; // true when callCount >= ceiling AND not improved
}

// ─── Sentinel ─────────────────────────────────────────────────────────────────

/** Prefix for tool result strings that signal a SHIM_LOOP event to the caller. */
export const SHIM_LOOP_SENTINEL = '__SHIM_LOOP__';

// ─── In-memory tracker ────────────────────────────────────────────────────────

interface RetryEntry {
  callCount: number;
  lastScore: number;
}

/** Key: `{manifestId}:{filePath}` */
const _tracker = new Map<string, RetryEntry>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * getLastScore — returns the score from the most recent SHIM call on this
 * (session, file) pair, or null if no prior calls exist.
 *
 * Callers should read this BEFORE running the analyser so they can pass the
 * correct scoreBefore to recordShimCall().
 */
export function getLastScore(manifestId: string, filePath: string): number | null {
  const key = `${manifestId}:${filePath}`;
  const entry = _tracker.get(key);
  return entry !== undefined ? entry.lastScore : null;
}

/**
 * recordShimCall — increment the call counter for this (session, file) pair,
 * persist to shim_session_log, and return the retry status.
 *
 * @param manifestId  The session manifest ID.
 * @param filePath    Absolute path to the file that was analysed.
 * @param scoreBefore Score from the previous call (pass 0 if first call).
 * @param scoreAfter  Score returned by this call.
 */
export function recordShimCall(
  manifestId: string,
  filePath: string,
  scoreBefore: number,
  scoreAfter: number,
): ShimRetryStatus {
  const key      = `${manifestId}:${filePath}`;
  const existing = _tracker.get(key);
  const callCount = (existing?.callCount ?? 0) + 1;
  const improved  = scoreAfter > scoreBefore;

  _tracker.set(key, { callCount, lastScore: scoreAfter });

  // Read configurable ceiling — default 3 per blueprint §4.3.4
  const ceiling     = getBudgetConfigNumber('shim_retry_ceiling', 3);
  const triggerLoop = callCount >= ceiling && !improved;

  // Persist to shim_session_log (non-blocking: failure does not crash session)
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO shim_session_log
        (id, manifest_id, file_path, call_number, score_before, score_after, shim_required, logged_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      manifestId,
      filePath,
      callCount,
      scoreBefore,
      scoreAfter,
      scoreAfter < 70 ? 1 : 0,
      Date.now(),
    );
  } catch {
    // Log failure must not crash the session
  }

  return { callCount, improved, triggerLoop };
}

/**
 * clearSession — remove all tracker entries for a session when it ends.
 * Called from query.ts at every exit path to prevent memory leaks.
 */
export function clearSession(manifestId: string): void {
  const prefix = `${manifestId}:`;
  for (const key of _tracker.keys()) {
    if (key.startsWith(prefix)) {
      _tracker.delete(key);
    }
  }
}
