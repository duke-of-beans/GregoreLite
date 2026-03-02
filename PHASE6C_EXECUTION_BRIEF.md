GREGLITE SPRINT 6C - Ghost Thread Unified Ingest Pipeline
Phase 6, Sprint 3 of 9 | Sequential after 6B | March 2, 2026

YOUR ROLE: Build the unified ingest pipeline. It receives file change events from the Rust watcher (6A) and email messages from the connectors (6B), chunks content by type, embeds using the shared bge-small-en-v1.5 model, and writes to the shared content_chunks table and vec_index. The Ghost shares the same semantic space as the Cross-Context Engine - same model, same table, same index. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - section 6 fully, section 5.1 for embedding model
7. D:\Projects\GregLite\SPRINT_6B_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- content_chunks table schema from Phase 3 does not have a source_type column - add a migration, do not silently add columns
- vec_index already has chunks from Phase 3 Cross-Context Engine - confirm shared table is intentional (it is, per BLUEPRINT section 6.5) before writing
- Chunking a PDF or DOCX requires a parser not already in the project - use EoS Phase 5 extraction, do not add new dependencies
- AEGIS-governed queue design is unclear - read BLUEPRINT section 6.2 before building the backup queue
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] KERNL migrations: ALTER TABLE content_chunks ADD COLUMN source_type/source_path/source_account → DDL specified, use PRAGMA table_info check first, mechanical
[HAIKU] CREATE ghost_indexed_items table → DDL specified, mechanical
[HAIKU] Write types.ts (IngestItem, ChunkResult, IngestStats interfaces) → shapes fully specified, mechanical
[HAIKU] Write writer.ts (insert to content_chunks + vec_index) → schema known, SQL specified, mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 6C complete, write SPRINT_6C_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] chunker.ts: type-aware chunking with function-boundary awareness for code, paragraph awareness for prose
[SONNET] embedder.ts: batch embedder with 100ms delay, integrate with existing Phase 3 embedText()
[SONNET] queue.ts: IngestQueue class with AEGIS-governed pause/resume, never-drop guarantee
[SONNET] Modify app/lib/cross-context/surfacing.ts to exclude ghost source by default + add includeGhost param
[SONNET] index.ts: wire ingestFile() and ingestEmail() through privacy check → chunker → embedder → writer
[OPUS] Escalation only if Sonnet fails twice on the same problem

QUALITY GATES:
1. File changes from watcher-bridge feed into ingest pipeline within 1 second of receipt
2. Email messages from poller feed into ingest pipeline after each poll
3. Chunking respects type-specific sizes from BLUEPRINT section 6.2
4. All Ghost chunks tagged source: 'ghost' in content_chunks metadata
5. Embedding batches of 10, 100ms delay between batches (never floods the embedding model)
6. AEGIS-governed queue: events never dropped, back up during PARALLEL_BUILD/COUNCIL
7. Ghost chunks excluded from Cross-Context Engine suggestions (same index, different source filter)
8. pnpm test:run zero failures

CHUNKING SIZES - from BLUEPRINT section 6.2:
  Code files (.ts .tsx .js .py .rs .go .java .sql): ~600 tokens, function-boundary aware, 50-token overlap
  Documents/PDFs/DOCX: ~700 tokens, paragraph-aware, 100-token overlap
  Plain text (.txt .md .yaml .json): ~600 tokens, 100-token overlap
  Email body: full body if under 700 tokens; else prose rules with 100-token overlap

FILE LOCATIONS:
  app/lib/ghost/ingest/
    index.ts         - public API: ingestFile(path), ingestEmail(message), getQueueDepth()
    chunker.ts       - type-aware chunking logic
    embedder.ts      - batch embedder, 100ms delay, uses shared bge-small-en-v1.5
    queue.ts         - AEGIS-governed in-memory queue, never drops items
    writer.ts        - writes chunks to content_chunks + vec_index
    types.ts         - IngestItem, ChunkResult, IngestStats interfaces

SHARED INFRASTRUCTURE:
The Ghost uses the same embedding pipeline from Phase 3 (app/lib/embeddings/). Do not create a new embedding model instance. Import and call the existing embedText() function.

