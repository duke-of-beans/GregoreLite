/**
 * Warm Cache — Tier 2 Cold Start
 *
 * Builds an in-memory brute-force index of the last 30 days of chunk embeddings
 * at application boot. Covers ~10k chunks — sufficient for most queries without
 * hitting sqlite-vec.
 *
 * Embeddings are loaded from vec_index by chunk_id join. Vectors are already
 * L2-normalised (bge-small-en-v1.5), so dot product = cosine similarity.
 *
 * @module lib/vector/warm-cache
 */

import { getDatabase } from '@/lib/kernl/database';
import { ensureVecIndex } from './store';
import type { VectorSearchResult } from './types';

// ─── In-memory index ─────────────────────────────────────────────────────────

let _warmIndex: Array<{ chunkId: string; embedding: Float32Array }> | null = null;

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface ChunkIdRow {
  id: string;
}

interface EmbeddingRow {
  embedding: Buffer;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Dot product of two pre-normalised Float32Arrays = cosine similarity. */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}

/**
 * Load embeddings from vec_index for the given chunk IDs.
 * Each embedding is stored as a BLOB (Float32LE) in vec_index.
 * Chunks without a vec_index entry are silently skipped.
 */
async function loadEmbeddingsForChunks(
  chunkIds: string[]
): Promise<Array<{ chunkId: string; embedding: Float32Array }>> {
  if (chunkIds.length === 0) return [];

  const db = getDatabase();
  ensureVecIndex(db);

  const stmt = db.prepare('SELECT embedding FROM vec_index WHERE chunk_id = ?');
  const result: Array<{ chunkId: string; embedding: Float32Array }> = [];

  for (const id of chunkIds) {
    const row = stmt.get(id) as EmbeddingRow | undefined;
    if (row?.embedding) {
      const buf = Buffer.isBuffer(row.embedding)
        ? row.embedding
        : Buffer.from(row.embedding as ArrayBuffer);
      const embedding = new Float32Array(
        buf.buffer,
        buf.byteOffset,
        buf.byteLength / 4
      );
      result.push({ chunkId: id, embedding });
    }
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the 30-day warm cache.
 * Queries content_chunks for chunks created within the last 30 days,
 * then loads their embeddings from vec_index into memory.
 *
 * Call this once at boot (non-blocking via warmAll()).
 */
export async function buildWarmCache(): Promise<void> {
  const db = getDatabase();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const chunks = db
    .prepare(`SELECT id FROM content_chunks WHERE created_at > ?`)
    .all(thirtyDaysAgo) as ChunkIdRow[];

  _warmIndex = await loadEmbeddingsForChunks(chunks.map((c) => c.id));
}

/**
 * Brute-force cosine similarity search over the in-memory warm index.
 * Returns at most k results sorted by similarity descending.
 * Returns [] if buildWarmCache() has not been called yet.
 */
export function searchWarmCache(query: Float32Array, k: number): VectorSearchResult[] {
  if (!_warmIndex || _warmIndex.length === 0) return [];

  return _warmIndex
    .map(({ chunkId, embedding }) => {
      const sim = cosineSimilarity(query, embedding);
      return { chunkId, distance: 1 - sim, similarity: sim };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/** True if the in-memory warm index has been populated by buildWarmCache(). */
export function isWarmCacheReady(): boolean {
  return _warmIndex !== null;
}

/** Reset in-memory state — used by tests to isolate test cases. */
export function _resetWarmCache(): void {
  _warmIndex = null;
}
