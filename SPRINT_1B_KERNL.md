# SPRINT 1B — KERNL Native Module
## GregLite Phase 1 | Session 2 of 5 (Sequential)
**Status:** READY TO QUEUE (after 1A gates pass)  
**Depends on:** Sprint 1A complete  
**Blocks:** Sprint 1C, all Phase 2 sprints

---

## OBJECTIVE

Build the KERNL persistence layer as a native TypeScript module backed by SQLite. This is the memory system — every session, decision, and workstream survives process death. No MCP overhead, no separate process, direct function calls only.

**Success criteria:**
- KERNL module initializes on app boot, creates DB if not exists
- Sessions written on creation, updated on message
- Decisions extracted and stored with project context
- Active workstreams readable at bootstrap
- Module survives app restart with data intact
- All KERNL tables from BLUEPRINT_FINAL.md §3.1 exist and are queryable

---

## NEW FILES TO CREATE

```
app/lib/kernl/
  index.ts           — public API (init, session, decisions, workstreams)
  database.ts        — SQLite connection + WAL mode + schema bootstrap
  schema.sql         — all tables from §3.1 (threads, messages, decisions, projects, manifests, patterns, suggestions, aegis_signals)
  session-manager.ts — create/update/end sessions
  decision-store.ts  — write and query decisions
  workstream.ts      — active project workstreams
  types.ts           — KERNLSession, KERNLDecision, KERNLWorkstream interfaces
```

---

## SCHEMA

Pull directly from BLUEPRINT_FINAL.md §3.1. Key tables for Phase 1:

```sql
CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  type TEXT CHECK(type IN ('strategic','worker','research','council','background','self_evolution')),
  status TEXT CHECK(status IN ('active','suspended','completed','failed')),
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL,
  context_hash TEXT,
  checkpoint_path TEXT,
  session_summary TEXT,
  decisions_extracted INTEGER DEFAULT 0
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  embedding BLOB,
  timestamp INTEGER NOT NULL,
  tokens INTEGER,
  FOREIGN KEY(thread_id) REFERENCES threads(id)
);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  alternatives TEXT,
  timestamp INTEGER NOT NULL,
  project_id TEXT,
  FOREIGN KEY(thread_id) REFERENCES threads(id)
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT,
  context_summary TEXT,
  last_active INTEGER,
  active_threads TEXT
);

CREATE TABLE manifests (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL DEFAULT '1.0',
  spawned_by_thread TEXT NOT NULL,
  strategic_thread_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending','running','complete','partial','failed')),
  task_type TEXT,
  title TEXT,
  description TEXT,
  project_path TEXT,
  dependencies TEXT,
  quality_gates TEXT,
  is_self_evolution INTEGER DEFAULT 0,
  self_evolution_branch TEXT,
  result_report TEXT,
  tokens_used INTEGER,
  cost_usd REAL,
  FOREIGN KEY(spawned_by_thread) REFERENCES threads(id)
);

CREATE TABLE patterns (
  id TEXT PRIMARY KEY,
  pattern_type TEXT,
  description TEXT,
  source_threads TEXT,
  first_seen INTEGER,
  last_seen INTEGER,
  occurrence_count INTEGER DEFAULT 1,
  weight REAL DEFAULT 1.0
);

CREATE TABLE aegis_signals (
  id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  source_thread TEXT,
  sent_at INTEGER NOT NULL,
  is_override INTEGER DEFAULT 0
);
```

Storage path: `%APPDATA%\greglite\kernl.db` (Windows). Use `app.getPath('userData')` from Tauri or fallback to `process.env.APPDATA`.

---

## PUBLIC API

```typescript
// app/lib/kernl/index.ts
export interface KERNLModule {
  init(): Promise<void>;
  
  // Sessions
  createSession(projectId?: string): Promise<string>; // returns threadId
  updateSession(threadId: string, summary?: string): Promise<void>;
  endSession(threadId: string, summary: string): Promise<void>;
  getActiveSession(): Promise<string | null>; // returns threadId or null
  
  // Messages
  appendMessage(threadId: string, role: 'user' | 'assistant', content: string, tokens?: number): Promise<string>;
  
  // Decisions
  writeDecision(threadId: string, decision: string, rationale?: string, projectId?: string): Promise<void>;
  getRecentDecisions(limit?: number): Promise<KERNLDecision[]>;
  
  // Workstreams
  upsertProject(id: string, name: string, path?: string): Promise<void>;
  getActiveProjects(): Promise<KERNLProject[]>;
  
  // Bootstrap
  getBootstrapContext(): Promise<KERNLBootstrapContext>;
}

export interface KERNLBootstrapContext {
  activeSession: string | null;
  recentDecisions: KERNLDecision[];
  activeProjects: KERNLProject[];
  lastSessionSummary: string | null;
}
```

---

## INTEGRATION POINT

After KERNL module is built, wire it into the chat route (1A) so every message gets persisted:

```typescript
// In chat route, after getting response:
const threadId = await kernl.getActiveSession() ?? await kernl.createSession();
await kernl.appendMessage(threadId, 'user', body.message);
await kernl.appendMessage(threadId, 'assistant', content, totalTokens);
```

---

## GATES

- [ ] `app/lib/kernl/index.ts` exports all methods
- [ ] DB created at userData path on first run
- [ ] All §3.1 tables present after init
- [ ] WAL mode enabled (PRAGMA journal_mode=WAL)
- [ ] Messages persist across pnpm dev restarts
- [ ] pnpm type-check clean
- [ ] Commit: `sprint-1b: KERNL native module, SQLite persistence`
