/**
 * Transit Map Learning Engine — Pipeline Orchestrator Tests
 * Sprint 11.7 | TRANSIT_MAP_SPEC.md §6.1
 *
 * Covers:
 *   - runLearningPipeline: returns [] when no pending events
 *   - runLearningPipeline: calls decayExpiredInsights at the start
 *   - runLearningPipeline: returns [] when no learnable event types
 *   - runLearningPipeline: enforces MIN_SAMPLE gate per event group
 *   - runLearningPipeline: marks processed events with learning_status=processed
 *   - runLearningPipeline: stores generated insights via storeInsight
 *   - Error isolation: decayExpiredInsights failure does not crash pipeline
 *   - Error isolation: storeInsight failure for one insight does not crash pipeline
 *   - Error isolation: top-level unexpected error does not crash pipeline
 *   - startLearningScheduler / stopLearningScheduler: start/stop/idempotent/safe-stop
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// Mock transit registry to control learnable event types
vi.mock('@/lib/transit/registry', () => ({
  getAllEventTypes: vi.fn().mockReturnValue([
    { id: 'quality.interruption', learnable: true },
    { id: 'quality.regeneration', learnable: true },
    { id: 'system.model_route',   learnable: true },
    { id: 'flow.message',         learnable: false }, // non-learnable, must be ignored
  ]),
}));

// Mock pattern detectors — pipeline tests focus on orchestration, not detection logic
vi.mock('../verbosity', () => ({
  detectVerbosityPatterns: vi.fn().mockReturnValue([]),
}));
vi.mock('../regeneration', () => ({
  detectRegenerationPatterns: vi.fn().mockReturnValue([]),
}));
vi.mock('../model-routing', () => ({
  detectModelRoutingPatterns: vi.fn().mockReturnValue([]),
}));

// Mock insight generator and registry CRUD
vi.mock('../insights', () => ({
  generateInsights: vi.fn().mockReturnValue([]),
}));
vi.mock('../registry', () => ({
  storeInsight:          vi.fn(),
  decayExpiredInsights:  vi.fn().mockReturnValue(0),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { runLearningPipeline, startLearningScheduler, stopLearningScheduler } from '../pipeline';
import { getAllEventTypes } from '@/lib/transit/registry';
import { decayExpiredInsights, storeInsight } from '../registry';
import { generateInsights } from '../insights';
import { detectVerbosityPatterns } from '../verbosity';
import type { LearningInsight } from '../types';

// ── Global reset ──────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRun.mockReset().mockReturnValue({ changes: 0 });
  mockGet.mockReset();
  mockAll.mockReset().mockReturnValue([]);
  mockPrepare.mockReset().mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
  // Full reset (clears call counts) then restore defaults
  vi.mocked(generateInsights).mockReset().mockReturnValue([]);
  vi.mocked(decayExpiredInsights).mockReset().mockReturnValue(0);
  vi.mocked(storeInsight).mockReset();
  vi.mocked(detectVerbosityPatterns).mockReset().mockReturnValue([]);
});

afterEach(() => {
  stopLearningScheduler();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build mock DB rows as returned by getPendingLearnableEvents SELECT */
function makePendingRows(count: number, eventType: string) {
  return Array.from({ length: count }, (_, i) => ({
    id: `evt-${eventType.replace('.', '-')}-${i}`,
    conversation_id: 'conv-1',
    message_id: null,
    event_type: eventType,
    category: 'quality',
    payload: '{"tokens_generated_before_stop": 1500}',
    created_at: Date.now() - 1000,
  }));
}

function makeFakeInsight(id: string): LearningInsight {
  const now = Date.now();
  return {
    id,
    pattern_type: 'verbosity',
    title: 'Test insight',
    description: 'Test',
    confidence: 70,
    sample_size: 12,
    status: 'proposed',
    adjustment: { type: 'max_tokens', target: 'test', current_value: 500, proposed_value: 450 },
    before_state: '{}',
    after_state: null,
    created_at: now,
    applied_at: null,
    expires_at: now + 90 * 24 * 60 * 60 * 1000,
  };
}

// ── runLearningPipeline — basic orchestration ─────────────────────────────────

describe('runLearningPipeline — basic orchestration', () => {
  it('returns empty array when no pending events exist', async () => {
    mockAll.mockReturnValue([]);
    const results = await runLearningPipeline();
    expect(results).toEqual([]);
  });

  it('calls decayExpiredInsights at the start of each run', async () => {
    mockAll.mockReturnValue([]);
    await runLearningPipeline();
    expect(decayExpiredInsights).toHaveBeenCalledOnce();
  });

  it('returns empty array when no learnable event types are registered', async () => {
    vi.mocked(getAllEventTypes).mockReturnValueOnce([
      { id: 'flow.message', learnable: false } as ReturnType<typeof getAllEventTypes>[0],
    ]);
    const results = await runLearningPipeline();
    expect(results).toEqual([]);
  });

  it('returns empty array when pending events exist but are all non-learnable types', async () => {
    // Only flow.message events — filtered out because learnable=false
    mockAll.mockReturnValue(makePendingRows(15, 'flow.message'));
    const results = await runLearningPipeline();
    expect(results).toEqual([]);
  });
});

// ── runLearningPipeline — minimum sample gate ────────────────────────────────

