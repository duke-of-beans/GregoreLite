/**
 * Web Session Governor — Sprint 32.0
 *
 * Enforces desktop-app-equivalent usage patterns for headless browser mode.
 * THE GOVERNOR IS NOT OPTIONAL. Every web-session message MUST pass through
 * canSendMessage() before being sent and recordMessageSent() after success.
 *
 * Rate limits (conservative defaults — match Claude Pro desktop usage):
 *   4 messages / minute
 *  40 messages / hour
 * 200 messages / day
 *   8 second minimum delay between messages (human reading time)
 *
 * Burst detection: 3+ messages in 30s → artificial delay to simulate human pacing.
 * Cooldown escalation: >180 today → minimum delay increases to 15s + warning logged.
 *
 * All limits are configurable in kernl_settings but DEFAULT to conservative values
 * that make GregLite's headless usage indistinguishable from a real desktop user.
 */

import { getDatabase } from '@/lib/kernl/database';
import type { GovernorLimits, GovernorCheck, GovernorStats } from './types';
import { DEFAULT_GOVERNOR_LIMITS } from './types';

// ── Settings keys in kernl_settings table ─────────────────────────────────
const SETTINGS_KEYS = {
  maxPerMinute: 'web_governor_max_per_minute',
  maxPerHour:   'web_governor_max_per_hour',
  maxPerDay:    'web_governor_max_per_day',
  minDelayMs:   'web_governor_min_delay_ms',
} as const;

// ── Burst detection constants ──────────────────────────────────────────────
/** Window in which burst detection counts messages (ms). */
const BURST_WINDOW_MS    = 30_000;
/** Number of messages in BURST_WINDOW_MS that constitutes a burst. */
const BURST_THRESHOLD    = 3;
/** Artificial delay introduced after burst detection (ms). */
const BURST_DELAY_MS     = 12_000;
/** Messages/day above which cooldown escalation activates. */
const COOLDOWN_THRESHOLD = 180;
/** Elevated minimum delay during cooldown (ms). */
const COOLDOWN_MIN_DELAY_MS = 15_000;

export class WebSessionGovernor {
  private limits: GovernorLimits = { ...DEFAULT_GOVERNOR_LIMITS };
  /** Timestamp (ms) of the most recent sent message. */
  private lastSentAt: number = 0;
  /** In-memory circular buffer of all sent timestamps (past 1 hour). */
  private sentTimestamps: number[] = [];

  constructor() {
    this.loadLimitsFromSettings();
  }

  // ── Settings persistence ─────────────────────────────────────────────────

  private loadLimitsFromSettings(): void {
    try {
      const db = getDatabase();
      const getInt = (key: string, fallback: number): number => {
        const row = db.prepare(
          'SELECT value FROM kernl_settings WHERE key = ?'
        ).get(key) as { value: string } | undefined;
        if (!row) return fallback;
        const n = parseInt(row.value, 10);
        return Number.isFinite(n) ? n : fallback;
      };
      this.limits = {
        maxPerMinute: getInt(SETTINGS_KEYS.maxPerMinute, DEFAULT_GOVERNOR_LIMITS.maxPerMinute),
        maxPerHour:   getInt(SETTINGS_KEYS.maxPerHour,   DEFAULT_GOVERNOR_LIMITS.maxPerHour),
        maxPerDay:    getInt(SETTINGS_KEYS.maxPerDay,    DEFAULT_GOVERNOR_LIMITS.maxPerDay),
        minDelayMs:   getInt(SETTINGS_KEYS.minDelayMs,   DEFAULT_GOVERNOR_LIMITS.minDelayMs),
      };
    } catch {
      // kernl_settings may not exist yet — silently use defaults
      this.limits = { ...DEFAULT_GOVERNOR_LIMITS };
    }
  }

