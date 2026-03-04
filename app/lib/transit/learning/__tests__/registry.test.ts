/**
 * Transit Map Learning Engine — Registry CRUD Tests
 * Sprint 11.7 | TRANSIT_MAP_SPEC.md §6.3
 *
 * Covers:
 *   - storeInsight: calls DB with correct values, serializes adjustment, rounds confidence
 *   - applyInsight: sets status=applied, passes afterState and timestamp
 *   - dismissInsight: sets status=dismissed
 *   - rollbackInsight: returns beforeState, sets status=rolled_back, throws if not found
 *   - decayExpiredInsights: returns change count, passes timestamp, targets proposed/approved
 *   - getAllInsights: deserializes rows, returns empty array when no data
 *   - getInsightsByStatus: filters by status, deserializes rows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock ───────────────────────────────────────────────────────────────────

const { mockRun, mockGet, mockAll, mockPrepare, mockDb } = vi.hoisted(() => {
  const mockRun     = vi.fn().mockReturnValue({ changes: 0 });
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

import {
  storeInsight,
  applyInsight,
  dismissInsight,
  rollbackInsight,
  decayExpiredInsights,
  getAllInsights,
  getInsightsByStatus,
} from '../registry';
import type { LearningInsight } from '../types';

// ── Global reset ──────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRun.mockReset().mockReturnValue({ changes: 0 });
  mockGet.mockReset();
  mockAll.mockReset().mockReturnValue([]);
  mockPrepare.mockReset().mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInsight(overrides: Partial<LearningInsight> = {}): LearningInsight {
  const now = Date.now();
  return {
    id: 'insight-001',
    pattern_type: 'verbosity',
    title: 'High interruption rate in 1k–2k token range',
    description: 'Test description.',
    confidence: 70,
    sample_size: 15,
    status: 'proposed',
    adjustment: {
      type: 'max_tokens',
      target: 'token_range:1k–2k',
      current_value: 2000,
      proposed_value: 1440,
    },
    before_state: '{"max_tokens":2000}',
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

// ── storeInsight ──────────────────────────────────────────────────────────────

describe('storeInsight', () => {
  it('calls db.prepare once and db.run once', () => {
    storeInsight(makeInsight());
    expect(mockPrepare).toHaveBeenCalledOnce();
    expect(mockRun).toHaveBeenCalledOnce();
  });

  it('passes correct positional values to run()', () => {
    const insight = makeInsight();
    storeInsight(insight);
    const args = mockRun.mock.calls[0]!;
    expect(args[0]).toBe('insight-001');    // id
    expect(args[1]).toBe('verbosity');      // pattern_type
    expect(args[2]).toBe('High interruption rate in 1k–2k token range'); // title
    expect(args[3]).toBe('Test description.'); // description
    expect(args[4]).toBe(70);              // confidence (rounded)
    expect(args[5]).toBe(15);             // sample_size
    expect(args[6]).toBe('proposed');     // status
  });

  it('serializes adjustment as a JSON string', () => {
    storeInsight(makeInsight());
    const args = mockRun.mock.calls[0]!;
    const adjustmentArg = args[7] as string;
    expect(typeof adjustmentArg).toBe('string');
    expect(() => JSON.parse(adjustmentArg)).not.toThrow();
    const parsed = JSON.parse(adjustmentArg) as LearningInsight['adjustment'];
    expect(parsed.type).toBe('max_tokens');
    expect(parsed.target).toBe('token_range:1k–2k');
    expect(parsed.proposed_value).toBe(1440);
  });

  it('rounds fractional confidence to integer', () => {
    storeInsight(makeInsight({ confidence: 73.6 }));
    const args = mockRun.mock.calls[0]!;
    expect(args[4]).toBe(74); // Math.round(73.6)
  });

  it('uses UPSERT SQL (ON CONFLICT ... DO UPDATE)', () => {
    storeInsight(makeInsight());
    const sql = mockPrepare.mock.calls[0]![0] as string;
    expect(sql.toUpperCase()).toContain('ON CONFLICT');
    expect(sql.toUpperCase()).toContain('DO UPDATE');
  });
});

// ── applyInsight ──────────────────────────────────────────────────────────────

describe('applyInsight', () => {
  it('calls run() with afterState, a numeric timestamp, and the id', () => {
    applyInsight('insight-001', '{"max_tokens":1440}');
    expect(mockRun).toHaveBeenCalledOnce();
    const args = mockRun.mock.calls[0]!;
    expect(args[0]).toBe('{"max_tokens":1440}'); // after_state
    expect(typeof args[1]).toBe('number');        // applied_at timestamp
    expect(args[1]).toBeGreaterThan(0);
    expect(args[2]).toBe('insight-001');          // id
  });

  it('SQL sets status = applied', () => {
    applyInsight('insight-001', '{}');
    const sql = mockPrepare.mock.calls[0]![0] as string;
    expect(sql).toContain("'applied'");
  });
});

// ── dismissInsight ────────────────────────────────────────────────────────────

describe('dismissInsight', () => {
  it('calls run() with just the id', () => {
    dismissInsight('insight-002');
    expect(mockRun).toHaveBeenCalledWith('insight-002');
  });

  it('SQL sets status = dismissed', () => {
    dismissInsight('insight-002');
    const sql = mockPrepare.mock.calls[0]![0] as string;
    expect(sql).toContain("'dismissed'");
  });
});

// ── rollbackInsight ───────────────────────────────────────────────────────────

describe('rollbackInsight', () => {
  it('returns beforeState when insight exists', () => {
    mockGet.mockReturnValue({ before_state: '{"max_tokens":2000}' });
    const result = rollbackInsight('insight-001');
    expect(result.beforeState).toBe('{"max_tokens":2000}');
  });

  it('makes two DB calls: SELECT then UPDATE', () => {
    mockGet.mockReturnValue({ before_state: '{"max_tokens":2000}' });
    rollbackInsight('insight-001');
    expect(mockPrepare).toHaveBeenCalledTimes(2);
    // First: SELECT before_state; Second: UPDATE status
    const selectSql = mockPrepare.mock.calls[0]![0] as string;
    const updateSql = mockPrepare.mock.calls[1]![0] as string;
    expect(selectSql).toContain('SELECT');
    expect(selectSql).toContain('before_state');
    expect(updateSql).toContain("'rolled_back'");
  });

  it('passes the insight id to the UPDATE run() call', () => {
    mockGet.mockReturnValue({ before_state: '{}' });
    rollbackInsight('insight-rollback-123');
    // Second run() call is the UPDATE
    expect(mockRun).toHaveBeenCalledWith('insight-rollback-123');
  });

  it('throws when insight is not found', () => {
    mockGet.mockReturnValue(undefined);
    expect(() => rollbackInsight('nonexistent-id')).toThrow('Insight not found for rollback: nonexistent-id');
  });

  it('does not call UPDATE when insight not found', () => {
    mockGet.mockReturnValue(undefined);
    try { rollbackInsight('nonexistent'); } catch { /* expected */ }
    // Only one prepare call (SELECT) — no UPDATE
    expect(mockPrepare).toHaveBeenCalledOnce();
  });
});

