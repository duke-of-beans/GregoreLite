/**
 * Ghost Privacy Engine — Public API
 *
 * checkFile()   — run all 4 layers against a file path + content
 * checkEmail()  — run all 4 layers against an email message
 * checkChunk()  — run Layer 2 PII scan on a single text chunk
 * logExclusion() — write an audit row to ghost_exclusion_log
 *
 * Layer order: 1 (path, hardcoded) → 3 (contextual defaults) → 4 (user rules)
 * → content read → 1 (content) → chunks → 2 (PII per-chunk)
 *
 * Any excluded result short-circuits immediately — remaining layers not run.
 */

import { nanoid } from 'nanoid';
import { getDatabase } from '@/lib/kernl/database';
import { deleteVector } from '@/lib/vector';
import { checkPathLayer1, checkContentLayer1 } from './layer1';
import { checkChunkLayer2 } from './layer2';
import { checkFileLayer3, checkEmailLayer3 } from './layer3';
import { checkFileLayer4, checkEmailLayer4 } from './layer4';
import type { ExclusionResult } from './types';
import { NOT_EXCLUDED } from './types';
import type { EmailMessage } from '@/lib/ghost/email/types';

// ── Retention cap ─────────────────────────────────────────────────────────────

const EXCLUSION_LOG_MAX_ROWS = 10_000;

// ─── Audit logging ────────────────────────────────────────────────────────────

export function logExclusion(
  sourceType: 'file' | 'email',
  sourcePath: string,
  result: ExclusionResult
): void {
  if (!result.excluded || result.layer === undefined) return;
  const db = getDatabase();
  db.prepare(`
    INSERT INTO ghost_exclusion_log
      (id, source_type, source_path, layer, reason, pattern, logged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    nanoid(),
    sourceType,
    sourcePath,
    result.layer,
    result.reason ?? '',
    result.pattern ?? null,
    Date.now()
  );

  // Retention cap: keep only the most recent EXCLUSION_LOG_MAX_ROWS rows
  db.prepare(`
    DELETE FROM ghost_exclusion_log
    WHERE id NOT IN (
      SELECT id FROM ghost_exclusion_log
      ORDER BY logged_at DESC
      LIMIT ${EXCLUSION_LOG_MAX_ROWS}
    )
  `).run();
}

// ── Cascade item delete ───────────────────────────────────────────────────────

/**
 * Delete a Ghost indexed item by its ghost_indexed_items.id.
 * Cascade:
 *   1. Get chunk IDs from content_chunks WHERE source_path = item.source_path
 *   2. Delete those chunk_ids from vec_index
 *   3. Delete the rows from content_chunks
 *   4. Soft-delete the ghost_indexed_items row (deleted=1, deleted_at=now)
 *   5. Write audit row to ghost_exclusion_log (reason: 'user_deleted')
 *
 * Returns false if the item was not found or already deleted.
 */
export async function deleteGhostItem(itemId: string): Promise<boolean> {
  const db = getDatabase();

  // Fetch the item (must be alive)
  const item = db
    .prepare(
      `SELECT id, source_type, source_path FROM ghost_indexed_items
       WHERE id = ? AND deleted = 0 LIMIT 1`
    )
    .get(itemId) as { id: string; source_type: string; source_path: string | null } | undefined;

  if (!item || !item.source_path) return false;

  // Step 1: Get chunk IDs for this item
  const chunkRows = db
    .prepare(
      `SELECT id FROM content_chunks
       WHERE source_path = ? AND source_path IS NOT NULL`
    )
    .all(item.source_path) as { id: string }[];

  // Step 2: Delete from vec_index (via the vector API which loads sqlite-vec)
  for (const { id: chunkId } of chunkRows) {
    await deleteVector(chunkId);
  }

  // Step 3: Delete from content_chunks
  db.prepare(
    `DELETE FROM content_chunks WHERE source_path = ? AND source_path IS NOT NULL`
  ).run(item.source_path);

  // Step 4: Soft-delete the audit row
  db.prepare(
    `UPDATE ghost_indexed_items SET deleted = 1, deleted_at = ? WHERE id = ?`
  ).run(Date.now(), itemId);

  // Step 5: Audit log entry
  logExclusion(
    item.source_type as 'file' | 'email',
    item.source_path,
    {
      excluded: true,
      layer: 4,
      reason: 'user_deleted',
    }
  );

  return true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run all pre-read path checks for a file (Layers 1, 3, 4).
 * Call this BEFORE reading the file — if excluded, skip the read entirely.
 */
export function checkFilePath(filePath: string): ExclusionResult {
  const l1 = checkPathLayer1(filePath);
  if (l1.excluded) return l1;

  const l3 = checkFileLayer3(filePath);
  if (l3.excluded) return l3;

  const l4 = checkFileLayer4(filePath);
  if (l4.excluded) return l4;

  return NOT_EXCLUDED;
}

/**
 * Run Layer 1 content check on file content.
 * Call this AFTER reading the file, BEFORE chunking.
 */
export function checkFileContent(content: string): ExclusionResult {
  return checkContentLayer1(content);
}

/**
 * Run Layer 2 PII scan on a single chunk.
 * Call this per-chunk before embedding.
 */
export function checkChunk(text: string): ExclusionResult {
  return checkChunkLayer2(text);
}

/**
 * Run all applicable layers for an email message.
 * Call this before chunking the email body.
 * Returns the first exclusion triggered, or NOT_EXCLUDED.
 */
export function checkEmail(message: EmailMessage): ExclusionResult {
  // Layer 3: subject-based contextual defaults
  const l3 = checkEmailLayer3(message.subject);
  if (l3.excluded) return l3;

  // Layer 4: user-configured domain/sender/subject rules
  const l4 = checkEmailLayer4(message.from, message.subject);
  if (l4.excluded) return l4;

  return NOT_EXCLUDED;
}

// ─── Re-exports for consumers ─────────────────────────────────────────────────

export { getUserExclusions, addExclusion, removeExclusion } from './layer4';
export type { ExclusionResult, ExclusionLayer, GhostExclusion, ExclusionType } from './types';
export { NOT_EXCLUDED } from './types';
export type { ExclusionLogRow } from './types';
