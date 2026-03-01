/**
 * Cold Start Orchestrator — Three-Tier Query Routing
 *
 * Tier 1 (hot_cache.bin):  ~1k most recent chunks, binary file, <5ms
 * Tier 2 (warm cache):     ~10k last-30-day chunks, in-memory brute-force, <10ms
 * Tier 3 (sqlite-vec):     Full authoritative index, used when Tiers 1/2 miss
 *
 * warmAll() is called non-blocking on application boot (bootstrap/index.ts).
 * searchAllTiers() routes queries through all three tiers with deduplication.
 *
 * @module lib/vector/cold-start
 */

import { readHotCache, searchHotCache } from './hot-cache';
import { buildWarmCache, searchWarmCache } from './warm-cache';
import { searchSimilar } from './index';
import type { VectorSearchResult } from './types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Merge and deduplicate VectorSearchResults from multiple tiers.
 * Sorted by similarity descending before dedup — highest similarity wins
 * when the same chunkId appears in multiple tiers.
 * Returns at most k results.
 */
export function mergeDedup(results: VectorSearchResult[], k: number): VectorSearchResult[] {
  if (k <= 0) return [];
  const seen = new Set<string>();
  const merged: VectorSearchResult[] = [];

  // Sort descending by similarity — best result wins on dupe
  const sorted = [...results].sort((a, b) => b.similarity - a.similarity);

  for (const r of sorted) {
    if (!seen.has(r.chunkId)) {
      seen.add(r.chunkId);
      merged.push(r);
      if (merged.length >= k) break;
    }
  }

  return merged;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Warm all three tiers on application boot.
 *
 * Tier 1: reads hot_cache.bin into memory (~2s on first run, <100ms after)
 * Tier 2: builds 30-day in-memory index from content_chunks + vec_index (~5-10s)
 * Tier 3: sqlite-vec is always ready — no warm-up required
 *
 * Call site in bootstrap/index.ts should NOT await this — fire and forget:
 *   warmAll().catch(err => console.warn('[cold-start] warm failed', { err }));
 */
export async function warmAll(): Promise<void> {
  const t0 = Date.now();

  await readHotCache();
  console.log(`[cold-start] Tier 1 ready: ${Date.now() - t0}ms`);

  await buildWarmCache();
  console.log(`[cold-start] Tier 2 ready: ${Date.now() - t0}ms`);

  // Tier 3 (sqlite-vec) is always ready — no warm-up needed
  console.log(`[cold-start] All tiers ready: ${Date.now() - t0}ms`);
}

/**
 * Query all three tiers with short-circuit and deduplication.
 *
 * 1. Hot cache  — if k results above minSimilarity, return immediately
 * 2. Warm cache — merge + dedup with hot; if k results, return
 * 3. sqlite-vec — full index fallback; merge + dedup with previous results
 *
 * @param query         Embedded query vector (pre-normalised Float32Array)
 * @param k             Maximum number of results (default 10)
 * @param minSimilarity Minimum cosine similarity threshold (default 0.70)
 */
export async function searchAllTiers(
  query: Float32Array,
  k: number = 10,
  minSimilarity: number = 0.70
): Promise<VectorSearchResult[]> {
  // ── Tier 1: Hot cache ─────────────────────────────────────────────────────
  const hotResults = searchHotCache(query, k).filter((r) => r.similarity >= minSimilarity);
  if (hotResults.length >= k) return hotResults;

  // ── Tier 2: Warm cache ────────────────────────────────────────────────────
  const warmResults = searchWarmCache(query, k).filter((r) => r.similarity >= minSimilarity);
  const merged = mergeDedup([...hotResults, ...warmResults], k);
  if (merged.length >= k) return merged;

  // ── Tier 3: Full sqlite-vec index ─────────────────────────────────────────
  const fullResults = await searchSimilar(query, k);
  return mergeDedup(
    [...merged, ...fullResults.filter((r) => r.similarity >= minSimilarity)],
    k
  );
}