The Ghost writes to the same content_chunks table and vec_index from Phase 3. This is intentional - same semantic space. Add a source_type column if not present.

KERNL MIGRATION - add source_type to content_chunks if missing:
  ALTER TABLE content_chunks ADD COLUMN source_type TEXT DEFAULT 'conversation';
  ALTER TABLE content_chunks ADD COLUMN source_path TEXT;
  ALTER TABLE content_chunks ADD COLUMN source_account TEXT;

Write this as a KERNL migration in app/lib/kernl/migrations/. Check if columns exist before adding (SQLite ALTER TABLE does not support IF NOT EXISTS - use PRAGMA table_info to check first).

CHUNK METADATA for Ghost chunks:
  {
    source: 'ghost',
    source_type: 'file' | 'email',
    source_path: string,        // file path or email ID
    source_account: string,     // email account or watch root
    indexed_at: number,
    file_ext?: string,
    email_provider?: 'gmail' | 'outlook',
    email_subject?: string,
    email_from?: string,
  }

AEGIS-GOVERNED QUEUE (queue.ts):
The queue holds IngestItem objects in memory. It processes items at full speed normally. When AEGIS profile is PARALLEL_BUILD or COUNCIL, the queue pauses processing but continues accepting new items. When the profile returns to normal, it drains the backlog.

  export class IngestQueue {
    enqueue(item: IngestItem): void
    pause(): void
    resume(): void
    getDepth(): number
    onProcess(handler: (item: IngestItem) => Promise<void>): void
  }

Never drop items. If the queue exceeds 10,000 items, log a warning but continue accepting.

BATCH EMBEDDING:
Process chunks in batches of 10. After each batch, wait 100ms before the next. This prevents flooding the ONNX embedding model which runs synchronously on CPU.

  async function embedBatch(chunks: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      for (const text of batch) {
        results.push(await embedText(text));
      }
      if (i + 10 < chunks.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    return results;
  }

CROSS-CONTEXT FILTER:
Ghost chunks have source: 'ghost' in metadata. The Cross-Context Engine suggestion surfacing (Phase 3, app/lib/cross-context/surfacing.ts) must exclude Ghost chunks from its results - Ghost has its own surfacing path (Sprint 6E). Add a filter in findSimilarChunks() to exclude source: 'ghost' by default, with an opt-in parameter includeGhost for the interrupt scorer in 6E.

GHOST INDEXED ITEMS AUDIT TABLE:
  CREATE TABLE IF NOT EXISTS ghost_indexed_items (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,       -- 'file' | 'email'
    source_path TEXT,
    source_account TEXT,
    chunk_count INTEGER DEFAULT 0,
    indexed_at INTEGER NOT NULL,
    deleted INTEGER DEFAULT 0,       -- soft delete for Privacy Dashboard
    deleted_at INTEGER
  );

This table is the audit trail David can inspect in the Privacy Dashboard (Sprint 6G). Every ingest operation writes one row here.

INGEST STATS:
Track and expose for the context panel status display:

  export interface IngestStats {
    totalIndexed: number;
    filesIndexed: number;
    emailsIndexed: number;
    queueDepth: number;
    lastIngestAt: number;
    embeddingModelReady: boolean;
  }

  export async function getIngestStats(): Promise<IngestStats>

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 6C complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-6c: Ghost unified ingest pipeline, chunker, AEGIS queue)
5. git push
6. Write SPRINT_6C_COMPLETE.md: first file ingest tested end-to-end, chunk counts per type, embedding throughput measured, queue backpressure behavior verified

GATES CHECKLIST:
- ingestFile(path) produces chunks written to content_chunks with source: ghost
- ingestEmail(message) produces chunks written to content_chunks with source: ghost
- Chunk sizes match type-specific targets from BLUEPRINT
- ghost_indexed_items audit row written per ingest
- Batch embedder: 10 per batch, 100ms delay between batches
- Queue pauses during PARALLEL_BUILD/COUNCIL, drains on resume, never drops items
- findSimilarChunks() in Cross-Context Engine excludes ghost source by default
- KERNL migration runs without error on existing Phase 3+ database
- pnpm test:run clean
- Commit pushed via cmd -F flag
