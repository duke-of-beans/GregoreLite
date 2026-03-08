# Conversation Import & Cross-Platform Memory Spec
**Status:** Design — pre-sprint
**Author:** David Kirsch / Claude synthesis
**Date:** March 2026
**Relates to:** `lib/kernl/`, `lib/memory/`, `lib/vector/`, `content_chunks`, Transit Map

---

## Problem Statement

GregLite's memory system (Shimmer, Ghost, cross-context retrieval) only knows
about conversations that happened inside GregLite. Every Claude Desktop session,
every claude.ai conversation, every ChatGPT exchange — none of it exists to Greg.

This is a significant blind spot. The most valuable context is often in older
conversations: architecture decisions made six months ago, research threads from
Claude Desktop, brainstorming sessions that informed current projects. GregLite
currently has no access to any of it.

This spec defines how to fix that — in a way that's honest about what each
platform allows, maximally useful within those constraints, and extensible to
any future provider.

---

## The Three Approaches (and when each applies)

### Approach A — File Import (works everywhere, always)

Every AI platform that has ever existed allows you to export your conversations.
The formats differ, but the data is there.

| Platform | Export format | How to get it |
|----------|--------------|---------------|
| Claude.ai | JSON (via Settings → Export data) | Manual download |
| Claude Desktop | SQLite DB or JSON (local app data) | Direct file access |
| ChatGPT | JSON (via Settings → Data Controls → Export) | Manual download |
| Gemini | Google Takeout → JSON | Manual download |
| Cursor / Copilot | Varies — some have export, some don't | Check per-version |

**Mechanism:** User exports from the source platform, drops the file(s) into a
GregLite import folder (or drags into the import panel). GregLite parses the
format, normalizes to its internal schema, chunks and embeds the content,
and indexes it into `content_chunks` with `source_type = 'imported_conversation'`.

From that point forward, Shimmer, Ghost, and cross-context retrieval work against
imported conversations exactly as they do against native GregLite conversations.

**This is the right default for almost every case.** It works offline, requires
no API keys for the source platform, has no ongoing cost, and gives you the full
conversation text.

---

### Approach B — API Sync (where available, for ongoing freshness)

Some platforms expose APIs that allow programmatic access to conversation history.
This enables ongoing sync — new conversations automatically appear in GregLite's
memory without manual export.

| Platform | API availability | Notes |
|----------|-----------------|-------|
| Claude.ai | ❌ No conversation history API | Anthropic does not expose this |
| Claude Desktop | ✅ Local SQLite — direct read | Same machine, no API needed |
| ChatGPT | ❌ No conversation history API | OpenAI does not expose this publicly |
| Gemini | ❌ No conversation history API | Google does not expose this |
| Notion AI | ✅ Notion API includes AI content | If conversations are stored in pages |
| Custom deployments | ✅ If you own the API | Enterprise self-hosted models |

**Reality check:** The major consumer AI platforms (Claude, ChatGPT, Gemini)
do NOT provide conversation history APIs. This is intentional — they treat
conversation history as platform-retained data, not user-accessible data via API.

For Claude Desktop specifically: the app stores conversations locally in a SQLite
database on the same machine. GregLite can read this directly with the user's
permission — no API required, no export step. This is the highest-value integration.

---

### Approach C — Browser Extraction (Claude Desktop / claude.ai)

Since Claude Desktop is a local Electron app and claude.ai is a web app, there
are paths to extract conversations programmatically without a formal API:

**Claude Desktop:** Locate the local SQLite database (known path on Windows/Mac),
read it directly. This is reliable, fast, and gives the complete conversation
history with full fidelity.

**claude.ai:** The browser's IndexedDB or localStorage MAY contain cached
conversation data. This is fragile, undocumented, and subject to change. Not
recommended as a primary path. However, a browser extension (GregLite already
has Claude in Chrome via KERNL) could intercept conversation data at the API
response level — everything claude.ai receives from Anthropic's servers passes
through the browser and is readable by an extension with appropriate permissions.

---

## Recommended Architecture

### Priority 1: claude.ai Full Export (One-Time Historical Corpus)

