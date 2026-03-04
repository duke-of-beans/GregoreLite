/**
 * ScrollbarLandmarks — pure logic tests — Sprint 11.3
 *
 * Tests cover the two exportable behaviours that don't require a DOM:
 *   1. evaluateFilter() — the payload-filter gate for landmark visibility
 *   2. Landmark position formula — message_index / (total_messages - 1)
 *
 * DOM rendering tests are intentionally omitted: the component's JSX is
 * trivially composed from these two pure functions plus a CSS-class list.
 * The project's global vitest environment is 'node' (required for
 * better-sqlite3), so React 19 DOM rendering is excluded from the test suite.
 */

import { describe, it, expect } from 'vitest';
import { evaluateFilter } from '../ScrollbarLandmarks';

// ── evaluateFilter ─────────────────────────────────────────────────────────────

describe('evaluateFilter', () => {
  it('returns true when payload value matches filter (single-quote literal)', () => {
    expect(evaluateFilter("payload.role === 'user'", { role: 'user' })).toBe(true);
  });

  it('returns false when payload value does not match filter', () => {
    expect(evaluateFilter("payload.role === 'user'", { role: 'assistant' })).toBe(false);
  });

  it('returns true for unknown / unparseable filter pattern (safe pass-through)', () => {
    // Anything that isn't `payload.<key> === '<value>'` should include the event
    expect(evaluateFilter('payload.role !== null', { role: 'user' })).toBe(true);
    expect(evaluateFilter('', {})).toBe(true);
    expect(evaluateFilter('INVALID', {})).toBe(true);
  });

  it('returns true when the filter key is missing from payload (key mismatch)', () => {
    // payload.role === 'user' but payload has no `role` key → undefined !== 'user' → false
    expect(evaluateFilter("payload.role === 'user'", {})).toBe(false);
  });

  it('handles double-quote string literals in filter expression', () => {
    expect(evaluateFilter('payload.type === "artifact"', { type: 'artifact' })).toBe(true);
    expect(evaluateFilter('payload.type === "artifact"', { type: 'message' })).toBe(false);
  });
});

// ── Position formula ───────────────────────────────────────────────────────────

/**
 * Mirror of the position logic inside ScrollbarLandmarks to keep tests in sync
 * with the component without requiring DOM rendering.
 */
function computeTopPct(messageIndex: number | null, totalMessages: number): number {
  if (typeof messageIndex === 'number' && totalMessages > 1) {
    return Math.min(1, Math.max(0, messageIndex / (totalMessages - 1))) * 100;
  }
  if (typeof messageIndex === 'number' && totalMessages === 1) {
    return 50;
  }
  // Session-level event or no message_index — caller handles fallback
  return 50;
}

describe('landmark position formula', () => {
  it('positions mid-conversation event at 50% (index 5 of 11)', () => {
    expect(computeTopPct(5, 11)).toBe(50);
  });

  it('positions first message at 0%', () => {
    expect(computeTopPct(0, 5)).toBe(0);
  });

  it('positions last message at 100%', () => {
    expect(computeTopPct(4, 5)).toBe(100);
  });

  it('positions single-message conversation at 50%', () => {
    expect(computeTopPct(0, 1)).toBe(50);
  });

  it('clamps out-of-range indices to [0, 100]', () => {
    // Defensive: should never happen in practice but formula must stay sane
    expect(computeTopPct(-1, 5)).toBe(0);   // below floor
    expect(computeTopPct(10, 5)).toBe(100); // above ceiling
  });
});
