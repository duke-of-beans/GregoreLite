/**
 * Embeddings — Public API
 *
 * embed()               — chunk text and embed each chunk
 * batchEmbed()          — embed multiple sources sequentially with 100ms pacing
 * persistEmbeddings()   — write EmbeddingRecords to content_chunks (text+metadata only)
 * persistEmbeddingsFull() — write to content_chunks AND vec_index (Sprint 3B full pipeline)
 *
 * persistEmbeddings() is Sprint 3A only (text+metadata, no vectors).
 * persistEmbeddingsFull() is the complete pipeline: call this from the chat route.
 * chunk_id is the join key between content_chunks and vec_index.
 */

import { nanoid } from 'nanoid';
import { embedText, MODEL_ID, MODEL_DIMENSION } from './model';
import { chunkText } from './chunker';
import { getDatabase } from '@/lib/kernl/database';
import { upsertVector } from '@/lib/vector';
import type { EmbeddingRecord } from './types';

export type { EmbeddingRecord } from './types';
export type { Chunk } from './types';
export { MODEL_ID, MODEL_DIMENSION } from './model';
export { MIN_CHARS } from './chunker';

/**
 * Embed a single text string from a known source.
 * Returns one EmbeddingRecord per chunk. Returns [] if text is under MIN_CHARS.
 */
export async function embed(
  text: string,
  sourceType: EmbeddingRecord['sourceType'],
  sourceId: string
): Promise<EmbeddingRecord[]> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return [];

  const records: EmbeddingRecord[] = [];

  for (const chunk of chunks) {
    const embedding = await embedText(chunk.text);
    records.push({
      chunkId: nanoid(),
      sourceType,
      sourceId,
      chunkIndex: chunk.index,
      content: chunk.text,
      embedding,
      modelId: MODEL_ID,
      createdAt: Date.now(),
    });
  }

  return records;
}

/**
 * Embed multiple sources sequentially with 100ms pacing between each
 * to avoid saturating the ONNX runtime (§5.2 blueprint).
 */
export async function batchEmbed(
  inputs: Array<{
    text: string;
    sourceType: EmbeddingRecord['sourceType'];
    sourceId: string;
  }>
): Promise<EmbeddingRecord[]> {
  const results: EmbeddingRecord[] = [];

  for (const input of inputs) {
    const records = await embed(input.text, input.sourceType, input.sourceId);
    results.push(...records);
    await new Promise<void>((r) => setTimeout(r, 100));
  }

  return results;
}

/**
 * Persist EmbeddingRecords to content_chunks table (text + metadata only).
 * Vectors (Float32Array) are written to vec_index by Sprint 3B.
 *
 * Uses better-sqlite3 synchronous API inside a transaction for atomicity.
 */
export function persistEmbeddings(records: EmbeddingRecord[]): void {
  if (records.length === 0) return;

  const db = getDatabase();
  const now = Date.now();

  const stmt = db.prepare<[string, string, string, number, string, string, string, number, number]>(`
    INSERT OR REPLACE INTO content_chunks
      (id, source_type, source_id, chunk_index, content, metadata, model_id, created_at, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((rows: EmbeddingRecord[]) => {
    for (const record of rows) {
      stmt.run(
        record.chunkId,
        record.sourceType,
        record.sourceId,
        record.chunkIndex,
        record.content,
        JSON.stringify({ embedding_dim: MODEL_DIMENSION }),
        record.modelId,
        record.createdAt,
        now
      );
    }
  });

  insertAll(records);
}

/**
 * Full Sprint 3A+3B pipeline: persist text+metadata to content_chunks,
 * then upsert each vector into vec_index.
 *
 * Use this in the chat route (and anywhere that needs full indexing).
 * persistEmbeddings() remains available for text-only use cases.
 */
export async function persistEmbeddingsFull(records: EmbeddingRecord[]): Promise<void> {
  if (records.length === 0) return;

  // Write text + metadata first (synchronous better-sqlite3 transaction)
  persistEmbeddings(records);

  // Upsert vectors — sequential to avoid saturating the DB
  for (const record of records) {
    await upsertVector(record.chunkId, record.embedding);
  }
}