  /** Persist updated limits to kernl_settings (upsert). */
  saveLimitsToSettings(limits: Partial<GovernorLimits>): void {
    try {
      const db = getDatabase();
      const upsert = db.prepare(`
        INSERT INTO kernl_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE
          SET value = excluded.value, updated_at = excluded.updated_at
      `);
      const now = Date.now();
      if (limits.maxPerMinute !== undefined) {
        upsert.run(SETTINGS_KEYS.maxPerMinute, String(limits.maxPerMinute), now);
        this.limits.maxPerMinute = limits.maxPerMinute;
      }
      if (limits.maxPerHour !== undefined) {
        upsert.run(SETTINGS_KEYS.maxPerHour, String(limits.maxPerHour), now);
        this.limits.maxPerHour = limits.maxPerHour;
      }
      if (limits.maxPerDay !== undefined) {
        upsert.run(SETTINGS_KEYS.maxPerDay, String(limits.maxPerDay), now);
        this.limits.maxPerDay = limits.maxPerDay;
      }
      if (limits.minDelayMs !== undefined) {
        upsert.run(SETTINGS_KEYS.minDelayMs, String(limits.minDelayMs), now);
        this.limits.minDelayMs = limits.minDelayMs;
      }
    } catch (err) {
      console.warn('[governor] Failed to save limits to settings:', err);
    }
  }

  getLimits(): GovernorLimits {
    return { ...this.limits };
  }

  // ── Daily counter (persisted in web_sessions table) ───────────────────────

  private getMidnightUtcMs(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }

  private getDailyCount(): number {
    try {
      const db = getDatabase();
      const midnight = this.getMidnightUtcMs();
      const row = db.prepare(`
        SELECT daily_message_count, daily_reset_at
        FROM web_sessions
        WHERE status = 'active'
        ORDER BY last_used_at DESC
        LIMIT 1
      `).get() as { daily_message_count: number; daily_reset_at: number | null } | undefined;

      if (!row) return 0;

      // Auto-reset if daily_reset_at is before today's midnight UTC
      if (row.daily_reset_at === null || row.daily_reset_at < midnight) {
        db.prepare(`
          UPDATE web_sessions
          SET daily_message_count = 0, daily_reset_at = ?
          WHERE status = 'active'
        `).run(midnight);
        return 0;
      }
      return row.daily_message_count;
    } catch {
      return 0;
    }
  }

  private incrementDailyCount(): void {
    try {
      const db = getDatabase();
      const midnight = this.getMidnightUtcMs();
      // Atomically increment count and ensure daily_reset_at is set correctly
      db.prepare(`
        UPDATE web_sessions
        SET daily_message_count = daily_message_count + 1,
            daily_reset_at = CASE
              WHEN daily_reset_at IS NULL OR daily_reset_at < ?
              THEN ?
              ELSE daily_reset_at
            END,
            last_used_at = ?
        WHERE status = 'active'
      `).run(midnight, midnight, Date.now());
    } catch (err) {
      console.warn('[governor] Failed to increment daily count:', err);
    }
  }

  // ── In-memory timestamp buffer ─────────────────────────────────────────

  /** Discard timestamps older than 1 hour (max window we ever query). */
  private pruneTimestamps(): void {
    const cutoff = Date.now() - 3_600_000;
    this.sentTimestamps = this.sentTimestamps.filter((t) => t > cutoff);
  }

  private countInWindow(windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    return this.sentTimestamps.filter((t) => t > cutoff).length;
  }

