# GREGLITE — SPRINT 3C EXECUTION BRIEF
## Three-Tier Cold Start Warming
**Instance:** Phase 3, Workstream C
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Prerequisite:** Sprint 3B complete (sqlite-vec live, vector queries working)

---

## YOUR ROLE

Bounded execution worker. You are building the three-tier index warming system so vector search is fast from the moment the app opens. Tier 1 hits in 2 seconds, Tier 2 in 10 seconds, Tier 3 (full index) always available. David is CEO. Zero debt.

---

## MANDATORY BOOTSTRAP

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\PROJECT_DNA.yaml`
5. `D:\Projects\GregLite\STATUS.md`
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §5.5 (Cold Start) specifically
7. `D:\Projects\GregLite\SPRINT_3B_COMPLETE.md`

Verify baseline before touching anything.

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Memory-mapped file approach fails on Windows — report before trying alternatives
- Hot cache binary format causes corruption on write — stop immediately
- TypeScript errors increase beyond baseline

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. Tier 1 available within 2s of app open (measured)
4. Tier 2 available within 10s of app open (measured)
5. STATUS.md updated

---

## WHAT YOU ARE BUILDING

### Three tiers (from BLUEPRINT §5.5)

| Tier | Target | Contents | Storage |
|------|--------|----------|---------|
| 1 | T+2s | 1–2k most recent embeddings | `hot_cache.bin` memory-mapped |
| 2 | T+5–10s | 30-day window (~10k embeddings) | In-memory Float32Array |
| 3 | Always | Full `sqlite-vec` index | DB (already working from 3B) |

### New files

```
app/lib/cross-context/
  warm-cache.ts      — hot_cache.bin writer and loader
  tier-manager.ts    — orchestrates all three tiers, unified search interface
  types.ts           — update with WarmCacheEntry, TierStatus interfaces
```

### Tier 1 — hot_cache.bin

The hot cache is a binary file containing the 2,000 most recent chunk embeddings serialized as Float32Arrays alongside their chunk IDs. Written on every new embedding. Memory-mapped on boot for sub-5ms access.

```typescript
// app/lib/cross-context/warm-cache.ts

const HOT_CACHE_PATH = path.join(process.cwd(), '.kernl', 'hot_cache.bin');
const HOT_CACHE_SIZE = 2000;

interface HotCacheEntry {
  chunkId: string;   // 36 chars (UUID)
  embedding: Float32Array;  // 384 floats = 1536 bytes
}

// Binary format per entry:
// [36 bytes: chunkId as UTF-8] [1536 bytes: 384 x float32] = 1572 bytes/entry
// Total: 2000 * 1572 = ~3.1MB

export function writeHotCache(entries: HotCacheEntry[]): void {
  const ENTRY_SIZE = 36 + (384 * 4);
  const buf = Buffer.allocUnsafe(entries.length * ENTRY_SIZE);
  entries.forEach((entry, i) => {
    const offset = i * ENTRY_SIZE;
    buf.write(entry.chunkId.padEnd(36), offset, 36, 'utf8');
    const floatBuf = Buffer.from(entry.embedding.buffer);
    floatBuf.copy(buf, offset + 36);
  });
  fs.writeFileSync(HOT_CACHE_PATH, buf);
}

export function loadHotCache(): HotCacheEntry[] {
  if (!fs.existsSync(HOT_CACHE_PATH)) return [];
  const buf = fs.readFileSync(HOT_CACHE_PATH);
  const ENTRY_SIZE = 36 + (384 * 4);
  const count = Math.floor(buf.length / ENTRY_SIZE);
  const entries: HotCacheEntry[] = [];
  for (let i = 0; i < count; i++) {
    const offset = i * ENTRY_SIZE;
    const chunkId = buf.subarray(offset, offset + 36).toString('utf8').trimEnd();
    const floatBuf = buf.subarray(offset + 36, offset + ENTRY_SIZE);
    const embedding = new Float32Array(floatBuf.buffer.slice(floatBuf.byteOffset, floatBuf.byteOffset + 384 * 4));
    entries.push({ chunkId, embedding });
  }
  return entries;
}
```

Refresh hot cache after every 10 new embeddings (not every single one — batching reduces disk writes).

### Tier 2 — 30-day in-memory window

Load all embeddings from `content_chunks` where `indexed_at > now - 30 days` into a `Map<chunkId, Float32Array>`. Brute-force cosine similarity in JS. Target: ~2ms for k=10 on 10,000 entries.

```typescript
// In tier-manager.ts
let tier2Cache: Map<string, Float32Array> = new Map();
let tier2LoadedAt: number = 0;

export async function loadTier2(): Promise<void> {
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const rows = db.prepare(
    `SELECT c.id, v.embedding FROM content_chunks c
     JOIN vec_index v ON v.chunk_id = c.id
     WHERE c.indexed_at > ?`
  ).all(cutoff) as any[];

  tier2Cache = new Map(
    rows.map(row => [row.id, new Float32Array(row.embedding.buffer)])
  );
  tier2LoadedAt = Date.now();
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### Tier manager — unified search

```typescript
// app/lib/cross-context/tier-manager.ts

export async function search(
  queryEmbedding: Float32Array,
  limit = 10,
  threshold = 0.75
): Promise<SimilarChunk[]> {
  // Try Tier 1 first (hot cache, <5ms)
  const tier1Results = searchTier1(queryEmbedding, limit, threshold);
  if (tier1Results.length >= limit) return tier1Results;

  // Fall through to Tier 2 (30-day window, ~2ms)
  if (tier2Cache.size > 0) {
    const tier2Results = searchTier2(queryEmbedding, limit, threshold);
    if (tier2Results.length >= limit) return tier2Results;
  }

  // Fall through to Tier 3 (sqlite-vec, <200ms)
  return findSimilar(queryEmbedding, limit, threshold);
}
```

### Boot sequence integration

Update `app/lib/bootstrap/index.ts` to load tiers as part of the bootstrap sequence. Non-blocking — UI does not wait for tiers:

```typescript
// In bootstrap:
// T+0: boot starts
// T+2: load hot cache (Tier 1) — sync read, fast
setTimeout(() => loadHotCache(), 0);
// T+10: load 30-day window (Tier 2) — async DB query
setTimeout(() => loadTier2(), 8000);
// Tier 3 (sqlite-vec) is always available — no load needed
```

### Timing measurements

Log tier availability timestamps to console on boot:
```
[tier-manager] Tier 1 ready: 1842ms
[tier-manager] Tier 2 ready: 9231ms
[tier-manager] Tier 3: always available
```

Write a test that mocks the boot sequence and verifies Tier 1 loads within 3000ms.

---

## SESSION END

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Boot the app, verify timing logs appear in console
4. Update STATUS.md
5. Commit: `sprint-3c: three-tier cold start warming`
6. Push
7. Write `SPRINT_3C_COMPLETE.md`

---

## GATES

- [ ] `hot_cache.bin` written to `.kernl/` directory
- [ ] Hot cache loads within 2s of app open (logged)
- [ ] 30-day window loads within 10s of app open (logged)
- [ ] `tier-manager.search()` falls through tiers correctly
- [ ] Search still returns results when Tier 1 and 2 are cold (Tier 3 fallback)
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
