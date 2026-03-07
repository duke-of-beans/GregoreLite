/**
 * Tests for lib/web-session/governor.ts — Sprint 32.0
 *
 * Coverage:
 *   - canSendMessage() — first message allowed
 *   - minDelayMs enforcement (actual reason string format)
 *   - Per-minute limit
 *   - Per-hour limit
 *   - Burst detection fires after burst threshold + past minDelay
 *   - recordMessageSent() updates in-memory timestamps + DB
 *   - getUsageStats() — thisMinute/thisHour from in-memory, today from DB
 *   - _resetGovernorForTest() provides test isolation
 *
 * DB mock is stateful: run() increments dailyCount, get() returns it.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Stateful DB mock ──────────────────────────────────────────────────────────

const dbState = vi.hoisted(() => ({ dailyCount: 0 }));

const { mockGet, mockPrepare } = vi.hoisted(() => {
  const mg = vi.fn().mockImplementation(() => ({
    daily_message_count: dbState.dailyCount,
    daily_reset_at: Date.now() + 86_400_000, // far-future reset — no auto-reset
  }));
  const mr = vi.fn().mockImplementation(() => {
    dbState.dailyCount++;
    return { changes: 1 };
  });
  const mp = vi.fn().mockReturnValue({ get: mg, run: mr });
  return { mockGet: mg, mockPrepare: mp };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({ prepare: mockPrepare }),
}));

import {
  getGovernor,
  _resetGovernorForTest,
} from '../governor';
import { DEFAULT_GOVERNOR_LIMITS } from '../types';

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  dbState.dailyCount = 0;
  mockGet.mockClear();
  _resetGovernorForTest();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Basic allow ───────────────────────────────────────────────────────────────

describe('canSendMessage — first message', () => {
  it('allows the first message with no history', () => {
    const gov = getGovernor();
    const result = gov.canSendMessage();
    expect(result.allowed).toBe(true);
    expect(result.waitMs).toBe(0);
  });
});

// ── minDelayMs ────────────────────────────────────────────────────────────────

describe('canSendMessage — minDelayMs enforcement', () => {
  it('blocks when sent within minDelayMs and reason mentions "Minimum delay"', () => {
    const gov = getGovernor();
    gov.recordMessageSent();
    vi.advanceTimersByTime(DEFAULT_GOVERNOR_LIMITS.minDelayMs - 1000);

    const result = gov.canSendMessage();
    expect(result.allowed).toBe(false);
    expect(result.waitMs).toBeGreaterThan(0);
    // Actual format: "Minimum delay: Xs remaining."
    expect(result.reason).toMatch(/Minimum delay/);
  });

  it('allows a message after minDelayMs has elapsed', () => {
    const gov = getGovernor();
    gov.recordMessageSent();
    vi.advanceTimersByTime(DEFAULT_GOVERNOR_LIMITS.minDelayMs + 100);
    expect(gov.canSendMessage().allowed).toBe(true);
  });
});

// ── Per-minute limit ──────────────────────────────────────────────────────────

describe('canSendMessage — per-minute limit', () => {
  it('blocks when maxPerMinute is exhausted', () => {
    const gov = getGovernor();
    for (let i = 0; i < DEFAULT_GOVERNOR_LIMITS.maxPerMinute; i++) {
      vi.advanceTimersByTime(DEFAULT_GOVERNOR_LIMITS.minDelayMs + 100);
      gov.recordMessageSent();
    }
    vi.advanceTimersByTime(DEFAULT_GOVERNOR_LIMITS.minDelayMs + 100);
    const result = gov.canSendMessage();
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Per-minute limit/);
  });
});

// ── Per-hour limit ────────────────────────────────────────────────────────────

describe('canSendMessage — per-hour limit', () => {
  it('rejects once hourly quota is full', () => {
    const gov = getGovernor();
    // Space each 61s apart so per-minute window is always clear
    const SPACING = 61_000;
    for (let i = 0; i < DEFAULT_GOVERNOR_LIMITS.maxPerHour; i++) {
      vi.advanceTimersByTime(SPACING);
      gov.recordMessageSent();
    }
    vi.advanceTimersByTime(SPACING);
    const result = gov.canSendMessage();
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Per-hour limit/);
  });
});

// ── Burst detection ───────────────────────────────────────────────────────────

describe('burst detection', () => {
  it('fires after burst threshold when minDelay is satisfied', () => {
    const BURST_THRESHOLD = 3;
    const gov = getGovernor();

    // Send exactly BURST_THRESHOLD messages, each past minDelay
    const STEP = DEFAULT_GOVERNOR_LIMITS.minDelayMs + 100;
    for (let i = 0; i < BURST_THRESHOLD; i++) {
      vi.advanceTimersByTime(STEP);
      gov.recordMessageSent();
    }

    // Advance past minDelay but stay within BURST_WINDOW (30s)
    // Total elapsed so far: BURST_THRESHOLD * STEP = 3 * 8100 = 24300ms
    // First message at 8100ms. Now at 24300 + STEP = 32400ms
    // First message is 32400-8100 = 24300ms ago → still within 30s window
    vi.advanceTimersByTime(STEP);

    const result = gov.canSendMessage();
    // Must be blocked with burst reason (burst fires after min-delay check passes)
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Burst detected/);
  });

  it('clears burst restriction after burst window + minDelay expires', () => {
    const BURST_THRESHOLD = 3;
    const BURST_WINDOW_MS  = 30_000;
    const gov = getGovernor();
    const STEP = DEFAULT_GOVERNOR_LIMITS.minDelayMs + 100;

    for (let i = 0; i < BURST_THRESHOLD; i++) {
      vi.advanceTimersByTime(STEP);
      gov.recordMessageSent();
    }

    // Advance well past both the burst window and minDelay
    vi.advanceTimersByTime(BURST_WINDOW_MS + DEFAULT_GOVERNOR_LIMITS.minDelayMs + 500);

    const result = gov.canSendMessage();
    if (!result.allowed) {
      expect(result.reason).not.toMatch(/Burst detected/);
    }
  });
});

// ── getUsageStats ─────────────────────────────────────────────────────────────

describe('getUsageStats', () => {
  it('returns zero in-memory counts on a fresh governor', () => {
    const gov = getGovernor();
    const stats = gov.getUsageStats();
    expect(stats.thisMinute).toBe(0);
    expect(stats.thisHour).toBe(0);
  });

  it('thisMinute and thisHour increment after recordMessageSent', () => {
    const gov = getGovernor();
    // First send: no minDelay needed (lastSentAt = 0)
    gov.recordMessageSent();
    vi.advanceTimersByTime(DEFAULT_GOVERNOR_LIMITS.minDelayMs + 100);
    gov.recordMessageSent();

    const stats = gov.getUsageStats();
    expect(stats.thisMinute).toBe(2);
    expect(stats.thisHour).toBe(2);
  });

  it('today reflects the DB-backed daily count', () => {
    // DB mock increments on each run() call (= each recordMessageSent)
    const gov = getGovernor();
    gov.recordMessageSent();
    vi.advanceTimersByTime(DEFAULT_GOVERNOR_LIMITS.minDelayMs + 100);
    gov.recordMessageSent();

    // DB mock was called twice by incrementDailyCount
    expect(dbState.dailyCount).toBe(2);
    const stats = gov.getUsageStats();
    expect(stats.today).toBe(2);
    expect(stats.remainingDaily).toBe(DEFAULT_GOVERNOR_LIMITS.maxPerDay - 2);
  });

  it('thisMinute drops to zero after 60s, today persists', () => {
    const gov = getGovernor();
    gov.recordMessageSent();
    vi.advanceTimersByTime(61_000);

    const stats = gov.getUsageStats();
    expect(stats.thisMinute).toBe(0);
    // today comes from DB mock (still 1)
    expect(stats.today).toBe(1);
  });
});

// ── Singleton isolation ───────────────────────────────────────────────────────

describe('_resetGovernorForTest', () => {
  it('creates a clean governor after reset', () => {
    const gov1 = getGovernor();
    gov1.recordMessageSent();
    vi.advanceTimersByTime(DEFAULT_GOVERNOR_LIMITS.minDelayMs + 100);
    gov1.recordMessageSent();
    expect(gov1.getUsageStats().thisMinute).toBe(2);

    _resetGovernorForTest();
    const gov2 = getGovernor();
    expect(gov2.getUsageStats().thisMinute).toBe(0);
  });
});
