# EPIC-81 — Cross-Platform Conversation Memory Import
# Cowork Sprint Prompts
# Generated: March 2026
# Spec: D:\Projects\GregLite\docs\CONVERSATION_IMPORT_SPEC.md
# Backlog: D:\Projects\GregLite\FEATURE_BACKLOG.md (EPIC-81)

---

═══════════════════════════════════════════════════════════════
SPRINT 33.0 — Conversation Import Pipeline + Historical Corpus
Run FIRST. No dependencies.
Gives GregLite memory of every AI conversation you've ever had.
═══════════════════════════════════════════════════════════════

Execute Sprint 33.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\database.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\schema.sql
  Filesystem:read_file D:\Projects\GregLite\app\lib\memory\shimmer-query.ts
  Filesystem:read_file D:\Projects\GregLite\docs\CONVERSATION_IMPORT_SPEC.md
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\settings\SettingsPanel.tsx

Summary: GregLite's memory is currently blind to every conversation that happened
outside of it — every Claude Desktop session, every ChatGPT exchange, years of
context. This sprint builds the complete import pipeline. After it ships, the user
can drag a claude.ai export ZIP (or any supported format) into GregLite's import
panel, and every conversation in that file becomes immediately searchable via
Shimmer and cross-context retrieval. Two new DB tables track what's been imported
and prevent re-importing duplicates. Shimmer results gain platform provenance badges
so the user knows where each memory came from.

Tasks:

1. **DB Schema — imported_sources + imported_conversations** — app/lib/kernl/schema.sql + database.ts:
   - Add to schema.sql (CREATE TABLE IF NOT EXISTS pattern, same as all other tables):
     ```sql
     CREATE TABLE IF NOT EXISTS imported_sources (
       id             TEXT PRIMARY KEY,
       source_type    TEXT NOT NULL,
       source_path    TEXT,
       display_name   TEXT NOT NULL,
       conversation_count INTEGER DEFAULT 0,
       chunk_count    INTEGER DEFAULT 0,
       last_synced_at INTEGER,
       created_at     INTEGER NOT NULL,
       meta           TEXT
     );
     CREATE TABLE IF NOT EXISTS imported_conversations (
       id                  TEXT PRIMARY KEY,
       imported_source_id  TEXT NOT NULL REFERENCES imported_sources(id),
       external_id         TEXT NOT NULL,
       title               TEXT,
       message_count       INTEGER DEFAULT 0,
       created_at_source   INTEGER,
       imported_at         INTEGER NOT NULL
     );
     CREATE UNIQUE INDEX IF NOT EXISTS idx_imported_convos_dedup
       ON imported_conversations(imported_source_id, external_id);
     ```
   - Add imported_source_id column to content_chunks:
     `ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS imported_source_id TEXT REFERENCES imported_sources(id);`
     (wrap in try/catch in runMigrations() — same pattern as all other ALTER TABLEs in this codebase)
   - Run migrations in database.ts so tables exist on next boot

2. **Format Types + Normalized Schema** — app/lib/import/types.ts (new file):
   - `ImportFormat` union: `'claude_ai_export' | 'chatgpt_export' | 'generic_json' | 'markdown' | 'text'`
   - `ImportedMessage`: `{ role: 'user' | 'assistant' | 'system'; content: string; created_at: number; }`
   - `ImportedConversation`: `{ external_id: string; source_platform: string; title: string; created_at: number; messages: ImportedMessage[]; }`
   - `ImportSource`: `{ id: string; display_name: string; source_type: string; conversation_count: number; chunk_count: number; last_synced_at: number | null; created_at: number; }`
   - `ImportProgress`: `{ total: number; processed: number; skipped: number; chunks_written: number; status: 'running' | 'complete' | 'error'; error?: string; }`

