/**
 * Tests for app/lib/vector/ — Sprint 3B
 *
 * Coverage:
 *   - upsertVector(): calls db.prepare().run() with correct chunkId and Buffer embedding
 *   - searchSimilar(): calls db.prepare().all(), maps rows to VectorSearchResult[]
 *   - deleteVector(): calls db.prepare().run() with chunk_id
 *   - findSimilarChunks(): embeds query → searches → joins content_chunks → filters by minSimilarity
 *   - ensureVecIndex(): calls load(db) + db.exec() exactly once (singleton guard)
 *   - persistEmbeddingsFull(): writes to content_chunks + upserts each vector
 *
 * sqlite-vec, @/lib/kernl/database, and @/lib/embeddings are all mocked.
 * No native dependencies required to run this test suite.
 *
 * @module __tests__/unit/vector.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── DB mock (hoisted before all imports) ──────────────────────────────────────
const { mockRun, mockPrepare, mockAll, mockGet, mockExec, mockTransaction } = vi.hoisted(() => {
  const mockRun = vi.fn().mockReturnValue({ changes: 1 });
  const mockAll = vi.fn().mockReturnValue([]);
  const mockGet = vi.fn().mockReturnValue(null);
  const mockStmt = { run: mockRun, all: mockAll, get: mockGet };
  const mockPrepare = vi.fn().mockReturnValue(mockStmt);
  const mockExec = vi.fn();
  const mockTransaction = vi.fn((fn: (...args: unknown[]) => unknown) => fn);
  return { mockRun, mockPrepare, mockAll, mockGet, mockExec, mockTransaction };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({
    prepare: mockPrepare,
    exec: mockExec,
    transaction: mockTransaction,
  }),
}));

// ── sqlite-vec mock — load() and getLoadablePath() are no-ops ────────────────
const { mockLoad } = vi.hoisted(() => {
  const mockLoad = vi.fn();
  return { mockLoad };
});

vi.mock('sqlite-vec', () => ({
  load: mockLoad,
  getLoadablePath: vi.fn().mockReturnValue('/mock/path/vec0.dll'),
}));

// ── @/lib/embeddings mock — used by findSimilarChunks dynamic import ─────────
const { mockEmbed } = vi.hoisted(() => {
  const mockEmbed = vi.fn().mockResolvedValue([]);
  return { mockEmbed };
});

vi.mock('@/lib/embeddings', () => ({
  embed: mockEmbed,
}));

// ── Imports (after all vi.mock() calls) ───────────────────────────────────────
import {
  upsertVector,
  searchSimilar,
  deleteVector,
  findSimilarChunks,
} from '@/lib/vector';
import { _resetVecState } from '@/lib/vector/store';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DIMENSION = 384;

/** Make a deterministic 384-dim Float32Array seeded by value. */
function makeEmbedding(seed: number): Float32Array {
  const data = new Float32Array(DIMENSION);
  for (let i = 0; i < DIMENSION; i++) {
    data[i] = ((seed * (i + 1)) % 1000) / 1000;
  }
  return data;
}


// ─── beforeEach — reset singleton + mocks ─────────────────────────────────────
// Use mockReset() (not mockClear()) — mockClear() does NOT flush the
// mockReturnValueOnce queue, which causes stale Once entries to bleed
// into subsequent tests. mockReset() clears both call history AND the queue.

beforeEach(() => {
  _resetVecState();

  // Reset everything — clears call history AND mockReturnValueOnce queues
  mockRun.mockReset();
  mockPrepare.mockReset();
  mockAll.mockReset();
  mockGet.mockReset();
  mockExec.mockReset();
  mockTransaction.mockReset();
  mockLoad.mockReset();
  mockEmbed.mockReset();

  // Re-establish default returns (mockReset() clears these too)
  mockRun.mockReturnValue({ changes: 1 });
  mockAll.mockReturnValue([]);
  mockGet.mockReturnValue(null);
  mockEmbed.mockResolvedValue([]);
  // Restore mockPrepare → mockStmt chain
  const mockStmt = { run: mockRun, all: mockAll, get: mockGet };
  mockPrepare.mockReturnValue(mockStmt);
});

// ─── ensureVecIndex() ─────────────────────────────────────────────────────────

