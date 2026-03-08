GREGLITE EPIC-81 — CROSS-PLATFORM CONVERSATION MEMORY IMPORT
"Give Greg Memory of Everything" — 3 sprints, sequential
Run after Sprint 32.0 (Headless Browser Mode). March 2026.

---

YOUR ROLE: You are the EPIC-81 execution agent for GregLite. Your job is to work through
all 3 sprints in order. Each sprint has a clear scope, quality gates, and a commit
checkpoint before you move to the next. You do not skip sprints. You do not move forward
if quality gates fail. Stop and notify David if an authority protocol condition is hit.

---

BOOTSTRAP (DO THIS ONCE AT SESSION START — BEFORE ANY SPRINT)

1. Read D:\Dev\CLAUDE_INSTRUCTIONS.md
2. Read D:\Dev\TECHNICAL_STANDARDS.md
3. Read D:\Projects\GregLite\DEV_PROTOCOLS.md
4. Read D:\Projects\GregLite\STATUS.md
5. Read D:\Projects\GregLite\docs\CONVERSATION_IMPORT_SPEC.md — this is your master spec. Read it fully.
6. Read D:\Projects\GregLite\FEATURE_BACKLOG.md — find EPIC-81 for the full scope summary.
7. Run baseline: cd /d D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run
   Record baseline test count (currently 1667). This is your floor.

GIT PROTOCOL (EVERY COMMIT):
Write commit message to COMMIT_MSG_TEMP.txt in project root.
Then: cd /d D:\Projects\GregLite && "D:\Program Files\Git\cmd\git.exe" add -A && "D:\Program Files\Git\cmd\git.exe" commit -F COMMIT_MSG_TEMP.txt && "D:\Program Files\Git\cmd\git.exe" push
Shell: cmd only (not PowerShell).

BETWEEN EACH SPRINT:
- Run: npx tsc --noEmit (zero errors before proceeding)
- Run: pnpm test:run (zero new failures)
- Commit with message format: epic-81-sprint-33: [name] complete
- Update STATUS.md: Last Updated, test count, add sprint entry
- Only then start the next sprint

---

AUTHORITY PROTOCOL — STOP AND NOTIFY DAVID WHEN:

- Any new DB table is needed beyond imported_sources, imported_conversations, and the
  imported_source_id column on content_chunks — stop, get approval
- The embedText() dynamic import fails with a native module error — stop, document the
  exact error, do not try to replace the embedding model
- content_chunks CHECK constraint on source_type blocks the 'imported_conversation' value —
  stop, document the constraint definition, confirm approach before modifying schema
- A single adapter takes more than 10 minutes to run on a 1000-conversation test file —
  stop, we need to discuss batching strategy
- Watchfolder watcher causes 100% CPU on the dev machine — stop immediately
- The same TypeScript error appears in 3+ new files — likely a type definition problem
  upstream; stop and diagnose before continuing
- Test count drops (regression) — do not proceed until fixed and explained

---

SPRINT EXECUTION ORDER

Work through sprints in this exact sequence. Do not reorder.

════════════════════════════════════════════════════════════
SPRINT 33.0 — Import Pipeline + Historical Corpus
════════════════════════════════════════════════════════════

What this delivers: The user can drop a claude.ai export ZIP (or ChatGPT JSON) into
GregLite's Import panel and every conversation becomes immediately searchable via Shimmer
and cross-context retrieval. After this sprint, years of prior AI conversations are
in GregLite's memory.

Read before coding:
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\database.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\schema.sql
  Filesystem:read_file D:\Projects\GregLite\app\lib\memory\shimmer-query.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\ghost\ingest\chunker.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\ghost\ingest\embedder.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\settings\SettingsPanel.tsx
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts

─── TASK 1: DB Schema ───────────────────────────────────────

