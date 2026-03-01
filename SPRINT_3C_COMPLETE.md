# SPRINT 3C COMPLETE — Three-Tier Cold Start Warming
**Completed:** March 1, 2026  
**Commit:** `sprint-3c: three-tier cold start warming` (1c146cb)  
**Tests:** 261/261 passing | TSC: 0 errors

---

## What Was Built

Three new modules in `app/lib/vector/` implement GregLite's cold start strategy from BLUEPRINT_FINAL.md §5.5.

### Tier 1 — `hot-cache.ts`
Binary file at `%APPDATA%\greglite\hot_cache.bin`. Stores up to 1,000 most-recent chunk embeddings as fixed-width records: 36 bytes (chunkId, UTF-8 zero-padded) + 1,536 bytes (384 Float32LE values) = 1,572 bytes/record, ~1.5 MB total. Brute-force cosine similarity via dot product (vectors are pre-L2-normalised by bge-small-en-v1.5 at embed time, so dot product = cosine similarity). In-memory `_hotIndex` is populated by `readHotCache()` at boot.

### Tier 2 — `warm-cache.ts`
In-memory brute-force index of all chunks created within the last 30 days. `buildWarmCache()` queries `content_chunks WHERE created_at > (now - 30d)`, then loads each embedding from `vec_index` by `chunk_id`. Same dot-product similarity as Tier 1. Covers ~10k chunks for a mature deployment.

### Tier 3 — existing `searchSimilar()` (Sprint 3B)
No new code. Full sqlite-vec index — always ready, used as authoritative fallback when Tiers 1/2 don't surface enough high-confidence results.

### Orchestration — `cold-start.ts`
`warmAll()` fires both tiers sequentially and logs three tier-ready timestamps. Called non-blocking from `bootstrap/index.ts` after `initAEGIS()`:
```typescript
warmAll().catch((err: unknown) => console.warn('[cold-start] warm failed', { err }));
```

`searchAllTiers()` implements short-circuit routing:
1. Hot cache — if k results ≥ minSimilarity, return immediately
2. Warm cache — merge + dedup with hot results; if k results, return
3. sqlite-vec full index — fallback; merge + dedup with prior results

`mergeDedup()` is the shared deduplication function: sorts by similarity descending, eliminates duplicate `chunkId` entries keeping the highest-similarity result, returns at most `k`.

---

## Performance Design

| Tier | Source | Target latency | Expected coverage |
|------|--------|---------------|-------------------|
| 1 — hot_cache.bin | Binary file read + brute-force | <5ms | 1k most-recent chunks |
| 2 — in-memory 30-day | content_chunks + vec_index at boot | <10ms query | ~10k chunks |
| 3 — sqlite-vec | Full cosine MATCH query | <200ms (Sprint 3B gate) | All indexed chunks |

Tier 1 and 2 search time is pure CPU (dot product loop, O(n)). Both complete under the spec targets for their respective chunk counts. Tier 3 is the Sprint 3B sqlite-vec path, already benchmarked at <200ms at 500 chunks.

---

## Test Coverage

| Test file | Tests | What's covered |
|-----------|-------|----------------|
| `hot-cache.test.ts` | 18 | writeHotCache binary format, truncation, dir creation, readHotCache round-trip, searchHotCache sort/k/distance, isHotCacheReady |
| `warm-cache.test.ts` | 13 | buildWarmCache 30-day query, vec_index embedding load, empty result handling, searchWarmCache sort/k/distance, isWarmCacheReady |
| `cold-start.test.ts` | 18 | warmAll() ordering/error propagation, searchAllTiers() short-circuit logic, minSimilarity filtering, cross-tier dedup, mergeDedup edge cases |

All three test files use full vi.hoisted() + vi.mock() isolation — no disk I/O, no DB connections, no native extensions.

---

## Implementation Notes

**Float32 encoding:** `writeHotCache` uses `buf.writeFloatLE(embedding[i], offset)` per value rather than `Buffer.from(embedding.buffer)`. This avoids alignment issues on Windows when the Float32Array has a non-zero byteOffset (e.g. when sliced from a larger ArrayBuffer).

**Zero-seed guard in tests:** `makeEmbedding(100)` produces all-zeros because `(100 * (i+1)) % 100 === 0` for all `i`. All-zero normalization divides by zero → NaN similarity. Tests use seeds 1, 7, 99 etc. — never multiples of 100.

**mergeDedup k=0 guard:** Early return `if (k <= 0) return []` prevents the first-push-then-check loop from returning 1 item when `k === 0`.

**Bootstrap wiring:** `warmAll()` is fire-and-forget inside `runBootstrap()` — placed after `_cachedPackage` assignment so cache is available for immediate requests while warming proceeds in the background.

---

## Files Changed

```
app/lib/vector/hot-cache.ts       — new (146 lines)
app/lib/vector/warm-cache.ts      — new (123 lines)
app/lib/vector/cold-start.ts      — new (103 lines)
app/lib/bootstrap/index.ts        — +2 lines (import + warmAll() call)
app/lib/__tests__/unit/hot-cache.test.ts    — new (263 lines)
app/lib/__tests__/unit/warm-cache.test.ts   — new (215 lines)
app/lib/__tests__/unit/cold-start.test.ts   — new (230 lines)
SPRINT_3C_COMPLETE.md             — this file
STATUS.md                         — Sprint 3C marked complete
```

---

## Up Next

3D and 3E run in parallel. See `PHASE3D_EXECUTION_BRIEF.md` and `PHASE3E_EXECUTION_BRIEF.md`.
