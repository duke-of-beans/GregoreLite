# GREGLITE — SPRINT 3C EXECUTION BRIEF
## Three-Tier Cold Start Warming
**Instance:** Sequential after 3B
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Depends on:** Sprint 3B complete (vec_index live and queryable)

---

## YOUR ROLE

Bounded execution worker. You are building the three-tier index warming system so that GregLite's similarity search is fast from the moment the app opens — not just after a 10-second warm-up. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §5.5 (Cold Start) specifically
6. `D:\Projects\GregLite\SPRINT_3B_COMPLETE.md` — confirm 3B is done, note measured latencies

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Memory-mapped file approach causes issues on Windows — report before attempting workarounds
- Hot cache binary serialization format is ambiguous — decide Float32Array → Buffer approach before building
- Same fix 3+ times

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. Tier 1 search (hot cache) under 5ms
4. Tier 2 search (30-day window) under 10ms
5. All three tiers measured and logged on boot
6. STATUS.md updated

---

## THREE TIERS — SPEC FROM §5.5

```
Tier 1 (T+2s):   hot_cache.bin — 1-2k most recent embeddings, memory-mapped, <5ms
Tier 2 (T+5-10s): 30-day window — ~10k embeddings, brute-force in-memory, ~2ms
Tier 3 (always):  Full sqlite-vec index — authoritative, used when tiers 1/2 miss
```

### New files

```
app/lib/vector/
  cold-start.ts     — three-tier orchestration, warm() on boot, query routing
  hot-cache.ts      — Tier 1: binary file serialization, memory-mapped reads
  warm-cache.ts     — Tier 2: 30-day in-memory brute-force index
```

### Tier 1 — Hot Cache

Stores the 1,000 most recently used chunks as a binary file. Serialization format: simple binary — each record is `[chunkId (36 bytes, padded), embedding (384 × 4 bytes = 1536 bytes)]`. Total per record: 1572 bytes. 1000 records = ~1.5MB.

```typescript
// hot-cache.ts
const HOT_CACHE_PATH = path.join(process.env.APPDATA!, 'greglite', 'hot_cache.bin');
const RECORD_SIZE = 36 + 384 * 4; // chunkId + Float32Array
const MAX_HOT_RECORDS = 1000;

export async function writeHotCache(records: Array<{ chunkId: string; embedding: Float32Array }>): Promise<void>

export async function readHotCache(): Promise<Array<{ chunkId: string; embedding: Float32Array }>>

export async function searchHotCache(query: Float32Array, k: number): Promise<VectorSearchResult[]>
```

Hot cache is rebuilt: on session end, after background indexer runs, whenever top-1000 most-used chunks change significantly.

Cosine similarity for brute-force: dot product of normalized vectors (both embeddings are already L2-normalized from `bge-small-en-v1.5`).

```typescript
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are pre-normalized, dot product = cosine similarity
}
```

### Tier 2 — Warm Cache

Last 30 days of chunks loaded into memory at boot. Query with brute-force dot product, same as Tier 1. The difference is coverage — Tier 2 has ~10k chunks vs Tier 1's 1k.

```typescript
// warm-cache.ts
let warmIndex: Array<{ chunkId: string; embedding: Float32Array }> | null = null;

export async function buildWarmCache(): Promise<void> {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const chunks = kernl.db.prepare(
    `SELECT c.id, c.embedding FROM content_chunks c WHERE c.created_at > ?`
  ).all(thirtyDaysAgo);
  // Note: embedding is stored as blob in vec_index, not content_chunks
  // Load embeddings from vec_index by chunk_id
  warmIndex = await loadEmbeddingsForChunks(chunks.map(c => c.id));
}

export function searchWarmCache(query: Float32Array, k: number): VectorSearchResult[]
```

### Tier 3 — Full Index

This is `searchSimilar` from Sprint 3B. No new code — just the existing sqlite-vec query. Tier 3 is the fallback when Tiers 1 and 2 don't return enough high-confidence results.

### Orchestration

```typescript
// cold-start.ts
export async function warmAll(): Promise<void> {
  const t0 = Date.now();
  await readHotCache();         // Tier 1 — ~2s
  console.log(`[cold-start] Tier 1 ready: ${Date.now() - t0}ms`);
  await buildWarmCache();       // Tier 2 — ~5-10s
  console.log(`[cold-start] Tier 2 ready: ${Date.now() - t0}ms`);
  // Tier 3 (sqlite-vec) is always ready — no warm-up needed
  console.log(`[cold-start] All tiers ready: ${Date.now() - t0}ms`);
}

export async function searchAllTiers(
  query: Float32Array,
  k: number = 10,
  minSimilarity: number = 0.70
): Promise<VectorSearchResult[]> {
  // 1. Try hot cache — if k results above threshold, return immediately
  const hotResults = searchHotCache(query, k).filter(r => r.similarity >= minSimilarity);
  if (hotResults.length >= k) return hotResults;

  // 2. Try warm cache — merge with hot results
  const warmResults = searchWarmCache(query, k).filter(r => r.similarity >= minSimilarity);
  const merged = mergeDedup([...hotResults, ...warmResults], k);
  if (merged.length >= k) return merged;

  // 3. Fall through to sqlite-vec full index
  const fullResults = await searchSimilar(query, k);
  return mergeDedup([...merged, ...fullResults.filter(r => r.similarity >= minSimilarity)], k);
}
```

### Wire into bootstrap

In `app/lib/bootstrap/index.ts`, add `warmAll()` to the boot sequence after KERNL hydration:

```typescript
// Non-blocking — don't await, let UI render immediately
warmAll().catch(err => logger.warn('[cold-start] warm failed', { err }));
```

---

## CHECKPOINTING

Every 3 file writes: `npx tsc --noEmit` + `git add && git commit -m "sprint-3c(wip): [description]"`

---

## SESSION END

1. Zero errors, zero failures
2. Update STATUS.md — Sprint 3C complete
3. `git commit -m "sprint-3c: three-tier cold start warming"`
4. `git push`
5. Write `SPRINT_3C_COMPLETE.md` — measured Tier 1/2/3 latencies, hot cache file size, warm cache build time

---

## GATES CHECKLIST

- [ ] `warmAll()` runs non-blocking on bootstrap
- [ ] Tier 1 (hot cache) reads binary file and returns results in <5ms
- [ ] Tier 2 (warm cache) builds 30-day in-memory index in <10s
- [ ] Tier 3 (sqlite-vec) falls through correctly when Tiers 1/2 insufficient
- [ ] `searchAllTiers` deduplicates results across tiers
- [ ] All three tier ready-times logged to console on boot
- [ ] Hot cache file written to `%APPDATA%\greglite\hot_cache.bin`
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
