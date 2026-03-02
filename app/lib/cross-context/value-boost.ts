/**
 * Value Boost — Phase 4 implementation
 *
 * Returns a weight multiplier for a chunk based on whether its source thread
 * contains a KERNL-logged decision. Chunks from "decided" threads carry more
 * strategic weight — David explicitly reviewed and approved those paths.
 *
 * - 1.5× if the chunk's source thread has ≥1 logged decision in KERNL
 * - 1.0× otherwise (neutral — no change to base score)
 *
 * Uses better-sqlite3 (synchronous) to stay compatible with the synchronous
 * scoreCandidate() call site in surfacing.ts.
 *
 * @module lib/cross-context/value-boost
 */

import { getDatabase } from '@/lib/kernl/database';

/** Multiplier applied when a chunk originates from a decided thread. */
const DECIDED_THREAD_BOOST = 1.5;

interface ChunkSourceRow {
  source_id: string;
}

/**
 * Returns the value boost multiplier for the given chunk.
 *
 * Queries content_chunks for the chunk's source_id, then checks the decisions
 * table to see if any decision was logged against that thread. Falls back to
 * 1.0 on any DB error or missing chunk (fail-open — never reduces scores).
 *
 * @param chunkId - content_chunks.id to look up
 * @returns 1.5 if source thread has a logged decision, 1.0 otherwise
 */
export function getValueBoost(chunkId: string): number {
  try {
    const db = getDatabase();

    const chunk = db
      .prepare('SELECT source_id FROM content_chunks WHERE id = ?')
      .get(chunkId) as ChunkSourceRow | undefined;

    if (!chunk?.source_id) return 1.0;

    const hasDecision = db
      .prepare('SELECT 1 FROM decisions WHERE thread_id = ? LIMIT 1')
      .get(chunk.source_id);

    return hasDecision ? DECIDED_THREAD_BOOST : 1.0;
  } catch {
    // Fail open — never penalise a chunk due to a DB lookup error
    return 1.0;
  }
}
