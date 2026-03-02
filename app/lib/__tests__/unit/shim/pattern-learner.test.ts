/**
 * PatternLearner unit tests
 *
 * Tests in-memory behaviour of the class (recordImprovement, predictSuccess,
 * getTopPatterns, getPatternStats, updatePatterns). KERNL persistence is
 * mocked via vi.mock so the DB is never touched.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock KERNL database ──────────────────────────────────────────────────────

const mockDb = {
  prepare: vi.fn().mockReturnValue({
    all: vi.fn().mockReturnValue([]),
    run: vi.fn(),
    get: vi.fn().mockReturnValue(null),
  }),
};

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => mockDb,
}));

// Make transaction a pass-through so persistPatterns works without a real db
mockDb.prepare.mockImplementation(() => ({
  all: vi.fn().mockReturnValue([]),
  run: vi.fn(),
  get: vi.fn().mockReturnValue(null),
}));

// db.transaction must return an executable function
const realDbGet = () => ({
  all: vi.fn().mockReturnValue([]),
  run: vi.fn(),
  get: vi.fn().mockReturnValue(null),
});

vi.mock('@/lib/kernl/database', () => {
  const stmtFactory = () => ({
    all: vi.fn().mockReturnValue([]),
    run: vi.fn(),
    get: vi.fn().mockReturnValue(null),
  });
  const db = {
    prepare: vi.fn().mockImplementation(() => stmtFactory()),
    transaction: vi.fn().mockImplementation((fn: () => void) => fn),
  };
  return { getDatabase: () => db };
});

// ─── Import after mock registration ──────────────────────────────────────────

import { PatternLearner, _resetPatternLearner } from '@/lib/shim/pattern-learner';
import type { HistoricalImprovement } from '@/lib/shim/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let idCounter = 0;

function makeImprovement(
  pattern: string,
  success: boolean,
  impactScore = 5,
  complexity = 50,
): HistoricalImprovement {
  return {
    id: `imp-${++idCounter}`,
    pattern,
    context: { complexity, maintainability: 70, linesOfCode: 500 },
    modification: { type: pattern, impactScore },
    outcome: { success, complexityDelta: success ? -5 : 0, maintainabilityDelta: success ? 5 : 0 },
    timestamp: Date.now(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PatternLearner', () => {
  let learner: PatternLearner;

  beforeEach(() => {
    _resetPatternLearner();
    learner = new PatternLearner();
  });

  describe('recordImprovement', () => {
    it('stores improvements in history', () => {
      learner.recordImprovement(makeImprovement('refactor', true));
      learner.recordImprovement(makeImprovement('refactor', false));
      expect(learner.getPatternStats().totalImprovements).toBe(2);
    });

    it('creates a pattern entry for a new pattern key', () => {
      learner.recordImprovement(makeImprovement('extract-method', true));
      const patterns = learner.learnPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0]!.id).toBe('extract-method');
    });

    it('accumulates multiple patterns correctly', () => {
      learner.recordImprovement(makeImprovement('refactor', true));
      learner.recordImprovement(makeImprovement('add-tests', true));
      expect(learner.learnPatterns()).toHaveLength(2);
    });
  });

  describe('learnPatterns — successRate', () => {
    it('computes successRate as fraction of successes', () => {
      learner.recordImprovement(makeImprovement('fix', true));
      learner.recordImprovement(makeImprovement('fix', true));
      learner.recordImprovement(makeImprovement('fix', false));
      const p = learner.learnPatterns().find((x) => x.id === 'fix')!;
      expect(p.successRate).toBeCloseTo(2 / 3);
    });

    it('sets frequency to total occurrence count', () => {
      for (let i = 0; i < 4; i++) {
        learner.recordImprovement(makeImprovement('loop', i % 2 === 0));
      }
      const p = learner.learnPatterns().find((x) => x.id === 'loop')!;
      expect(p.frequency).toBe(4);
    });

    it('computes averageImpact correctly', () => {
      learner.recordImprovement(makeImprovement('opt', true, 10));
      learner.recordImprovement(makeImprovement('opt', true, 20));
      const p = learner.learnPatterns().find((x) => x.id === 'opt')!;
      expect(p.averageImpact).toBeCloseTo(15);
    });
  });

  describe('predictSuccess', () => {
    it('returns empty array when no patterns exist', () => {
      expect(learner.predictSuccess({ complexity: 50, maintainability: 70, linesOfCode: 500 })).toEqual([]);
    });

    it('returns predictions sorted by confidence descending', () => {
      // Two different patterns with different success rates
      for (let i = 0; i < 5; i++) learner.recordImprovement(makeImprovement('A', true, 10, 50));
      for (let i = 0; i < 5; i++) learner.recordImprovement(makeImprovement('B', i < 2, 10, 50));

      const preds = learner.predictSuccess({ complexity: 50, maintainability: 70, linesOfCode: 500 });
      expect(preds.length).toBeGreaterThan(0);
      for (let i = 1; i < preds.length; i++) {
        expect(preds[i - 1]!.confidence).toBeGreaterThanOrEqual(preds[i]!.confidence);
      }
    });

    it('confidence is 0 for 0% success rate pattern', () => {
      learner.recordImprovement(makeImprovement('failing', false));
      const preds = learner.predictSuccess({ complexity: 50, maintainability: 70, linesOfCode: 500 });
      expect(preds[0]!.confidence).toBe(0);
    });

    it('includes reasoning string with pattern name, success rate, and similarity', () => {
      learner.recordImprovement(makeImprovement('my-pattern', true));
      const preds = learner.predictSuccess({ complexity: 50, maintainability: 70, linesOfCode: 500 });
      expect(preds[0]!.reasoning).toContain('my-pattern');
      expect(preds[0]!.reasoning).toContain('%');
    });
  });

  describe('getTopPatterns', () => {
    it('returns at most limit patterns', () => {
      for (let i = 0; i < 8; i++) {
        learner.recordImprovement(makeImprovement(`pattern-${i}`, true));
      }
      expect(learner.getTopPatterns(3)).toHaveLength(3);
    });

    it('returns fewer than limit when fewer patterns exist', () => {
      learner.recordImprovement(makeImprovement('solo', true));
      expect(learner.getTopPatterns(5)).toHaveLength(1);
    });
  });

  describe('getPatternStats', () => {
    it('returns zeros for empty learner', () => {
      const stats = learner.getPatternStats();
      expect(stats.totalPatterns).toBe(0);
      expect(stats.totalImprovements).toBe(0);
      expect(stats.averageSuccessRate).toBe(0);
    });

    it('averageSuccessRate averages across patterns', () => {
      // Pattern A: 100% success, Pattern B: 0% success → avg 50%
      learner.recordImprovement(makeImprovement('A', true));
      learner.recordImprovement(makeImprovement('B', false));
      const stats = learner.getPatternStats();
      expect(stats.averageSuccessRate).toBeCloseTo(0.5);
    });
  });
});