  /** True if 3+ messages sent within the last 30 seconds. */
  private detectBurst(): boolean {
    return this.countInWindow(BURST_WINDOW_MS) >= BURST_THRESHOLD;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Check whether the governor permits sending a message right now.
   * Call this BEFORE every web-session message. Never bypass.
   */
  canSendMessage(): GovernorCheck {
    this.pruneTimestamps();
    const now = Date.now();
    const dailyCount = this.getDailyCount();

    // Effective minimum delay (escalated during cooldown)
    const effectiveMinDelay = dailyCount >= COOLDOWN_THRESHOLD
      ? COOLDOWN_MIN_DELAY_MS
      : this.limits.minDelayMs;

    // ── Minimum delay between messages ───────────────────────────────────
    if (this.lastSentAt > 0) {
      const elapsed = now - this.lastSentAt;
      if (elapsed < effectiveMinDelay) {
        const waitMs = effectiveMinDelay - elapsed;
        return {
          allowed: false,
          waitMs,
          reason: dailyCount >= COOLDOWN_THRESHOLD
            ? `Cooldown active (${dailyCount}/${this.limits.maxPerDay} today). Waiting ${Math.ceil(waitMs / 1000)}s.`
            : `Minimum delay: ${Math.ceil(waitMs / 1000)}s remaining.`,
        };
      }
    }

    // ── Per-minute check ────────────────────────────────────────────────
    const thisMinute = this.countInWindow(60_000);
    if (thisMinute >= this.limits.maxPerMinute) {
      const oldest = this.sentTimestamps
        .filter((t) => t > now - 60_000)
        .sort((a, b) => a - b)[0] ?? now;
      const waitMs = Math.max(0, oldest + 60_000 - now);
      return {
        allowed: false,
        waitMs,
        reason: `Per-minute limit (${this.limits.maxPerMinute}/min) reached. Waiting ${Math.ceil(waitMs / 1000)}s.`,
      };
    }

    // ── Per-hour check ──────────────────────────────────────────────────
    const thisHour = this.countInWindow(3_600_000);
    if (thisHour >= this.limits.maxPerHour) {
      const oldest = this.sentTimestamps
        .filter((t) => t > now - 3_600_000)
        .sort((a, b) => a - b)[0] ?? now;
      const waitMs = Math.max(0, oldest + 3_600_000 - now);
      return {
        allowed: false,
        waitMs,
        reason: `Per-hour limit (${this.limits.maxPerHour}/hr) reached. Waiting ${Math.ceil(waitMs / 1000)}s.`,
      };
    }

    // ── Per-day check ────────────────────────────────────────────────────
    if (dailyCount >= this.limits.maxPerDay) {
      return {
        allowed: false,
        waitMs: 0,
        reason: `Daily limit (${this.limits.maxPerDay}/day) reached. Resets at midnight UTC.`,
      };
    }

    // ── Burst detection (introduces delay, doesn't outright block) ────────
    if (this.detectBurst()) {
      const elapsed = now - this.lastSentAt;
      if (elapsed < BURST_DELAY_MS) {
        const waitMs = BURST_DELAY_MS - elapsed;
        return {
          allowed: false,
          waitMs,
          reason: `Burst detected (3+ messages in 30s). Simulating human pacing — waiting ${Math.ceil(waitMs / 1000)}s.`,
        };
      }
    }

    // ── Cooldown warning (approaching daily cap) ──────────────────────────
    if (dailyCount >= COOLDOWN_THRESHOLD) {
      console.warn(
        `[governor] Approaching daily cap: ${dailyCount}/${this.limits.maxPerDay} messages today. ` +
        `Minimum delay elevated to ${COOLDOWN_MIN_DELAY_MS / 1000}s.`
      );
    }

    return { allowed: true, waitMs: 0 };
  }

  /**
   * Record a successfully sent message.
   * Call this AFTER each web-session message is confirmed sent.
   */
  recordMessageSent(): void {
    const now = Date.now();
    this.lastSentAt = now;
    this.sentTimestamps.push(now);
    this.incrementDailyCount();
  }

  /** Usage stats for display in Settings. */
  getUsageStats(): GovernorStats {
    this.pruneTimestamps();
    const today = this.getDailyCount();
    return {
      today,
      thisHour:      this.countInWindow(3_600_000),
      thisMinute:    this.countInWindow(60_000),
      remainingDaily: Math.max(0, this.limits.maxPerDay - today),
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _governor: WebSessionGovernor | null = null;

export function getGovernor(): WebSessionGovernor {
  if (!_governor) _governor = new WebSessionGovernor();
  return _governor;
}

/** Reset singleton — for testing only. */
export function _resetGovernorForTest(): void {
  _governor = null;
}
