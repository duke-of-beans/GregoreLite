/**
 * failure-modes.ts — Phase 7C
 *
 * FailureMode enum and detection predicates for all error cases per §4.3.4.
 *
 * Detection responsibilities:
 *   detectContextLimit   — stop_reason === 'max_tokens'
 *   detectImpossibleTask — impossibility phrasing in final text + no files written
 *   isNetworkError       — connection-layer SDK errors (1 retry)
 *   isToolError          — all other SDK errors (3 retries with backoff)
 *   detectShimLoop       — implemented in Sprint 11.1
 *
 * BLUEPRINT §4.3.4
 */

// ─── FailureMode enum ─────────────────────────────────────────────────────────

export enum FailureMode {
  /** SDK stop_reason === 'max_tokens'. FAILED, no retry. */
  CONTEXT_LIMIT   = 'CONTEXT_LIMIT',
  /** Recoverable tool-call SDK error. FAILED after 3 retries (1s/2s/4s). */
  TOOL_ERROR      = 'TOOL_ERROR',
  /** Connection/timeout SDK error. FAILED after 1 retry (2s). */
  NETWORK_ERROR   = 'NETWORK_ERROR',
  /** Claude declares task impossible + no files written. FAILED, no retry. */
  IMPOSSIBLE_TASK = 'IMPOSSIBLE_TASK',
  /** App restart found job in active state. INTERRUPTED on boot. */
  APP_CRASH       = 'APP_CRASH',
  /** 3 consecutive SHIM calls on same file with no score improvement. BLOCKED. Implemented in Sprint 11.1. */
  SHIM_LOOP       = 'SHIM_LOOP',
}

// ─── Detection constants ──────────────────────────────────────────────────────

/** Phrases that indicate Claude has declared the task impossible. */
const IMPOSSIBILITY_PHRASES = [
  'cannot',
  'impossible',
  'not possible',
  'unable to',
] as const;

/** Substrings that identify network-layer errors in the Error message. */
const NETWORK_ERROR_KEYWORDS = [
  'econnreset',
  'econnrefused',
  'etimedout',
  'socket hang up',
  'network error',
  'connection reset',
  'connection refused',
  'request timeout',
  'response timeout',
  'fetch failed',
] as const;

// ─── Detection predicates ─────────────────────────────────────────────────────

/**
 * detectContextLimit — true when the SDK stop_reason is 'max_tokens'.
 * These sessions cannot be resumed; they must be restarted with a smaller manifest.
 */
export function detectContextLimit(stopReason: string | null | undefined): boolean {
  return stopReason === 'max_tokens';
}

/**
 * detectImpossibleTask — true when:
 *   - The agent's final response contains an explicit impossibility phrase, AND
 *   - No files were written during the session (avoids false positives on partial
 *     completions that included a cautionary disclaimer).
 */
export function detectImpossibleTask(finalText: string, filesWritten: string[]): boolean {
  if (filesWritten.length > 0) return false;
  const lower = finalText.toLowerCase();
  return IMPOSSIBILITY_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * isNetworkError — true for connection-layer errors (ECONNRESET, ETIMEDOUT, etc.).
 * Network errors get 1 auto-retry after 2 seconds before being marked FAILED.
 */
export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return NETWORK_ERROR_KEYWORDS.some((kw) => msg.includes(kw));
}

/**
 * isToolError — true for recoverable SDK errors that are not network errors.
 * Tool errors get up to 3 auto-retries with exponential backoff (1s → 2s → 4s).
 */
export function isToolError(err: unknown): boolean {
  return err instanceof Error && !isNetworkError(err);
}

/**
 * detectShimLoop — Sprint 11.1 implementation.
 *
 * Returns true when the last 3 consecutive SHIM calls on the same file show
 * no quality score improvement (each score <= the previous), signalling a
 * BLOCKED state. The session should surface an escalation banner and stop
 * attempting to fix the file.
 *
 * "Consecutive" = the last 3 entries for the most-recently-seen file.
 * "No improvement" = score[n] <= score[n-1] for all consecutive pairs.
 */
export function detectShimLoop(
  shimCallHistory: Array<{ file: string; score: number }>,
): boolean {
  if (shimCallHistory.length < 3) return false;

  // Identify the file from the most recent call
  const mostRecentFile = shimCallHistory[shimCallHistory.length - 1]?.file;
  if (!mostRecentFile) return false;

  // Collect all calls for that file in order
  const fileCalls = shimCallHistory.filter((entry) => entry.file === mostRecentFile);
  if (fileCalls.length < 3) return false;

  // Examine the last 3 calls for this file
  const last3 = fileCalls.slice(-3);
  const [a, b, c] = last3 as [
    { file: string; score: number },
    { file: string; score: number },
    { file: string; score: number },
  ];

  // Loop = no improvement in either consecutive step
  return b.score <= a.score && c.score <= b.score;
}