3. **Format Adapters** — app/lib/import/adapters/ (new directory):
   - `claude-ai.ts`: parse claude.ai export. Input is the parsed JSON of conversations.json from the ZIP.
     Schema: array of `{ uuid, name, created_at, updated_at, chat_messages: [{ uuid, sender, text, created_at }] }`.
     Map sender 'human' → 'user', 'assistant' → 'assistant'. Return `ImportedConversation[]`.
   - `chatgpt.ts`: parse ChatGPT export. Input is conversations.json array.
     Schema: `{ id, title, create_time, mapping: { [nodeId]: { message: { author: { role }, content: { parts: string[] } } } } }`.
     Walk the mapping tree (nodes with parent null are roots), reconstruct message order, concatenate content parts.
     Return `ImportedConversation[]`.
   - `generic-json.ts`: fallback. Accepts array of `{ role, content }` objects or array of conversation objects.
     Best-effort parse — if it looks like messages, import it.
   - `index.ts`: `detectFormat(filename: string, content: unknown): ImportFormat` — infer format from filename
     ('conversations.json' in a ZIP → claude_ai_export if it has uuid+chat_messages shape, chatgpt if it has mapping shape).
     `runAdapter(format: ImportFormat, content: unknown): ImportedConversation[]` — dispatch to correct adapter.

4. **ZIP Handler** — app/lib/import/zip-handler.ts (new file):
   - Use Node's built-in `zlib` + manual ZIP parsing OR install `jszip` (check package.json first — if not present, add jszip@3).
   - `extractConversationsJson(buffer: Buffer): unknown` — opens ZIP, finds conversations.json, returns parsed JSON.
   - Handles both: direct JSON file (claude.ai sometimes exports bare JSON) and ZIP containing conversations.json.

