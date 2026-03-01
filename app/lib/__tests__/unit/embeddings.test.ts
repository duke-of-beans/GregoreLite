/**
 * Tests for app/lib/embeddings/ — Sprint 3A
 *
 * Coverage:
 *   - chunkText(): MIN_CHARS gate, single chunk, multi-chunk with overlap,
 *     token estimates, trim behaviour
 *   - embed(): returns [] for short text, returns EmbeddingRecord[] with
 *     correct shape, modelId, sourceType, sourceId
 *   - batchEmbed(): processes all inputs, pacing delay present
 *   - persistEmbeddings(): calls db.prepare().run() for each record,
 *     uses INSERT OR REPLACE with correct column order
 *   - Determinism: same input → identical Float32Array (via mock)
 *   - MIN_CHARS and MODEL_DIMENSION constants are exported correctly
 *
 * @xenova/transformers is mocked — no real model download.
 * @/lib/kernl/database is mocked — no real SQLite dependency.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── DB mock (hoisted before imports) ─────────────────────────────────────────
const { mockRun, mockPrepare, mockTransaction } = vi.hoisted(() => {
  const mockRun = vi.fn().mockReturnValue({ changes: 1 });
  const mockStmt = { run: mockRun };
  const mockPrepare = vi.fn().mockReturnValue(mockStmt);
  const mockTransaction = vi.fn((fn: (...args: unknown[]) => unknown) => fn);
  return { mockRun, mockPrepare, mockTransaction };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({
    prepare: mockPrepare,
    transaction: mockTransaction,
  }),
}));

// ── @xenova/transformers mock ─────────────────────────────────────────────────
// Returns a deterministic 384-dim Float32Array seeded from the input text length.
vi.mock('@xenova/transformers', () => {
  const makePipeline = () => async (text: string, _opts: unknown) => {
    const dim = 384;
    const data = new Float32Array(dim);
    // Deterministic seed: fill with (charCode * index) % 1 values
    for (let i = 0; i < dim; i++) {
      data[i] = ((text.charCodeAt(i % text.length) * (i + 1)) % 1000) / 1000;
    }
    return { data };
  };
  return { pipeline: vi.fn(makePipeline) };
});

import { chunkText, MIN_CHARS } from '@/lib/embeddings/chunker';
import { MODEL_ID, MODEL_DIMENSION } from '@/lib/embeddings/model';
import {
  embed,
  batchEmbed,
  persistEmbeddings,
} from '@/lib/embeddings';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a string of exactly `n` characters */
const str = (n: number) => 'a'.repeat(n);

/** 200-char text that is exactly at the MIN_CHARS boundary */
const EXACTLY_MIN = str(MIN_CHARS);
/** 199-char text — one below the gate */
const BELOW_MIN = str(MIN_CHARS - 1);
/** A "real" message — 400 chars, fits in one chunk */
const SHORT_MSG = str(400);
/** Large text that exceeds one 2048-char chunk */
const LONG_TEXT = str(5000);

// ─── chunkText() ─────────────────────────────────────────────────────────────