Add to app/lib/kernl/schema.sql (CREATE TABLE IF NOT EXISTS pattern):

  imported_sources table:
    id TEXT PRIMARY KEY
    source_type TEXT NOT NULL
    source_path TEXT
    display_name TEXT NOT NULL
    conversation_count INTEGER DEFAULT 0
    chunk_count INTEGER DEFAULT 0
    last_synced_at INTEGER
    created_at INTEGER NOT NULL
    meta TEXT

  imported_conversations table:
    id TEXT PRIMARY KEY
    imported_source_id TEXT NOT NULL REFERENCES imported_sources(id)
    external_id TEXT NOT NULL
    title TEXT
    message_count INTEGER DEFAULT 0
    created_at_source INTEGER
    imported_at INTEGER NOT NULL
    UNIQUE(imported_source_id, external_id)  ← dedup index

Add to database.ts runMigrations() — same try/catch ALTER TABLE pattern as all prior phases:
  ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS imported_source_id TEXT REFERENCES imported_sources(id);

─── TASK 2: Types ───────────────────────────────────────────

New file: app/lib/import/types.ts
  ImportFormat = 'claude_ai_export' | 'chatgpt_export' | 'generic_json' | 'markdown' | 'text'
  ImportedMessage: { role: 'user' | 'assistant' | 'system'; content: string; created_at: number }
  ImportedConversation: { external_id: string; source_platform: string; title: string; created_at: number; messages: ImportedMessage[] }
  ImportSource: { id, display_name, source_type, conversation_count, chunk_count, last_synced_at, created_at }
  ImportProgress: { total, processed, skipped, chunks_written, status: 'running'|'complete'|'error', error? }

─── TASK 3: Format Adapters ─────────────────────────────────

New directory: app/lib/import/adapters/

claude-ai.ts — parse claude.ai export JSON
  Input: parsed conversations.json array
  Schema: [{ uuid, name, created_at, chat_messages: [{ uuid, sender, text, created_at }] }]
  sender 'human' → role 'user', sender 'assistant' → role 'assistant'
  Returns ImportedConversation[]

chatgpt.ts — parse ChatGPT export JSON
  Input: conversations.json array
  Schema: [{ id, title, create_time, mapping: { [nodeId]: { message: { author: { role }, content: { parts: string[] } } } } }]
  Walk mapping tree (nodes where parent is null are roots), reconstruct message order, join content parts
  Returns ImportedConversation[], source_platform = 'chatgpt'

generic-json.ts — fallback
  Accepts array of { role, content } objects or any recognizable conversation structure
  Best-effort parse — return [] if unrecognizable (never throw)

index.ts — adapter registry
  detectFormat(filename: string, content: unknown): ImportFormat
    'conversations.json' + uuid+chat_messages shape → 'claude_ai_export'
    'conversations.json' + mapping shape → 'chatgpt_export'
    .md/.txt extension → 'markdown'
    anything else that's an array → 'generic_json'
  runAdapter(format: ImportFormat, content: unknown): ImportedConversation[]
    Wraps each adapter in try/catch — returns [] on error, never throws

─── TASK 4: ZIP Handler ─────────────────────────────────────

New file: app/lib/import/zip-handler.ts
  Check package.json — if jszip not present, add jszip@3
  extractConversationsJson(buffer: Buffer): unknown
    Opens ZIP, finds conversations.json, returns parsed JSON
    Also handles bare JSON (not zipped) — detect by magic bytes (ZIP starts with PK\x03\x04)

─── TASK 5: Import Pipeline ─────────────────────────────────

