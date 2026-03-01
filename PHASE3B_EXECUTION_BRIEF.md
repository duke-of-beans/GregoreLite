# GREGLITE — SPRINT 3B EXECUTION BRIEF
## sqlite-vec Integration (Vector Store)
**Instance:** Phase 3, Workstream B
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Prerequisite:** Sprint 3A complete (embedding pipeline exists, content_chunks populated)

---

## YOUR ROLE

Bounded execution worker. You are wiring the vector index — `sqlite-vec` loaded into the KERNL SQLite database so GregLite can do cosine similarity search across all embedded content. This is what makes "you already built this" queries possible. David is CEO. Zero debt.

---

## MANDATORY BOOTSTRAP

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\PROJECT_DNA.yaml`
5. `D:\Projects\GregLite\STATUS.md`
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §5.2 specifically
7. `D:\Projects\GregLite\SPRINT_3A_COMPLETE.md` — what 3A built and how

Verify baseline before touching anything.

---

## AUTHORITY PROTOCOL — STOP WHEN:

- `sqlite-vec` native binary fails to load on Windows — report immediately, do not attempt to build from source without confirmation
- The prebuilt Windows binary is not available for the current Node/SQLite version — stop and report
- TypeScript errors increase beyond baseline

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. Vector queries return results in <200ms on a populated index
4. STATUS.md updated
5. Conventional commits

---

## WHAT YOU ARE BUILDING

### Install

```powershell
cd D:\Projects\GregLite\app
pnpm add sqlite-vec
```

`sqlite-vec` is a loadable SQLite extension packaged as a Node addon. It ships prebuilt binaries for Windows x64. Verify it loads before writing any query code:

```typescript
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

const db = new Database('.kernl/greglite.db');
sqliteVec.load(db);  // loads the vec0 virtual table extension

// Verify
const version = db.prepare("SELECT vec_version()").get();
console.log('sqlite-vec version:', version);
```

If this throws, stop and report. Do not build workarounds.

### New files

```
app/lib/cross-context/
  vector-store.ts    — vec_index wrapper: insert, search, delete
  search.ts          — public search API: findSimilar(), findSimilarToText()
```

Add to existing:
```
app/lib/kernl/
  database.ts        — update to load sqlite-vec extension on connection open
```

### vec_index creation

The blueprint shows this as a commented-out SQL block (loaded via Rust layer). For Phase 3 we create it via Node instead:

```typescript
// In vector-store.ts init():
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_index USING vec0(
    chunk_id TEXT PRIMARY KEY,
    embedding FLOAT[384] distance_metric=cosine
  )
`);
```

Call this once during KERNL initialization, after `sqliteVec.load(db)`.

### Inserting embeddings

After 3A writes a chunk to `content_chunks`, also insert its embedding into `vec_index`:

```typescript
export function insertEmbedding(chunkId: string, embedding: Float32Array): void {
  // sqlite-vec expects the embedding as a Buffer
  const buf = Buffer.from(embedding.buffer);
  db.prepare(
    `INSERT OR REPLACE INTO vec_index (chunk_id, embedding) VALUES (?, ?)`
  ).run(chunkId, buf);
}
```

Update `app/lib/cross-context/pipeline.ts` (from 3A) to call `insertEmbedding()` after writing each chunk.

### Similarity search

```typescript
// app/lib/cross-context/search.ts

export interface SimilarChunk {
  chunkId: string;
  sourceType: string;
  sourceId: string;
  content: string;
  similarity: number;  // 0–1, higher = more similar
  metadata: unknown;
}

export async function findSimilar(
  embedding: Float32Array,
  limit = 10,
  threshold = 0.75
): Promise<SimilarChunk[]> {
  const buf = Buffer.from(embedding.buffer);

  const rows = db.prepare(`
    SELECT
      v.chunk_id,
      v.distance,
      c.source_type,
      c.source_id,
      c.content,
      c.metadata
    FROM vec_index v
    JOIN content_chunks c ON c.id = v.chunk_id
    WHERE v.embedding MATCH ? AND k = ?
    ORDER BY v.distance
  `).all(buf, limit) as any[];

  // sqlite-vec returns cosine distance (0 = identical, 2 = opposite)
  // Convert to similarity score (1 = identical, 0 = opposite)
  return rows
    .map(row => ({
      chunkId: row.chunk_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      content: row.content,
      similarity: 1 - (row.distance / 2),
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }))
    .filter(r => r.similarity >= threshold);
}

export async function findSimilarToText(
  text: string,
  limit = 10,
  threshold = 0.75
): Promise<SimilarChunk[]> {
  const embedding = await embedText(text);
  return findSimilar(embedding, limit, threshold);
}
```

### Performance gate

Query SLA from blueprint §5.2: sub-200ms for k=10 on full index. Write a vitest benchmark that seeds 1,000 chunks, then measures query time. Fail if median >200ms.

```typescript
// In test file:
test('vector search under 200ms for k=10', async () => {
  // seed 1000 chunks with random embeddings
  // ...
  const start = Date.now();
  await findSimilarToText('test query', 10);
  expect(Date.now() - start).toBeLessThan(200);
});
```

### KERNL database.ts update

Load sqlite-vec immediately after opening the database connection, before any other queries:

```typescript
// In database.ts open():
import * as sqliteVec from 'sqlite-vec';
sqliteVec.load(db);
// Then run schema migrations
```

---

## SESSION END

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` including benchmark — zero failures, <200ms confirmed
3. Verify manually: check `vec_index` table exists and has rows after sending a message
4. Update STATUS.md
5. Commit: `sprint-3b: sqlite-vec integration, vector store`
6. Push
7. Write `SPRINT_3B_COMPLETE.md`

---

## GATES

- [ ] `sqlite-vec` loads without error on Windows
- [ ] `vec_index` virtual table created in KERNL DB
- [ ] Embedding inserted to `vec_index` for every chunk written by 3A pipeline
- [ ] `findSimilarToText()` returns ranked results with similarity scores
- [ ] Results filtered by threshold (default 0.75)
- [ ] Query time <200ms for k=10 (benchmark test passes)
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
