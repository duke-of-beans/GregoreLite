/**
 * error-handler.ts — Phase 7C
 *
 * Per-failure-mode detection, routing, and retry policy.
 *
 * Kill-switch mutual exclusion guarantee:
 *   withBackoff() accepts an AbortSignal. If killSession() fires during a
 *   backoff sleep, the sleep Promise rejects immediately and the error propagates
 *   out. The retry path and the kill-switch path are mutually exclusive by
 *   construction — you cannot be in a backoff sleep and responding to a kill
 *   simultaneously.
 *
 * Retry policy:
 *   TOOL_ERROR:    3 retries, 1s base  → delays: 1s, 2s, 4s → then FAILED
 *   NETWORK_ERROR: 1 retry,  2s base  → delay:  2s           → then FAILED
 *
 * BLUEPRINT §4.3.4
 */

import {
  FailureMode,
  detectContextLimit,
  detectImpossibleTask,
  isNetworkError,
} from './failure-modes';

export { FailureMode };

// ─── Result type ──────────────────────────────────────────────────────────────

export interface FailureResult {
  mode:    FailureMode;
  message: string;
}

// ─── Retry configuration ──────────────────────────────────────────────────────

export const RETRY_CONFIG = {
  toolError:    { maxRetries: 3, baseDelayMs: 1_000 },
  networkError: { maxRetries: 1, baseDelayMs: 2_000 },
} as const;

// ─── Backoff sleep ────────────────────────────────────────────────────────────

/**
 * sleep — resolves after ms, or rejects immediately when abortSignal fires.
 *
 * This ensures withBackoff and killSession are mutually exclusive:
 * a kill during a sleep delay throws instead of silently continuing the loop.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Session aborted before sleep started'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Session aborted during backoff delay'));
      },
      { once: true },
    );
  });
}

// ─── withBackoff ──────────────────────────────────────────────────────────────

/**
 * withBackoff — execute fn() up to maxRetries times with exponential back-off.
 *
 * Delay sequence with baseDelayMs B and attempt index i (0-based):
 *   delay = B * 2^i
 *
 * Examples:
 *   Tool errors  (maxRetries=3, base=1000):  1s → 2s → 4s → throw
 *   Network error (maxRetries=1, base=2000):  2s → throw
 *
 * If the AbortSignal fires during any sleep, throws immediately with
 * 'Session aborted during backoff delay'. Callers should propagate this to
 * the outer abort handler in query.ts.
 */
export async function withBackoff(
  fn:          () => Promise<void>,
  maxRetries:  number,
  baseDelayMs: number,
  signal?:     AbortSignal,
): Promise<void> {
  let lastErr: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new Error('Session aborted');

    try {
      await fn();
      return; // success — exit retry loop
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      // Don't sleep after the final attempt
      if (attempt < maxRetries) {
        await sleep(baseDelayMs * Math.pow(2, attempt), signal);
      }
    }
  }

  throw lastErr ?? new Error('All retries exhausted');
}

// ─── Stop-reason classifier ───────────────────────────────────────────────────

/**
 * classifyStopReason — inspect the SDK stop_reason and agent's final text.
 *
 * Returns a FailureResult if the session should transition to FAILED, or null
 * if the session completed normally (end_turn with no impossibility detected).
 *
 * Called in query.ts after stream.finalMessage() resolves.
 */
export function classifyStopReason(
  stopReason:   string | null | undefined,
  finalText:    string,
  filesWritten: string[],
): FailureResult | null {
  if (detectContextLimit(stopReason)) {
    return {
      mode:    FailureMode.CONTEXT_LIMIT,
      message: 'Context limit reached. Consider splitting into smaller tasks.',
    };
  }

  if (detectImpossibleTask(finalText, filesWritten)) {
    return {
      mode:    FailureMode.IMPOSSIBLE_TASK,
      message: 'Task marked impossible by agent. Revise the manifest.',
    };
  }

  return null; // normal completion
}

// ─── SDK error classifier ─────────────────────────────────────────────────────

/**
 * classifyError — categorise a caught Error into a FailureMode.
 *
 * Used when the Anthropic SDK throws during a stream round-trip.
 * Network errors get 1 retry; all others are classified as tool errors and
 * get up to 3 retries.
 */
export function classifyError(err: unknown): FailureResult {
  const msg = err instanceof Error ? err.message : String(err);

  if (isNetworkError(err)) {
    return { mode: FailureMode.NETWORK_ERROR, message: `Network error: ${msg}` };
  }

  return { mode: FailureMode.TOOL_ERROR, message: `Tool error: ${msg}` };
}
