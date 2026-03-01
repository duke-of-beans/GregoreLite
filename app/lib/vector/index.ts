/**
 * Vector — Public API
 *
 * upsertVector()      — insert/replace a chunk_id + embedding in vec_index
 * searchSimilar()     — cosine nearest-neighbour search, returns k results
 * deleteVector()      — remove a chunk from vec_index by chunk_id
 * findSimilarChunks() — end-to-end: embed query text → search → enrich from content_chunks
 *
 * All operations use the KERNL SQLite database (better-sqlite3 sync API).
 * The sqlite-vec extension is loaded lazily on first call via ensureVecIndex().
 *
 * chunk_id is the join key between vec_index and content_chunks (Sprint 3A).
 *
 * findSimilarChunks() uses a dynamic import for embed() to break the
 * static circular dependency:
 *   lib/embeddings/index.ts → lib/vector/index.ts → lib/embeddings/index.ts
 */

import { getDatabase } from '@/lib/kernl/database';
import { ensureVecIndex } from './store';
import type { VectorSearchResult } from './types';

export type { VectorSearchResult } from './types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getDb() {
  const db = getDatabase();
  ensureVecIndex(db);
  return db;
}

/** Serialize a Float32Array to a Buffer for sqlite-vec binding. */
function toBuffer(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
}

// ─── Row shapes returned by better-sqlite3 ───────────────────────────────────

interface VecRow {
  chunk_id: string;
  distance: number;
}

interface ChunkRow {
  content: string;
  source_type: string;
  source_id: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upsert a vector into vec_index.
 * chunk_id must match the corresponding content_chunks.id (join key).
 */
export async function upsertVector(
  chunkId: string,
  embedding: Float32Array
): Promise<void> {
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO vec_index (chunk_id, embedding) VALUES (?, ?)'
  ).run(chunkId, toBuffer(embedding));
}

/**
 * k-nearest-neighbour cosine search.
 * Results are sorted by distance ascending (most similar first).
 * Returns at most k results.
 */
export async function searchSimilar(
  embedding: Float32Array,
  k: number = 10
): Promise<VectorSearchResult[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT chunk_id, distance
       FROM vec_index
       WHERE embedding MATCH ?
       ORDER BY distance
       LIMIT ?`
    )
    .all(toBuffer(embedding), k) as VecRow[];

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    distance: row.distance,
    similarity: 1 - row.distance,
  }));
}

/**
 * Remove a vector from vec_index by chunk_id.
 */
export async function deleteVector(chunkId: string): Promise<void> {
  const db = getDb();
  db.prepare('DELETE FROM vec_index WHERE chunk_id = ?').run(chunkId);
}

/**
 * Full Cross-Context Engine query:
 *   1. Embed queryText using bge-small-en-v1.5
 *   2. Search vec_index for k nearest neighbours
 *   3. Filter results below minSimilarity threshold
 *   4. Enrich with content + source metadata from content_chunks
 *
 * Uses dynamic import for embed() to break the circular module dep.
 *
 * @param queryText     Raw text to embed and search against
 * @param k             Number of candidates to retrieve (default 10)
 * @param minSimilarity Cosine similarity floor — results below this are dropped (default 0.70)
 */
export async function findSimilarChunks(
  queryText: string,
  k: number = 10,
  minSimilarity: number = 0.7
): Promise<
  Array<VectorSearchResult & { content: string; sourceType: string; sourceId: string }>
> {
  // Dynamic import to avoid static circular dependency with lib/embeddings
  const { embed } = await import('@/lib/embeddings');

  const queryRecords = await embed(queryText, 'conversation', 'query');
  if (queryRecords.length === 0) return [];

  const firstRecord = queryRecords[0];
  if (!firstRecord) return [];

  const results = await searchSimilar(firstRecord.embedding, k);

  const db = getDb();
  const enriched: Array<
    VectorSearchResult & { content: string; sourceType: string; sourceId: string }
  > = [];

  for (const result of results) {
    if (result.similarity < minSimilarity) continue;

    const chunk = db
      .prepare(
        'SELECT content, source_type, source_id FROM content_chunks WHERE id = ?'
      )
      .get(result.chunkId) as ChunkRow | undefined;

    if (chunk) {
      enriched.push({
        ...result,
        content: chunk.content,
        sourceType: chunk.source_type,
        sourceId: chunk.source_id,
      });
    }
  }

  return enriched;
}
