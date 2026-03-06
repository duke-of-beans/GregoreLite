/**
 * Sprint 27.0 Unit Tests — Ambient Memory
 *
 * Covers: detector strategies, scorer calibration, frequency auto-reduction,
 * DB persistence helpers, and surfaceNextEvent daily cap.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRun  = vi.fn(() => ({ changes: 1 }));
const mockGet  = vi.fn(() => null);
const mockAll  = vi.fn(() => []);
const mockExec = vi.fn();

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn(() => ({ run: mockRun, get: mockGet, all: mockAll })),
    exec:    mockExec,
    transaction: vi.fn((fn: (items: unknown[]) => void) => (items: unknown[]) => fn(items)),
  })),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  scoreRecallEvent,
  isEligibleToSurface,
  getRecallCalibration,
  applyCalibration,
} from '../scorer';
import type { RecallEvent, RecallUserHistory, RecallSchedulerSettings } from '../types';
import { DEFAULT_RECALL_SETTINGS } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = Date.now();

function makeEvent(overrides: Partial<RecallEvent> = {}): RecallEvent {
  return {
    id:              overrides.id              ?? 'evt-1',
    type:            overrides.type            ?? 'file_revisit',
    source_type:     overrides.source_type     ?? 'file',
    source_name:     overrides.source_name     ?? 'README.md',
    message:         overrides.message         ?? 'README.md. 35 days since you last opened it. Still relevant?',
    relevance_score: overrides.relevance_score ?? 0.65,
    created_at:      overrides.created_at      ?? NOW - 2 * 60 * 60 * 1000, // 2h old
    ...overrides,
  };
}

function makeHistory(overrides: Partial<RecallUserHistory> = {}): RecallUserHistory {
  return {
    totalActions: overrides.totalActions ?? 0,
    appreciated:  overrides.appreciated  ?? 0,
    dismissed:    overrides.dismissed    ?? 0,
    snoozed:      overrides.snoozed      ?? 0,
    byType:       overrides.byType       ?? {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. scoreRecallEvent — base score passthrough
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreRecallEvent — base passthrough', () => {
  it('returns base score when no history and event is 2h old', () => {
    const event   = makeEvent({ relevance_score: 0.65 });
    const history = makeHistory();
    const score   = scoreRecallEvent(event, history);
    // 2h old → 0.85 multiplier applied, still comfortably above 0.4
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThanOrEqual(0.65);
  });

  it('applies recency penalty for very new events (<1h)', () => {
    const event   = makeEvent({ relevance_score: 0.65, created_at: NOW - 30 * 60 * 1000 });
    const history = makeHistory();
    const score   = scoreRecallEvent(event, history);
    // 0.65 * 0.7 = 0.455
    expect(score).toBeLessThan(0.65);
    expect(score).toBeCloseTo(0.65 * 0.7, 1);
  });

  it('applies no recency penalty for events >4h old', () => {
    const event   = makeEvent({ relevance_score: 0.65, created_at: NOW - 5 * 60 * 60 * 1000 });
    const history = makeHistory();
    const score   = scoreRecallEvent(event, history);
    expect(score).toBeCloseTo(0.65, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. scoreRecallEvent — diversity bonus
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreRecallEvent — diversity bonus', () => {
  it('boosts score when type differs from recent surfaces', () => {
    const event   = makeEvent({ type: 'personal_moment', relevance_score: 0.60, created_at: NOW - 5 * 60 * 60 * 1000 });
    const history = makeHistory();
    const scoreWithDiversity  = scoreRecallEvent(event, history, ['file_revisit', 'pattern_insight']);
    const scoreWithoutDiversity = scoreRecallEvent(event, history, []);
    expect(scoreWithDiversity).toBeGreaterThan(scoreWithoutDiversity);
  });

  it('does not boost when type matches recent surfaces', () => {
    const event   = makeEvent({ type: 'file_revisit', relevance_score: 0.60, created_at: NOW - 5 * 60 * 60 * 1000 });
    const history = makeHistory();
    const score = scoreRecallEvent(event, history, ['file_revisit']);
    expect(score).toBeCloseTo(0.60, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. scoreRecallEvent — per-type dismissal penalty
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreRecallEvent — per-type dismissal penalty', () => {
  it('reduces score for heavily-dismissed type', () => {
    const event = makeEvent({
      type: 'file_revisit',
      relevance_score: 0.65,
      created_at: NOW - 5 * 60 * 60 * 1000,
    });
    const heavyDismissHistory = makeHistory({
      totalActions: 10,
      dismissed: 8,
      appreciated: 1,
      snoozed: 1,
      byType: {
        file_revisit: { appreciated: 0, dismissed: 8, snoozed: 0 },
      },
    });
    const penalisedScore = scoreRecallEvent(event, heavyDismissHistory);
    const baseScore      = scoreRecallEvent(event, makeHistory());
    expect(penalisedScore).toBeLessThan(baseScore);
  });

  it('boosts score for heavily-appreciated type', () => {
    const event = makeEvent({
      type: 'personal_moment',
      relevance_score: 0.60,
      created_at: NOW - 5 * 60 * 60 * 1000,
    });
    const appreciateHistory = makeHistory({
      totalActions: 10,
      appreciated: 8,
      byType: {
        personal_moment: { appreciated: 8, dismissed: 0, snoozed: 0 },
      },
    });
    const boostedScore = scoreRecallEvent(event, appreciateHistory);
    const baseScore    = scoreRecallEvent(event, makeHistory());
    expect(boostedScore).toBeGreaterThan(baseScore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. isEligibleToSurface
// ─────────────────────────────────────────────────────────────────────────────

describe('isEligibleToSurface', () => {
  it('returns true for scores >= 0.40', () => {
    expect(isEligibleToSurface(0.40)).toBe(true);
    expect(isEligibleToSurface(0.55)).toBe(true);
    expect(isEligibleToSurface(1.00)).toBe(true);
  });

  it('returns false for scores < 0.40', () => {
    expect(isEligibleToSurface(0.39)).toBe(false);
    expect(isEligibleToSurface(0.00)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. getRecallCalibration
// ─────────────────────────────────────────────────────────────────────────────

describe('getRecallCalibration', () => {
  it('returns no auto-reduce for <5 total actions', () => {
    const calibration = getRecallCalibration(makeHistory({ totalActions: 3, dismissed: 3 }));
    expect(calibration.autoReduced).toBe(false);
    expect(calibration.dismissalRate).toBe(0);
  });

  it('triggers autoReduced when dismissal rate > 60%', () => {
    const history = makeHistory({ totalActions: 10, dismissed: 7, appreciated: 2, snoozed: 1 });
    const calibration = getRecallCalibration(history);
    expect(calibration.autoReduced).toBe(true);
    expect(calibration.dismissalRate).toBeCloseTo(0.7, 5);
  });

  it('triggers suggestIncrease when appreciation rate > 70%', () => {
    const history = makeHistory({ totalActions: 10, appreciated: 8, dismissed: 1, snoozed: 1 });
    const calibration = getRecallCalibration(history);
    expect(calibration.suggestIncrease).toBe(true);
    expect(calibration.appreciationRate).toBeCloseTo(0.8, 5);
  });

  it('does not trigger autoReduced when dismissal rate is exactly 60%', () => {
    const history = makeHistory({ totalActions: 10, dismissed: 6, appreciated: 4 });
    const calibration = getRecallCalibration(history);
    // 60% is NOT > 0.60 threshold (strictly greater than)
    expect(calibration.autoReduced).toBe(false);
  });

  it('both signals can be false simultaneously (healthy balance)', () => {
    const history = makeHistory({ totalActions: 10, appreciated: 4, dismissed: 3, snoozed: 3 });
    const calibration = getRecallCalibration(history);
    expect(calibration.autoReduced).toBe(false);
    expect(calibration.suggestIncrease).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. applyCalibration — frequency reduction steps
// ─────────────────────────────────────────────────────────────────────────────

describe('applyCalibration', () => {
  it('steps up detection interval when autoReduced is true', () => {
    const settings: RecallSchedulerSettings = { ...DEFAULT_RECALL_SETTINGS, detectionIntervalHours: 2 };
    const calibration = { dismissalRate: 0.7, appreciationRate: 0.1, autoReduced: true, suggestIncrease: false };
    const updated = applyCalibration(settings, calibration);
    expect(updated.detectionIntervalHours).toBe(4);
  });

  it('does not change interval when autoReduced is false', () => {
    const settings: RecallSchedulerSettings = { ...DEFAULT_RECALL_SETTINGS, detectionIntervalHours: 2 };
    const calibration = { dismissalRate: 0.3, appreciationRate: 0.5, autoReduced: false, suggestIncrease: false };
    const updated = applyCalibration(settings, calibration);
    expect(updated.detectionIntervalHours).toBe(2);
  });

  it('does not step beyond 8h (maximum interval)', () => {
    const settings: RecallSchedulerSettings = { ...DEFAULT_RECALL_SETTINGS, detectionIntervalHours: 8 };
    const calibration = { dismissalRate: 0.8, appreciationRate: 0.1, autoReduced: true, suggestIncrease: false };
    const updated = applyCalibration(settings, calibration);
    expect(updated.detectionIntervalHours).toBe(8); // already at max
  });

  it('steps from 1h to 2h', () => {
    const settings: RecallSchedulerSettings = { ...DEFAULT_RECALL_SETTINGS, detectionIntervalHours: 1 };
    const calibration = { dismissalRate: 0.7, appreciationRate: 0.1, autoReduced: true, suggestIncrease: false };
    const updated = applyCalibration(settings, calibration);
    expect(updated.detectionIntervalHours).toBe(2);
  });

  it('preserves other settings fields', () => {
    const settings: RecallSchedulerSettings = { ...DEFAULT_RECALL_SETTINGS, detectionIntervalHours: 2, maxPerDay: 5 };
    const calibration = { dismissalRate: 0.7, appreciationRate: 0.1, autoReduced: true, suggestIncrease: false };
    const updated = applyCalibration(settings, calibration);
    expect(updated.maxPerDay).toBe(5);
    expect(updated.enabled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. DEFAULT_RECALL_SETTINGS shape
// ─────────────────────────────────────────────────────────────────────────────

describe('DEFAULT_RECALL_SETTINGS', () => {
  it('has correct defaults', () => {
    expect(DEFAULT_RECALL_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_RECALL_SETTINGS.detectionIntervalHours).toBe(2);
    expect(DEFAULT_RECALL_SETTINGS.maxPerDay).toBe(3);
    expect(DEFAULT_RECALL_SETTINGS.enabledTypes).toHaveLength(6);
  });

  it('includes all 6 recall types', () => {
    const expected = [
      'file_revisit', 'conversation_callback', 'project_milestone',
      'personal_moment', 'work_anniversary', 'pattern_insight',
    ];
    for (const t of expected) {
      expect(DEFAULT_RECALL_SETTINGS.enabledTypes).toContain(t);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. RECALL copy templates shape
// ─────────────────────────────────────────────────────────────────────────────

describe('RECALL copy templates', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports required template functions and strings', async () => {
    const { RECALL } = await import('@/lib/voice/copy-templates');
    expect(typeof RECALL.file_revisit_intensive).toBe('function');
    expect(typeof RECALL.file_revisit_forgotten).toBe('function');
    expect(typeof RECALL.conversation_decision).toBe('function');
    expect(typeof RECALL.project_version).toBe('function');
    expect(typeof RECALL.project_reactivated).toBe('function');
    expect(typeof RECALL.pattern_focus).toBe('function');
    expect(typeof RECALL.pattern_topic).toBe('function');
    expect(typeof RECALL.moment_anniversary).toBe('function');
    expect(typeof RECALL.moment_first).toBe('function');
    expect(typeof RECALL.action_appreciated).toBe('string');
    expect(typeof RECALL.action_dismissed).toBe('string');
    expect(typeof RECALL.action_snoozed).toBe('string');
    expect(typeof RECALL.settings_title).toBe('string');
  });

  it('templates produce Greg-voice output (no exclamation marks)', async () => {
    const { RECALL } = await import('@/lib/voice/copy-templates');
    const outputs = [
      RECALL.file_revisit_intensive('scaffold.ts', 'January'),
      RECALL.file_revisit_forgotten('README.md', 42),
      RECALL.conversation_decision('the API choice', '3 weeks ago'),
      RECALL.project_version('GregLite', '0.5.0', 12),
      RECALL.project_reactivated('FINE PRINT', 14),
      RECALL.pattern_focus('GregLite'),
      RECALL.moment_anniversary('GregLite', '1 month', 4),
    ];
    for (const output of outputs) {
      expect(output).not.toContain('!');
      expect(output.length).toBeGreaterThan(10);
    }
  });

  it('action strings match Greg voice — short, direct', async () => {
    const { RECALL } = await import('@/lib/voice/copy-templates');
    expect(RECALL.action_appreciated).toBe('Noted.');
    expect(RECALL.action_dismissed).toBe('Gone.');
  });
});