5. **Import Pipeline** — app/lib/import/pipeline.ts (new file):
   - `runImport(sourceId: string, conversations: ImportedConversation[], db: Database): ImportProgress`
   - For each conversation:
     - Check `imported_conversations` for (sourceId, external_id) — skip if already exists (dedup)
     - Chunk the conversation: join messages as `${role}: ${content}\n` blocks, split at 600-token boundaries
       (reuse the chunking logic from `app/lib/ghost/ingest/chunker.ts` — import and call it, don't duplicate)
     - Embed each chunk using `embedText()` from `app/lib/embeddings/model` (dynamic import, same pattern as ghost ingest)
     - Write chunks to content_chunks with source_type='imported_conversation', imported_source_id=sourceId,
       metadata JSON containing: `{ source_platform, conversation_id: external_id, conversation_title, message_count }`
     - Insert row into imported_conversations
   - Update imported_sources: increment conversation_count, chunk_count, set last_synced_at
   - Return running ImportProgress (update in place so API can poll it)
   - Dedup is at conversation level via UNIQUE index — individual chunk dedup is not needed (if conversation is new, all its chunks are new)

6. **Import API Routes** — app/api/import/ (new directory):
   - `POST /api/import/upload` — accepts multipart form data with a file field.
     Read file buffer, detect format (zip or json), run adapter, kick off pipeline in background (fire-and-forget),
     return `{ sourceId: string, conversationCount: number }` immediately.
     Store progress in a module-level Map keyed by sourceId.
   - `GET /api/import/progress/[sourceId]` — returns current ImportProgress from the module-level Map.
   - `GET /api/import/sources` — returns all rows from imported_sources, most recent first.
   - `DELETE /api/import/sources/[sourceId]` — deletes source + cascade delete all its imported_conversations and content_chunks (WHERE imported_source_id = sourceId). Update vec_index accordingly (delete by rowid).

7. **Import Panel UI** — app/components/settings/ImportSection.tsx (new file):
   - Drag-and-drop zone: accepts .json and .zip files. Uses HTML5 drag events + input[type=file] fallback.
     Drop zone copy: "Drop your claude.ai export or ChatGPT export here" with sub-copy "Supports: claude.ai ZIP, ChatGPT JSON, generic conversation JSON".
   - On file drop/select: POST to /api/import/upload, get sourceId back, start polling /api/import/progress/[sourceId] every 2s.
   - Progress indicator: show "Processing... 42 / 156 conversations" during import, "✓ 156 conversations indexed (2,847 chunks)" on complete.
   - Memory Sources list below drop zone: fetches /api/import/sources on mount.
     Each row: display_name, conversation_count, chunk_count, last_synced_at (relative time), delete button (with confirmation).
   - Wire into SettingsPanel.tsx under Memory section (or create Memory section if none exists).
     Tab label: "Memory" or add to existing import/recall section.

8. **Shimmer Provenance — platform badges** — app/lib/memory/shimmer-query.ts + ShimmerOverlay.tsx:
   - `ShimmerMatch` type gains optional `source_platform?: string` field.
   - In shimmer-query.ts server route: when querying content_chunks, JOIN or subquery imported_conversations
     to pull source_platform from metadata JSON. Parse metadata JSON: `JSON.parse(row.metadata ?? '{}').source_platform`.
   - In ShimmerOverlay / MemoryCard: if match.source_platform is present, render a small badge next to the match:
     'claude_ai' → "Claude" badge (cyan), 'chatgpt' → "ChatGPT" badge (green), else omit badge.
   - Badges should be subtle — same size as existing source badge pill, just color + label differs.

9. **Voice Copy** — app/lib/voice/copy-templates.ts:
   - Add `IMPORT` export with strings for: drop zone heading, drop zone subtext, processing in-progress,
     complete (with counts), error, delete confirmation, empty sources state, platform badge labels (Claude, ChatGPT, Other).
   - No hardcoded user-facing strings in any new component.

10. **TypeScript Gate** — zero new errors:
    - `npx tsc --noEmit` from D:\Projects\GregLite\app — must show 0 new errors.
    - Run full test suite: `pnpm test:run` — 1667/1667 (or higher with new tests) must pass.
    - Write at least 15 tests in `app/lib/import/__tests__/sprint33.test.ts` covering:
      adapter parsing (claude_ai, chatgpt, generic), dedup logic (same external_id not re-imported),
      format detection, ZIP extraction (mock the buffer), ImportProgress shape.
    - Sync, commit, and push: update STATUS.md (Last Updated, test count, sprint entry) first, then git.

CRITICAL CONSTRAINTS:
- Schema changes via ALTER TABLE in runMigrations() with try/catch — NEVER via prisma or separate migration files.
  This codebase uses raw better-sqlite3 with idempotent schema.sql + runtime ALTER TABLE. Do not introduce any new pattern.
- Pipeline runs ASYNC / fire-and-forget from the API route. Never block the HTTP response waiting for import to complete.
  Large exports (10k+ conversations) can take minutes. Progress polling is how the UI tracks it.
- embedText() is a dynamic import — `const { embedText } = await import('@/lib/embeddings/model')`.
  Same pattern as ghost/ingest/embedder.ts. Do not static-import the embedding model.
- content_chunks source_type for imported content: 'imported_conversation' — check if the existing
  CHECK constraint on source_type needs updating. If it does, remove the constraint (SQLite can't ALTER constraints)
  or use application-level validation. Prefer removing the constraint for extensibility.
- All new API routes use the project's existing safeHandler or NextResponse.json pattern — check existing routes
  for the pattern before writing new ones.
- cmd shell (not PowerShell). Full git path: D:\Program Files\Git\cmd\git.exe. Commit messages via temp file.
- Additive only — touch zero existing import paths (ghost ingest, shimmer core logic, etc.).

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell) with `cd /d D:\Projects\GregLite\app`
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to COMMIT_MSG_TEMP.txt, then `git commit -F COMMIT_MSG_TEMP.txt`.


═══════════════════════════════════════════════════════════════
SPRINT 34.0 — Watchfolder + Ongoing Sync + Reminder
Run after Sprint 33.0. Sprint 33.0 import pipeline must be complete.
Makes memory sync automatic — one click in claude.ai, everything else is hands-free.
═══════════════════════════════════════════════════════════════

Execute Sprint 34.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\GregLite\docs\CONVERSATION_IMPORT_SPEC.md
  Filesystem:read_file D:\Projects\GregLite\docs\EPIC81_COWORK_PROMPTS.md
  Filesystem:read_file D:\Projects\GregLite\app\lib\import\pipeline.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\ghost\watcher-bridge.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\settings-store.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\StatusBar.tsx
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts

Summary: Sprint 33.0 built the import pipeline and the one-time historical import UI.
This sprint makes ongoing sync automatic. GregLite watches a folder on disk; when the
user drops a new claude.ai export there (or their browser auto-downloads it there),
GregLite picks it up automatically, deduplicates, and indexes only the new conversations.
A StatusBar indicator tracks days since last sync and provides a one-click link to
claude.ai's export page when the user is overdue. After this sprint, the only human
step for ongoing memory sync is clicking "Export" in claude.ai — everything else is
hands-free.

Tasks:

1. **Watchfolder Config** — app/lib/import/watchfolder-config.ts (new file):
   - `DEFAULT_WATCHFOLDER`: platform-aware default path.
     Windows: `path.join(os.homedir(), 'GregLite', 'imports')` → resolves to `C:\Users\{user}\GregLite\imports`.
     macOS/Linux: `path.join(os.homedir(), 'GregLite', 'imports')`.
   - `PROCESSED_SUBDIR`: `path.join(watchfolderPath, 'processed')` — completed files moved here.
   - `SUPPORTED_EXTENSIONS`: `['.json', '.zip']`
   - `getSetting('watchfolder_path')` / `setSetting('watchfolder_path', path)` — reads/writes from KERNL settings-store.
   - `getWatchfolderPath(): Promise<string>` — returns configured path or default.
   - `ensureWatchfolderExists(folderPath: string): void` — `fs.mkdirSync(folderPath, { recursive: true })` + mkdirSync the processed subdir too.

2. **Watchfolder Watcher** — app/lib/import/watchfolder.ts (new file):
   - Use Tauri's `fs.watch()` API for the Tauri runtime, with a Node.js `fs.watch()` fallback for dev/test.
     Check `typeof window !== 'undefined' && window.__TAURI_INTERNALS__` to detect Tauri context.
   - `startWatchfolder(onFile: (filePath: string) => void): Promise<() => void>`:
     - Ensure the watchfolder directory exists (call ensureWatchfolderExists).
     - Watch for new files (create events only — ignore modify/delete).
     - Filter: only SUPPORTED_EXTENSIONS pass through.
     - On new file detected: 500ms debounce (file may still be writing), then call onFile(absolutePath).
     - Return an unsubscribe/stop function.
   - `stopWatchfolder()`: calls the unsubscribe function from startWatchfolder.
   - `moveToProcessed(filePath: string): void`: moves file to the `processed/` subdir using `fs.renameSync`.
     If rename fails (cross-device), fall back to copy + delete.
   - Dev mode (no Tauri): Node.js fs.watch() works fine — same behavior, slightly different event names.

3. **Auto-Ingest Handler** — app/lib/import/auto-ingest.ts (new file):
   - `handleWatchfolderFile(filePath: string): Promise<void>`:
     - Read file buffer.
     - Detect format (ZIP or JSON) based on extension + magic bytes (ZIP starts with PK\x03\x04).
     - Run the appropriate adapter (reuse runAdapter() from Sprint 33.0 adapters/index.ts).
     - Create a new imported_sources row with display_name = `${filename} (auto-imported ${date})`.
     - Call runImport() from pipeline.ts with the parsed conversations.
     - On completion: call moveToProcessed(filePath).
     - On error: log to console.error + write to KERNL decisions table as a warning entry. Do NOT move file — leave it in place so user can retry manually.
     - Emit a Tauri notification (best-effort, wrapped in try/catch) on success:
       title "Memory updated", body "N new conversations indexed from {filename}".
       Outside Tauri, console.log the message instead.
   - `startAutoIngest(): Promise<void>`: calls startWatchfolder(handleWatchfolderFile). Stores unsubscribe fn.
   - `stopAutoIngest(): void`: calls the stored unsubscribe fn.

4. **Sync Reminder Logic** — app/lib/import/sync-reminder.ts (new file):
   - `DEFAULT_REMINDER_DAYS = 14` — configurable via KERNL settings ('import_reminder_days').
   - `getLastSyncedAt(): Promise<number | null>`: queries imported_sources for MAX(last_synced_at).
   - `getDaysSinceSync(): Promise<number | null>`: returns null if no imports ever (no reminder needed — user hasn't set up import yet), else days since MAX(last_synced_at).
   - `shouldShowReminder(): Promise<boolean>`: returns true if daysSinceSync >= reminderDays.
   - `getSyncReminderUrl(): string`: returns `'https://claude.ai/settings'` (Settings → Export data is where the export button lives on claude.ai).
   - No persistent "dismissed" state — reminder resets automatically when a new file is processed (last_synced_at updates).

5. **Lifecycle Integration** — app/lib/import/index.ts (update or create barrel):
   - Export: startAutoIngest, stopAutoIngest, handleWatchfolderFile, getWatchfolderPath.
   - Wire startAutoIngest() into Ghost lifecycle startup (app/lib/ghost/lifecycle.ts Step 7 or after).
     If Ghost is disabled, auto-ingest should still run — it's independent. Add a separate bootstrap step
     in app/lib/bootstrap/index.ts after the existing steps. Wrap in try/catch — failure is non-fatal.
   - Wire stopAutoIngest() into Ghost lifecycle shutdown (or app/page.tsx beforeunload alongside existing cleanup).

6. **StatusBar Sync Indicator** — app/components/ui/StatusBar.tsx:
   - Add a new StatusBar chip: "MEMORY" (or reuse existing if one exists — check StatusBar first).
   - The chip polls /api/import/sync-status every 5 minutes (not on every render).
   - States:
     - No imports ever: chip hidden (don't nag before user has set up import).
     - Synced recently (< reminderDays): "MEM: 3d ago" in muted green.
     - Overdue (>= reminderDays): "MEM: 14d ago" in amber, clickable.
     - Click when overdue: opens claude.ai settings page in the embedded WebView (use the greglite:web-navigate event)
       OR dispatch a greglite:open-settings event to open ImportSection. Prefer opening the import settings panel.
   - Tooltip: "Memory last synced {N} days ago — click to sync" when overdue, "Memory synced {N} days ago" when current.

7. **Sync Status API Route** — app/api/import/sync-status/route.ts (new file):
   - `GET /api/import/sync-status`: returns `{ daysSinceSync: number | null, shouldShowReminder: boolean, reminderUrl: string }`.
   - Calls getDaysSinceSync() and shouldShowReminder() from sync-reminder.ts.

8. **Watchfolder Settings UI** — app/components/settings/ImportSection.tsx (extend from Sprint 33.0):
   - Add a "Auto-Sync" subsection below the Memory Sources list.
   - Show: current watchfolder path (read from /api/import/watchfolder-config), an "Open folder" button
     (dispatches Tauri shell:open or logs path in dev), and a reminder interval selector (7 / 14 / 30 days).
   - "How to auto-sync" instructional copy: "Set your browser to auto-download exports to this folder.
     Then just click Export in claude.ai — GregLite handles the rest."
   - Link: "Export your claude.ai history →" that opens claude.ai/settings in WebView or new browser tab.

9. **Watchfolder Config API Route** — app/api/import/watchfolder-config/route.ts (new file):
   - `GET`: returns `{ path: string, processingPath: string, reminderDays: number }`.
   - `POST`: accepts `{ path?: string, reminderDays?: number }`, updates KERNL settings accordingly.

10. **Voice Copy** — app/lib/voice/copy-templates.ts:
    - Extend existing `IMPORT` export with new strings for: auto-sync section heading, watchfolder path label,
      "open folder" button, how-to-sync instructional copy, sync link text, reminder chip states
      (recent, overdue), reminder interval options.

11. **TypeScript Gate** — zero new errors:
    - `npx tsc --noEmit` from D:\Projects\GregLite\app — must show 0 new errors.
    - `pnpm test:run` — all prior tests pass plus new ones.
    - Write at least 12 tests in `app/lib/import/__tests__/sprint34.test.ts` covering:
      watchfolder path config (default + custom), moveToProcessed (rename + fallback copy),
      sync-reminder getDaysSinceSync (null when no imports, correct days when synced),
      shouldShowReminder (threshold boundary: 13 days → false, 14 days → true, 15 days → true).
    - Sync, commit, and push: STATUS.md first (Last Updated, test count, sprint 34.0 entry), then git.

CRITICAL CONSTRAINTS:
- Watchfolder watcher must be non-blocking. startAutoIngest() should return quickly — the actual
  filesystem watch runs in the background. App boot must not stall waiting for watchfolder.
- File processing is fire-and-forget. handleWatchfolderFile() is called by the watcher callback;
  it must not throw unhandled rejections. All errors caught internally.
- The processed/ subdir must exist before any moveToProcessed() call. ensureWatchfolderExists() creates it.
- Auto-ingest is additive to Sprint 33.0 — the manual drag-and-drop import from Sprint 33.0 continues to
  work unchanged. Auto-ingest is a separate entry point to the same pipeline.
- StatusBar chip polling: use setInterval with .unref() equivalent — do not prevent app shutdown.
  5-minute poll interval. Don't poll on every React render. Use a useEffect with cleanup.
- Ghost lifecycle dependency: if Ghost is disabled or failed to start, auto-ingest should still
  initialize. These are independent systems. Add auto-ingest to bootstrap/index.ts independently.
- cmd shell (not PowerShell). Full git path: D:\Program Files\Git\cmd\git.exe. Commit via temp file.
- All new code is ADDITIVE. Touch zero existing Sprint 33.0 code paths — only extend/wire.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell) with `cd /d D:\Projects\GregLite\app`
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to COMMIT_MSG_TEMP.txt, then `git commit -F COMMIT_MSG_TEMP.txt`.

═══════════════════════════════════════════════════════════════
SPRINT 35.0 — Additional Adapters + EPIC-81 Certification
Run after Sprint 34.0. Both prior sprints must be complete and green.
Closes the epic: ChatGPT adapter hardened, any remaining formats added, full integration certified.
═══════════════════════════════════════════════════════════════

Execute Sprint 35.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\GregLite\docs\CONVERSATION_IMPORT_SPEC.md
  Filesystem:read_file D:\Projects\GregLite\docs\EPIC81_COWORK_PROMPTS.md
  Filesystem:read_file D:\Projects\GregLite\app\lib\import\adapters\index.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\import\pipeline.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\import\watchfolder.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\import\sync-reminder.ts
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\FEATURE_BACKLOG.md

Summary: Sprint 33.0 built the pipeline and claude.ai + ChatGPT adapters. Sprint 34.0
added watchfolder auto-sync and the StatusBar reminder. This final sprint hardens everything:
adds a markdown/plain-text adapter for raw conversation dumps, adds a Gemini Takeout adapter
(documented format), runs a full integration test suite covering the end-to-end flow, and
certifies EPIC-81 complete. After certification, cross-platform conversation memory is a
first-class GregLite feature.

Tasks:

1. **Markdown Adapter** — app/lib/import/adapters/markdown.ts (new file):
   - Parses plain-text or markdown conversation dumps. Common formats:
     a) Lines alternating "You: " / "Claude: " or "User: " / "Assistant: "
     b) Markdown headers `## You` / `## Claude` with content blocks
     c) Raw text treated as a single "document" chunk (no role structure)
   - Detect which format by scanning first 20 lines.
   - For role-structured formats: extract role + content pairs → ImportedMessage[].
   - For raw text: create a single ImportedConversation with one message of role 'user' and the full text as content.
     (This allows importing research notes, pasted conversations, etc.)
   - external_id: SHA-256 hash of first 200 chars of content (deterministic, enables dedup on re-import).
   - source_platform: 'markdown_import'.

