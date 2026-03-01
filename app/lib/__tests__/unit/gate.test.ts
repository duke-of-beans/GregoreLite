/**
 * Sprint 3F — Gate + Override Tracker tests
 *
 * Coverage:
 *   checkBeforeManifest()
 *     - returns shouldIntercept=false when findSimilarChunks returns []
 *     - returns shouldIntercept=true when matches found
 *     - builds query text from manifest.task.title + description
 *     - passes alreadyBuiltGate threshold to findSimilarChunks
 *     - maps match fields correctly (chunkId, content, similarity, sourceId)
 *
 *   getOverrideCount()
 *     - returns 0 when no settings row exists
 *     - returns parsed integer from settings row
 *
 *   recordOverride()
 *     - upserts count to settings table
 *     - does NOT call adjustThreshold before threshold (count 1, 2)
 *     - calls adjustThreshold(+0.05) on 3rd override
 *     - resets counter (deletes settings row) after threshold hit
 *
 * @module lib/__tests__/unit/gate.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockFindSimilarChunks } = vi.hoisted(() => ({
  mockFindSimilarChunks: vi.fn().mockResolvedValue([]),
}));

const { mockLoadThresholds } = vi.hoisted(() => ({
  mockLoadThresholds: vi.fn().mockReturnValue({
    patternDetection: 0.75,
    onInputSuggestion: 0.85,
    alreadyBuiltGate: 0.72,
  }),
}));

const { mockAdjustThreshold } = vi.hoisted(() => ({
  mockAdjustThreshold: vi.fn(),
}));

const { mockPrepare, mockRun } = vi.hoisted(() => {
  const mr = vi.fn().mockReturnValue({ changes: 0 });
  const mp = vi.fn().mockReturnValue({ run: mr, get: vi.fn().mockReturnValue(undefined) });
  return { mockPrepare: mp, mockRun: mr };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/vector', () => ({
  findSimilarChunks: mockFindSimilarChunks,
}));

vi.mock('@/lib/cross-context/thresholds', () => ({
  loadThresholds: mockLoadThresholds,
  adjustThreshold: mockAdjustThreshold,
  clamp: (v: number) => Math.max(0.65, Math.min(0.92, v)),
}));

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({
    prepare: mockPrepare,
  }),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { checkBeforeManifest } from '@/lib/cross-context/gate';
import { getOverrideCount, recordOverride } from '@/lib/cross-context/override-tracker';
import type { TaskManifest } from '@/lib/agent-sdk/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeManifest(title: string, description: string): TaskManifest {
  return {
    manifest_id: 'test-manifest',
    version: '1.0',
    spawned_by: { thread_id: 'thread-1', strategic_thread_id: 'strat-1', timestamp: new Date().toISOString() },
    task: {
      id: 'task-1',
      type: 'code',
      title,
      description,
      success_criteria: ['tsc passes'],
    },
    context: {
      project_path: 'D:\\Projects\\GregLite',
      files: [],
      environment: {},
      dependencies: [],
    },
    protocol: { output_format: 'json', reporting_interval: 30, max_duration: 60 },
    return_to_thread: { id: 'thread-1', on_success: 'report', on_failure: 'report' },
    quality_gates: { shim_required: false, eos_required: false, tests_required: true },
    is_self_evolution: false,
  };
}

// ── checkBeforeManifest ───────────────────────────────────────────────────────

describe('checkBeforeManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadThresholds.mockReturnValue({
      patternDetection: 0.75,
      onInputSuggestion: 0.85,
      alreadyBuiltGate: 0.72,
    });
    mockFindSimilarChunks.mockResolvedValue([]);
  });

  it('returns shouldIntercept=false when no matches found', async () => {
    const result = await checkBeforeManifest(makeManifest('Add error boundary', 'Wrap root in ErrorBoundary'));
    expect(result.shouldIntercept).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it('returns shouldIntercept=true when matches found', async () => {
    mockFindSimilarChunks.mockResolvedValue([
      { chunkId: 'chunk-1', content: 'error boundary impl', similarity: 0.88, sourceId: 'thread-abc', distance: 0.12 },
    ]);
    const result = await checkBeforeManifest(makeManifest('Add error boundary', 'Wrap root in ErrorBoundary'));
    expect(result.shouldIntercept).toBe(true);
    expect(result.matches).toHaveLength(1);
  });

  it('passes combined title+description as queryText', async () => {
    await checkBeforeManifest(makeManifest('Add auth', 'JWT middleware for API routes'));
    expect(mockFindSimilarChunks).toHaveBeenCalledWith(
      'Add auth JWT middleware for API routes',
      10,
      0.72
    );
  });

  it('uses alreadyBuiltGate threshold from loadThresholds', async () => {
    mockLoadThresholds.mockReturnValue({
      patternDetection: 0.75,
      onInputSuggestion: 0.85,
      alreadyBuiltGate: 0.80,
    });
    await checkBeforeManifest(makeManifest('Title', 'Description'));
    expect(mockFindSimilarChunks).toHaveBeenCalledWith(expect.any(String), 10, 0.80);
  });

  it('maps match fields to GateMatch shape', async () => {
    mockFindSimilarChunks.mockResolvedValue([
      { chunkId: 'chunk-abc', content: 'impl content', similarity: 0.91, sourceId: 'thread-xyz', distance: 0.09, sourceType: 'conversation' },
    ]);
    const result = await checkBeforeManifest(makeManifest('T', 'D'));
    const match = result.matches[0]!;
    expect(match.chunkId).toBe('chunk-abc');
    expect(match.content).toBe('impl content');
    expect(match.similarity).toBeCloseTo(0.91);
    expect(match.sourceId).toBe('thread-xyz');
  });
});

// ── getOverrideCount ──────────────────────────────────────────────────────────

describe('getOverrideCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 0 when no settings row exists', () => {
    mockPrepare.mockReturnValue({ run: mockRun, get: vi.fn().mockReturnValue(undefined) });
    const count = getOverrideCount('chunk-1');
    expect(count).toBe(0);
  });

  it('returns parsed count from settings row', () => {
    mockPrepare.mockReturnValue({ run: mockRun, get: vi.fn().mockReturnValue({ value: '2' }) });
    const count = getOverrideCount('chunk-1');
    expect(count).toBe(2);
  });
});

// ── recordOverride ────────────────────────────────────────────────────────────

describe('recordOverride', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts count=1 on first override', () => {
    mockPrepare.mockReturnValue({ run: mockRun, get: vi.fn().mockReturnValue(undefined) });
    recordOverride('chunk-1');
    expect(mockRun).toHaveBeenCalledWith(
      'gate_override_chunk-1',
      '1',
      expect.any(Number)
    );
  });

  it('does not call adjustThreshold on first override', () => {
    mockPrepare.mockReturnValue({ run: mockRun, get: vi.fn().mockReturnValue(undefined) });
    recordOverride('chunk-1');
    expect(mockAdjustThreshold).not.toHaveBeenCalled();
  });

  it('does not call adjustThreshold on second override', () => {
    mockPrepare.mockReturnValue({ run: mockRun, get: vi.fn().mockReturnValue({ value: '1' }) });
    recordOverride('chunk-1');
    expect(mockAdjustThreshold).not.toHaveBeenCalled();
  });

  it('calls adjustThreshold(alreadyBuiltGate, +0.05) on third override', () => {
    mockPrepare.mockReturnValue({ run: mockRun, get: vi.fn().mockReturnValue({ value: '2' }) });
    recordOverride('chunk-1');
    expect(mockAdjustThreshold).toHaveBeenCalledWith('alreadyBuiltGate', 0.05);
  });

  it('resets counter (deletes settings row) after threshold hit', () => {
    const mockDelRun = vi.fn().mockReturnValue({ changes: 1 });
    let callCount = 0;
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.startsWith('DELETE')) return { run: mockDelRun };
      callCount++;
      if (callCount === 1) return { get: vi.fn().mockReturnValue({ value: '2' }) };
      return { run: mockRun };
    });
    recordOverride('chunk-1');
    expect(mockDelRun).toHaveBeenCalled();
  });
});
