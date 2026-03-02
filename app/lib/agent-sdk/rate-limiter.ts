/**
 * Rate Limiter — Sprint 7E
 *
 * Token bucket with a 60-second rolling window.
 * Capacity is read from budget_config.rate_limit_tokens_per_minute (default 100 000).
 *
 * Behaviour:
 *   - At <80% consumption: spawns proceed immediately.
 *   - At ≥80% consumption: new spawns are queued (not rejected); running
 *     sessions continue unaffected.
 *   - The bucket refills continuously as old token-log entries age out of the
 *     60-second window (sliding window log, not discrete resets).
 */

import { getBudgetConfigNumber } from './budget-enforcer';

const WINDOW_MS = 60_000;
const THROTTLE_THRESHOLD = 0.80;

interface TokenEntry {
  timestamp: number;
  tokens: number;
}

export class RateLimiter {
  private _log: TokenEntry[] = [];

  /** Capacity for the current window (reads from DB on each call, cheap). */
  private getCapacity(): number {
    return getBudgetConfigNumber('rate_limit_tokens_per_minute', 100_000);
  }

  /** Prune expired entries and return total tokens consumed in window. */
  private getUsedInWindow(): number {
    const cutoff = Date.now() - WINDOW_MS;
    this._log = this._log.filter((e) => e.timestamp > cutoff);
    return this._log.reduce((sum, e) => sum + e.tokens, 0);
  }

  /**
   * Returns true when new spawns should be queued rather than started.
   * Running sessions are never interrupted when this returns true.
   */
  isThrottled(): boolean {
    const capacity = this.getCapacity();
    if (capacity <= 0) return false;
    return this.getUsedInWindow() / capacity >= THROTTLE_THRESHOLD;
  }

  /**
   * Record token consumption for the current moment.
   * Called by the scheduler when a session starts (estimated upfront) or when
   * actual token usage is known (updated during streaming checkpoints).
   */
  consume(tokens: number): void {
    if (tokens <= 0) return;
    this._log.push({ timestamp: Date.now(), tokens });
  }

  /**
   * Usage ratio 0.0–1.0 relative to capacity.
   * Used by the UI to display the rate-limit gauge.
   */
  getUsageRatio(): number {
    const capacity = this.getCapacity();
    if (capacity <= 0) return 0;
    return Math.min(this.getUsedInWindow() / capacity, 1.0);
  }

  /** Tokens consumed in the current rolling window. */
  getUsedTokens(): number {
    return this.getUsedInWindow();
  }

  /** Configured capacity (tokens per 60s). */
  getCapacityTokens(): number {
    return this.getCapacity();
  }

  /** Remove all log entries — used in tests. */
  reset(): void {
    this._log = [];
  }
}

/** Module-level singleton — one bucket for the whole process. */
export const rateLimiter = new RateLimiter();