describe('chunkText()', () => {
  it('returns [] for text strictly below MIN_CHARS', () => {
    expect(chunkText(BELOW_MIN)).toHaveLength(0);
  });

  it('returns [] for empty string', () => {
    expect(chunkText('')).toHaveLength(0);
  });

  it('returns one chunk for text at exactly MIN_CHARS', () => {
    const chunks = chunkText(EXACTLY_MIN);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.text.length).toBeGreaterThanOrEqual(MIN_CHARS);
  });

  it('returns one chunk for text that fits within a single window (400 chars)', () => {
    const chunks = chunkText(SHORT_MSG);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe(SHORT_MSG.trim());
  });

  it('returns multiple chunks for long text with correct sequential indexes', () => {
    const chunks = chunkText(LONG_TEXT);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  it('chunks have correct tokenEstimate (ceil(length / 4))', () => {
    const chunks = chunkText(SHORT_MSG);
    for (const chunk of chunks) {
      expect(chunk.tokenEstimate).toBe(Math.ceil(chunk.text.length / 4));
    }
  });

  it('adjacent chunks overlap — last chars of chunk N appear in chunk N+1', () => {
    const chunks = chunkText(LONG_TEXT);
    if (chunks.length < 2) return;
    const first = chunks[0]!.text;
    const second = chunks[1]!.text;
    // Overlap is 50 tokens × 4 chars = 200 chars
    const overlapRegion = first.slice(-200);
    expect(second.startsWith(overlapRegion.trim().slice(0, 50))).toBe(true);
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('MIN_CHARS is 200', () => {
    expect(MIN_CHARS).toBe(200);
  });

  it('MODEL_ID is the locked bge-small model', () => {
    expect(MODEL_ID).toBe('Xenova/bge-small-en-v1.5');
  });

  it('MODEL_DIMENSION is 384', () => {
    expect(MODEL_DIMENSION).toBe(384);
  });
});

// ─── embed() ─────────────────────────────────────────────────────────────────

describe('embed()', () => {
  it('returns [] for text below MIN_CHARS', async () => {
    const records = await embed(BELOW_MIN, 'conversation', 'thread-1');
    expect(records).toHaveLength(0);
  });

  it('returns EmbeddingRecord[] with correct shape for short message', async () => {
    const records = await embed(SHORT_MSG, 'conversation', 'thread-1');
    expect(records.length).toBeGreaterThan(0);

    const rec = records[0]!;
    expect(rec.chunkId).toBeTruthy();
    expect(rec.sourceType).toBe('conversation');
    expect(rec.sourceId).toBe('thread-1');
    expect(rec.chunkIndex).toBe(0);
    expect(rec.content).toBe(SHORT_MSG.trim());
    expect(rec.modelId).toBe(MODEL_ID);
    expect(rec.embedding).toBeInstanceOf(Float32Array);
    expect(rec.embedding.length).toBe(MODEL_DIMENSION);
    expect(rec.createdAt).toBeGreaterThan(0);
  });

  it('stores correct sourceType variants', async () => {
    const types: Array<'conversation' | 'file' | 'email' | 'email_attachment'> = [
      'conversation', 'file', 'email', 'email_attachment',
    ];
    for (const sourceType of types) {
      const records = await embed(SHORT_MSG, sourceType, 'src-1');
      expect(records[0]!.sourceType).toBe(sourceType);
    }
  });

  it('always stores MODEL_ID on every record', async () => {
    const records = await embed(LONG_TEXT, 'file', 'file-path');
    for (const rec of records) {
      expect(rec.modelId).toBe(MODEL_ID);
    }
  });

  it('chunkIndex increments correctly across multi-chunk text', async () => {
    const records = await embed(LONG_TEXT, 'conversation', 'thread-2');
    expect(records.length).toBeGreaterThan(1);
    records.forEach((rec, i) => {
      expect(rec.chunkIndex).toBe(i);
    });
  });

  it('each record has a unique chunkId', async () => {
    const records = await embed(LONG_TEXT, 'conversation', 'thread-3');
    const ids = records.map((r) => r.chunkId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same input produces identical Float32Array vectors', async () => {
    const [a, b] = await Promise.all([
      embed(SHORT_MSG, 'conversation', 'thread-det'),
      embed(SHORT_MSG, 'conversation', 'thread-det'),
    ]);
    // Vectors must be identical element-by-element
    for (let i = 0; i < MODEL_DIMENSION; i++) {
      expect(a[0]!.embedding[i]).toBe(b[0]!.embedding[i]);
    }
  });
});

// ─── batchEmbed() ────────────────────────────────────────────────────────────

describe('batchEmbed()', () => {
  it('returns combined records for all inputs', async () => {
    const inputs = [
      { text: SHORT_MSG, sourceType: 'conversation' as const, sourceId: 'th-1' },
      { text: SHORT_MSG, sourceType: 'file' as const, sourceId: 'file-1' },
    ];
    const records = await batchEmbed(inputs);
    expect(records.length).toBeGreaterThanOrEqual(2);
    expect(records.some((r) => r.sourceType === 'conversation')).toBe(true);
    expect(records.some((r) => r.sourceType === 'file')).toBe(true);
  });

  it('skips inputs below MIN_CHARS', async () => {
    const inputs = [
      { text: BELOW_MIN, sourceType: 'conversation' as const, sourceId: 'th-skip' },
      { text: SHORT_MSG, sourceType: 'file' as const, sourceId: 'file-ok' },
    ];
    const records = await batchEmbed(inputs);
    expect(records.every((r) => r.sourceType !== 'conversation')).toBe(true);
  });

  it('returns empty array when all inputs are below MIN_CHARS', async () => {
    const inputs = [
      { text: BELOW_MIN, sourceType: 'conversation' as const, sourceId: 'th-1' },
    ];
    const records = await batchEmbed(inputs);
    expect(records).toHaveLength(0);
  });
});

// ─── persistEmbeddings() ─────────────────────────────────────────────────────

describe('persistEmbeddings()', () => {
  beforeEach(() => {
    mockRun.mockClear();
    mockPrepare.mockClear();
    mockTransaction.mockClear();
  });

  it('is a no-op for empty records array', () => {
    persistEmbeddings([]);
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('calls db.prepare with INSERT OR REPLACE INTO content_chunks', async () => {
    const records = await embed(SHORT_MSG, 'conversation', 'thread-p');
    persistEmbeddings(records);
    expect(mockPrepare).toHaveBeenCalledOnce();
    const sql = mockPrepare.mock.calls[0]![0] as string;
    expect(sql).toContain('INSERT OR REPLACE INTO content_chunks');
  });

  it('calls db.transaction and executes it', async () => {
    const records = await embed(SHORT_MSG, 'conversation', 'thread-t');
    persistEmbeddings(records);
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it('passes model_id to the stmt for every record', async () => {
    const records = await embed(SHORT_MSG, 'conversation', 'thread-m');
    persistEmbeddings(records);
    // mockTransaction wraps fn — mockRun is called once per record
    expect(mockRun).toHaveBeenCalledTimes(records.length);
    for (const call of mockRun.mock.calls) {
      const args = call as unknown[];
      // model_id is the 7th positional arg (0-indexed: 6)
      expect(args[6]).toBe(MODEL_ID);
    }
  });

  it('passes embedding_dim in metadata JSON', async () => {
    const records = await embed(SHORT_MSG, 'conversation', 'thread-meta');
    persistEmbeddings(records);
    for (const call of mockRun.mock.calls) {
      const args = call as unknown[];
      const metadata = JSON.parse(args[5] as string) as { embedding_dim: number };
      expect(metadata.embedding_dim).toBe(MODEL_DIMENSION);
    }
  });
});
