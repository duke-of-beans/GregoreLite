/**
 * Transit Map Learning Engine — Insight Generator & Confidence Scoring Tests
 * Sprint 11.7 | TRANSIT_MAP_SPEC.md §6.2–§6.3
 *
 * Covers:
 *   - calculateConfidence: base formula, recency boost, consistency boost, cap
 *   - generateInsights: empty patterns, pass-through, deduplication, conflict detection
 *   - generateInsights: graceful fallback when getAllInsights throws
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock (used by getAllInsights inside generateInsights) ───────────────────

const { mockRun, mockGet, mockAll, mockPrepare, mockDb } = vi.hoisted(() => {
  const mockRun     = vi.fn();
  const mockGet     = vi.fn();
  const mockAll     = vi.fn().mockReturnValue([]);
  const mockPrepare = vi.fn().mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
  const mockDb      = { prepare: mockPrepare };
  return { mockRun, mockGet, mockAll, mockPrepare, mockDb };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn().mockReturnValue(mockDb),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { calculateConfidence, generateInsights } from '../insights';
import type { EventMetadata } from '@/lib/transit/types';
import type { LearningInsight, PatternResult } from '../types';

// ── Global reset ──────────────────────────────────────────────────────────────

beforeEach(() => {
  mockGet.mockReset();
  mockAll.mockReset().mockReturnValue([]);
  mockRun.mockReset();
  mockPrepare.mockReset().mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(conversationId = 'conv-1', ageMs = 1000): EventMetadata {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: conversationId,
    message_id: null,
    event_type: 'quality.interruption',
    category: 'quality',
    payload: {},
    created_at: Date.now() - ageMs,
  };
}

function makeInsight(overrides: Partial<LearningInsight> = {}): LearningInsight {
  const now = Date.now();
  return {
    id: 'insight-001',
    pattern_type: 'verbosity',
    title: 'High interruption rate in 0–500 token range',
    description: 'Test description.',
    confidence: 50,
    sample_size: 10,
    status: 'proposed',
    adjustment: {
      type: 'max_tokens',
      target: 'token_range:0–500',
      current_value: 500,
      proposed_value: 360,
    },
    before_state: '{"max_tokens":500}',
    after_state: null,
    created_at: now,
    applied_at: null,
    expires_at: now + 90 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

function makeInsightRow(insight: LearningInsight) {
  return {
    id: insight.id,
    pattern_type: insight.pattern_type,
    title: insight.title,
    description: insight.description,
    confidence: insight.confidence,
    sample_size: insight.sample_size,
    status: insight.status,
    adjustment: JSON.stringify(insight.adjustment),
    before_state: insight.before_state,
    after_state: insight.after_state,
    created_at: insight.created_at,
    applied_at: insight.applied_at,
    expires_at: insight.expires_at,
  };
}

// ── calculateConfidence ───────────────────────────────────────────────────────

describe('calculateConfidence', () => {
  it('returns 0 for sampleSize = 0', () => {
    expect(calculateConfidence(0, [])).toBe(0);
  });

  it('base formula: min(sampleSize/20*100, 90)', () => {
    expect(calculateConfidence(10, [])).toBe(50); // 10/20*100 = 50
    expect(calculateConfidence(15, [])).toBe(75); // 15/20*100 = 75
    expect(calculateConfidence(20, [])).toBe(90); // 100 → capped at 90
    expect(calculateConfidence(30, [])).toBe(90); // still capped at 90
  });

  it('adds +5 recency boost when >50% of events are within 7 days', () => {
    const events = [
      makeEvent('conv-1', 1000),              // recent
      makeEvent('conv-1', 1000),              // recent
      makeEvent('conv-1', 30 * 86400000),     // old
    ];
    // 2/3 = 67% recent → recency boost +5
    // 1 unique conversation → no consistency boost
    expect(calculateConfidence(10, events)).toBe(55);
  });

  it('does not add recency boost when ≤50% of events are recent', () => {
    const events = [
      makeEvent('conv-1', 1000),              // recent
      makeEvent('conv-1', 30 * 86400000),     // old
      makeEvent('conv-1', 30 * 86400000),     // old
    ];
    // 1/3 = 33% recent → no recency boost
    expect(calculateConfidence(10, events)).toBe(50);
  });

  it('adds +5 consistency boost when events span more than 1 conversation', () => {
    const events = [
      makeEvent('conv-1', 30 * 86400000),   // old, different conv
      makeEvent('conv-2', 30 * 86400000),   // old, different conv
    ];
    // 0/2 = 0% recent → no recency boost
    // 2 unique conversations → consistency boost +5
    expect(calculateConfidence(10, events)).toBe(55);
  });

  it('does not add consistency boost when all events are from one conversation', () => {
    const events = [
      makeEvent('conv-1', 1000),
      makeEvent('conv-1', 1000),
    ];
    // 2/2 = 100% recent → recency boost; 1 unique conv → no consistency
    expect(calculateConfidence(10, events)).toBe(55);
  });

  it('stacks both recency and consistency boosts', () => {
    const events = [
      makeEvent('conv-1', 1000),   // recent
      makeEvent('conv-2', 1000),   // recent, different conv
    ];
    // 2/2 = 100% recent → +5 recency; 2 unique convs → +5 consistency
    expect(calculateConfidence(10, events)).toBe(60);
  });

  it('caps at 95 even with maximum base + both boosts', () => {
    // sampleSize=18 → base=90, +5 recency, +5 consistency → 100 → capped at 95
    const events = [
      makeEvent('conv-1', 1000),
      makeEvent('conv-2', 1000),
    ];
    expect(calculateConfidence(18, events)).toBe(95);
  });

  it('handles empty events array with non-zero sampleSize (no boosts)', () => {
    expect(calculateConfidence(10, [])).toBe(50);
    expect(calculateConfidence(20, [])).toBe(90);
  });

  it('is strictly increasing with sample size up to the cap', () => {
    const c5  = calculateConfidence(5,  []);
    const c10 = calculateConfidence(10, []);
    const c15 = calculateConfidence(15, []);
    expect(c5).toBeLessThan(c10);
    expect(c10).toBeLessThan(c15);
  });
});

// ── generateInsights ─────────────────────────────────────────────────────────

describe('generateInsights', () => {
  it('returns [] for empty pattern array', () => {
    expect(generateInsights([])).toEqual([]);
  });

  it('returns [] when all patterns have empty insights', () => {
    const patterns: PatternResult[] = [
      { pattern_type: 'verbosity', events_analyzed: 5, insights: [] },
      { pattern_type: 'regeneration', events_analyzed: 8, insights: [] },
    ];
    expect(generateInsights(patterns)).toEqual([]);
  });

  it('passes through a new insight when no existing insights exist', () => {
    const insight = makeInsight({ id: 'new-insight-001' });
    const patterns: PatternResult[] = [
      { pattern_type: 'verbosity', events_analyzed: 15, insights: [insight] },
    ];
    const result = generateInsights(patterns);
    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe('new-insight-001');
  });

  it('flattens insights from multiple pattern results', () => {
    const i1 = makeInsight({ id: 'a', pattern_type: 'verbosity' });
    const i2 = makeInsight({
      id: 'b',
      pattern_type: 'regeneration',
      adjustment: { type: 'system_prompt', target: 'task_type:code', current_value: 'default', proposed_value: 'enhanced' },
    });
    const patterns: PatternResult[] = [
      { pattern_type: 'verbosity', events_analyzed: 15, insights: [i1] },
      { pattern_type: 'regeneration', events_analyzed: 12, insights: [i2] },
    ];
    const result = generateInsights(patterns);
    expect(result.length).toBe(2);
  });

  it('merges duplicate: replaces new insight id with existing id when same type+target exists', () => {
    const existingId = 'existing-proposed-001';
    const existing = makeInsight({ id: existingId, status: 'proposed' });
    mockAll.mockReturnValue([makeInsightRow(existing)]);

    const newInsight = makeInsight({ id: 'brand-new-id' }); // same pattern_type/adjustment as existing
    const patterns: PatternResult[] = [
      { pattern_type: 'verbosity', events_analyzed: 20, insights: [newInsight] },
    ];
    const result = generateInsights(patterns);
    expect(result.length).toBe(1);
    // id replaced with existing id → storeInsight will upsert
    expect(result[0]!.id).toBe(existingId);
  });

  it('appends conflict warning when an applied insight has a different proposed_value on same target', () => {
    // Two existing insights:
    // 1. proposed-duplicate: same pattern_type/type/target → will become the "duplicate"
    // 2. applied-conflict: applied, same type/target, DIFFERENT proposed_value → conflict

    const duplicateId = 'proposed-duplicate-001';
    const proposedDuplicate = makeInsight({
      id: duplicateId,
      status: 'proposed',
      adjustment: { type: 'max_tokens', target: 'token_range:0–500', current_value: 500, proposed_value: 360 },
    });

    const conflictId = 'applied-conflict-001';
    const appliedConflict = makeInsight({
      id: conflictId,
      status: 'applied',
      adjustment: { type: 'max_tokens', target: 'token_range:0–500', current_value: 500, proposed_value: 999 },
    });

    mockAll.mockReturnValue([
      makeInsightRow(proposedDuplicate),
      makeInsightRow(appliedConflict),
    ]);

    // New insight: same type/target, different proposed_value than applied (not duplicate)
    const newInsight = makeInsight({
      id: 'brand-new-conflict',
      adjustment: { type: 'max_tokens', target: 'token_range:0–500', current_value: 500, proposed_value: 200 },
    });
    const patterns: PatternResult[] = [
      { pattern_type: 'verbosity', events_analyzed: 20, insights: [newInsight] },
    ];
    const result = generateInsights(patterns);
    // The new insight's id was replaced by duplicateId; conflict flag was added
    expect(result[0]!.id).toBe(duplicateId);
    expect(result[0]!.description).toContain('⚠️ Conflicts');
  });

  it('proceeds without dedup when getAllInsights throws (registry not yet populated)', () => {
    // Simulate DB not available during first run
    mockPrepare.mockImplementationOnce(() => {
      throw new Error('Table does not exist yet');
    });

    const insight = makeInsight({ id: 'first-run-insight' });
    const patterns: PatternResult[] = [
      { pattern_type: 'verbosity', events_analyzed: 15, insights: [insight] },
    ];

    // Must not throw — gracefully proceeds without dedup
    expect(() => generateInsights(patterns)).not.toThrow();
    const result = generateInsights(patterns);
    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe('first-run-insight');
  });
});