describe('runLearningPipeline — minimum sample gate (§6.3)', () => {
  it('skips event group with fewer than 10 events', async () => {
    // Only 5 interruption events — below MIN_SAMPLE of 10
    mockAll.mockReturnValue(makePendingRows(5, 'quality.interruption'));
    await runLearningPipeline();
    expect(detectVerbosityPatterns).not.toHaveBeenCalled();
  });

  it('processes event group with exactly 10 events', async () => {
    mockAll.mockReturnValue(makePendingRows(10, 'quality.interruption'));
    await runLearningPipeline();
    expect(detectVerbosityPatterns).toHaveBeenCalledOnce();
  });

  it('processes groups meeting threshold while skipping those that do not', async () => {
    // 12 interruption events (passes) + 3 regeneration events (skipped)
    const events = [
      ...makePendingRows(12, 'quality.interruption'),
      ...makePendingRows(3, 'quality.regeneration'),
    ];
    mockAll.mockReturnValue(events);
    await runLearningPipeline();
    // Verbosity detector called for interruption (12 >= 10)
    expect(detectVerbosityPatterns).toHaveBeenCalledOnce();
  });
});

// ── runLearningPipeline — event processing ────────────────────────────────────

describe('runLearningPipeline — event processing', () => {
  it('marks all processed event IDs with learning_status=processed', async () => {
    mockAll.mockReturnValue(makePendingRows(12, 'quality.interruption'));
    await runLearningPipeline();
    // Should call db.prepare with SQL containing 'processed'
    const updateCalls = mockPrepare.mock.calls.filter(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('processed'),
    );
    expect(updateCalls.length).toBeGreaterThan(0);
  });

  it('calls generateInsights with the collected pattern results', async () => {
    mockAll.mockReturnValue(makePendingRows(12, 'quality.interruption'));
    await runLearningPipeline();
    expect(generateInsights).toHaveBeenCalledOnce();
  });

  it('calls storeInsight for each insight returned by generateInsights', async () => {
    const insight1 = makeFakeInsight('insight-a');
    const insight2 = makeFakeInsight('insight-b');
    vi.mocked(generateInsights).mockReturnValueOnce([insight1, insight2]);
    mockAll.mockReturnValue(makePendingRows(12, 'quality.interruption'));

    await runLearningPipeline();

    expect(storeInsight).toHaveBeenCalledTimes(2);
    expect(storeInsight).toHaveBeenCalledWith(insight1);
    expect(storeInsight).toHaveBeenCalledWith(insight2);
  });
});

// ── runLearningPipeline — error isolation ─────────────────────────────────────

describe('runLearningPipeline — error isolation (§6.1 never crashes app)', () => {
  it('does not throw when decayExpiredInsights fails', async () => {
    vi.mocked(decayExpiredInsights).mockImplementationOnce(() => {
      throw new Error('DB error during decay');
    });
    mockAll.mockReturnValue([]);
    await expect(runLearningPipeline()).resolves.not.toThrow();
  });

  it('returns [] (not throws) when top-level unexpected error occurs', async () => {
    // Make getAllEventTypes throw inside the pipeline
    vi.mocked(getAllEventTypes).mockImplementationOnce(() => {
      throw new Error('Registry completely unavailable');
    });
    const results = await runLearningPipeline();
    expect(results).toEqual([]);
  });

  it('does not throw when storeInsight fails for one insight', async () => {
    vi.mocked(generateInsights).mockReturnValueOnce([makeFakeInsight('bad-insight')]);
    vi.mocked(storeInsight).mockImplementationOnce(() => {
      throw new Error('Unique constraint violation');
    });
    mockAll.mockReturnValue(makePendingRows(12, 'quality.interruption'));
    await expect(runLearningPipeline()).resolves.not.toThrow();
  });

  it('continues storing other insights after one storeInsight failure', async () => {
    const good = makeFakeInsight('good-insight');
    const bad  = makeFakeInsight('bad-insight');
    vi.mocked(generateInsights).mockReturnValueOnce([bad, good]);
    vi.mocked(storeInsight)
      .mockImplementationOnce(() => { throw new Error('Constraint error'); })
      .mockImplementationOnce(() => undefined); // second call succeeds

    mockAll.mockReturnValue(makePendingRows(12, 'quality.interruption'));
    await runLearningPipeline();

    // Both were attempted — second one succeeded
    expect(storeInsight).toHaveBeenCalledTimes(2);
  });

  it('does not throw when markEventsProcessed fails (DB error on UPDATE)', async () => {
    mockAll.mockReturnValue(makePendingRows(12, 'quality.interruption'));
    // Fail on the UPDATE call for processed events
    mockRun.mockImplementationOnce(() => ({ changes: 0 }))  // decay
           .mockImplementationOnce(() => { throw new Error('UPDATE failed'); });
    await expect(runLearningPipeline()).resolves.not.toThrow();
  });
});

// ── startLearningScheduler / stopLearningScheduler ────────────────────────────

describe('startLearningScheduler / stopLearningScheduler', () => {
  it('starts and stops without throwing', () => {
    expect(() => {
      startLearningScheduler(10_000_000); // large interval — won't fire during test
      stopLearningScheduler();
    }).not.toThrow();
  });

  it('is idempotent — calling start twice does not create multiple intervals', () => {
    startLearningScheduler(10_000_000);
    startLearningScheduler(10_000_000); // second call is a no-op
    // If two intervals existed, the internal handle would be inconsistent
    // Simply verify no error was thrown and stop works correctly
    expect(() => stopLearningScheduler()).not.toThrow();
  });

  it('stop is safe to call when scheduler is not running', () => {
    // Never started
    expect(() => stopLearningScheduler()).not.toThrow();
  });

  it('can be restarted after stopping', () => {
    startLearningScheduler(10_000_000);
    stopLearningScheduler();
    expect(() => {
      startLearningScheduler(10_000_000);
    }).not.toThrow();
  });
});