New file: app/lib/import/pipeline.ts
  runImport(sourceId: string, conversations: ImportedConversation[], db: Database): Promise<ImportProgress>
  For each conversation:
    Check imported_conversations for (sourceId, external_id) — skip if exists (dedup)
    Chunk using chunker.ts from ghost/ingest (reuse, don't duplicate)
      Join messages as "${role}: ${content}\n" blocks, then chunk at 600-token boundaries
    Embed using embedText() — dynamic import: const { embedText } = await import('@/lib/embeddings/model')
    Write chunks to content_chunks:
      source_type = 'imported_conversation'
      imported_source_id = sourceId
      metadata JSON: { source_platform, conversation_id: external_id, conversation_title, message_count }
    Insert row to imported_conversations
  Update imported_sources: increment conversation_count, chunk_count, set last_synced_at = Date.now()
  Update ImportProgress in place (module-level Map keyed by sourceId — API polls it)
  Return final ImportProgress

─── TASK 6: API Routes ──────────────────────────────────────

New directory: app/api/import/

POST /api/import/upload
  Accepts multipart form data, file field
  Read buffer, detect format, run adapter
  Create imported_sources row, kick off runImport() fire-and-forget
  Return { sourceId, conversationCount } immediately (don't wait for pipeline)
  Store progress in module-level Map

GET /api/import/progress/[sourceId]
  Returns current ImportProgress from Map

GET /api/import/sources
  Returns all imported_sources rows, most recent first

DELETE /api/import/sources/[sourceId]
  Cascade delete: imported_conversations WHERE imported_source_id = sourceId
  Delete content_chunks WHERE imported_source_id = sourceId (and remove from vec_index by rowid)
  Delete imported_sources row

─── TASK 7: Import Panel UI ─────────────────────────────────

New file: app/components/settings/ImportSection.tsx
  Drag-and-drop zone: accepts .json and .zip
    Copy: "Drop your claude.ai or ChatGPT export here"
    Sub-copy: "Supports: claude.ai ZIP, ChatGPT JSON, generic conversation JSON"
  On drop/select: POST to /api/import/upload, poll /api/import/progress/[sourceId] every 2s
  Progress indicator: "Processing... 42 / 156 conversations" → "✓ 156 conversations indexed (2,847 chunks)"
  Memory Sources list: fetches /api/import/sources on mount
    Each row: display_name, conversation_count, chunk_count, last_synced_at (relative time), delete button

Wire into app/components/settings/SettingsPanel.tsx — add ImportSection under Memory or create Memory section.

─── TASK 8: Shimmer Provenance ──────────────────────────────

app/lib/memory/shimmer-query.ts
  ShimmerMatch type gains: source_platform?: string
  When querying content_chunks, parse metadata JSON to extract source_platform
    JSON.parse(row.metadata ?? '{}').source_platform

app/components/memory/ShimmerOverlay.tsx (or MemoryCard.tsx — check which renders match results)
  If match.source_platform present, render small badge next to match:
    'claude_ai' → "Claude" badge (cyan)
    'chatgpt' → "ChatGPT" badge (green)
    Other → omit badge
  Badge size matches existing source badge pill

─── TASK 9: Voice Copy ──────────────────────────────────────

app/lib/voice/copy-templates.ts — add IMPORT export:
  Drop zone heading, drop zone subtext, processing in-progress (with count tokens),
  complete (with conversation + chunk counts), error state, delete confirmation,
  empty sources state, platform badge labels (Claude, ChatGPT, Other)
  No hardcoded user-facing strings in any new component

─── TASK 10: Quality Gate ───────────────────────────────────

  □ npx tsc --noEmit — zero new errors
  □ pnpm test:run — 1667+ tests all passing
  □ Write app/lib/import/__tests__/sprint33.test.ts — minimum 15 tests:
      adapter parsing: claude_ai, chatgpt, generic (valid input → correct ImportedConversation[])
      dedup: same external_id not re-imported (second call → skipped count increments)
      format detection: ZIP with claude shape → 'claude_ai_export'; JSON with mapping → 'chatgpt_export'
      ZIP extraction: mock buffer, verify returns parsed JSON
      ImportProgress shape: status transitions running → complete
  □ STATUS.md updated (Last Updated, test count, Sprint 33.0 entry)
  □ Commit: epic-81-sprint-33: import pipeline, adapters, drag-drop UI, Shimmer provenance

════════════════════════════════════════════════════════════
SPRINT 34.0 — Watchfolder + Ongoing Sync + Reminder
════════════════════════════════════════════════════════════

REQUIRES: Sprint 33.0 complete and green.

What this delivers: GregLite watches a folder. When a claude.ai export lands there
(manually dropped or auto-downloaded by the browser), it's processed automatically.
A StatusBar chip shows days since last sync and links to claude.ai export page when
overdue. The only human step for ongoing memory sync is clicking Export in claude.ai.

Read before coding:
  Filesystem:read_file D:\Projects\GregLite\app\lib\import\pipeline.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\import\adapters\index.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\ghost\watcher-bridge.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\settings-store.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\StatusBar.tsx

─── TASK 1: Watchfolder Config ──────────────────────────────

New file: app/lib/import/watchfolder-config.ts
  DEFAULT_WATCHFOLDER: path.join(os.homedir(), 'GregLite', 'imports')
  PROCESSED_SUBDIR: path.join(watchfolderPath, 'processed')
  SUPPORTED_EXTENSIONS: ['.json', '.zip']
  getWatchfolderPath(): Promise<string> — reads 'watchfolder_path' from KERNL settings-store, falls back to DEFAULT
  ensureWatchfolderExists(folderPath: string): void — fs.mkdirSync both watchfolder and processed subdir, { recursive: true }

─── TASK 2: Watchfolder Watcher ─────────────────────────────

New file: app/lib/import/watchfolder.ts
  Tauri runtime: use Tauri fs.watch() API
  Non-Tauri (dev/test): use Node.js fs.watch() fallback
  Detect Tauri: typeof window !== 'undefined' && window.__TAURI_INTERNALS__

  startWatchfolder(onFile: (filePath: string) => void): Promise<() => void>
    Call ensureWatchfolderExists first
    Watch for create events only (ignore modify/delete)
    Filter: SUPPORTED_EXTENSIONS only
    500ms debounce per file (may still be writing when first detected)
    Call onFile(absolutePath) after debounce
    Return unsubscribe/stop function

  stopWatchfolder(): calls the stored unsubscribe fn

  moveToProcessed(filePath: string): void
    fs.renameSync to processed/ subdir
    If rename fails (cross-device), fallback: copy + delete

─── TASK 3: Auto-Ingest Handler ─────────────────────────────

New file: app/lib/import/auto-ingest.ts
  handleWatchfolderFile(filePath: string): Promise<void>
    Read file buffer
    Detect format: ZIP by magic bytes (PK\x03\x04), JSON by extension
    Run runAdapter() from adapters/index.ts
    Create imported_sources row: display_name = "${filename} (auto-imported ${date})"
    Call runImport() from pipeline.ts
    On success: moveToProcessed(filePath)
      Best-effort Tauri notification: title "Memory updated", body "N new conversations indexed from {filename}"
      Outside Tauri: console.log
    On error: log to console.error + write KERNL decision row as warning
      Do NOT move file — leave in place so user can retry by re-dropping

  startAutoIngest(): Promise<void> — calls startWatchfolder(handleWatchfolderFile), stores unsubscribe
  stopAutoIngest(): void — calls stored unsubscribe

─── TASK 4: Sync Reminder Logic ─────────────────────────────

New file: app/lib/import/sync-reminder.ts
  DEFAULT_REMINDER_DAYS = 14 (reads 'import_reminder_days' from KERNL settings, falls back to 14)
  getLastSyncedAt(): Promise<number | null> — MAX(last_synced_at) from imported_sources
  getDaysSinceSync(): Promise<number | null>
    null if no imports ever (chip stays hidden — no nag before first import)
    else: Math.floor((Date.now() - lastSyncedAt) / 86400000)
  shouldShowReminder(): Promise<boolean> — daysSinceSync >= reminderDays
  getSyncReminderUrl(): string — returns 'https://claude.ai/settings'

─── TASK 5: Lifecycle Wiring ────────────────────────────────

app/lib/import/index.ts (barrel export):
  Export: startAutoIngest, stopAutoIngest, handleWatchfolderFile, getWatchfolderPath

app/lib/bootstrap/index.ts:
  Add startAutoIngest() as a new step after existing bootstrap steps
  Wrap in try/catch — failure is non-fatal, app must still start
  Auto-ingest runs independently of Ghost — don't gate it on Ghost being enabled

app/app/page.tsx (or wherever beforeunload cleanup lives):
  Wire stopAutoIngest() into cleanup — alongside existing Ghost/AEGIS shutdown

─── TASK 6: StatusBar Sync Indicator ────────────────────────

app/components/ui/StatusBar.tsx:
  Add "MEM" chip
  Poll /api/import/sync-status every 5 minutes via useEffect + setInterval
    Clean up interval on unmount
  States:
    No imports ever (daysSinceSync === null): chip hidden
    Synced recently (< reminderDays): "MEM: Nd ago" in muted green
    Overdue (>= reminderDays): "MEM: Nd ago" in amber, clickable
  Click when overdue: dispatch greglite:open-settings to open ImportSection in Settings
  Tooltip: "Memory synced N days ago" when current; "Memory last synced N days ago — click to sync" when overdue

─── TASK 7: Sync Status API Route ───────────────────────────

New file: app/api/import/sync-status/route.ts
  GET: returns { daysSinceSync: number | null, shouldShowReminder: boolean, reminderUrl: string }
  Calls getDaysSinceSync() and shouldShowReminder() from sync-reminder.ts

─── TASK 8: Watchfolder Settings UI ─────────────────────────

app/components/settings/ImportSection.tsx (extend from Sprint 33):
  Add "Auto-Sync" subsection below Memory Sources list:
    Current watchfolder path (from /api/import/watchfolder-config GET)
    "Open folder" button (Tauri shell:open or console.log in dev)
    Reminder interval selector: 7 / 14 / 30 days (writes to KERNL settings)
    Instructional copy: "Set your browser to auto-download exports to this folder.
      Then just click Export in claude.ai — GregLite handles the rest."
    Link: "Export your claude.ai history →" opens claude.ai/settings

─── TASK 9: Watchfolder Config API Route ────────────────────

New file: app/api/import/watchfolder-config/route.ts
  GET: returns { path, processingPath, reminderDays }
  POST: accepts { path?, reminderDays? }, writes to KERNL settings

─── TASK 10: Voice Copy ─────────────────────────────────────

Extend IMPORT export in copy-templates.ts with strings for:
  Auto-sync section heading, watchfolder path label, open folder button,
  instructional how-to copy, sync link text,
  MEM chip states (recent: "Memory synced {N}d ago", overdue: "Memory last synced {N}d ago")
  Reminder interval options (7 days / 14 days / 30 days)

─── TASK 11: Quality Gate ───────────────────────────────────

  □ npx tsc --noEmit — zero new errors
  □ pnpm test:run — all prior tests pass + new tests added
  □ Write app/lib/import/__tests__/sprint34.test.ts — minimum 12 tests:
      watchfolder path: DEFAULT_WATCHFOLDER correct on Windows, getWatchfolderPath reads KERNL then falls back
      moveToProcessed: file exists in processed/ after; original path gone; fallback copy+delete on rename failure
      getDaysSinceSync: null when no imports, correct days when last_synced_at set
      shouldShowReminder: 13 days → false, 14 days → true, 15 days → true, null → false
      SUPPORTED_EXTENSIONS: rejects .pdf and .docx, accepts .json and .zip
  □ STATUS.md updated (Last Updated, test count, Sprint 34.0 entry)
  □ Commit: epic-81-sprint-34: watchfolder watcher, auto-ingest, sync reminder, StatusBar MEM chip

════════════════════════════════════════════════════════════
SPRINT 35.0 — Additional Adapters + EPIC-81 Certification
════════════════════════════════════════════════════════════

REQUIRES: Sprint 33.0 and 34.0 both complete and green.

What this delivers: Markdown/plain-text import for raw conversation dumps, Gemini Takeout
support, hardened adapter registry (never throws on bad input), a 25-test integration suite
covering the full end-to-end flow, and EPIC-81 certified complete with git tag.

Read before coding:
  Filesystem:read_file D:\Projects\GregLite\app\lib\import\adapters\index.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\import\pipeline.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\import\sync-reminder.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\import\watchfolder.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\inspector\MemoryTab.tsx
  Filesystem:read_file D:\Projects\GregLite\SPRINT_6G_COMPLETE.md  (reference format for EPIC81_COMPLETE.md)

─── TASK 1: Markdown Adapter ────────────────────────────────

New file: app/lib/import/adapters/markdown.ts
  Detect format by scanning first 20 lines:
    a) Role-structured: lines starting with "You: " / "Claude: " or "User: " / "Assistant: "
    b) Markdown headers: "## You" / "## Claude" with content blocks
    c) Raw text fallback: no recognizable structure
  For (a) and (b): extract role+content pairs → ImportedMessage[]
  For (c): single ImportedConversation with one message, role='user', content = full text
  external_id: SHA-256 hash of first 200 chars (deterministic dedup)
  source_platform: 'markdown_import'

