# Sprint 6C Complete — Ghost Unified Ingest Pipeline

**Date:** March 2, 2026  
**Gate:** tsc 0 errors | pnpm test:run 603/603 passing

---

## Files Built

| File | Description |
|------|-------------|
| `app/lib/ghost/ingest/types.ts` | `IngestItem` (file/email union), `ChunkResult`, `GhostChunkMetadata`, `IngestStats` |
| `app/lib/ghost/ingest/chunker.ts` | Type-aware chunker: code (600t, function-boundary, 50t overlap), doc (700t, para, 100t overlap), plain (600t, para, 100t overlap), email (700t ceiling or full) |
| `app/lib/ghost/ingest/embedder.ts` | `embedBatch()` — batches of 10, 100ms inter-batch delay, dynamic import of Phase 3 `embedText()` |
| `app/lib/ghost/ingest/queue.ts` | `IngestQueue` — AEGIS-governed pause/resume, never-drop guarantee, 10k warning threshold |
| `app/lib/ghost/ingest/writer.ts` | `writeChunks()` (better-sqlite3 transaction → content_chunks + vec_index), `writeAuditRow()` → ghost_indexed_items |
| `app/lib/ghost/ingest/index.ts` | Public API: `ingestFile()`, `ingestEmail()`, `getIngestStats()`, `getQueueDepth()`, queue lifecycle |

## Schema Changes

| Change | Method |
|--------|--------|
| `content_chunks.source_path TEXT` | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` appended to schema.sql |
| `content_chunks.source_account TEXT` | Same — idempotent on every `getDatabase()` call |
| `ghost_indexed_items` table | `CREATE TABLE IF NOT EXISTS` — soft-delete, index on `(source_type, indexed_at DESC)` |

## Modified Files

| File | Change |
|------|--------|
| `app/lib/vector/index.ts` | `findSimilarChunks()` — added `includeGhost: boolean = false` param; reads `metadata.source` to exclude Ghost chunks from Cross-Context suggestions by default |
| `app/lib/kernl/schema.sql` | Ghost Ingest section appended (ALTER TABLEs + ghost_indexed_items) |

---

## Gate Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 603/603 (31 test files, unchanged from 6B) |
| ingestFile() queues file → chunks → embeddings → content_chunks | ✅ |
| ingestEmail() queues email → chunks → embeddings → content_chunks | ✅ |
| All Ghost chunks tagged `source: 'ghost'` in metadata | ✅ |
| ghost_indexed_items audit row written per ingest op | ✅ |
| Batch embedder: 10 per batch, 100ms inter-batch delay | ✅ |
| Queue pauses on PARALLEL_BUILD/COUNCIL, drains on resume | ✅ |
| Queue never drops items — continues accepting while paused | ✅ |
| findSimilarChunks() excludes Ghost source by default | ✅ |
| KERNL migration runs idempotently on existing Phase 3 DB | ✅ |

---

## Key Technical Decisions

**Ghost filter approach**: Reads `content_chunks.metadata` JSON inline inside `findSimilarChunks()`. Chosen over a separate column (e.g. `is_ghost INTEGER`) because metadata is already the canonical extensibility point for chunk provenance. Malformed metadata defaults to non-ghost — no silent suggestion drops.

**No migrations runner**: Project uses schema.sql + `_db.exec(schema)` on every open. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (SQLite 3.37+) is the established pattern. A separate migrations directory would require a runner that doesn't exist.

**Dynamic import in embedder.ts**: `embedText` is imported dynamically inside `embedBatch()` to break the `ghost/ingest → embeddings → vector → embeddings` circular chain. Same pattern as `vector/index.ts → embed()`.

**AEGIS pause in queue**: The `IngestQueue._tick()` calls `getLatestAegisSignal()` on every 200ms interval. No subscription needed — polling is cheap (one SQLite `SELECT`) and keeps the queue stateless with respect to AEGIS profile changes.
