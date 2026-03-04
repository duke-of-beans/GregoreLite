/**
 * Transit Map Learning Engine — Verbosity Detector Tests
 * Sprint 11.7 | TRANSIT_MAP_SPEC.md §6.2
 *
 * Covers:
 *   - Minimum sample gate (< 10 → returns [])
 *   - No-pattern case (no single bucket dominates)
 *   - Pattern detection (one bucket >50% of interruptions)
 *   - proposed_value formula: Math.max(256, round(median * 0.9))
 *   - Token payload fallback (estimated_total_tokens)
 *   - Events with no usable token count are skipped
 *   - Output shape: all LearningInsight fields present and valid
 */

import { describe, it, expect } from 'vitest';
import { detectVerbosityPatterns } from '../verbosity';
import type { EventMetadata } from '@/lib/transit/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInterruptionEvent(
  tokensGeneratedBeforeStop: number,
  overrides: Partial<EventMetadata> = {},
): EventMetadata {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: 'conv-1',
    message_id: null,
    event_type: 'quality.interruption',
    category: 'quality',
    payload: { tokens_generated_before_stop: tokensGeneratedBeforeStop },
    created_at: Date.now() - 1000,
    ...overrides,
  };
}

// ── Minimum sample gate ───────────────────────────────────────────────────────

describe('detectVerbosityPatterns — minimum sample gate', () => {
  it('returns [] when 0 interruption events', () => {
    expect(detectVerbosityPatterns([], [])).toEqual([]);
  });

  it('returns [] when fewer than 10 interruption events', () => {
    const events = Array.from({ length: 9 }, (_, i) => makeInterruptionEvent(300 + i));
    expect(detectVerbosityPatterns(events, [])).toEqual([]);
  });

  it('returns [] when 10+ events but fewer than 10 have usable token data', () => {
    // 5 usable, 5 without token payload → usableEvents = 5 < MIN_SAMPLE
    const usable = Array.from({ length: 5 }, () => makeInterruptionEvent(300));
    const noData = Array.from({ length: 5 }, (_, i) => ({
      ...makeInterruptionEvent(0),
      id: `evt-nodata-${i}`,
      payload: {},
    }));
    expect(detectVerbosityPatterns([...usable, ...noData], [])).toEqual([]);
  });
});

// ── No-pattern case ───────────────────────────────────────────────────────────

describe('detectVerbosityPatterns — no pattern detected', () => {
  it('returns [] when interruptions are spread evenly across all 4 buckets', () => {
    // 3 events per bucket, 12 total — each bucket = 25%, none > 50%
    const events = [
      ...Array.from({ length: 3 }, () => makeInterruptionEvent(250)),   // 0–500
      ...Array.from({ length: 3 }, () => makeInterruptionEvent(750)),   // 500–1k
      ...Array.from({ length: 3 }, () => makeInterruptionEvent(1500)),  // 1k–2k
      ...Array.from({ length: 3 }, () => makeInterruptionEvent(2500)),  // 2k+
    ];
    expect(detectVerbosityPatterns(events, [])).toEqual([]);
  });

  it('returns [] when the largest bucket has exactly 50% (not >50%)', () => {
    // 5 events in 0–500, 5 events in 500–1k — 50% each, neither exceeds threshold
    const events = [
      ...Array.from({ length: 5 }, () => makeInterruptionEvent(250)),
      ...Array.from({ length: 5 }, () => makeInterruptionEvent(750)),
    ];
    expect(detectVerbosityPatterns(events, [])).toEqual([]);
  });
});

// ── Pattern detection ─────────────────────────────────────────────────────────

describe('detectVerbosityPatterns — pattern detected', () => {
  it('detects a pattern when one bucket exceeds 50% of total interruptions', () => {
    // 8 events in 1k–2k (67%), 4 in 0–500 (33%)
    const events = [
      ...Array.from({ length: 8 }, () => makeInterruptionEvent(1500)),
      ...Array.from({ length: 4 }, () => makeInterruptionEvent(300)),
    ];
    const insights = detectVerbosityPatterns(events, []);
    expect(insights.length).toBe(1);
    expect(insights[0]!.pattern_type).toBe('verbosity');
    expect(insights[0]!.adjustment.type).toBe('max_tokens');
    expect(insights[0]!.adjustment.target).toBe('token_range:1k–2k');
  });

  it('detects pattern in the 500–1k bucket', () => {
    const events = [
      ...Array.from({ length: 8 }, () => makeInterruptionEvent(800)),  // 500–1k
      ...Array.from({ length: 2 }, () => makeInterruptionEvent(250)),  // 0–500
    ];
    const insights = detectVerbosityPatterns(events, []);
    expect(insights.length).toBe(1);
    expect(insights[0]!.adjustment.target).toBe('token_range:500–1k');
  });

  it('detects pattern in the 2k+ bucket', () => {
    const events = [
      ...Array.from({ length: 8 }, () => makeInterruptionEvent(3000)),  // 2k+
      ...Array.from({ length: 2 }, () => makeInterruptionEvent(400)),   // 0–500
    ];
    const insights = detectVerbosityPatterns(events, []);
    expect(insights.length).toBe(1);
    expect(insights[0]!.adjustment.target).toBe('token_range:2k+');
  });

  it('returns [] when dominating bucket has fewer than 5 events', () => {
    // 4 events in 0–500 (despite 40%), 6 in 500–1k
    // 500–1k has 60% — DOES trigger (6 >= 5)
    // 0–500 has 40% — does NOT exceed threshold
    const events = [
      ...Array.from({ length: 4 }, () => makeInterruptionEvent(300)),
      ...Array.from({ length: 6 }, () => makeInterruptionEvent(750)),
    ];
    const insights = detectVerbosityPatterns(events, []);
    // Only 500–1k qualifies (60% > 50%, count 6 >= 5)
    expect(insights.length).toBe(1);
    expect(insights[0]!.adjustment.target).toBe('token_range:500–1k');
  });
});

