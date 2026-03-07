/**
 * Web Session Types — Sprint 32.0
 *
 * Types for headless browser session management and chat routing.
 * Shared across governor, browser engine, fallback router, and UI.
 */

// ── Session status ─────────────────────────────────────────────────────────

/** Lifecycle state of a web session. */
export type WebSessionStatus = 'active' | 'expired' | 'revoked';

/** Chat routing mode. 'auto' tries web_session first, falls back to API. */
export type ChatMode = 'api' | 'web_session' | 'auto';

// ── Database row ───────────────────────────────────────────────────────────

/** Row shape for the web_sessions SQLite table. */
export interface WebSession {
  id: string;
  /** Provider identifier. Currently always 'claude'. */
  provider: string;
  /** JSON blob of Puppeteer cookie objects. */
  cookies: string;
  user_agent: string | null;
  /** Unix timestamp (ms) when session was first created. */
  session_started_at: number;
  /** Unix timestamp (ms) of the most recent message. */
  last_used_at: number;
  /** Estimated expiry timestamp (ms), or null if unknown. */
  expires_at: number | null;
  status: WebSessionStatus;
  /** Messages sent today (resets at midnight UTC). */
  daily_message_count: number;
  /** Midnight UTC (ms) for the current daily window. */
  daily_reset_at: number | null;
}

// ── Governor ───────────────────────────────────────────────────────────────

/** Rate limit configuration for the performance governor. */
export interface GovernorLimits {
  maxPerMinute: number;
  maxPerHour: number;
  maxPerDay: number;
  /** Minimum milliseconds between messages (human reading time). */
  minDelayMs: number;
}

/** Conservative defaults — match typical Claude Desktop usage. */
export const DEFAULT_GOVERNOR_LIMITS: GovernorLimits = {
  maxPerMinute: 4,
  maxPerHour: 40,
  maxPerDay: 200,
  minDelayMs: 8_000,
};

/** Result of a canSendMessage() check. */
export interface GovernorCheck {
  allowed: boolean;
  /** Milliseconds to wait before retrying (0 if allowed). */
  waitMs: number;
  /** Human-readable reason when not allowed. */
  reason?: string;
}

/** Usage stats for Settings display. */
export interface GovernorStats {
  today: number;
  thisHour: number;
  thisMinute: number;
  remainingDaily: number;
}

// ── Routing ────────────────────────────────────────────────────────────────

/** Single chunk yielded by the fallback router's async generator. */
export interface RouteChunk {
  chunk: string;
  routedVia: 'api' | 'web_session';
}