describe('ensureVecIndex()', () => {
  it('calls load(db) and db.exec() on first operation', async () => {
    await upsertVector('chunk-init', makeEmbedding(1));
    expect(mockLoad).toHaveBeenCalledOnce();
    expect(mockExec).toHaveBeenCalledOnce();
    const sql = mockExec.mock.calls[0]![0] as string;
    expect(sql).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS vec_index');
    expect(sql).toContain('vec0');
    expect(sql).toContain('FLOAT[384] distance_metric=cosine');
  });

  it('calls load(db) only once across multiple vector operations (singleton guard)', async () => {
    await upsertVector('chunk-a', makeEmbedding(1));
    await upsertVector('chunk-b', makeEmbedding(2));
    await searchSimilar(makeEmbedding(3), 5);
    expect(mockLoad).toHaveBeenCalledOnce();
    expect(mockExec).toHaveBeenCalledOnce();
  });
});

// ─── upsertVector() ───────────────────────────────────────────────────────────

describe('upsertVector()', () => {
  it('calls db.prepare() with INSERT OR REPLACE INTO vec_index', async () => {
    await upsertVector('chunk-1', makeEmbedding(1));
    expect(mockPrepare).toHaveBeenCalled();
    const sql = mockPrepare.mock.calls.find((c) =>
      (c[0] as string).includes('INSERT OR REPLACE INTO vec_index')
    )?.[0] as string | undefined;
    expect(sql).toBeDefined();
    expect(sql).toContain('chunk_id');
    expect(sql).toContain('embedding');
  });

  it('calls stmt.run() with chunkId string and Buffer embedding', async () => {
    const embedding = makeEmbedding(7);
    await upsertVector('chunk-buf', embedding);
    expect(mockRun).toHaveBeenCalled();
    const args = mockRun.mock.calls.find((c) => c[0] === 'chunk-buf');
    expect(args).toBeDefined();
    expect(args![0]).toBe('chunk-buf');
    expect(Buffer.isBuffer(args![1])).toBe(true);
  });

  it('Buffer has the same byte length as Float32Array', async () => {
    const embedding = makeEmbedding(3);
    await upsertVector('chunk-bytes', embedding);
    const bufArg = mockRun.mock.calls.find((c) => c[0] === 'chunk-bytes')?.[1] as Buffer;
    expect(bufArg).toBeDefined();
    expect(bufArg.byteLength).toBe(DIMENSION * 4); // Float32 = 4 bytes
  });

  it('resolves without error for valid inputs', async () => {
    await expect(upsertVector('chunk-ok', makeEmbedding(0))).resolves.toBeUndefined();
  });
});

// ─── searchSimilar() ─────────────────────────────────────────────────────────

describe('searchSimilar()', () => {
  it('returns [] when db returns no rows', async () => {
    mockAll.mockReturnValue([]);
    const results = await searchSimilar(makeEmbedding(1), 10);
    expect(results).toEqual([]);
  });

  it('maps rows to VectorSearchResult with chunkId, distance, similarity', async () => {
    mockAll.mockReturnValue([
      { chunk_id: 'c1', distance: 0.1 },
      { chunk_id: 'c2', distance: 0.4 },
    ]);
    const results = await searchSimilar(makeEmbedding(1), 10);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ chunkId: 'c1', distance: 0.1, similarity: 0.9 });
    expect(results[1]).toEqual({ chunkId: 'c2', distance: 0.4, similarity: 0.6 });
  });

  it('similarity = 1 - distance for each row', async () => {
    const distances = [0.0, 0.25, 0.5, 0.75, 1.0];
    mockAll.mockReturnValue(
      distances.map((d, i) => ({ chunk_id: `c${i}`, distance: d }))
    );
    const results = await searchSimilar(makeEmbedding(1), 10);
    for (const result of results) {
      expect(result.similarity).toBeCloseTo(1 - result.distance, 10);
    }
  });

  it('calls db.prepare with SELECT chunk_id, distance FROM vec_index', async () => {
    await searchSimilar(makeEmbedding(2), 5);
    const sqls = mockPrepare.mock.calls.map((c) => c[0] as string);
    const vecSql = sqls.find((s) => s.includes('FROM vec_index'));
    expect(vecSql).toBeDefined();
    expect(vecSql).toContain('WHERE embedding MATCH');
    expect(vecSql).toContain('ORDER BY distance');
    expect(vecSql).toContain('LIMIT');
  });

  it('passes k as the LIMIT parameter', async () => {
    await searchSimilar(makeEmbedding(2), 7);
    const allArgs = mockAll.mock.calls[0] as unknown[];
    expect(allArgs[1]).toBe(7);
  });

  it('passes embedding as a Buffer', async () => {
    await searchSimilar(makeEmbedding(5), 10);
    const allArgs = mockAll.mock.calls[0] as unknown[];
    expect(Buffer.isBuffer(allArgs[0])).toBe(true);
    expect((allArgs[0] as Buffer).byteLength).toBe(DIMENSION * 4);
  });
});

// ─── deleteVector() ───────────────────────────────────────────────────────────