─── TASK 2: Gemini Takeout Adapter ──────────────────────────

New file: app/lib/import/adapters/gemini.ts
  Google Takeout exports Gemini conversations as JSON in a ZIP
  Expected format: [{ title, conversations: [{ id, createTime, messages: [{ author: 'user'|'model', content: string }] }] }]
  Map 'model' → 'assistant'
  If top-level structure doesn't match: console.warn "Unrecognized Gemini format, skipping" + return []
  Never throw. Always return [].
  source_platform: 'gemini'

─── TASK 3: Adapter Registry Hardening ──────────────────────

app/lib/import/adapters/index.ts — update:
  detectFormat() handles: claude_ai (uuid+chat_messages), chatgpt (mapping shape), gemini (filename heuristic
    'Gemini'|'MyActivity' + structure check), markdown (.md/.txt extension), generic JSON fallback
  runAdapter() wraps each adapter in try/catch — on error: console.error + return []
  Log detected format to console.debug before running adapter

─── TASK 4: Integration Test Suite ──────────────────────────

New file: app/lib/import/__tests__/epic81-integration.test.ts
  Minimum 25 tests. Use in-memory SQLite (:memory:). Call runMigrations() on in-memory DB before tests.
  Mock embedText() → returns fixed Float32Array(384). No real embeddings in tests.

  Cover:
    claude_ai adapter: 10-conversation fixture → correct ImportedConversation[]
    chatgpt adapter: mapping-structure fixture → correct ImportedConversation[]
    markdown adapter: role-structured → correct messages; raw text → single message
    gemini adapter: sample fixture → correct ImportedConversation[]
    Dedup: pipeline twice with same data → second run: 0 new conversations, all skipped
    Dedup: 5 new + 5 existing → inserts exactly 5, skipped = 5
    Format detection: ZIP with claude shape → 'claude_ai_export'; JSON with mapping → 'chatgpt_export'
    Sync reminder: 0 days → no reminder; 14 days → reminder; no imports ever → no reminder
    Watchfolder SUPPORTED_EXTENSIONS: .pdf rejected, .json accepted, .zip accepted
    moveToProcessed: file in processed/ after move; original gone
    ImportProgress: status 'running' during processing → 'complete' after; skipped count correct on dedup
    content_chunks after import: source_type = 'imported_conversation'; imported_source_id populated
    Shimmer provenance: match for imported chunk has source_platform from metadata JSON