**Discovery finding (March 2026):** Claude Desktop is an Electron wrapper around
claude.ai. Its local storage is Chromium IndexedDB (LevelDB binary format) at
`%APPDATA%\Claude\IndexedDB\https_claude.ai_0.indexeddb.leveldb\`. This means:

1. Claude Desktop conversations ARE claude.ai conversations — same account, same
   backend. There is no separate dataset. Desktop and web are the same history.
2. LevelDB is not trivially readable — it requires a Chromium IndexedDB parser
   and is fragile across app updates. Not a viable direct-read path.

**The right approach:** Export from claude.ai directly. Settings → Export data
produces a JSON file containing every conversation across all surfaces (Desktop,
web, mobile) because they all share one backend. One export, complete history.

This is actually better than a Desktop-only DB read — you get everything.

**Implementation path:**
1. User exports from claude.ai (Settings → Export data → Download)
2. Drop the export file into GregLite's import panel
3. Parse the claude.ai JSON format (adapter: `claude_ai_export`)
4. Normalize, chunk, embed, index into `content_chunks`
5. Track imported conversation IDs in `imported_conversations` for deduplication

**Format:** claude.ai export is a ZIP containing a `conversations.json` with an
array of conversation objects. Each has a UUID, title, created_at, and a messages
array with role/content/timestamps. Well-structured and reliable.

---

### Priority 2: File Import Pipeline (all platforms)

**What:** A structured import UI where the user drops in exported conversation
files. GregLite detects the format, parses it with a format-specific adapter,
and indexes the content.

**Supported formats to implement:**

```typescript
type ImportFormat =
  | 'claude_ai_export'      // claude.ai JSON export
  | 'chatgpt_export'        // ChatGPT conversations.json
  | 'claude_desktop_export' // If Claude Desktop adds an export feature
  | 'generic_json'          // Fallback: array of {role, content} objects
  | 'markdown'              // Plain text / markdown conversation dumps
  | 'text'                  // Raw text — index as a document, not conversation