describe('deleteVector()', () => {
  it('calls db.prepare with DELETE FROM vec_index WHERE chunk_id = ?', async () => {
    await deleteVector('chunk-del');
    const sqls = mockPrepare.mock.calls.map((c) => c[0] as string);
    const delSql = sqls.find((s) => s.includes('DELETE FROM vec_index'));
    expect(delSql).toBeDefined();
    expect(delSql).toContain('chunk_id');
  });

  it('calls stmt.run with the chunkId', async () => {
    await deleteVector('chunk-del-2');
    const runArgs = mockRun.mock.calls.find((c) => c[0] === 'chunk-del-2');
    expect(runArgs).toBeDefined();
    expect(runArgs![0]).toBe('chunk-del-2');
  });

  it('resolves without error', async () => {
    await expect(deleteVector('chunk-gone')).resolves.toBeUndefined();
  });
});

// ─── findSimilarChunks() ──────────────────────────────────────────────────────

describe('findSimilarChunks()', () => {
  it('returns [] when embed() returns empty (text too short)', async () => {
    mockEmbed.mockResolvedValue([]);
    const results = await findSimilarChunks('short', 10, 0.7);
    expect(results).toEqual([]);
  });

  it('returns [] when searchSimilar returns no rows', async () => {
    mockEmbed.mockResolvedValue([
      { chunkId: 'q1', embedding: makeEmbedding(1), sourceType: 'conversation', sourceId: 'query' },
    ]);
    mockAll.mockReturnValue([]);
    const results = await findSimilarChunks('some query text here', 10, 0.7);
    expect(results).toEqual([]);
  });

  it('filters out results below minSimilarity', async () => {
    mockEmbed.mockResolvedValue([
      { chunkId: 'q1', embedding: makeEmbedding(1) },
    ]);
    // One result above threshold, one below
    mockAll.mockReturnValue([
      { chunk_id: 'above', distance: 0.2 },  // similarity = 0.8 ✓
      { chunk_id: 'below', distance: 0.4 },  // similarity = 0.6 ✗ (< 0.7)
    ]);
    mockGet
      .mockReturnValueOnce({ content: 'Above content', source_type: 'conversation', source_id: 'thread-1' })
      .mockReturnValueOnce(null);

    const results = await findSimilarChunks('query text', 10, 0.7);
    expect(results).toHaveLength(1);
    expect(results[0]!.chunkId).toBe('above');
    expect(results[0]!.content).toBe('Above content');
    expect(results[0]!.similarity).toBeCloseTo(0.8, 5);
  });

  it('enriches results with content, sourceType, sourceId from content_chunks', async () => {
    mockEmbed.mockResolvedValue([{ chunkId: 'q1', embedding: makeEmbedding(1) }]);
    mockAll.mockReturnValue([{ chunk_id: 'chunk-rich', distance: 0.1 }]);
    mockGet.mockReturnValue({
      content: 'Rich content here',
      source_type: 'file',
      source_id: 'doc.md',
    });

    const results = await findSimilarChunks('find me something', 10, 0.7);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      chunkId: 'chunk-rich',
      distance: 0.1,
      similarity: 0.9,
      content: 'Rich content here',
      sourceType: 'file',
      sourceId: 'doc.md',
    });
  });

  it('skips chunks where content_chunks row is missing (GET returns null)', async () => {
    mockEmbed.mockResolvedValue([{ chunkId: 'q1', embedding: makeEmbedding(1) }]);
    mockAll.mockReturnValue([{ chunk_id: 'orphan', distance: 0.1 }]);
    mockGet.mockReturnValue(null); // chunk_id not in content_chunks

    const results = await findSimilarChunks('some text here please', 10, 0.5);
    expect(results).toEqual([]);
  });

  it('queries content_chunks with SELECT content, source_type, source_id', async () => {
    mockEmbed.mockResolvedValue([{ chunkId: 'q1', embedding: makeEmbedding(1) }]);
    mockAll.mockReturnValue([{ chunk_id: 'c1', distance: 0.1 }]);
    mockGet.mockReturnValue({ content: 'c', source_type: 'conversation', source_id: 's' });

    await findSimilarChunks('query', 10, 0.5);
    const sqls = mockPrepare.mock.calls.map((c) => c[0] as string);
    const chunkSql = sqls.find((s) => s.includes('FROM content_chunks'));
    expect(chunkSql).toBeDefined();
    expect(chunkSql).toContain('source_type');
    expect(chunkSql).toContain('source_id');
  });
});

// NOTE: persistEmbeddingsFull() tests live in embeddings.test.ts — that file
// mocks @/lib/vector (not @/lib/embeddings), so the real implementation can
// be imported and tested without the module-mock conflict that exists here.