2. **Gemini Takeout Adapter** — app/lib/import/adapters/gemini.ts (new file):
   - Google Takeout exports Gemini conversations as JSON inside a ZIP (Takeout/Gemini/MyActivity.json or similar).
   - Format (as of 2025 Takeout): array of `{ title, conversations: [{ id, createTime, messages: [{ author: 'user'|'model', content: string }] }] }`.
   - If the format has changed or is unrecognized, return empty array with a console.warn — never throw.
   - source_platform: 'gemini'.
   - Register in adapters/index.ts: detect by filename containing 'Gemini' or 'MyActivity' AND JSON structure matching.

3. **Adapter Registry Hardening** — app/lib/import/adapters/index.ts (update):
   - `detectFormat()` should now handle: chatgpt export filename ('conversations.json' with mapping shape),
     claude.ai export (ZIP with conversations.json having uuid+chat_messages shape OR bare JSON of same shape),
     Gemini Takeout (filename heuristic + structure check), markdown (.md extension or .txt),
     generic JSON fallback (anything else that's an array).
   - Add confidence scores to detection: if two adapters could match, pick the one with higher confidence.
   - Log the detected format to console.debug before running the adapter (aids debugging import failures).
   - `runAdapter()` wraps each adapter in try/catch: if adapter throws, return empty array + log the error.
     Never let an adapter failure crash the import pipeline.

4. **Integration Test Suite** — app/lib/import/__tests__/epic81-integration.test.ts (new file):
   - Minimum 25 tests covering the full end-to-end import flow:
     a) claude.ai adapter: parse sample fixture (10 conversations, 3-5 messages each) → correct ImportedConversation[]
     b) chatgpt adapter: parse sample fixture with mapping structure → correct ImportedConversation[]
     c) markdown adapter: role-structured format → correct messages; raw text → single message
     d) gemini adapter: parse sample fixture → correct ImportedConversation[]
     e) Dedup: running pipeline twice with same data → second run inserts 0 new conversations
     f) Dedup: running pipeline with 5 new + 5 existing → inserts exactly 5
     g) format detection: ZIP with claude.ai shape → 'claude_ai_export'; JSON with mapping → 'chatgpt_export'
     h) sync-reminder: 0 days → no reminder; 14 days → reminder; no imports ever → no reminder
     i) watchfolder: SUPPORTED_EXTENSIONS filter (rejects .pdf, .docx; accepts .json, .zip)
     j) moveToProcessed: file exists in processed/ after move; original path no longer exists
     k) Pipeline ImportProgress: status transitions running → complete; skipped count correct on dedup
     l) content_chunks: after import, chunks have correct source_type='imported_conversation' and imported_source_id
     m) Shimmer provenance: ShimmerMatch for imported chunk has source_platform populated from metadata JSON
   - Use in-memory SQLite (`:memory:`) for all DB tests — no disk writes, no teardown needed.
   - Mock embedText() to return a fixed Float32Array(384) — don't run real embeddings in tests.

