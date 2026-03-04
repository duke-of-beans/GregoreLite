/**
 * MessageMetadata — Unit Tests
 * Sprint 11.4: pure logic functions, no DOM (consistent with project test pattern)
 */

import { describe, it, expect } from 'vitest';
import { parseModelLabel, formatTokens, formatCost, formatLatency } from '../MessageMetadata';

// ── parseModelLabel ───────────────────────────────────────────────────────────

describe('parseModelLabel', () => {
  it('returns "sonnet" in cyan for sonnet model strings', () => {
    const { label, color } = parseModelLabel('claude-sonnet-4-5-20250929');
    expect(label).toBe('sonnet');
    expect(color).toBe('var(--cyan)');
  });

  it('returns "haiku" in green for haiku model strings', () => {
    const { label, color } = parseModelLabel('claude-haiku-4-5-20251001');
    expect(label).toBe('haiku');
    expect(color).toBe('var(--green-400)');
  });

  it('returns "opus" in purple for opus model strings', () => {
    const { label, color } = parseModelLabel('claude-opus-4-5-20251101');
    expect(label).toBe('opus');
    expect(color).toBe('var(--purple-400, #a78bfa)');
  });

  it('falls back gracefully for unknown model strings', () => {
    const { label } = parseModelLabel('unknown-model-v1');
    expect(label).toBeTruthy();
    expect(label.length).toBeGreaterThan(0);
  });

  it('handles bare "sonnet" without version suffix', () => {
    const { label } = parseModelLabel('sonnet');
    expect(label).toBe('sonnet');
  });
});

// ── formatTokens ──────────────────────────────────────────────────────────────

describe('formatTokens', () => {
  it('returns "in · out" format when both input and output provided', () => {
    const result = formatTokens(247, 1842);
    expect(result).toBe('247 in · 1,842 out');
  });

  it('formats large numbers with commas', () => {
    const result = formatTokens(10000, 50000);
    expect(result).toBe('10,000 in · 50,000 out');
  });

  it('falls back to total tokens when only total is provided', () => {
    const result = formatTokens(undefined, undefined, 1500);
    expect(result).toBe('1,500 tokens');
  });

  it('returns null when all values are absent', () => {
    const result = formatTokens(undefined, undefined, undefined);
    expect(result).toBeNull();
  });

  it('returns null when total tokens is zero', () => {
    const result = formatTokens(undefined, undefined, 0);
    expect(result).toBeNull();
  });

  it('prefers in/out over total when all are provided', () => {
    const result = formatTokens(100, 200, 300);
    expect(result).toBe('100 in · 200 out');
  });
});

// ── formatCost ────────────────────────────────────────────────────────────────

describe('formatCost', () => {
  it('formats cost with exactly 4 decimal places', () => {
    expect(formatCost(0.0142)).toBe('$0.0142');
  });

  it('formats small cost correctly', () => {
    expect(formatCost(0.0031)).toBe('$0.0031');
  });

  it('returns null for zero cost', () => {
    expect(formatCost(0)).toBeNull();
  });

  it('returns null for undefined cost', () => {
    expect(formatCost(undefined)).toBeNull();
  });

  it('returns null for negative cost', () => {
    expect(formatCost(-0.001)).toBeNull();
  });
});

// ── formatLatency ─────────────────────────────────────────────────────────────

describe('formatLatency', () => {
  it('shows milliseconds below 1000ms', () => {
    expect(formatLatency(842)).toBe('842ms');
  });

  it('shows seconds at 1000ms threshold', () => {
    expect(formatLatency(1000)).toBe('1.0s');
  });

  it('shows seconds for values above 1000ms', () => {
    expect(formatLatency(1200)).toBe('1.2s');
  });

  it('rounds ms values', () => {
    expect(formatLatency(999)).toBe('999ms');
  });

  it('returns null for zero latency', () => {
    expect(formatLatency(0)).toBeNull();
  });

  it('returns null for undefined latency', () => {
    expect(formatLatency(undefined)).toBeNull();
  });
});
