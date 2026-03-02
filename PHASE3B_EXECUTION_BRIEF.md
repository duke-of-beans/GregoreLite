# GREGLITE — SPRINT 3B EXECUTION BRIEF
## sqlite-vec Integration (Vector Store)
**Instance:** Sequential after 3A
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Depends on:** Sprint 3A complete (embedding pipeline live, content_chunks populated)

---

## YOUR ROLE

Bounded execution worker. You are wiring the vector index — `sqlite-vec` loaded into KERNL's SQLite database so cosine similarity search works against the embeddings 3A is producing. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §5.2 specifically
6. `D:\Projects\GregLite\SPRINT_3A_COMPLETE.md` — confirm 3A is done

Then baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- `sqlite-vec` extension fails to load on Windows — this is a known complexity, report exact error before attempting workarounds
- Build tools for native compilation are missing (`node-gyp`, MSVC, etc.) — report before spending time on environment setup
- Same fix 3+ times
- TypeScript errors increase

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. k=10 similarity query returns results in under 200ms on a populated index
4. `chunk_id` is the join key between `content_chunks` and `vec_index` — enforced in code
5. STATUS.md updated

---

## WHAT YOU ARE BUILDING

### Install sqlite-vec

`sqlite-vec` is a loadable SQLite extension. Check if there's an npm package first:

```powershell
pnpm add sqlite-vec
```

If that package exists and provides prebuilt Windows binaries, use it. If not, check the sqlite-vec GitHub releases for a Windows `.dll`. The extension needs to be loaded into better-sqlite3 at runtime:

```typescript
import Database from 'better-sqlite3';
const db = new Database(dbPath);
db.loadExtension('/path/to/vec0.dll');
```

Read the sqlite-vec docs before assuming the API — the exact load path and syntax may vary. Do not guess.

### New files

```
app/lib/vector/
  index.ts        — public API: upsert(chunkId, embedding), search(embedding, k), delete(chunkId)
  store.ts        — sqlite-vec setup, extension loading, table creation
  types.ts        — VectorSearchResult interface
```

### Schema

The `vec_index` virtual table is commented out in §3.1 because it requires the extension to be loaded first. After loading the extension in `store.ts`, create it:

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS vec_index USING vec0(
  chunk_id TEXT PRIMARY KEY,
  embedding FLOAT[384] distance_metric=cosine
);
```

### Public API

```typescript
export interface VectorSearchResult {
  chunkId: string;
  distance: number;      // cosine distance (lower = more similar)
  similarity: number;    // 1 - distance (higher = more similar)
}

export async function upsertVector(chunkId: string, embedding: Float32Array): Promise<void>;

export async function searchSimilar(embedding: Float32Array, k: number = 10): Promise<VectorSearchResult[]>;

export async function deleteVector(chunkId: string): Promise<void>;
```

### Wire 3A → 3B

In 3A's `persistEmbeddings`, after writing to `content_chunks`, also write the vector:

```typescript
// Add to persistEmbeddings in app/lib/embeddings/index.ts
await upsertVector(record.chunkId, record.embedding);
```

Or add a new function `persistEmbeddingsFull` that does both in sequence.

### Full similarity search function

This is the core query the Cross-Context Engine will use:

```typescript
export async function findSimilarChunks(
  queryText: string,
  k: number = 10,
  minSimilarity: number = 0.70
): Promise<Array<VectorSearchResult & { content: string; sourceType: string; sourceId: string }>> {
  const [queryEmbedding] = await embed(queryText, 'conversation', 'query');
  if (!queryEmbedding) return [];

  const results = await searchSimilar(queryEmbedding.embedding, k);

  const enriched = [];
  for (const result of results) {
    if (result.similarity < minSimilarity) continue;
    const chunk = kernl.db.prepare(
      'SELECT content, source_type, source_id FROM content_chunks WHERE id = ?'
    ).get(result.chunkId) as any;
    if (chunk) {
      enriched.push({ ...result, content: chunk.content, sourceType: chunk.source_type, sourceId: chunk.source_id });
    }
  }

  return enriched;
}
```

### Performance target

Per §5.2: sub-200ms for k=10 on full index. Measure this in your test suite with a realistic index size (seed 500+ chunks before benchmarking).

Seed script: `app/scripts/seed-vectors.ts` — generate 500 fake chunks, embed them all, insert into vec_index. Use this for both testing and benchmarking.

---

## CHECKPOINTING

Every 3 file writes: `npx tsc --noEmit` + `git add && git commit -m "sprint-3b(wip): [description]"`

---

## SESSION END

1. Zero errors, zero test failures
2. Update STATUS.md — Sprint 3B complete
3. `git commit -m "sprint-3b: sqlite-vec integration, vector store"`
4. `git push`
5. Write `SPRINT_3B_COMPLETE.md` — sqlite-vec load mechanism used, Windows binary path, query latency measured at 10/100/500 chunk counts

---

## GATES CHECKLIST

- [ ] sqlite-vec extension loads without error on Windows
- [ ] `vec_index` virtual table created on DB init
- [ ] `upsertVector` writes to vec_index
- [ ] `searchSimilar` returns k results with cosine distance
- [ ] `findSimilarChunks` joins vec_index with content_chunks, filters by minSimilarity
- [ ] k=10 query under 200ms with 500+ indexed chunks (measured)
- [ ] Chunks from Phase 1 chat history are now searchable
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