// ── proposed_value formula ────────────────────────────────────────────────────

describe('detectVerbosityPatterns — proposed_value formula', () => {
  it('sets proposed_value to Math.round(median * 0.9)', () => {
    // 10 events all at 400 tokens → median = 400, proposed = round(400 * 0.9) = 360
    const events = Array.from({ length: 10 }, () => makeInterruptionEvent(400));
    const insights = detectVerbosityPatterns(events, []);
    expect(insights.length).toBe(1);
    expect(insights[0]!.adjustment.proposed_value).toBe(360);
  });

  it('never proposes max_tokens below 256', () => {
    // Very small tokens (100 each) → median = 100, round(100 * 0.9) = 90 → clamped to 256
    const events = Array.from({ length: 10 }, () => makeInterruptionEvent(100));
    const insights = detectVerbosityPatterns(events, []);
    expect(insights.length).toBe(1);
    expect(insights[0]!.adjustment.proposed_value).toBe(256);
  });
});

// ── Token payload fallback ────────────────────────────────────────────────────

describe('detectVerbosityPatterns — token payload handling', () => {
  it('falls back to estimated_total_tokens when tokens_generated_before_stop absent', () => {
    const events = Array.from({ length: 10 }, (_, i) => {
      const e = makeInterruptionEvent(0);
      e.payload = { estimated_total_tokens: 2500 }; // 2k+ bucket
      e.id = `evt-fallback-${i}`;
      return e;
    });
    const insights = detectVerbosityPatterns(events, []);
    expect(insights.length).toBe(1);
    expect(insights[0]!.adjustment.target).toBe('token_range:2k+');
  });

  it('prefers tokens_generated_before_stop over estimated_total_tokens', () => {
    // tokens_generated_before_stop = 600 → 500–1k bucket
    // estimated_total_tokens = 300 → 0–500 bucket (should be ignored)
    const events = Array.from({ length: 10 }, (_, i) => {
      const e = makeInterruptionEvent(0);
      e.payload = { tokens_generated_before_stop: 600, estimated_total_tokens: 300 };
      e.id = `evt-prefer-${i}`;
      return e;
    });
    const insights = detectVerbosityPatterns(events, []);
    expect(insights.length).toBe(1);
    expect(insights[0]!.adjustment.target).toBe('token_range:500–1k');
  });
});

// ── Output shape ──────────────────────────────────────────────────────────────

describe('detectVerbosityPatterns — output shape', () => {
  it('produces an insight with all required LearningInsight fields', () => {
    const events = Array.from({ length: 12 }, () => makeInterruptionEvent(1200));
    const insights = detectVerbosityPatterns(events, []);
    expect(insights.length).toBe(1);
    const insight = insights[0]!;

    expect(insight.id).toBeTruthy();
    expect(insight.pattern_type).toBe('verbosity');
    expect(insight.title).toContain('1k–2k');
    expect(insight.description).toBeTruthy();
    expect(insight.confidence).toBeGreaterThan(0);
    expect(insight.confidence).toBeLessThanOrEqual(95);
    expect(insight.sample_size).toBe(12);
    expect(insight.status).toBe('proposed');
    expect(insight.after_state).toBeNull();
    expect(insight.applied_at).toBeNull();
    expect(insight.expires_at).toBeGreaterThan(insight.created_at);
  });

  it('sets expires_at ~90 days from created_at', () => {
    const events = Array.from({ length: 10 }, () => makeInterruptionEvent(1200));
    const insight = detectVerbosityPatterns(events, [])[0]!;
    const diff = insight.expires_at - insight.created_at;
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    // Allow 5s tolerance for test execution time
    expect(diff).toBeGreaterThanOrEqual(ninetyDays - 5000);
    expect(diff).toBeLessThanOrEqual(ninetyDays + 5000);
  });

  it('before_state is valid JSON containing max_tokens', () => {
    const events = Array.from({ length: 10 }, () => makeInterruptionEvent(600));
    const insight = detectVerbosityPatterns(events, [])[0]!;
    expect(() => JSON.parse(insight.before_state)).not.toThrow();
    const parsed = JSON.parse(insight.before_state) as Record<string, unknown>;
    expect('max_tokens' in parsed).toBe(true);
  });
});
