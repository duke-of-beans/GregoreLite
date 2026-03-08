/**
 * Import Pipeline — chunk, embed, index imported conversations
 * Sprint 33.0 / EPIC-81
 *
 * runImport() processes ImportedConversation[] for one source:
 *   1. Dedup check per conversation (imported_conversations table)
 *   2. Chunk messages into ~600-token blocks
 *   3. Embed via embedText() (dynamic import, keeps ONNX lazy)
 *   4. Write to content_chunks + vec_index (upsertVector)
 *   5. Insert imported_conversations row
 *   6. Update imported_sources totals
 *
 * Progress is stored in a module-level Map keyed by sourceId.
 * The GET /api/import/progress/[sourceId] route polls this Map.
 */

import { nanoid } from 'nanoid';
import { getDatabase } from '@/lib/kernl/database';
import { upsertVector } from '@/lib/vector';
import type { ImportedConversation, ImportProgress } from './types';
import type Database from 'better-sqlite3';

// ─── Progress store (module-level, polled by API) ─────────────────────────────

const progressStore = new Map<string, ImportProgress>();

export function getProgress(sourceId: string): ImportProgress | null {
  return progressStore.get(sourceId) ?? null;
}

// ─── Conversation chunker ─────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;
const MAX_TOKENS = 600;
const OVERLAP_TOKENS = 50;

function tokensOf(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Chunk conversation messages into ~600-token blocks.
 * Messages joined as "role: content" with double-newline separators.
 * Oversized single messages are split with sliding window + overlap.
 */
export function chunkConversation(messages: ImportedConversation['messages']): string[] {
  const blocks = messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => `${m.role}: ${m.content}`);

  const chunks: string[] = [];
  let current = '';

  const maxChars = MAX_TOKENS * CHARS_PER_TOKEN;
  const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN;

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;

    if (tokensOf(candidate) <= MAX_TOKENS) {
      current = candidate;
    } else {
      if (current) chunks.push(current);

      if (tokensOf(block) > MAX_TOKENS) {
        // Oversized single block — sliding window
        let start = 0;
        while (start < block.length) {
          const end = Math.min(start + maxChars, block.length);
          const slice = block.slice(start, end).trim();
          if (slice) chunks.push(slice);
          if (end >= block.length) break;
          start = end - overlapChars;
        }
        current = '';
      } else {
        current = block;
      }
    }
  }

  if (current.trim()) chunks.push(current);
  return chunks.filter((c) => c.trim().length > 0);
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function runImport(
  sourceId: string,
  conversations: ImportedConversation[],
  db?: Database.Database,
): Promise<ImportProgress> {
  const progress: ImportProgress = {
    total: conversations.length,
    processed: 0,
    skipped: 0,
    chunks_written: 0,
    status: 'running',
  };
  progressStore.set(sourceId, { ...progress });

  const database = db ?? getDatabase();
  const now = Date.now();

  const checkDupStmt = database.prepare<[string, string]>(
    'SELECT id FROM imported_conversations WHERE imported_source_id = ? AND external_id = ? LIMIT 1',
  );

  const insertConvStmt = database.prepare(
    `INSERT OR IGNORE INTO imported_conversations
       (id, imported_source_id, external_id, title, message_count, created_at_source, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertChunkStmt = database.prepare(
    `INSERT INTO content_chunks
       (id, source_type, source_id, chunk_index, content, metadata, model_id,
        created_at, indexed_at, imported_source_id)
     VALUES (?, 'imported_conversation', ?, ?, ?, ?, 'Xenova/bge-small-en-v1.5', ?, ?, ?)`,
  );

  const updateSourceStmt = database.prepare(
    `UPDATE imported_sources
     SET conversation_count = conversation_count + ?,
         chunk_count        = chunk_count + ?,
         last_synced_at     = ?
     WHERE id = ?`,
  );

  // Dynamic import keeps ONNX runtime lazy until first real use
  const { embedText } = await import('@/lib/embeddings/model');

  let newConvCount = 0;
  let newChunkCount = 0;

  try {
    for (const conv of conversations) {
      // Dedup: skip conversations already in the index for this source
      const existing = checkDupStmt.get(sourceId, conv.external_id);
      if (existing) {
        progress.skipped++;
        progressStore.set(sourceId, { ...progress });
        continue;
      }

      const chunks = chunkConversation(conv.messages);
      const convId = nanoid();

      // Insert imported_conversations row
      database.transaction(() => {
        insertConvStmt.run(
          convId,
          sourceId,
          conv.external_id,
          conv.title,
          conv.messages.length,
          conv.created_at,
          now,
        );
      })();

      // Embed + write each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i]!;
        try {
          const embedding = await embedText(chunkText);
          const chunkId = nanoid();
          const metadata = JSON.stringify({
            source_platform: conv.source_platform,
            conversation_id: conv.external_id,
            conversation_title: conv.title,
            message_count: conv.messages.length,
          });

          insertChunkStmt.run(
            chunkId,
            conv.external_id,   // source_id = external conversation ID
            i,                  // chunk_index
            chunkText,
            metadata,
            now,                // created_at
            now,                // indexed_at
            sourceId,           // imported_source_id
          );

          await upsertVector(chunkId, embedding);
          newChunkCount++;
          progress.chunks_written++;
        } catch (embedErr) {
          console.error(
            `[import] embed/write error chunk=${i} conv=${conv.external_id}:`,
            embedErr,
          );
        }
      }

      newConvCount++;
      progress.processed++;
      progressStore.set(sourceId, { ...progress });
    }

    // Update source row totals
    updateSourceStmt.run(newConvCount, newChunkCount, Date.now(), sourceId);

    progress.status = 'complete';
    progressStore.set(sourceId, { ...progress });
  } catch (err) {
    progress.status = 'error';
    progress.error = err instanceof Error ? err.message : String(err);
    progressStore.set(sourceId, { ...progress });
  }

  return { ...progress };
}
