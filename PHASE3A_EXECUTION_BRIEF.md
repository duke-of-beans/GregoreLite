# GREGLITE — SPRINT 3A EXECUTION BRIEF
## Embedding Pipeline
**Instance:** Phase 3, Workstream A
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Prerequisite:** All Phase 2 sprints complete (2A–2E)

---

## YOUR ROLE

Bounded execution worker. You are building the embedding pipeline — the foundation of the Cross-Context Engine. Every message, decision, and artifact gets embedded into a 384-dimension vector so GregLite can detect when David is re-solving a problem he already solved. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order before writing any code:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\PROJECT_DNA.yaml`
5. `D:\Projects\GregLite\STATUS.md`
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — read §5 (Cross-Context Engine) fully before touching any code
7. `D:\Projects\GregLite\BLUEPRINT_S5_CrossContext.md` — supplementary detail

Then verify baseline:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- `@xenova/transformers` model download fails or hangs — report before building workarounds
- ONNX runtime version conflicts with existing dependencies
- Same fix applied 3+ times
- TypeScript errors increase beyond baseline

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. No mocks in production code
4. TDD: write tests before implementation
5. STATUS.md updated
6. Conventional commits

---

## WHAT YOU ARE BUILDING

### Install

```powershell
cd D:\Projects\GregLite\app
pnpm add @xenova/transformers
```

Verify build after install before writing any module code.

### New files

```
app/lib/cross-context/
  embedder.ts        — model loader, embedText(), singleton pattern
  chunker.ts         — text → chunks with overlap
  pipeline.ts        — public API: indexMessage(), indexDecision(), indexArtifact()
  types.ts           — Chunk, EmbeddingRecord interfaces
```

### Model — locked, no substitutions

**`BAAI/bge-small-en-v1.5`** via `@xenova/transformers`, ONNX runtime, 8-bit quantized. 384 dimensions. Fully offline after first download. This choice is in the blueprint and is non-negotiable — do not swap for OpenAI embeddings or any other model.

```typescript
// app/lib/cross-context/embedder.ts
import { pipeline } from '@xenova/transformers';

let embedder: any = null;

export async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/bge-small-en-v1.5',
      { quantized: true }
    );
  }
  return embedder;
}

export async function embedText(text: string): Promise<Float32Array> {
  const extractor = await getEmbedder();
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return result.data as Float32Array;
}
```

Model downloads to `~/.cache/huggingface/` on first run. Log download progress — first run takes 10–30s. Subsequent runs load from cache in <1s.

### Chunker

```typescript
// app/lib/cross-context/chunker.ts
export interface Chunk {
  content: string;
  chunkIndex: number;
  tokenEstimate: number;  // rough: content.length / 4
}

// Chunking rules from BLUEPRINT §5.1:
// - Window: 512 tokens (~2048 chars)
// - Overlap: 50 tokens (~200 chars)
// - Skip chunks under 200 chars (too short to embed meaningfully)
export function chunkText(text: string, sourceType: 'message' | 'decision' | 'artifact'): Chunk[] {
  const CHUNK_SIZE = 2048;   // chars (~512 tokens)
  const OVERLAP = 200;       // chars (~50 tokens)
  const MIN_LENGTH = 200;

  if (text.length < MIN_LENGTH) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const content = text.slice(start, end).trim();
    if (content.length >= MIN_LENGTH) {
      chunks.push({ content, chunkIndex: index, tokenEstimate: Math.ceil(content.length / 4) });
      index++;
    }
    start = end - OVERLAP;
    if (start >= text.length) break;
  }

  return chunks;
}
```

### Pipeline

```typescript
// app/lib/cross-context/pipeline.ts
// Public API — called from chat route and KERNL module

export async function indexMessage(
  messageId: string,
  threadId: string,
  content: string,
  role: 'user' | 'assistant'
): Promise<void>;

export async function indexDecision(
  decisionId: string,
  threadId: string,
  decision: string,
  rationale?: string
): Promise<void>;

export async function indexArtifact(
  artifactId: string,
  threadId: string,
  content: string,
  type: string
): Promise<void>;
```

Each function: chunk the input → embed each chunk → write to `content_chunks` table → store embedding blob in `messages.embedding` column (or `content_chunks` for cross-source search).

### content_chunks table

Verify this table exists in `.kernl/greglite.db` — it's in the §3.1 schema but may not have been created in Phase 1. If missing, add migration:

```sql
CREATE TABLE IF NOT EXISTS content_chunks (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  chunk_index INTEGER,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER,
  indexed_at INTEGER,
  model_id TEXT DEFAULT 'bge-small-en-v1.5'
);
```

The `model_id` column is mandatory — every embedding record must store which model produced it. This enables future migration without re-embedding everything.

### Wire into chat route

After assistant response is saved to KERNL, queue embedding (non-blocking — do not await in hot path):

```typescript
// Fire-and-forget, never block the response
indexMessage(messageId, threadId, content, 'assistant').catch(err =>
  console.warn('[cross-context] index failed:', err)
);
```

User messages get indexed too — index both sides of every exchange.

### Performance

First `embedText()` call initializes the ONNX model — ~500ms warm-up. Subsequent calls: ~20–50ms per chunk. For long messages (>3 chunks), batch via `Promise.all()` across chunks but limit to 5 concurrent to avoid memory spikes.

---

## CHECKPOINTING

Every 3 file writes:
1. `npx tsc --noEmit`
2. `git add && git commit -m "sprint-3a(wip): [what]"`

---

## SESSION END

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Verify: send a message in the UI, check `content_chunks` table has rows
4. Update `D:\Projects\GregLite\STATUS.md`
5. Commit: `sprint-3a: embedding pipeline, bge-small-en-v1.5`
6. Push
7. Write `SPRINT_3A_COMPLETE.md`

---

## GATES

- [ ] `embedText()` returns Float32Array of length 384
- [ ] `chunkText()` respects 512-token window and 50-token overlap
- [ ] Chunks under 200 chars are skipped
- [ ] Message sent in UI → rows appear in `content_chunks` table
- [ ] `model_id` column populated on every row
- [ ] Embedding is non-blocking in chat route (no latency added to response)
- [ ] First-run model download logged with progress
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
