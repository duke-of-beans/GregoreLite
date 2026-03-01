/**
 * Hot Cache — Tier 1 Cold Start
 *
 * Stores the 1,000 most recently used chunk embeddings as a binary file.
 * Serialization format (per record):
 *   [chunkId: 36 bytes, UTF-8 zero-padded] [embedding: 384 × 4 bytes, Float32LE]
 *   Total: 1,572 bytes per record — 1,000 records ≈ 1.5 MB
 *
 * Hot cache is rebuilt on session end or after background indexer runs.
 *
 * Cosine similarity uses dot product — vectors from bge-small-en-v1.5
 * are L2-normalised at embed time, so dot product = cosine similarity.
 *
 * @module lib/vector/hot-cache
 */

import path from 'path';
import fs from 'fs';
import type { VectorSearchResult } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const _appData = process.env['APPDATA'] ?? path.join(process.cwd(), '.data');
export const HOT_CACHE_PATH = path.join(_appData, 'greglite', 'hot_cache.bin');

export const CHUNK_ID_BYTES = 36;
export const EMBEDDING_FLOATS = 384;
export const RECORD_SIZE = CHUNK_ID_BYTES + EMBEDDING_FLOATS * 4; // 36 + 1536 = 1572
export const MAX_HOT_RECORDS = 1000;

// ─── In-memory index ─────────────────────────────────────────────────────────

let _hotIndex: Array<{ chunkId: string; embedding: Float32Array }> | null = null;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Dot product of two pre-normalised Float32Arrays = cosine similarity. */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}

function ensureDir(): void {
  const dir = path.dirname(HOT_CACHE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Write up to MAX_HOT_RECORDS chunk embeddings to hot_cache.bin.
 * Creates the greglite app-data directory if it does not exist.
 * Overwrites any existing cache file.
 */
export async function writeHotCache(
  records: Array<{ chunkId: string; embedding: Float32Array }>
): Promise<void> {
  ensureDir();
  const limited = records.slice(0, MAX_HOT_RECORDS);
  const buf = Buffer.alloc(limited.length * RECORD_SIZE);
  let offset = 0;

  for (const { chunkId, embedding } of limited) {
    // Write chunkId as UTF-8, zero-padded to CHUNK_ID_BYTES
    buf.write(chunkId, offset, CHUNK_ID_BYTES, 'utf8');
    offset += CHUNK_ID_BYTES;

    // Write embedding as Float32LE values
    for (let i = 0; i < EMBEDDING_FLOATS; i++) {
      buf.writeFloatLE(embedding[i] ?? 0, offset);
      offset += 4;
    }
  }

  fs.writeFileSync(HOT_CACHE_PATH, buf);
}

/**
 * Read hot_cache.bin into memory.
 * Returns [] if the file does not exist (first run).
 * Populates the in-memory _hotIndex used by searchHotCache().
 */
export async function readHotCache(): Promise<Array<{ chunkId: string; embedding: Float32Array }>> {
  if (!fs.existsSync(HOT_CACHE_PATH)) {
    _hotIndex = [];
    return _hotIndex;
  }

  const buf = fs.readFileSync(HOT_CACHE_PATH);
  const count = Math.floor(buf.length / RECORD_SIZE);
  const records: Array<{ chunkId: string; embedding: Float32Array }> = [];

  for (let i = 0; i < count; i++) {
    const base = i * RECORD_SIZE;

    // Read chunkId — strip null padding bytes
    const chunkId = buf
      .subarray(base, base + CHUNK_ID_BYTES)
      .toString('utf8')
      .replace(/\0/g, '');

    // Read embedding — Float32LE values
    const embedding = new Float32Array(EMBEDDING_FLOATS);
    for (let j = 0; j < EMBEDDING_FLOATS; j++) {
      embedding[j] = buf.readFloatLE(base + CHUNK_ID_BYTES + j * 4);
    }

    records.push({ chunkId, embedding });
  }

  _hotIndex = records;
  return records;
}

/**
 * Brute-force cosine similarity search over the in-memory hot index.
 * Returns at most k results sorted by similarity descending.
 * Returns [] if readHotCache() has not been called yet.
 */
export function searchHotCache(query: Float32Array, k: number): VectorSearchResult[] {
  if (!_hotIndex || _hotIndex.length === 0) return [];

  return _hotIndex
    .map(({ chunkId, embedding }) => {
      const sim = cosineSimilarity(query, embedding);
      return { chunkId, distance: 1 - sim, similarity: sim };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/** True if the in-memory hot index has been populated by readHotCache(). */
export function isHotCacheReady(): boolean {
  return _hotIndex !== null;
}

/** Reset in-memory state — used by tests to isolate test cases. */
export function _resetHotCache(): void {
  _hotIndex = null;
}