─── TASK 5: Inspector Import Summary ───────────────────────

app/components/inspector/MemoryTab.tsx — extend (ADDITIVE only, do not modify existing Shimmer stats):
  Add "Import Sources" section below existing Shimmer stats content:
    Total sources, total conversations, total chunks, last synced (relative time)
    Data from GET /api/import/sources
    Empty state: "No conversation history imported yet — add in Settings → Memory"
    Empty state links to ImportSection (dispatch greglite:open-settings with section: 'memory')
    Compact 3-4 lines — this is inspector, not a dashboard

─── TASK 6: EPIC-81 Certification ──────────────────────────

STATUS.md:
  Update Last Updated, test count
  Add Sprint 33.0, 34.0, 35.0 entries in the existing sprint format (match detail level of Sprint 31.0 entry)

FEATURE_BACKLOG.md:
  Mark EPIC-81 Sprint X.0 → Sprint 33.0 ✅ SHIPPED [commit hash]
  Mark EPIC-81 Sprint X.1 → Sprint 34.0 ✅ SHIPPED [commit hash]
  Mark EPIC-81 Sprint X.2 → Sprint 35.0 ✅ SHIPPED [commit hash]

Write D:\Projects\GregLite\docs\EPIC81_COMPLETE.md:
  Follow the SPRINT_6G_COMPLETE.md format exactly.
  Include: what shipped across all 3 sprints, files created/modified, gate results,
  key discoveries, memory coverage note (GregLite now has access to all prior AI conversation
  history from any supported platform — claude.ai, ChatGPT, Gemini, markdown dumps).

