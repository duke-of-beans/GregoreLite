/**
 * Tests for app/lib/vector/hot-cache.ts — Sprint 3C
 *
 * Coverage:
 *   - writeHotCache(): serialises records to correct binary format, respects MAX_HOT_RECORDS
 *   - readHotCache(): returns [] when file missing, deserialises binary correctly
 *   - searchHotCache(): brute-force cosine similarity, top-k, returns [] before read
 *   - isHotCacheReady(): reflects in-memory state
 *
 * fs is fully mocked — no disk I/O.
 *
 * @module __tests__/unit/hot-cache.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── fs mock ───────────────────────────────────────────────────────────────────
const { mockExistsSync, mockMkdirSync, mockReadFileSync, mockWriteFileSync } = vi.hoisted(() => {
  const mockExistsSync = vi.fn().mockReturnValue(false);
  const mockMkdirSync = vi.fn();
  const mockReadFileSync = vi.fn().mockReturnValue(Buffer.alloc(0));
  const mockWriteFileSync = vi.fn();
  return { mockExistsSync, mockMkdirSync, mockReadFileSync, mockWriteFileSync };
});

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

import {
  writeHotCache,
  readHotCache,
  searchHotCache,
  isHotCacheReady,
  _resetHotCache,
  RECORD_SIZE,
  CHUNK_ID_BYTES,
  EMBEDDING_FLOATS,
  MAX_HOT_RECORDS,
} from '@/lib/vector/hot-cache';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEmbedding(seed: number): Float32Array {
  const data = new Float32Array(EMBEDDING_FLOATS);
  // Normalise so dot product equals cosine similarity
  let magnitude = 0;
  for (let i = 0; i < EMBEDDING_FLOATS; i++) {
    data[i] = ((seed * (i + 1)) % 100) / 100;
    magnitude += (data[i] ?? 0) ** 2;
  }
  magnitude = Math.sqrt(magnitude);
  for (let i = 0; i < EMBEDDING_FLOATS; i++) {
    data[i] = (data[i] ?? 0) / magnitude;
  }
  return data;
}

/** Encode a single record to the expected binary layout. */
function encodeRecord(chunkId: string, embedding: Float32Array): Buffer {
  const buf = Buffer.alloc(RECORD_SIZE);
  buf.write(chunkId, 0, CHUNK_ID_BYTES, 'utf8');
  for (let j = 0; j < EMBEDDING_FLOATS; j++) {
    buf.writeFloatLE(embedding[j] ?? 0, CHUNK_ID_BYTES + j * 4);
  }
  return buf;
}

beforeEach(() => {
  _resetHotCache();
  mockExistsSync.mockReset();
  mockMkdirSync.mockReset();
  mockReadFileSync.mockReset();
  mockWriteFileSync.mockReset();
  // Safe default: directory exists, empty file
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(Buffer.alloc(0));
});

// ─── writeHotCache() ──────────────────────────────────────────────────────────

describe('writeHotCache()', () => {
  it('writes a buffer of exactly records.length * RECORD_SIZE bytes', async () => {
    const records = [
      { chunkId: 'chunk-1', embedding: makeEmbedding(1) },
      { chunkId: 'chunk-2', embedding: makeEmbedding(2) },
    ];
    await writeHotCache(records);
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [, buf] = mockWriteFileSync.mock.calls[0] as [string, Buffer];
    expect(buf.byteLength).toBe(2 * RECORD_SIZE);
  });

  it('encodes chunkId as UTF-8 in the first CHUNK_ID_BYTES bytes of each record', async () => {
    await writeHotCache([{ chunkId: 'test-id-abc', embedding: makeEmbedding(1) }]);
    const [, buf] = mockWriteFileSync.mock.calls[0] as [string, Buffer];
    const decoded = buf.subarray(0, CHUNK_ID_BYTES).toString('utf8').replace(/\0/g, '');
    expect(decoded).toBe('test-id-abc');
  });

  it('encodes embedding as Float32LE values after chunkId bytes', async () => {
    const embedding = makeEmbedding(5);
    await writeHotCache([{ chunkId: 'enc-test', embedding }]);
    const [, buf] = mockWriteFileSync.mock.calls[0] as [string, Buffer];
    for (let j = 0; j < EMBEDDING_FLOATS; j++) {
      const read = buf.readFloatLE(CHUNK_ID_BYTES + j * 4);
      expect(read).toBeCloseTo(embedding[j] ?? 0, 4);
    }
  });

  it('truncates input to MAX_HOT_RECORDS', async () => {
    const records = Array.from({ length: MAX_HOT_RECORDS + 50 }, (_, i) => ({
      chunkId: `chunk-${i}`,
      embedding: makeEmbedding(i),
    }));
    await writeHotCache(records);
    const [, buf] = mockWriteFileSync.mock.calls[0] as [string, Buffer];
    expect(buf.byteLength).toBe(MAX_HOT_RECORDS * RECORD_SIZE);
  });

  it('creates the directory when it does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    await writeHotCache([{ chunkId: 'c1', embedding: makeEmbedding(1) }]);
    expect(mockMkdirSync).toHaveBeenCalledOnce();
    const [, opts] = mockMkdirSync.mock.calls[0] as [string, { recursive: boolean }];
    expect(opts.recursive).toBe(true);
  });

  it('does not call mkdirSync when directory already exists', async () => {
    mockExistsSync.mockReturnValue(true);
    await writeHotCache([{ chunkId: 'c1', embedding: makeEmbedding(1) }]);
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });
});

