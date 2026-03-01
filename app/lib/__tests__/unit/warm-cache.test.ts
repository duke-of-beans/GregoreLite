/**
 * Tests for app/lib/vector/warm-cache.ts — Sprint 3C
 *
 * Coverage:
 *   - buildWarmCache(): queries content_chunks with 30-day window, loads embeddings from vec_index
 *   - searchWarmCache(): brute-force cosine, top-k, returns [] before build
 *   - isWarmCacheReady(): reflects in-memory state
 *
 * @/lib/kernl/database and @/lib/vector/store are fully mocked.
 *
 * @module __tests__/unit/warm-cache.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── DB mock ───────────────────────────────────────────────────────────────────
const { mockRun, mockAll, mockGet, mockPrepare, mockExec } = vi.hoisted(() => {
  const mockRun = vi.fn().mockReturnValue({ changes: 1 });
  const mockAll = vi.fn().mockReturnValue([]);
  const mockGet = vi.fn().mockReturnValue(null);
  const mockStmt = { run: mockRun, all: mockAll, get: mockGet };
  const mockPrepare = vi.fn().mockReturnValue(mockStmt);
  const mockExec = vi.fn();
  return { mockRun, mockAll, mockGet, mockPrepare, mockExec };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({ prepare: mockPrepare, exec: mockExec }),
}));

// ── sqlite-vec mock ───────────────────────────────────────────────────────────
const { mockEnsureVecIndex } = vi.hoisted(() => ({
  mockEnsureVecIndex: vi.fn(),
}));

vi.mock('@/lib/vector/store', () => ({
  ensureVecIndex: mockEnsureVecIndex,
}));

import {
  buildWarmCache,
  searchWarmCache,
  isWarmCacheReady,
  _resetWarmCache,
} from '@/lib/vector/warm-cache';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DIM = 384;

function makeEmbedding(seed: number): Float32Array {
  const data = new Float32Array(DIM);
  let mag = 0;
  for (let i = 0; i < DIM; i++) {
    data[i] = ((seed * (i + 1)) % 100) / 100;
    mag += (data[i] ?? 0) ** 2;
  }
  mag = Math.sqrt(mag);
  for (let i = 0; i < DIM; i++) data[i] = (data[i] ?? 0) / mag;
  return data;
}

/** Serialise a Float32Array to Buffer for mock vec_index rows. */
function toEmbeddingBuffer(emb: Float32Array): Buffer {
  return Buffer.from(emb.buffer, emb.byteOffset, emb.byteLength);
}

beforeEach(() => {
  _resetWarmCache();

  mockRun.mockReset();
  mockAll.mockReset();
  mockGet.mockReset();
  mockPrepare.mockReset();
  mockExec.mockReset();
  mockEnsureVecIndex.mockReset();

  mockRun.mockReturnValue({ changes: 1 });
  mockAll.mockReturnValue([]);
  mockGet.mockReturnValue(null);
  const mockStmt = { run: mockRun, all: mockAll, get: mockGet };
  mockPrepare.mockReturnValue(mockStmt);
});

// ─── buildWarmCache() ─────────────────────────────────────────────────────────