5. **Import Health in Inspector** — app/components/inspector/MemoryTab.tsx (extend):
   - If MemoryTab exists (it was created in Sprint 18.0 for Shimmer stats) — add an "Import Sources" section.
   - Show: count of imported sources, total conversations, total chunks, last synced (relative time).
   - If no imports yet: show "No conversation history imported yet" with a link to open ImportSection in Settings.
   - Data from /api/import/sources (already exists from Sprint 33.0).
   - Limit to a compact 3-4 line summary — this is an inspector tab, not a full dashboard.

6. **EPIC-81 Certification** — STATUS.md + FEATURE_BACKLOG.md:
   - STATUS.md: update Last Updated, test count, add Sprint 33.0/34.0/35.0 entries in the sprint history format
     matching existing entries (same level of detail: deliverable, files changed, gate results).
   - FEATURE_BACKLOG.md: mark EPIC-81 all three sprints ✅ SHIPPED with their commit hashes.
   - Write EPIC81_COMPLETE.md in D:\Projects\GregLite\docs\ — same format as SPRINT_*_COMPLETE.md files
     used in Phase 6-8. Should include: what shipped, performance measurements (import time for 100 convos,
     dedup verification), any key discoveries, and a "Memory coverage" note (GregLite now has access to
     all prior AI conversation history from any supported platform).