// ─── readHotCache() ───────────────────────────────────────────────────────────

describe('readHotCache()', () => {
  it('returns [] when hot_cache.bin does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await readHotCache();
    expect(result).toEqual([]);
  });

  it('marks hot cache as ready after returning []', async () => {
    mockExistsSync.mockReturnValue(false);
    await readHotCache();
    expect(isHotCacheReady()).toBe(true);
  });

  it('correctly deserialises chunkId from binary', async () => {
    const embedding = makeEmbedding(3);
    const buf = encodeRecord('my-chunk-id', embedding);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(buf);

    const result = await readHotCache();
    expect(result).toHaveLength(1);
    expect(result[0]!.chunkId).toBe('my-chunk-id');
  });

  it('correctly deserialises embedding values from binary', async () => {
    const embedding = makeEmbedding(7);
    const buf = encodeRecord('emb-check', embedding);
    mockReadFileSync.mockReturnValue(buf);

    const result = await readHotCache();
    expect(result[0]!.embedding).toHaveLength(EMBEDDING_FLOATS);
    for (let j = 0; j < EMBEDDING_FLOATS; j++) {
      expect(result[0]!.embedding[j]).toBeCloseTo(embedding[j] ?? 0, 4);
    }
  });

  it('deserialises multiple records from a single buffer', async () => {
    const records = [
      { chunkId: 'alpha', embedding: makeEmbedding(1) },
      { chunkId: 'beta', embedding: makeEmbedding(2) },
      { chunkId: 'gamma', embedding: makeEmbedding(3) },
    ];
    const buf = Buffer.concat(records.map((r) => encodeRecord(r.chunkId, r.embedding)));
    mockReadFileSync.mockReturnValue(buf);

    const result = await readHotCache();
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.chunkId)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('populates the in-memory index used by searchHotCache()', async () => {
    const embedding = makeEmbedding(2);
    mockReadFileSync.mockReturnValue(encodeRecord('indexed', embedding));

    await readHotCache();
    const results = searchHotCache(embedding, 1);
    expect(results).toHaveLength(1);
    expect(results[0]!.chunkId).toBe('indexed');
  });
});

// ─── searchHotCache() ─────────────────────────────────────────────────────────

describe('searchHotCache()', () => {
  it('returns [] before readHotCache() is called', () => {
    expect(isHotCacheReady()).toBe(false);
    const results = searchHotCache(makeEmbedding(1), 5);
    expect(results).toEqual([]);
  });

  it('returns results sorted by similarity descending', async () => {
    // Pre-populate with two records with different seeds
    // Note: seed must not be a multiple of 100 — makeEmbedding(100) produces all-zeros
    const emb1 = makeEmbedding(1);
    const emb2 = makeEmbedding(99); // orthogonal-ish to emb1
    const buf = Buffer.concat([encodeRecord('close', emb1), encodeRecord('far', emb2)]);
    mockReadFileSync.mockReturnValue(buf);
    await readHotCache();

    // Query with emb1 — 'close' should rank first
    const results = searchHotCache(emb1, 2);
    expect(results[0]!.chunkId).toBe('close');
    expect(results[0]!.similarity).toBeGreaterThan(results[1]!.similarity);
  });

  it('returns at most k results', async () => {
    const records = Array.from({ length: 10 }, (_, i) => encodeRecord(`c${i}`, makeEmbedding(i)));
    mockReadFileSync.mockReturnValue(Buffer.concat(records));
    await readHotCache();

    const results = searchHotCache(makeEmbedding(1), 3);
    expect(results).toHaveLength(3);
  });

  it('result includes distance = 1 - similarity', async () => {
    const emb = makeEmbedding(4);
    mockReadFileSync.mockReturnValue(encodeRecord('dist-check', emb));
    await readHotCache();

    const results = searchHotCache(emb, 1);
    expect(results[0]!.distance).toBeCloseTo(1 - results[0]!.similarity, 10);
  });
});

// ─── isHotCacheReady() ────────────────────────────────────────────────────────

describe('isHotCacheReady()', () => {
  it('returns false before readHotCache() is called', () => {
    expect(isHotCacheReady()).toBe(false);
  });

  it('returns true after readHotCache() resolves', async () => {
    mockExistsSync.mockReturnValue(false);
    await readHotCache();
    expect(isHotCacheReady()).toBe(true);
  });
});