```

**Each adapter outputs a normalized structure:**

```typescript
interface ImportedConversation {
  external_id: string;          // Original platform's conversation ID
  source_platform: string;      // 'claude_ai' | 'chatgpt' | etc.
  title: string;
  created_at: number;           // Unix ms
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: number;
  }>;
}
```

After normalization, all imported conversations flow through the same
chunking + embedding pipeline that GregLite uses for its own conversations.
They land in `content_chunks` with appropriate source metadata and become
immediately searchable via Shimmer and cross-context retrieval.

**UI:** A dedicated "Import Memory" section in Settings → Memory (or a
standalone Import panel accessible from the command palette). Drag-and-drop
zone, progress indicator, deduplification (don't re-import conversations
already in the index), and a "Memory Sources" list showing what's been imported
and when.

---

### Priority 3: Ongoing Sync via Watchfolder + Reminder

The browser extension intercept approach was evaluated and rejected. It only
captures conversations where the extension is active in that specific browser
tab — miss a session, switch devices, or use mobile and that conversation is
permanently lost from the sync. Swiss cheese coverage with no visibility into
the gaps.

The correct mechanism is simpler and complete: periodic claude.ai export + 
automatic watchfolder ingestion.

**How it works:**

1. **Watchfolder** — GregLite watches a user-configured directory
   (default: `D:\GregLite\imports\` or `~/GregLite/imports/`). When any new
   file lands in that folder, GregLite detects it, identifies the format,
   and runs it through the import pipeline automatically. No user action
   beyond dropping the file.

2. **Browser download folder shortcut** — User configures their browser to
   auto-download claude.ai exports to the watched folder. Combined with the
   watchfolder, the only human step is clicking "Export" in claude.ai —
   GregLite handles the rest silently.

3. **Reminder notification** — GregLite tracks `last_synced_at` per source.
   After N days without a new import (default: 14 days, configurable), a
   subtle StatusBar indicator appears: "Memory last synced 14 days ago" with
   a one-click link to claude.ai's export page. Dismissed until the next
   file lands in the watchfolder, then resets the clock.

**Why this is right:**
- Complete coverage — export always contains full history across all surfaces
  (Desktop, web, mobile). No gaps from missed sessions.
- Deduplication handles re-imports — already-indexed conversations are skipped,
  only new content is processed. Re-exporting weekly costs nothing extra.
- Zero infrastructure — no extension permissions, no API intercepts, no LevelDB
  parsing. A filesystem watcher and a deduplication-aware importer.
- Works for any platform — same mechanism handles ChatGPT, Gemini, or any
  future source. Just drop the export file in the watched folder.

**Watchfolder implementation:**
- Use Tauri's `fs` watch API (already available, used by Ghost filesystem watcher)
- Watch for new `.json` and `.zip` files
- On file detected: auto-detect format → run import pipeline → notify user
  ("12 new conversations indexed from claude.ai export")
- Move processed file to `imports/processed/` to prevent re-processing on restart

---

## What About Other Models (GPT, Gemini, etc.)?

**File import covers them all.** The adapter pattern means adding a new source
is: write a parser, register it in the format registry, done. ChatGPT's export
format is well-documented JSON. Gemini's Takeout format is documented. Any
future platform with any export format can be added as an adapter.

**For API-based access:** The honest answer is that no major consumer AI platform
exposes a conversation history API today. If that changes (OpenAI has hinted at
it), adding an API sync adapter is the same pattern as the Claude Desktop direct
read — normalize to `ImportedConversation`, pass to the indexer.

**For GPT specifically:** The one realistic live-sync option would be the OpenAI
API's `/v1/threads` endpoint (from the Assistants API), but that's for
programmatically created threads, not ChatGPT.com conversations. There is no
programmatic access to chatgpt.com conversation history.

---

## Data Model Changes

### New table: `imported_sources`
Tracks what has been imported and sync state.

```sql
CREATE TABLE IF NOT EXISTS imported_sources (
  id             TEXT PRIMARY KEY,
  source_type    TEXT NOT NULL,   -- 'claude_desktop' | 'claude_ai_export' | 'chatgpt_export' | etc.
  source_path    TEXT,            -- file path or DB path
  display_name   TEXT NOT NULL,   -- "Claude Desktop" / "ChatGPT Export — Jan 2026"
  conversation_count INTEGER DEFAULT 0,
  chunk_count    INTEGER DEFAULT 0,
  last_synced_at INTEGER,
  created_at     INTEGER NOT NULL,
  meta           TEXT             -- JSON: format version, last known conversation ID, etc.
);
```

### Modified: `content_chunks`
Already has `source_type TEXT`. Extend the CHECK constraint to include import types,
or remove the constraint and rely on application-level validation (cleaner for
extensibility).

Add `imported_source_id TEXT REFERENCES imported_sources(id)` for provenance.

### New table: `imported_conversations`
Thin index of imported conversations for deduplication and the Memory Sources UI.

```sql
CREATE TABLE IF NOT EXISTS imported_conversations (
  id                  TEXT PRIMARY KEY,
  imported_source_id  TEXT NOT NULL REFERENCES imported_sources(id),
  external_id         TEXT NOT NULL,    -- original platform conversation ID
  title               TEXT,
  message_count       INTEGER DEFAULT 0,
  created_at_source   INTEGER,          -- timestamp from source platform
  imported_at         INTEGER NOT NULL,
  UNIQUE(imported_source_id, external_id)  -- prevent re-import
);
```

---

## Memory Search UX

Once imported conversations are in `content_chunks`, the existing Shimmer and
cross-context retrieval systems work against them automatically. No UI changes
needed for search.

What IS needed: provenance in search results. When Shimmer surfaces a match,
the user should know if it came from:
- A GregLite conversation (link to thread)
- Claude Desktop (show platform badge, date, conversation title)
- ChatGPT export (show platform badge, date)

The `ShimmerMatch` type gains a `source_platform` field and the UI renders
platform badges alongside memory highlights.

---

## Discovery Task (Pre-Implementation)

~~Before any code is written for Priority 1 (Claude Desktop direct read), a
discovery task is needed~~

**Discovery completed March 2026.** Claude Desktop is Electron over claude.ai.
Storage is Chromium IndexedDB (LevelDB) at `%APPDATA%\Claude\IndexedDB\https_claude.ai_0.indexeddb.leveldb\`.
Direct read is not viable. Full claude.ai export is the correct foundation.
Schema documented: claude.ai export is a ZIP → `conversations.json` array.
No further discovery needed before implementation.

---

## Sprint Plan

**Sprint X.0 — Discovery + File Import Pipeline**
- Discovery task: Claude Desktop DB schema
- `imported_sources` and `imported_conversations` tables
- Import pipeline: chunking, embedding, indexing for imported content
- Adapters: `claude_ai_export`, `chatgpt_export`, `generic_json`
- Import UI: drag-and-drop, progress, Memory Sources list
- Shimmer provenance: platform badges on memory matches

**Sprint X.1 — Claude Desktop Direct Sync**
- Claude Desktop DB reader (read-only, incremental)
- Background sync watcher (15-min poll, configurable)
- Sync status indicator in UI
- Schema mismatch handling (graceful degradation to prompt manual export)

**Sprint X.2 — Additional Adapters (as needed)**
- Additional format adapters based on actual usage
- API sync for any platforms that expose conversation history APIs

---

## Non-Goals

- Syncing GregLite conversations OUT to other platforms (write-back)
- Real-time mirroring (too fragile, not worth the complexity)
- Parsing conversation content to extract entities or structure beyond chunking
  (the vector index handles semantic search, no special parsing needed)
- Any integration that requires reverse-engineering non-public APIs or violating
  platform terms of service
