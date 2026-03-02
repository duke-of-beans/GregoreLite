# GREGLITE — SPRINT 3A EXECUTION BRIEF
## Embedding Pipeline
**Instance:** Parallel Workstream A (fire when Phase 2 complete)
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Phase 2 baseline:** All 5 Phase 2 sprints complete

---

## YOUR ROLE

Bounded execution worker. You are building the embedding pipeline — the foundation of GregLite's intelligence layer. Every message, decision, and artifact gets embedded and indexed so the Cross-Context Engine can find what David already knows. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order before writing any code:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\PROJECT_DNA.yaml`
5. `D:\Projects\GregLite\STATUS.md`
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — read §5 (Cross-Context Engine) fully
7. `D:\Projects\GregLite\SPRINT_3A_Embeddings.md` (this file)

Then verify baseline:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Embedding model download fails or is too slow (>30s first run is expected — document it, do not fight it)
- ONNX runtime throws unexpected errors on Windows — report exact error before attempting workarounds
- Same fix applied 3+ times
- TypeScript errors increase beyond baseline

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. Embeddings are deterministic — same input always produces same vector
4. `model_id` stored with every embedding record
5. Messages under 200 chars are NOT indexed (per §5.1)
6. STATUS.md updated
7. Conventional commit format

---

## WHAT YOU ARE BUILDING

### Install dependencies

```powershell
cd D:\Projects\GregLite\app
pnpm add @xenova/transformers
```

First import will download the quantized model (~25MB). This is expected. Subsequent runs use disk cache.

### New files

```
app/lib/embeddings/
  index.ts          — public API: embed(text), batchEmbed(texts[])
  model.ts          — model loader, singleton, lazy init
  chunker.ts        — text → chunks with 512-token window, 50-token overlap
  types.ts          — Chunk, EmbeddingRecord interfaces
```

### Model — locked

```typescript
// app/lib/embeddings/model.ts
import { pipeline } from '@xenova/transformers';

const MODEL_ID = 'Xenova/bge-small-en-v1.5';
let embedder: any = null;

export async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', MODEL_ID, { quantized: true });
  }
  return embedder;
}

export async function embedText(text: string): Promise<Float32Array> {
  const extractor = await getEmbedder();
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return result.data as Float32Array;
}

export const MODEL_DIMENSION = 384;
export { MODEL_ID };
```

### Chunker

512-token window, 50-token overlap, recursive character splitting. Token count estimated at 4 chars/token (fast approximation — do not import a tokenizer for this, overhead not worth it at this scale).

```typescript
// app/lib/embeddings/chunker.ts
export interface Chunk {
  index: number;
  text: string;
  tokenEstimate: number;
}

const CHUNK_SIZE = 512;   // tokens
const OVERLAP = 50;       // tokens
const CHARS_PER_TOKEN = 4;
const MIN_CHARS = 200;    // messages under this are not indexed

export function chunkText(text: string): Chunk[] {
  if (text.length < MIN_CHARS) return [];

  const chunkChars = CHUNK_SIZE * CHARS_PER_TOKEN;
  const overlapChars = OVERLAP * CHARS_PER_TOKEN;
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkChars, text.length);
    const chunkText = text.slice(start, end).trim();
    if (chunkText.length >= MIN_CHARS) {
      chunks.push({
        index,
        text: chunkText,
        tokenEstimate: Math.ceil(chunkText.length / CHARS_PER_TOKEN),
      });
      index++;
    }
    start += chunkChars - overlapChars;
  }

  return chunks;
}
```

### Public API

```typescript
// app/lib/embeddings/index.ts
export interface EmbeddingRecord {
  chunkId: string;        // nanoid
  sourceType: 'conversation' | 'file' | 'email' | 'email_attachment';
  sourceId: string;       // thread_id, file path, email_id
  chunkIndex: number;
  content: string;
  embedding: Float32Array;
  modelId: string;        // always MODEL_ID — required for future migration
  createdAt: number;
}

export async function embed(text: string, sourceType: EmbeddingRecord['sourceType'], sourceId: string): Promise<EmbeddingRecord[]> {
  const chunks = chunkText(text);
  const records: EmbeddingRecord[] = [];

  for (const chunk of chunks) {
    const embedding = await embedText(chunk.text);
    records.push({
      chunkId: nanoid(),
      sourceType,
      sourceId,
      chunkIndex: chunk.index,
      content: chunk.text,
      embedding,
      modelId: MODEL_ID,
      createdAt: Date.now(),
    });
  }

  return records;
}

export async function batchEmbed(inputs: Array<{ text: string; sourceType: EmbeddingRecord['sourceType']; sourceId: string }>): Promise<EmbeddingRecord[]> {
  const results: EmbeddingRecord[] = [];
  for (const input of inputs) {
    const records = await embed(input.text, input.sourceType, input.sourceId);
    results.push(...records);
    await new Promise(r => setTimeout(r, 100)); // 100ms delay per §5.2
  }
  return results;
}
```

### KERNL integration

After embedding, write to `content_chunks` table (already in schema from Phase 1):

```typescript
export async function persistEmbeddings(records: EmbeddingRecord[]): Promise<void> {
  for (const record of records) {
    await kernl.db.run(
      `INSERT OR REPLACE INTO content_chunks
       (id, source_type, source_id, chunk_index, content, metadata, created_at, indexed_at, model_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.chunkId,
        record.sourceType,
        record.sourceId,
        record.chunkIndex,
        record.content,
        JSON.stringify({ embedding_dim: MODEL_DIMENSION }),
        record.createdAt,
        Date.now(),
        record.modelId,
      ]
    );
  }
}
```

Note: the embedding vector itself (`Float32Array`) is written to `vec_index` by Sprint 3B — not here. `content_chunks` stores the text and metadata. `vec_index` stores the vectors. They are joined by `chunk_id`.

### Wire into chat route

After every assistant response, embed and persist the assistant message:

```typescript
// In app/app/api/chat/route.ts — after writing to KERNL
const embeddingRecords = await embed(content, 'conversation', threadId);
await persistEmbeddings(embeddingRecords);
// Sprint 3B will wire these to vec_index
```

Do NOT await this on the critical path — fire and forget with error logging only. Chat response must not be delayed by embedding.

```typescript
embed(content, 'conversation', threadId)
  .then(records => persistEmbeddings(records))
  .catch(err => logger.warn('[embeddings] persist failed', { err }));
```

---

## CHECKPOINTING

Every 3 file writes:
1. `npx tsc --noEmit`
2. `git add && git commit -m "sprint-3a(wip): [what you just did]"`

---

## SESSION END

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Update `D:\Projects\GregLite\STATUS.md` — mark Sprint 3A complete
4. Final commit: `git commit -m "sprint-3a: embedding pipeline, bge-small-en-v1.5"`
5. `git push`
6. Write `SPRINT_3A_COMPLETE.md` — what was built, first-run model download time observed, any ONNX issues

---

## GATES CHECKLIST

- [ ] `embed('hello world test message that is longer than 200 characters...')` returns Float32Array of length 384
- [ ] Same input always returns identical vector (deterministic)
- [ ] Text under 200 chars returns empty array (not indexed)
- [ ] `model_id` stored on every chunk record in `content_chunks`
- [ ] Chat route embeds assistant responses fire-and-forget (does not delay response)
- [ ] `content_chunks` rows visible in DB after sending a message
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
