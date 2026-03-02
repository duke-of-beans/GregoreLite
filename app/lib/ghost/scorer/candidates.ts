/**
 * Ghost Scorer — Candidate Generation
 *
 * generateCandidates() — query vec_index for Ghost chunks similar to the
 * active context vector. Returns up to candidateK results above minSimilarity,
 * enriched with content_chunks and ghost_indexed_items metadata.
 *
 * Only chunks whose content_chunks.metadata marks source === 'ghost' are
 * returned — Cross-Context chunks are excluded.
 */

import { searchSimilar } from '@/lib/vector';
import { getDatabase } from '@/lib/kernl/database';
import type { GhostCandidate } from './types';

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface ChunkRow {
  content: string;
  source_type: string;
  source_path: string | null;
  source_account: string | null;
  metadata: string | null;
  indexed_at: number;
}

interface IndexedItemRow {
  critical: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve the top-k Ghost chunks most similar to the given context vector.
 *
 * @param contextVector  Float32Array from buildActiveContextVector()
 * @param k              Maximum candidates to retrieve (default 50)
 * @param minSimilarity  Cosine similarity floor (default 0.75)
 */
export async function generateCandidates(
  contextVector: Float32Array,
  k: number = 50,
  minSimilarity: number = 0.75
): Promise<GhostCandidate[]> {
  const db = getDatabase();
  const results = await searchSimilar(contextVector, k);

  const candidates: GhostCandidate[] = [];

  for (const result of results) {
    if (result.similarity < minSimilarity) continue;

    const chunk = db
      .prepare(
        `SELECT content, source_type, source_path, source_account, metadata, indexed_at
         FROM content_chunks WHERE id = ?`
      )
      .get(result.chunkId) as ChunkRow | undefined;

    if (!chunk) continue;

    // Ghost-only filter: metadata must exist and have source === 'ghost'
    if (!chunk.metadata) continue;
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(chunk.metadata) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (meta['source'] !== 'ghost') continue;

    // Critical flag from ghost_indexed_items (set by Privacy Dashboard / Ghost card UI)
    let isCritical = false;
    if (chunk.source_path) {
      const item = db
        .prepare(
          `SELECT critical FROM ghost_indexed_items
           WHERE source_path = ? AND deleted = 0
           ORDER BY indexed_at DESC LIMIT 1`
        )
        .get(chunk.source_path) as IndexedItemRow | undefined;
      isCritical = (item?.critical ?? 0) === 1;
    }

    candidates.push({
      chunkId: result.chunkId,
      text: chunk.content,
      similarity: result.similarity,
      sourcePath: chunk.source_path,
      sourceType: chunk.source_type,
      sourceAccount: chunk.source_account,
      indexedAt: chunk.indexed_at,
      isCritical,
      metadata: meta,
    });
  }

  return candidates;
}