─── TASK 7: Quality Gate ────────────────────────────────────

  □ npx tsc --noEmit — zero new errors
  □ pnpm test:run — all 25+ integration tests pass; total count >= 1667 + all new sprint tests
  □ STATUS.md updated with all 3 sprint entries
  □ FEATURE_BACKLOG.md EPIC-81 marked shipped
  □ EPIC81_COMPLETE.md written in docs/

Final commit and tag:
  Commit message: epic-81: cross-platform conversation memory import complete (sprints 33-35)
  Then: "D:\Program Files\Git\cmd\git.exe" push
  Then: "D:\Program Files\Git\cmd\git.exe" tag epic-81-complete
  Then: "D:\Program Files\Git\cmd\git.exe" push origin epic-81-complete

════════════════════════════════════════════════════════════
EPIC-81 CERTIFICATION (AFTER ALL 3 SPRINTS)
════════════════════════════════════════════════════════════

Before tagging epic-81-complete, verify ALL of the following:

IMPORT PIPELINE:
  □ Drop a real claude.ai export ZIP → conversations appear in Memory Sources list
  □ Shimmer highlights on a phrase from an imported conversation
  □ Re-importing same file → 0 new conversations (dedup working)
  □ Drop a ChatGPT export JSON → conversations imported correctly
  □ Delete a source → removed from list, chunks gone from vec_index

WATCHFOLDER:
  □ Drop a file into ~/GregLite/imports/ → auto-processed without user action
  □ Processed file moves to ~/GregLite/imports/processed/
  □ StatusBar MEM chip shows correct days since last sync
  □ MEM chip turns amber at 14 days and links to import settings

ADAPTERS:
  □ Markdown file with "You: / Claude: " format → imports correctly
  □ Gemini Takeout JSON → imports correctly (or "Unrecognized format" logged — not a crash)
  □ Invalid/corrupted file → empty import result, no crash, file not moved to processed

QUALITY:
  □ pnpm test:run — zero failures, test count >= Sprint 33.0 baseline
  □ npx tsc --noEmit — zero errors
  □ All 25 integration tests pass

DOCUMENTATION:
  □ EPIC81_COMPLETE.md written and complete
  □ STATUS.md has Sprint 33.0, 34.0, 35.0 entries
  □ FEATURE_BACKLOG.md EPIC-81 marked shipped

---

END OF EPIC-81 EXECUTION PROMPT
Spec: D:\Projects\GregLite\docs\CONVERSATION_IMPORT_SPEC.md
Backlog: D:\Projects\GregLite\FEATURE_BACKLOG.md (EPIC-81)