describe('buildWarmCache()', () => {
  it('queries content_chunks with SELECT id WHERE created_at > ?', async () => {
    await buildWarmCache();
    const sqls = mockPrepare.mock.calls.map((c) => c[0] as string);
    const chunkSql = sqls.find((s) => s.includes('FROM content_chunks'));
    expect(chunkSql).toBeDefined();
    expect(chunkSql).toContain('created_at');
    expect(chunkSql).toContain('SELECT id');
  });

  it('passes a timestamp from ~30 days ago to the query', async () => {
    const before = Date.now() - 30 * 24 * 60 * 60 * 1000;
    await buildWarmCache();
    const chunkCallIdx = mockPrepare.mock.calls.findIndex((c) =>
      (c[0] as string).includes('FROM content_chunks')
    );
    const allCall = mockAll.mock.calls[chunkCallIdx];
    const ts = allCall?.[0] as number;
    // Timestamp should be within 5 seconds of 30 days ago
    expect(ts).toBeGreaterThan(before - 5000);
    expect(ts).toBeLessThan(before + 5000);
  });

  it('marks cache as ready after build', async () => {
    await buildWarmCache();
    expect(isWarmCacheReady()).toBe(true);
  });

  it('handles empty content_chunks result gracefully', async () => {
    mockAll.mockReturnValue([]);
    await expect(buildWarmCache()).resolves.toBeUndefined();
    expect(isWarmCacheReady()).toBe(true);
  });

  it('loads embeddings from vec_index for returned chunk IDs', async () => {
    const emb = makeEmbedding(1);
    // First all() call: content_chunks returns one chunk ID
    mockAll.mockReturnValueOnce([{ id: 'chunk-abc' }]);
    // First get() call: vec_index returns the embedding buffer
    mockGet.mockReturnValueOnce({ embedding: toEmbeddingBuffer(emb) });

    await buildWarmCache();

    // Verify a vec_index query was made with the chunk ID
    const sqls = mockPrepare.mock.calls.map((c) => c[0] as string);
    const vecSql = sqls.find((s) => s.includes('vec_index'));
    expect(vecSql).toBeDefined();
    expect(vecSql).toContain('chunk_id');
  });

  it('skips chunks whose vec_index entry is missing', async () => {
    mockAll.mockReturnValueOnce([{ id: 'orphan-chunk' }]);
    mockGet.mockReturnValueOnce(null); // no vec_index entry

    await buildWarmCache();
    // Should not throw, and warm index should be empty
    const results = searchWarmCache(makeEmbedding(1), 10);
    expect(results).toEqual([]);
  });

  it('calls ensureVecIndex before querying vec_index', async () => {
    mockAll.mockReturnValueOnce([{ id: 'chunk-1' }]);
    mockGet.mockReturnValueOnce({ embedding: toEmbeddingBuffer(makeEmbedding(1)) });

    await buildWarmCache();
    expect(mockEnsureVecIndex).toHaveBeenCalledOnce();
  });
});

// ─── searchWarmCache() ────────────────────────────────────────────────────────

describe('searchWarmCache()', () => {
  it('returns [] before buildWarmCache() is called', () => {
    expect(isWarmCacheReady()).toBe(false);
    expect(searchWarmCache(makeEmbedding(1), 5)).toEqual([]);
  });

  it('returns results sorted by similarity descending', async () => {
    const emb1 = makeEmbedding(1);
    const emb2 = makeEmbedding(99);

    mockAll.mockReturnValueOnce([{ id: 'close' }, { id: 'far' }]);
    mockGet
      .mockReturnValueOnce({ embedding: toEmbeddingBuffer(emb1) })
      .mockReturnValueOnce({ embedding: toEmbeddingBuffer(emb2) });

    await buildWarmCache();
    const results = searchWarmCache(emb1, 2);
    expect(results[0]!.chunkId).toBe('close');
    expect(results[0]!.similarity).toBeGreaterThan(results[1]!.similarity);
  });

  it('returns at most k results', async () => {
    // Seed 5 chunks in the warm index
    const ids = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}` }));
    mockAll.mockReturnValueOnce(ids);
    for (let i = 0; i < 5; i++) {
      mockGet.mockReturnValueOnce({ embedding: toEmbeddingBuffer(makeEmbedding(i)) });
    }

    await buildWarmCache();
    const results = searchWarmCache(makeEmbedding(1), 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('result distance = 1 - similarity', async () => {
    const emb = makeEmbedding(4);
    mockAll.mockReturnValueOnce([{ id: 'dist-test' }]);
    mockGet.mockReturnValueOnce({ embedding: toEmbeddingBuffer(emb) });

    await buildWarmCache();
    const results = searchWarmCache(emb, 1);
    expect(results[0]!.distance).toBeCloseTo(1 - results[0]!.similarity, 10);
  });
});

// ─── isWarmCacheReady() ───────────────────────────────────────────────────────

describe('isWarmCacheReady()', () => {
  it('returns false before buildWarmCache() is called', () => {
    expect(isWarmCacheReady()).toBe(false);
  });

  it('returns true after buildWarmCache() resolves', async () => {
    await buildWarmCache();
    expect(isWarmCacheReady()).toBe(true);
  });
});
