/**
 * Ghost Ingest — Writer
 *
 * writeChunks()   — insert ChunkResult[] into content_chunks and vec_index
 * writeAuditRow() — insert one row into ghost_indexed_items
 */

import { getDatabase } from '@/lib/kernl/database';
import { upsertVector } from '@/lib/vector';
import type { ChunkResult, GhostChunkMetadata } from './types';

const MODEL_ID = 'Xenova/bge-small-en-v1.5';

interface AuditRowParams {
  id: string;
  sourceType: 'file' | 'email';
  sourcePath: string;
  sourceAccount: string;
  chunkCount: number;
}

/**
 * Write all chunks for one ingest item to content_chunks and vec_index.
 * Returns the number of chunks written.
 */
export async function writeChunks(
  sourceId: string,
  sourceType: 'file' | 'email',
  chunks: ChunkResult[]
): Promise<number> {
  if (chunks.length === 0) return 0;

  const db = getDatabase();
  const now = Date.now();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO content_chunks
      (id, source_type, source_id, source_path, source_account,
       chunk_index, content, metadata, model_id, created_at, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows: ChunkResult[]) => {
    for (const chunk of rows) {
      const meta = chunk.metadata as GhostChunkMetadata;
      insert.run(
        chunk.chunkId,
        sourceType,
        sourceId,
        meta.source_path,
        meta.source_account,
        chunk.chunkIndex,
        chunk.content,
        JSON.stringify(meta),
        MODEL_ID,
        now,
        now
      );
    }
  });

  insertMany(chunks);

  // Write vectors outside the transaction — upsertVector is async
  for (const chunk of chunks) {
    await upsertVector(chunk.chunkId, chunk.embedding);
  }

  return chunks.length;
}

/**
 * Write one audit row to ghost_indexed_items.
 * Called once per ingest operation, after all chunks are written.
 */
export function writeAuditRow(row: AuditRowParams): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO ghost_indexed_items
      (id, source_type, source_path, source_account, chunk_count, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    row.id,
    row.sourceType,
    row.sourcePath,
    row.sourceAccount,
    row.chunkCount,
    Date.now()
  );
}
