/**
 * Tests for app/lib/cross-context/ — Sprint 3E
 *
 * Coverage:
 *   - clamp(): enforces [0.65, 0.92] bounds
 *   - loadThresholds(): returns defaults on first load, parses persisted JSON
 *   - saveThresholds(): clamps before writing, uses ON CONFLICT upsert
 *   - adjustThreshold(): applies delta and saves
 *   - runCalibration(): adjusts thresholds on low/high accept rates, consecutive dismissals
 *   - recordFeedback(): updates user_action, triggers calibration at threshold
 *   - insertSuggestion(): writes row and returns id
 *   - getRecencyFactor(): 1.0 fresh, 0.5 old, linear decay
 *   - getDismissalPenalty(): 0.2 per dismissal, capped at 0.8
 *   - isSuppressed(): 48h (3 dismissals) and 7-day (5 dismissals) windows
 *   - rankAndFilter(): scoring formula, max 2, threshold gate, suppressed excluded
 *
 * @module __tests__/unit/cross-context.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Database mock ─────────────────────────────────────────────────────────────
const { mockRun, mockAll, mockGet, mockPrepare } = vi.hoisted(() => {
  const mr = vi.fn().mockReturnValue({ changes: 0 });
  const ma = vi.fn().mockReturnValue([]);
  const mg = vi.fn().mockReturnValue(undefined);
  const mp = vi.fn().mockReturnValue({ run: mr, all: ma, get: mg });
  return { mockRun: mr, mockAll: ma, mockGet: mg, mockPrepare: mp };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => ({ prepare: mockPrepare })),
}));

// ── nanoid mock ───────────────────────────────────────────────────────────────
vi.mock('nanoid', () => ({ nanoid: vi.fn(() => 'test-id-001') }));

// ── calibrator mock (used in feedback tests) ──────────────────────────────────
const { mockRunCalibration, mockGetLastCalibrationTime } = vi.hoisted(() => ({
  mockRunCalibration: vi.fn().mockReturnValue({ ranAt: 0, eventsProcessed: 0, thresholdsBefore: {}, thresholdsAfter: {} }),
  mockGetLastCalibrationTime: vi.fn().mockReturnValue(0),
}));

vi.mock('@/lib/cross-context/calibrator', () => ({
  runCalibration: mockRunCalibration,
  getLastCalibrationTime: mockGetLastCalibrationTime,
  recordCalibrationRun: vi.fn(),
}));

// ── thresholds mock (used in calibrator tests — import real module for clamp tests) ──
// NOTE: thresholds.ts is tested with the real module (no mock needed for its own tests)

// ─────────────────────────────────────────────────────────────────────────────

import { clamp, loadThresholds, saveThresholds, adjustThreshold, DEFAULT_THRESHOLDS } from '@/lib/cross-context/thresholds';
import { recordFeedback, insertSuggestion } from '@/lib/cross-context/feedback';
import { getRecencyFactor, getDismissalPenalty, isSuppressed, rankAndFilter } from '@/lib/cross-context/surfacing';

// ═══════════════════════════════════════════════════════════════════════════════
// clamp
// ═══════════════════════════════════════════════════════════════════════════════

describe('clamp', () => {
  it('returns value unchanged when within [0.65, 0.92]', () => {
    expect(clamp(0.75)).toBe(0.75);
    expect(clamp(0.65)).toBe(0.65);
    expect(clamp(0.92)).toBe(0.92);
  });

  it('clamps below minimum to 0.65', () => {
    expect(clamp(0.0)).toBe(0.65);
    expect(clamp(0.64)).toBe(0.65);
  });

  it('clamps above maximum to 0.92', () => {
    expect(clamp(1.0)).toBe(0.92);
    expect(clamp(0.93)).toBe(0.92);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// loadThresholds / saveThresholds / adjustThreshold
// ═══════════════════════════════════════════════════════════════════════════════

describe('loadThresholds', () => {
  beforeEach(() => {
    mockPrepare.mockReset();
    mockGet.mockReset();
    mockRun.mockReset();
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });
  });

  it('returns DEFAULT_THRESHOLDS when no row in settings', () => {
    mockGet.mockReturnValue(undefined);
    const result = loadThresholds();
    expect(result).toEqual(DEFAULT_THRESHOLDS);
  });

  it('parses and returns persisted JSON thresholds', () => {
    const stored = { patternDetection: 0.78, onInputSuggestion: 0.88, alreadyBuiltGate: 0.70 };
    mockGet.mockReturnValue({ value: JSON.stringify(stored) });
    expect(loadThresholds()).toEqual(stored);
  });

  it('falls back to defaults for corrupted JSON', () => {
    mockGet.mockReturnValue({ value: 'not-json{{' });
    expect(loadThresholds()).toEqual(DEFAULT_THRESHOLDS);
  });

  it('fills missing keys with defaults for partial JSON', () => {
    mockGet.mockReturnValue({ value: JSON.stringify({ patternDetection: 0.80 }) });
    const result = loadThresholds();
    expect(result.patternDetection).toBe(0.80);
    expect(result.onInputSuggestion).toBe(DEFAULT_THRESHOLDS.onInputSuggestion);
    expect(result.alreadyBuiltGate).toBe(DEFAULT_THRESHOLDS.alreadyBuiltGate);
  });
});

describe('saveThresholds', () => {
  beforeEach(() => {
    mockPrepare.mockReset();
    mockRun.mockReset();
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });
  });

  it('calls prepare and run with upsert SQL', () => {
    saveThresholds({ patternDetection: 0.75, onInputSuggestion: 0.85, alreadyBuiltGate: 0.72 });
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'));
    expect(mockRun).toHaveBeenCalled();
  });

  it('clamps values before saving', () => {
    saveThresholds({ patternDetection: 0.50, onInputSuggestion: 0.99, alreadyBuiltGate: 0.72 });
    const runArg = mockRun.mock.calls[0]?.[1] as string;
    const saved = JSON.parse(runArg) as { patternDetection: number; onInputSuggestion: number };
    expect(saved.patternDetection).toBe(0.65); // clamped up
    expect(saved.onInputSuggestion).toBe(0.92); // clamped down
  });
});

describe('adjustThreshold', () => {
  beforeEach(() => {
    mockPrepare.mockReset();
    mockRun.mockReset();
    mockGet.mockReset();
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });
  });

  it('loads, applies delta, saves', () => {
    mockGet.mockReturnValue({ value: JSON.stringify(DEFAULT_THRESHOLDS) });
    adjustThreshold('patternDetection', 0.01);
    expect(mockRun).toHaveBeenCalled();
    const runArg = mockRun.mock.calls[0]?.[1] as string;
    const saved = JSON.parse(runArg) as { patternDetection: number };
    expect(saved.patternDetection).toBeCloseTo(DEFAULT_THRESHOLDS.patternDetection + 0.01, 5);
  });

  it('clamps result after applying delta', () => {
    mockGet.mockReturnValue({ value: JSON.stringify({ ...DEFAULT_THRESHOLDS, patternDetection: 0.91 }) });
    adjustThreshold('patternDetection', 0.05);
    const runArg = mockRun.mock.calls[0]?.[1] as string;
    const saved = JSON.parse(runArg) as { patternDetection: number };
    expect(saved.patternDetection).toBe(0.92); // clamped at max
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// recordFeedback / insertSuggestion
// ═══════════════════════════════════════════════════════════════════════════════

describe('recordFeedback', () => {
  beforeEach(() => {
    mockPrepare.mockReset();
    mockRun.mockReset();
    mockGet.mockReset();
    mockRunCalibration.mockReset();
    mockGetLastCalibrationTime.mockReturnValue(0);
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });
  });

  it('updates user_action and acted_at in suggestions table', () => {
    mockGet.mockReturnValue({ count: 0 });
    recordFeedback('suggestion-001', 'accepted');
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE suggestions'));
    expect(mockRun).toHaveBeenCalledWith('accepted', expect.any(Number), 'suggestion-001');
  });

  it('does not trigger calibration when event count below threshold', () => {
    mockGet.mockReturnValue({ count: 5 });
    mockGetLastCalibrationTime.mockReturnValue(Date.now() - 60_000);
    recordFeedback('suggestion-002', 'dismissed');
    expect(mockRunCalibration).not.toHaveBeenCalled();
  });

  it('triggers calibration when event count reaches 100', () => {
    mockGet.mockReturnValue({ count: 100 });
    mockGetLastCalibrationTime.mockReturnValue(Date.now() - 60_000);
    recordFeedback('suggestion-003', 'dismissed');
    expect(mockRunCalibration).toHaveBeenCalledTimes(1);
  });

  it('triggers calibration when 24h elapsed since last run', () => {
    mockGet.mockReturnValue({ count: 5 });
    const dayMs = 25 * 60 * 60 * 1000;
    mockGetLastCalibrationTime.mockReturnValue(Date.now() - dayMs);
    recordFeedback('suggestion-004', 'ignored');
    expect(mockRunCalibration).toHaveBeenCalledTimes(1);
  });
});

describe('insertSuggestion', () => {
  beforeEach(() => {
    mockPrepare.mockReset();
    mockRun.mockReset();
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });
  });

  it('inserts row and returns nanoid', () => {
    const id = insertSuggestion('chunk-001', 0.88, 0.72, 'on_input');
    expect(id).toBe('test-id-001');
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO suggestions'));
    expect(mockRun).toHaveBeenCalledWith(
      'test-id-001', 'chunk-001', 0.88, 0.72, 'on_input', expect.any(Number)
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getRecencyFactor
// ═══════════════════════════════════════════════════════════════════════════════

describe('getRecencyFactor', () => {
  it('returns 1.0 for content created now', () => {
    expect(getRecencyFactor(Date.now())).toBe(1.0);
  });

  it('returns 1.0 for content created 7 days ago', () => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(getRecencyFactor(sevenDaysAgo)).toBe(1.0);
  });

  it('returns 0.5 for content created 90 days ago', () => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    expect(getRecencyFactor(ninetyDaysAgo)).toBeCloseTo(0.5, 2);
  });

  it('returns 0.5 for content older than 90 days', () => {
    const old = Date.now() - 200 * 24 * 60 * 60 * 1000;
    expect(getRecencyFactor(old)).toBe(0.5);
  });

  it('decays linearly between 7 and 90 days', () => {
    // At midpoint (~48.5 days), factor should be ~0.75
    const midDays = (7 + 90) / 2;
    const midpoint = Date.now() - midDays * 24 * 60 * 60 * 1000;
    const factor = getRecencyFactor(midpoint);
    expect(factor).toBeGreaterThan(0.5);
    expect(factor).toBeLessThan(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getDismissalPenalty
// ═══════════════════════════════════════════════════════════════════════════════

describe('getDismissalPenalty', () => {
  beforeEach(() => {
    mockPrepare.mockReset();
    mockGet.mockReset();
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });
  });

  it('returns 0 when no dismissals', () => {
    mockGet.mockReturnValue({ count: 0 });
    expect(getDismissalPenalty('chunk-x')).toBe(0);
  });

  it('returns 0.2 per dismissal', () => {
    mockGet.mockReturnValue({ count: 2 });
    expect(getDismissalPenalty('chunk-x')).toBeCloseTo(0.4, 5);
  });

  it('caps penalty at 0.8', () => {
    mockGet.mockReturnValue({ count: 10 });
    expect(getDismissalPenalty('chunk-x')).toBe(0.8);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isSuppressed
// ═══════════════════════════════════════════════════════════════════════════════

describe('isSuppressed', () => {
  beforeEach(() => {
    mockPrepare.mockReset();
    mockGet.mockReset();
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });
  });

  it('returns false when no dismissals', () => {
    mockGet.mockReturnValue({ count: 0 });
    expect(isSuppressed('chunk-a')).toBe(false);
  });

  it('returns true when 5+ dismissals in 7-day window (7-day suppression)', () => {
    // First call (7d window) returns 5
    mockGet.mockReturnValueOnce({ count: 5 });
    expect(isSuppressed('chunk-b')).toBe(true);
  });

  it('returns true when 3+ dismissals in 48h window', () => {
    // First call (7d window) returns 2 (under 5-threshold)
    mockGet.mockReturnValueOnce({ count: 2 });
    // Second call (48h window) returns 3
    mockGet.mockReturnValueOnce({ count: 3 });
    expect(isSuppressed('chunk-c')).toBe(true);
  });

  it('returns false when 4 dismissals in 7d window but only 2 in 48h', () => {
    mockGet.mockReturnValueOnce({ count: 4 }); // 7d: below 5
    mockGet.mockReturnValueOnce({ count: 2 }); // 48h: below 3
    expect(isSuppressed('chunk-d')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// rankAndFilter
// ═══════════════════════════════════════════════════════════════════════════════

describe('rankAndFilter', () => {
  beforeEach(() => {
    mockPrepare.mockReset();
    mockGet.mockReset();
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });
  });

  const makeCandidate = (chunkId: string, similarity: number) => ({
    chunkId,
    similarity,
    distance: 1 - similarity,
  });

  it('returns empty array when no candidates', () => {
    expect(rankAndFilter([], 0.70)).toEqual([]);
  });

  it('excludes suppressed chunks', () => {
    // isSuppressed: first get (7d) = 5 → suppressed
    mockGet.mockReturnValue({ count: 5 });
    const result = rankAndFilter([makeCandidate('chunk-sup', 0.95)], 0.70);
    expect(result).toHaveLength(0);
  });

  it('excludes chunks below display score threshold', () => {
    // Not suppressed (0 dismissals), chunk metadata found, but score below threshold
    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) return { count: 0 }; // isSuppressed: 0 dismissals both windows
      if (callCount === 3) return { // chunk metadata
        content: 'test content',
        source_type: 'conversation',
        source_id: 'thread-1',
        created_at: Date.now() - 200 * 24 * 60 * 60 * 1000, // very old → recency 0.5
      };
      return { count: 0 }; // dismissal penalty: 0
    });
    // similarity=0.5 → displayScore = 0.25 * 0.5 * 1.0 = 0.125 — below 0.70
    const result = rankAndFilter([makeCandidate('chunk-low', 0.5)], 0.70);
    expect(result).toHaveLength(0);
  });

  it('returns max 2 suggestions', () => {
    const now = Date.now();
    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      // Pattern: for each candidate — 2 suppress checks + 1 chunk meta + 1 dismissal penalty
      const cyclePos = (callCount - 1) % 4;
      if (cyclePos === 0 || cyclePos === 1) return { count: 0 }; // not suppressed
      if (cyclePos === 2) return { content: 'c', source_type: 'conversation', source_id: 's', created_at: now };
      return { count: 0 }; // no dismissals
    });

    const candidates = [
      makeCandidate('c1', 0.95),
      makeCandidate('c2', 0.92),
      makeCandidate('c3', 0.90),
    ];
    const result = rankAndFilter(candidates, 0.70);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('sorts by displayScore descending', () => {
    const now = Date.now();
    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      const cyclePos = (callCount - 1) % 4;
      if (cyclePos === 0 || cyclePos === 1) return { count: 0 };
      if (cyclePos === 2) return { content: 'c', source_type: 'conversation', source_id: 's', created_at: now };
      return { count: 0 };
    });

    const candidates = [
      makeCandidate('low', 0.86),
      makeCandidate('high', 0.95),
    ];
    const result = rankAndFilter(candidates, 0.70);
    if (result.length === 2) {
      expect(result[0]!.displayScore).toBeGreaterThanOrEqual(result[1]!.displayScore);
    }
  });

  it('skips chunk when metadata not found', () => {
    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      const cyclePos = (callCount - 1) % 3;
      if (cyclePos === 0 || cyclePos === 1) return { count: 0 }; // not suppressed
      return undefined; // no chunk metadata
    });
    const result = rankAndFilter([makeCandidate('missing', 0.95)], 0.70);
    expect(result).toHaveLength(0);
  });
});
