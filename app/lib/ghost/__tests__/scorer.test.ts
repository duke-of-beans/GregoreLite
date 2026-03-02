/**
 * Ghost Scorer — Unit Tests
 *
 * Tests for the interrupt scoring engine:
 *   - scorer.ts: ranking formula component functions + full scoreCandidate()
 *   - window.ts: canSurface(), criticalOverride(), recordSurfaced()
 *   - context.ts: buildActiveContextVector() returns null with no session
 *   - index.ts: getActiveSuggestions() expiry pruning, dismissSuggestion()
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DB mock setup (vi.hoisted required — factories are hoisted before const) ─

const { mockRun, mockGet, mockAll, mockPrepare, mockDb, mockCreate } = vi.hoisted(() => {
  const mockRun     = vi.fn();
  const mockGet     = vi.fn();
  const mockAll     = vi.fn().mockReturnValue([]);
  const mockPrepare = vi.fn().mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
  const mockDb      = { prepare: mockPrepare };
  const mockCreate  = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'This is a relevant summary.' }],
  });
  return { mockRun, mockGet, mockAll, mockPrepare, mockDb, mockCreate };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn().mockReturnValue(mockDb),
}));

vi.mock('@/lib/kernl/aegis-store', () => ({
  getLatestAegisSignal: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/vector', () => ({
  searchSimilar: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/embeddings/model', () => ({
  embedText: vi.fn().mockResolvedValue(new Float32Array(384)),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: mockCreate,
      },
    };
  }),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import {
  computeRecencyBoost,
  computeRelevanceBoost,
  computeDismissalPenalty,
  scoreCandidate,
} from '@/lib/ghost/scorer/scorer';
import { canSurface, criticalOverride, recordSurfaced } from '@/lib/ghost/scorer/window';
import { buildActiveContextVector } from '@/lib/ghost/scorer/context';
import {
  getActiveSuggestions,
  dismissSuggestion,
  runScorer,
} from '@/lib/ghost/scorer/index';
import type { GhostCandidate, GhostSuggestion } from '@/lib/ghost/scorer/types';

// ─── Global reset — prevent mockReturnValueOnce queue bleed between tests ─────
// Only reset the DB mocks (hoisted). Module-level vi.mock() implementations
// (getDatabase, getLatestAegisSignal, searchSimilar, embedText) are NOT reset
// so they continue to return their defaults throughout the suite.

beforeEach(() => {
  mockGet.mockReset();
  mockAll.mockReset();
  mockRun.mockReset();
  mockPrepare.mockReset();
  // Restore defaults after reset
  mockAll.mockReturnValue([]);
  mockPrepare.mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_MS   = 24 * 60 * 60 * 1000;
const SEVEN    = 7  * DAY_MS;
const NINETY   = 90 * DAY_MS;

function makeCandidate(overrides: Partial<GhostCandidate> = {}): GhostCandidate {
  return {
    chunkId: 'chunk-1',
    text: 'Some relevant content from a file.',
    similarity: 0.85,
    sourcePath: '/home/david/project/notes.md',
    sourceType: 'file',
    sourceAccount: null,
    indexedAt: Date.now() - DAY_MS, // 1 day old → fresh
    isCritical: false,
    metadata: { source: 'ghost', source_type: 'file' },
    ...overrides,
  };
}

// ─── scorer.ts — computeRecencyBoost ─────────────────────────────────────────

describe('computeRecencyBoost', () => {
  const now = Date.now();

  it('returns 1.0 for content indexed today', () => {
    expect(computeRecencyBoost(now, now)).toBe(1.0);
  });

  it('returns 1.0 for content indexed exactly 7 days ago', () => {
    expect(computeRecencyBoost(now - SEVEN, now)).toBe(1.0);
  });

  it('returns 0.5 for content indexed 90 days ago', () => {
    expect(computeRecencyBoost(now - NINETY, now)).toBe(0.5);
  });

  it('returns 0.5 for content older than 90 days', () => {
    expect(computeRecencyBoost(now - NINETY - DAY_MS, now)).toBe(0.5);
  });

  it('returns ~0.75 for content at the midpoint (48.5 days)', () => {
    const midAge = SEVEN + (NINETY - SEVEN) / 2;
    const boost = computeRecencyBoost(now - midAge, now);
    expect(boost).toBeCloseTo(0.75, 2);
  });

  it('is strictly decreasing across the decay range', () => {
    const b7  = computeRecencyBoost(now - SEVEN,           now);
    const b30 = computeRecencyBoost(now - 30 * DAY_MS,     now);
    const b60 = computeRecencyBoost(now - 60 * DAY_MS,     now);
    const b90 = computeRecencyBoost(now - NINETY,           now);
    expect(b7).toBeGreaterThan(b30);
    expect(b30).toBeGreaterThan(b60);
    expect(b60).toBeGreaterThan(b90);
  });
});

// ─── scorer.ts — computeRelevanceBoost ───────────────────────────────────────

describe('computeRelevanceBoost', () => {
  beforeEach(() => {
    mockAll.mockReturnValue([]);
  });

  it('returns 1.0 for null source path', () => {
    expect(computeRelevanceBoost(null)).toBe(1.0);
  });

  it('returns 1.0 when no active projects match', () => {
    mockAll.mockReturnValue([{ path: '/home/david/other-project' }]);
    expect(computeRelevanceBoost('/home/david/project/file.ts')).toBe(1.0);
  });

  it('returns 1.2 when source path is under an active project', () => {
    mockAll.mockReturnValue([{ path: '/home/david/project' }]);
    expect(computeRelevanceBoost('/home/david/project/src/index.ts')).toBe(1.2);
  });

  it('normalises Windows backslashes for matching', () => {
    mockAll.mockReturnValue([{ path: 'D:\\Projects\\GregLite' }]);
    expect(computeRelevanceBoost('D:\\Projects\\GregLite\\app\\lib\\test.ts')).toBe(1.2);
  });
});

// ─── scorer.ts — computeDismissalPenalty ─────────────────────────────────────

describe('computeDismissalPenalty', () => {
  beforeEach(() => {
    mockGet.mockReturnValue(undefined);
  });

  it('returns 0 for null source path', () => {
    expect(computeDismissalPenalty(null)).toBe(0);
  });

  it('returns 0 when there are no dismissals', () => {
    mockGet.mockReturnValue({ count: 0 });
    expect(computeDismissalPenalty('/path/to/file.md')).toBe(0);
  });

  it('returns 0.2 for one dismissal', () => {
    mockGet.mockReturnValue({ count: 1 });
    expect(computeDismissalPenalty('/path/to/file.md')).toBe(0.2);
  });

  it('returns 0.4 for two dismissals', () => {
    mockGet.mockReturnValue({ count: 2 });
    expect(computeDismissalPenalty('/path/to/file.md')).toBe(0.4);
  });

  it('caps penalty at 0.8 regardless of dismissal count', () => {
    mockGet.mockReturnValue({ count: 10 });
    expect(computeDismissalPenalty('/path/to/file.md')).toBe(0.8);
  });
});

// ─── scorer.ts — scoreCandidate ───────────────────────────────────────────────

describe('scoreCandidate', () => {
  const now = Date.now();

  beforeEach(() => {
    mockGet.mockReturnValue({ count: 0 });
    mockAll.mockReturnValue([]);
  });

  it('computes baseline score correctly (fresh, no boost, no penalty)', () => {
    const candidate = makeCandidate({ similarity: 0.80, indexedAt: now - DAY_MS });
    // recency=1.0, relevance=1.0, dismissal=0, importance=1.0 → 0.80
    expect(scoreCandidate(candidate, now)).toBeCloseTo(0.80, 5);
  });

  it('applies importance_boost 1.5 for critical chunks', () => {
    const candidate = makeCandidate({ similarity: 0.80, indexedAt: now - DAY_MS, isCritical: true });
    expect(scoreCandidate(candidate, now)).toBeCloseTo(0.80 * 1.5, 5);
  });

  it('applies recency decay for older content', () => {
    const candidate = makeCandidate({ similarity: 0.80, indexedAt: now - NINETY });
    // recency=0.5 → 0.80 * 0.5 = 0.40
    expect(scoreCandidate(candidate, now)).toBeCloseTo(0.40, 5);
  });

  it('applies relevance boost when source matches active project', () => {
    mockAll.mockReturnValue([{ path: '/home/david/project' }]);
    const candidate = makeCandidate({
      similarity: 0.80,
      indexedAt: now - DAY_MS,
      sourcePath: '/home/david/project/notes.md',
    });
    expect(scoreCandidate(candidate, now)).toBeCloseTo(0.80 * 1.2, 5);
  });

  it('applies dismissal penalty correctly', () => {
    mockGet.mockReturnValue({ count: 2 });
    const candidate = makeCandidate({ similarity: 0.80, indexedAt: now - DAY_MS });
    // penalty = 0.2 * 2 = 0.4 → (1 - 0.4) = 0.6 → 0.80 * 0.6 = 0.48
    expect(scoreCandidate(candidate, now)).toBeCloseTo(0.48, 5);
  });

  it('full formula: similarity × recency × relevance × (1-penalty) × importance', () => {
    mockAll.mockReturnValue([{ path: '/home/david/project' }]);
    mockGet.mockReturnValue({ count: 1 });
    const candidate = makeCandidate({
      similarity: 0.90,
      indexedAt: now - NINETY,     // recency = 0.5
      sourcePath: '/home/david/project/file.ts', // relevance = 1.2
      isCritical: true,            // importance = 1.5
    });
    // 0.90 * 0.5 * 1.2 * (1 - 0.2) * 1.5 = 0.90 * 0.5 * 1.2 * 0.8 * 1.5 = 0.648
    expect(scoreCandidate(candidate, now)).toBeCloseTo(0.648, 3);
  });
});

// ─── window.ts — criticalOverride ────────────────────────────────────────────

describe('criticalOverride', () => {
  it('returns false when similarity <= 0.95', () => {
    expect(criticalOverride(0.95, 1.5)).toBe(false);
    expect(criticalOverride(0.90, 1.5)).toBe(false);
  });

  it('returns false when importanceBoost <= 1.3', () => {
    expect(criticalOverride(0.96, 1.3)).toBe(false);
    expect(criticalOverride(0.96, 1.0)).toBe(false);
  });

  it('returns true only when both conditions are met', () => {
    expect(criticalOverride(0.96, 1.5)).toBe(true);
    expect(criticalOverride(0.99, 1.31)).toBe(true);
  });
});

// ─── window.ts — canSurface ───────────────────────────────────────────────────

describe('canSurface', () => {
  it('returns true when no suggestions have been surfaced', async () => {
    mockGet.mockReturnValue({ count: 0 });
    expect(await canSurface(2, DAY_MS)).toBe(true);
  });

  it('returns true when only one suggestion has been surfaced (cap=2)', async () => {
    mockGet.mockReturnValue({ count: 1 });
    expect(await canSurface(2, DAY_MS)).toBe(true);
  });

  it('returns false when cap is reached', async () => {
    mockGet.mockReturnValue({ count: 2 });
    expect(await canSurface(2, DAY_MS)).toBe(false);
  });

  it('returns false when count exceeds cap', async () => {
    mockGet.mockReturnValue({ count: 5 });
    expect(await canSurface(2, DAY_MS)).toBe(false);
  });

  it('respects custom maxPerWindow', async () => {
    mockGet.mockReturnValue({ count: 1 });
    expect(await canSurface(1, DAY_MS)).toBe(false);
    expect(await canSurface(3, DAY_MS)).toBe(true);
  });
});

// ─── window.ts — recordSurfaced ──────────────────────────────────────────────

describe('recordSurfaced', () => {
  it('calls INSERT with correct columns', async () => {
    const now = Date.now();
    const suggestion: GhostSuggestion = {
      id: 'sug-1',
      chunkId: 'chunk-1',
      score: 0.85,
      similarity: 0.90,
      summary: 'A relevant note.',
      source: 'File: notes.md',
      sourcePath: '/path/notes.md',
      surfacedAt: now,
      expiresAt: now + 4 * 60 * 60 * 1000,
      isCritical: false,
    };

    await recordSurfaced(suggestion);

    expect(mockRun).toHaveBeenCalledWith(
      'sug-1', 'chunk-1', 0.85, suggestion.surfacedAt, suggestion.expiresAt
    );
  });
});

// ─── context.ts — buildActiveContextVector ────────────────────────────────────

describe('buildActiveContextVector', () => {
  it('returns null when no threads have messages', async () => {
    // thread query returns nothing
    mockGet.mockReturnValue(undefined);
    const result = await buildActiveContextVector();
    expect(result).toBeNull();
  });

  it('returns null when thread exists but has no assistant messages', async () => {
    // first call: thread row; second call: no messages
    mockGet
      .mockReturnValueOnce({ id: 'thread-1', project_id: null })
      .mockReturnValueOnce(undefined);
    mockAll.mockReturnValueOnce([]); // no assistant messages
    const result = await buildActiveContextVector();
    expect(result).toBeNull();
  });

  it('returns a Float32Array when an active session exists', async () => {
    mockGet
      .mockReturnValueOnce({ id: 'thread-1', project_id: null }) // thread
      .mockReturnValueOnce(undefined)  // manifest
      .mockReturnValueOnce(undefined); // project (no project_id)
    mockAll.mockReturnValueOnce([
      { content: 'Working on the Ghost ingest pipeline.' },
      { content: 'Next step is the scorer module.' },
    ]);
    const result = await buildActiveContextVector();
    expect(result).toBeInstanceOf(Float32Array);
  });
});

// ─── index.ts — getActiveSuggestions expiry ───────────────────────────────────

describe('getActiveSuggestions', () => {
  it('returns empty array when no suggestions have been surfaced', () => {
    expect(getActiveSuggestions()).toEqual([]);
  });
});

// ─── index.ts — runScorer skips when no context ───────────────────────────────

describe('runScorer', () => {
  it('does not throw when context vector is null (idle session)', async () => {
    mockGet.mockReturnValue(undefined); // no threads
    await expect(runScorer()).resolves.not.toThrow();
  });

  it('does not throw when AEGIS is in PARALLEL_BUILD profile', async () => {
    const { getLatestAegisSignal } = await import('@/lib/kernl/aegis-store');
    vi.mocked(getLatestAegisSignal).mockReturnValueOnce({
      id: 'sig-1',
      profile: 'PARALLEL_BUILD',
      source_thread: null,
      sent_at: Date.now(),
      is_override: 0,
    });
    await expect(runScorer()).resolves.not.toThrow();
  });
});

// ─── index.ts — dismissSuggestion ─────────────────────────────────────────────

describe('dismissSuggestion', () => {
  it('does nothing when suggestion id does not exist', async () => {
    await expect(dismissSuggestion('nonexistent-id')).resolves.not.toThrow();
  });
});
