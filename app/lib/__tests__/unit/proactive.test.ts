/**
 * proactive — unit tests (Sprint 3G)
 *
 * Tests: checkOnInput — message length gate, threshold query, suppression filter,
 * score filter, max-2 cap, sort order, DB persistence via insertSuggestion.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockFindSimilarChunks,
  mockLoadThresholds,
  mockIsSuppressed,
  mockScoreCandidate,
  mockInsertSuggestion,
} = vi.hoisted(() => ({
  mockFindSimilarChunks: vi.fn(),
  mockLoadThresholds: vi.fn(),
  mockIsSuppressed: vi.fn(),
  mockScoreCandidate: vi.fn(),
  mockInsertSuggestion: vi.fn(),
}));

vi.mock('@/lib/vector', () => ({ findSimilarChunks: mockFindSimilarChunks }));
vi.mock('@/lib/cross-context/thresholds', () => ({ loadThresholds: mockLoadThresholds }));
vi.mock('@/lib/cross-context/surfacing', () => ({
  isSuppressed: mockIsSuppressed,
  scoreCandidate: mockScoreCandidate,
}));
vi.mock('@/lib/cross-context/feedback', () => ({ insertSuggestion: mockInsertSuggestion }));

import { checkOnInput } from '@/lib/cross-context/proactive';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCandidate(chunkId: string, similarity = 0.9) {
  return {
    chunkId,
    distance: 1 - similarity,
    similarity,
    content: `Content for ${chunkId}`,
    sourceType: 'conversation',
    sourceId: `thread-${chunkId}`,
  };
}

const DEFAULT_THRESHOLDS = { onInputSuggestion: 0.85, patternDetection: 0.75, alreadyBuiltGate: 0.72 };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('checkOnInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadThresholds.mockReturnValue(DEFAULT_THRESHOLDS);
    mockIsSuppressed.mockReturnValue(false);
    mockScoreCandidate.mockReturnValue(0.80);
    mockInsertSuggestion.mockReturnValue('suggestion-id-1');
  });

  // ── Message length gate ────────────────────────────────────────────────────

  it('returns empty array for messages shorter than 50 chars', async () => {
    const result = await checkOnInput('short');
    expect(result).toEqual([]);
    expect(mockFindSimilarChunks).not.toHaveBeenCalled();
  });

  it('returns empty array for exactly 49-char message', async () => {
    const result = await checkOnInput('a'.repeat(49));
    expect(result).toEqual([]);
  });

  it('proceeds for message of exactly 50 chars', async () => {
    mockFindSimilarChunks.mockResolvedValue([]);
    const result = await checkOnInput('a'.repeat(50));
    expect(mockFindSimilarChunks).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  // ── Threshold query ────────────────────────────────────────────────────────

  it('queries vector index at onInputSuggestion threshold', async () => {
    mockFindSimilarChunks.mockResolvedValue([]);
    await checkOnInput('a'.repeat(60));
    expect(mockFindSimilarChunks).toHaveBeenCalledWith(
      expect.any(String),
      20,
      DEFAULT_THRESHOLDS.onInputSuggestion
    );
  });

  // ── Suppression filter ─────────────────────────────────────────────────────

  it('skips suppressed candidates', async () => {
    mockFindSimilarChunks.mockResolvedValue([makeCandidate('c1')]);
    mockIsSuppressed.mockReturnValue(true);
    const result = await checkOnInput('a'.repeat(60));
    expect(result).toHaveLength(0);
    expect(mockInsertSuggestion).not.toHaveBeenCalled();
  });

  // ── Score filter ───────────────────────────────────────────────────────────

  it('excludes candidates with displayScore below 0.70', async () => {
    mockFindSimilarChunks.mockResolvedValue([makeCandidate('low')]);
    mockScoreCandidate.mockReturnValue(0.69);
    const result = await checkOnInput('a'.repeat(60));
    expect(result).toHaveLength(0);
  });

  it('includes candidates with displayScore exactly 0.70', async () => {
    mockFindSimilarChunks.mockResolvedValue([makeCandidate('boundary')]);
    mockScoreCandidate.mockReturnValue(0.70);
    mockInsertSuggestion.mockReturnValue('sid-boundary');
    const result = await checkOnInput('a'.repeat(60));
    expect(result).toHaveLength(1);
  });

  // ── Persistence ────────────────────────────────────────────────────────────

  it('calls insertSuggestion for each qualifying candidate', async () => {
    mockFindSimilarChunks.mockResolvedValue([makeCandidate('c1'), makeCandidate('c2')]);
    mockInsertSuggestion.mockReturnValueOnce('s1').mockReturnValueOnce('s2');
    await checkOnInput('a'.repeat(60));
    expect(mockInsertSuggestion).toHaveBeenCalledTimes(2);
    expect(mockInsertSuggestion).toHaveBeenCalledWith('c1', expect.any(Number), 0.80, 'on_input');
    expect(mockInsertSuggestion).toHaveBeenCalledWith('c2', expect.any(Number), 0.80, 'on_input');
  });

  it('uses the insertSuggestion-returned id as suggestion.id', async () => {
    mockFindSimilarChunks.mockResolvedValue([makeCandidate('c1')]);
    mockInsertSuggestion.mockReturnValue('db-assigned-id');
    const result = await checkOnInput('a'.repeat(60));
    expect(result[0]?.id).toBe('db-assigned-id');
  });

  // ── Max-2 cap ──────────────────────────────────────────────────────────────

  it('returns at most 2 suggestions', async () => {
    mockFindSimilarChunks.mockResolvedValue([
      makeCandidate('c1'),
      makeCandidate('c2'),
      makeCandidate('c3'),
    ]);
    mockInsertSuggestion
      .mockReturnValueOnce('s1')
      .mockReturnValueOnce('s2')
      .mockReturnValueOnce('s3');
    const result = await checkOnInput('a'.repeat(60));
    expect(result).toHaveLength(2);
  });

  // ── Sort order ─────────────────────────────────────────────────────────────

  it('returns suggestions sorted by displayScore descending', async () => {
    mockFindSimilarChunks.mockResolvedValue([
      makeCandidate('low', 0.88),
      makeCandidate('high', 0.95),
    ]);
    mockScoreCandidate
      .mockReturnValueOnce(0.72) // low
      .mockReturnValueOnce(0.91); // high
    mockInsertSuggestion.mockReturnValueOnce('s-low').mockReturnValueOnce('s-high');
    const result = await checkOnInput('a'.repeat(60));
    expect(result[0]?.id).toBe('s-high');
    expect(result[1]?.id).toBe('s-low');
  });

  // ── Empty result ───────────────────────────────────────────────────────────

  it('returns empty array when no candidates found', async () => {
    mockFindSimilarChunks.mockResolvedValue([]);
    const result = await checkOnInput('a'.repeat(60));
    expect(result).toEqual([]);
  });
});