7. **TypeScript Gate** — zero new errors:
   - `npx tsc --noEmit` — 0 new errors.
   - `pnpm test:run` — all tests pass. Count should be 1667 + all new Sprint 33/34/35 tests.
   - Sync, commit, and push: STATUS.md + FEATURE_BACKLOG.md + EPIC81_COMPLETE.md first, then git.
     Commit message: "feat: EPIC-81 complete — cross-platform conversation memory import"

CRITICAL CONSTRAINTS:
- Adapter robustness is the primary concern of this sprint. Every adapter must return an empty array
  (never throw) on unrecognized input. Import of a bad file should produce zero results and a logged
  warning — not a crash, not a 500 error.
- Gemini Takeout format is documented but changes between Google product updates. The adapter must be
  defensive: if the top-level structure doesn't match expected shape, log "Unrecognized Gemini format,
  skipping" and return []. Do not attempt heroic parsing of unexpected shapes.
- Integration tests use in-memory SQLite. Do not write to D:\Projects\GregLite\data\ or any real DB file.
  Import runMigrations() and call it on the in-memory DB before tests.
- Inspector MemoryTab extension is ADDITIVE. Do not modify existing Shimmer stats display — only append
  the Import Sources section below it.
- EPIC81_COMPLETE.md follows the existing SPRINT_*_COMPLETE.md format exactly. Read one of the Phase 6
  COMPLETE files first to match the structure.
- cmd shell (not PowerShell). Full git path: D:\Program Files\Git\cmd\git.exe. Commit via temp file.
- Final commit must be tagged: `git tag epic-81-complete` after push.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell) with `cd /d D:\Projects\GregLite\app`
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to COMMIT_MSG_TEMP.txt, then `git commit -F COMMIT_MSG_TEMP.txt`. After push: `D:\Program Files\Git\cmd\git.exe tag epic-81-complete && D:\Program Files\Git\cmd\git.exe push origin epic-81-complete`.

---
# END OF EPIC-81 COWORK PROMPTS
# Sprint sequence: 33.0 → 34.0 → 35.0 (strictly sequential — each depends on the prior)
# Estimated sessions: 1 per sprint (1-2 hours each)
# Spec: D:\Projects\GregLite\docs\CONVERSATION_IMPORT_SPEC.md
# Backlog entry: D:\Projects\GregLite\FEATURE_BACKLOG.md (EPIC-81)
