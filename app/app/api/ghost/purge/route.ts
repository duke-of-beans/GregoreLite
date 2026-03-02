/**
 * Ghost Purge API — Nuclear option
 * Sprint 6G
 *
 * POST /api/ghost/purge
 *
 * Deletes ALL Ghost data in this order:
 *   1. content_chunks WHERE source_type IN ('file','email') (Ghost chunks only)
 *   2. vec_index entries for those chunk IDs
 *   3. ghost_indexed_items (all rows)
 *   4. ghost_surfaced (all rows)
 *   5. ghost_suggestion_feedback (all rows)
 *   6. ghost_exclusion_log (all rows)
 *   7. ghost_exclusions are KEPT (user keeps their custom rules)
 *   8. Stop + restart Ghost lifecycle
 *
 * NOTE: vec_index is a sqlite-vec virtual table. We delete by chunk_id using
 * the deleteVector() helper which ensures the extension is loaded.
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import { deleteVector } from '@/lib/vector';
import { stopGhost, startGhost } from '@/lib/ghost';

export async function POST(): Promise<NextResponse> {
  const db = getDatabase();

  // Step 1: Collect chunk IDs for Ghost-sourced chunks (file + email)
  const ghostChunks = db
    .prepare(
      `SELECT id FROM content_chunks
       WHERE source_type IN ('file', 'email')
       AND source_path IS NOT NULL`
    )
    .all() as { id: string }[];

  // Step 2: Delete from vec_index per chunk
  for (const { id } of ghostChunks) {
    await deleteVector(id);
  }

  // Step 3: Delete from content_chunks
  db.prepare(
    `DELETE FROM content_chunks
     WHERE source_type IN ('file', 'email') AND source_path IS NOT NULL`
  ).run();

  // Step 4: Hard delete ghost_indexed_items (all rows)
  db.prepare(`DELETE FROM ghost_indexed_items`).run();

  // Step 5: Delete ghost_surfaced
  db.prepare(`DELETE FROM ghost_surfaced`).run();

  // Step 6: Delete ghost_suggestion_feedback
  db.prepare(`DELETE FROM ghost_suggestion_feedback`).run();

  // Step 7: Delete ghost_exclusion_log
  db.prepare(`DELETE FROM ghost_exclusion_log`).run();

  // NOTE: ghost_exclusions (Layer 4 user rules) are intentionally kept.

  // Step 8: Restart Ghost lifecycle (stop + start)
  try {
    await stopGhost();
    await startGhost();
  } catch (err) {
    console.error('[ghost/purge] Ghost restart failed:', err);
    // Non-fatal — data is already cleared; Ghost will start clean on next app open
  }

  return NextResponse.json({ ok: true, chunksDeleted: ghostChunks.length });
}
