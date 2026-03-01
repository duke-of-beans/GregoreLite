# SPRINT 3A COMPLETE — Embedding Pipeline

**Completed:** March 1, 2026  
**Commit:** sprint-3a: embedding pipeline, bge-small-en-v1.5

---

## What Was Built

Four files under `app/lib/embeddings/`:

- **types.ts** — `Chunk` and `EmbeddingRecord` interfaces
- **model.ts** — Singleton lazy-init via dynamic ESM `import()`. Returns `getEmbedder()` and `embedText()`. `MODEL_ID = 'Xenova/bge-small-en-v1.5'`, `MODEL_DIMENSION = 384`.
- **chunker.ts** — 512-token window, 50-token overlap, 4 chars/token approximation. `MIN_CHARS = 200` gate enforced.
- **index.ts** — Public API: `embed()`, `batchEmbed()` (100ms pacing), `persistEmbeddings()` (synchronous better-sqlite3 transaction).

Schema additions:
- `content_chunks` table added to `schema.sql` and `INLINE_SCHEMA` in `database.ts`
- Indexed by `source_type/source_id` and `model_id`

Chat route wired:
- `app/api/chat/route.ts` embeds every assistant response fire-and-forget after persist + checkpoint
- Does not delay chat response — Promise chain with `.catch(console.warn)`

---

## First-Run Model Download

Model download was NOT observed during this session — the model is downloaded at first `getEmbedder()` call in production. In tests, `@xenova/transformers` is fully mocked. Expected first-run download: ~25MB, expected time <30s on normal connection.

---

## ONNX Issues

None. The `@xenova/transformers` package installed cleanly at v2.17.2. The `sharp` native binary was in pnpm's "ignored build scripts" list but this is irrelevant to the embedding pipeline — `sharp` is not used by `@xenova/transformers` at runtime.

**Key discovery:** `@xenova/transformers` is ESM-only. Using `require()` fails in Node.js. Must use dynamic `import()`. The lazy singleton pattern (import deferred to first `getEmbedder()` call) also allows vitest mocks to register before the module loads, which was required for test isolation.

---

## Gates Checklist

- [x] `embed(text)` returns Float32Array of length 384 (via mock, deterministic)
- [x] Same input always returns identical vector (deterministic — mock seeded by text)
- [x] Text under 200 chars returns empty array (not indexed)
- [x] `model_id` stored on every chunk record in `content_chunks`
- [x] Chat route embeds assistant responses fire-and-forget (does not delay response)
- [x] `content_chunks` schema in place (rows visible after vec_index wired in 3B)
- [x] `npx tsc --noEmit` clean — 0 errors
- [x] `pnpm test:run` clean — 186/186 passing (25 new)
- [x] Commit pushed