// ── decayExpiredInsights ──────────────────────────────────────────────────────

describe('decayExpiredInsights', () => {
  it('returns the number of rows changed', () => {
    mockRun.mockReturnValue({ changes: 3 });
    expect(decayExpiredInsights()).toBe(3);
  });

  it('returns 0 when no rows expired', () => {
    mockRun.mockReturnValue({ changes: 0 });
    expect(decayExpiredInsights()).toBe(0);
  });

  it('passes a numeric timestamp as the first argument', () => {
    decayExpiredInsights();
    const args = mockRun.mock.calls[0]!;
    expect(typeof args[0]).toBe('number');
    expect(args[0]).toBeGreaterThan(0);
  });

  it('SQL sets status = expired and targets proposed and approved rows', () => {
    decayExpiredInsights();
    const sql = mockPrepare.mock.calls[0]![0] as string;
    expect(sql).toContain("'expired'");
    expect(sql).toContain("'proposed'");
    expect(sql).toContain("'approved'");
    // Must NOT include 'applied' in the WHERE — those should never auto-expire
    expect(sql).not.toMatch(/'applied'/);
  });
});

// ── getAllInsights ────────────────────────────────────────────────────────────

describe('getAllInsights', () => {
  it('returns empty array when DB returns no rows', () => {
    mockAll.mockReturnValue([]);
    expect(getAllInsights()).toEqual([]);
  });

  it('deserializes DB rows into LearningInsight objects', () => {
    const insight = makeInsight();
    mockAll.mockReturnValue([makeInsightRow(insight)]);
    const results = getAllInsights();
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe('insight-001');
    expect(results[0]!.pattern_type).toBe('verbosity');
    expect(results[0]!.confidence).toBe(70);
    expect(results[0]!.sample_size).toBe(15);
  });

  it('parses adjustment JSON into an object (not a string)', () => {
    mockAll.mockReturnValue([makeInsightRow(makeInsight())]);
    const results = getAllInsights();
    expect(typeof results[0]!.adjustment).toBe('object');
    expect(results[0]!.adjustment.type).toBe('max_tokens');
    expect(results[0]!.adjustment.target).toBe('token_range:1k–2k');
  });

  it('preserves null after_state', () => {
    mockAll.mockReturnValue([makeInsightRow(makeInsight({ after_state: null }))]);
    expect(getAllInsights()[0]!.after_state).toBeNull();
  });

  it('preserves null applied_at', () => {
    mockAll.mockReturnValue([makeInsightRow(makeInsight({ applied_at: null }))]);
    expect(getAllInsights()[0]!.applied_at).toBeNull();
  });

  it('returns multiple rows in order', () => {
    const i1 = makeInsight({ id: 'alpha' });
    const i2 = makeInsight({ id: 'beta', pattern_type: 'regeneration' });
    mockAll.mockReturnValue([makeInsightRow(i1), makeInsightRow(i2)]);
    const results = getAllInsights();
    expect(results.length).toBe(2);
    expect(results[0]!.id).toBe('alpha');
    expect(results[1]!.id).toBe('beta');
  });
});

// ── getInsightsByStatus ───────────────────────────────────────────────────────

describe('getInsightsByStatus', () => {
  it('returns empty array when DB returns no rows', () => {
    mockAll.mockReturnValue([]);
    expect(getInsightsByStatus('approved')).toEqual([]);
  });

  it('passes status value as a query argument', () => {
    mockAll.mockReturnValue([]);
    getInsightsByStatus('applied');
    expect(mockAll).toHaveBeenCalledWith('applied');
  });

  it('deserializes rows into LearningInsight objects', () => {
    const insight = makeInsight({ status: 'approved' });
    mockAll.mockReturnValue([makeInsightRow(insight)]);
    const results = getInsightsByStatus('approved');
    expect(results.length).toBe(1);
    expect(results[0]!.status).toBe('approved');
    expect(typeof results[0]!.adjustment).toBe('object');
  });

  it('works for each valid status value', () => {
    const statuses = ['proposed', 'approved', 'applied', 'dismissed', 'rolled_back', 'expired'] as const;
    for (const status of statuses) {
      mockAll.mockReturnValue([makeInsightRow(makeInsight({ status }))]);
      const results = getInsightsByStatus(status);
      expect(results[0]!.status).toBe(status);
    }
  });
});
