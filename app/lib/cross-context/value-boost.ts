/**
 * Value Boost — Phase 3 stub (Sprint 3G)
 *
 * Returns a weight multiplier for a chunk based on its "strategic value".
 * Phase 3: always 1.0.
 * Phase 4: will weight by criticality tags, usage frequency, and
 *           explicit "mark as critical" annotations from David.
 *
 * @module lib/cross-context/value-boost
 */

/**
 * Returns the value boost multiplier for the given chunk.
 * Always 1.0 in Phase 3 — no premium weighting applied.
 *
 * @param _chunkId - chunk ID (reserved for Phase 4 lookup)
 * @returns multiplier in [1.0, 1.5] — currently always 1.0
 */
export function getValueBoost(_chunkId: string): number {
  // Phase 4: query a `chunk_tags` table for criticality markers
  // and return up to 1.5 for chunks David has explicitly flagged.
  return 1.0;
}
