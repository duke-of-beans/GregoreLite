# GREGORE LITE — BLUEPRINT FINAL
**Version:** 1.1.0  
**Status:** LOCKED FOR EXECUTION — All Council sessions complete  
**Last Updated:** March 1, 2026 (Phase 3 complete)  
**Authority:** Council Round 2 synthesis (D:\Downloads\greglite synth.md) + seven amendments from HANDOFF.md + three Council session syntheses + identity clarification (v1.1.0)

---

## AMENDMENT LOG

All seven amendments from the Q&A session are incorporated below. This section is the change record.

| # | Subject | Impact | Location |
|---|---------|--------|----------|
| 1 | Session end is inferred, not signaled | §2.3 Session End | Session Lifecycle |
| 2 | Dev protocols load at bootstrap as first-class inputs | §2.1 Bootstrap | Session Lifecycle |
| 3 | Borrow Gregore scaffold aggressively — audit before writing | §11 Build Order | Build Order |
| 4 | Cowork replaced by Claude Agent SDK throughout | §4 Worker Sessions | Worker Sessions |
| 5 | Ghost Thread has full disk + all email access | §6 Ghost Thread | Ghost Thread |
| 6 | War Room is Phase 2; dependency fields required in Phase 1 schema | §4.1 Manifest Schema | Worker Sessions |
| 7 | Self-Evolution Mode is in scope — Phase 7 | §7 Self-Evolution | Self-Evolution |
| 8 | GregLite is single-model only — §8 renamed from Council Escalation to Decision Gate | §8 Decision Gate | System Identity + Decision Gate |
| 9 | Phase 0 scaffold: explicit take/leave list from Gregore added | §13 Build Order | Build Order |

---

## §1 — SYSTEM IDENTITY

**Name:** Gregore Lite  
**Canonical:** GregLite  
**Purpose:** Replace Claude Desktop entirely as David's primary AI interface. Purpose-built cockpit for a high-velocity solo operator. Not a wrapper — direct Claude API, native tool integration, persistent memory, autonomous execution.

**Philosophy:**
- Option B Perfection — no MVP mentality
- Foundation out — backend before surface
- Zero technical debt
- Build Intelligence, Not Plumbing
- LEAN-OUT — use existing tools, build only unique intelligence

**Relationship to Gregore (Full):**
Lite is the dogfooding vehicle. Single-user, Claude-only, David's daily driver. Full adds: Consensus multi-model engine, multi-tenant architecture, user accounts, billing, marketplace API, team KERNL. The Lite → Full delta is additive. Nothing in Lite gets rewritten.

---

## §2 — SESSION LIFECYCLE

### §2.1 Bootstrap Sequence (Amendment 2)

Every session start — whether opening Gregore Lite fresh or resuming a suspended thread — runs this bootstrap sequence before any Claude API call is made:

```
BOOTSTRAP ORDER
1. Load KERNL: active workstreams, last session summary, 
   recent decisions (last 5), unresolved blockers
2. Load dev protocols as first-class context:
   - D:\Dev\TECHNICAL_STANDARDS.md
   - D:\Dev\CLAUDE_INSTRUCTIONS.md
3. Build context injection package:
   - Current project state
   - Active jobs and their status
   - Recent architectural decisions
   - Unresolved blockers from prior session
4. Send AEGIS signal: STARTUP
5. Render UI (non-blocking — UI appears before Claude responds)
6. Send first API call to strategic thread with full context package
```

The dev protocol files are not optional reference documents. They define how every Agent SDK session working on the GregLite codebase must behave: LEAN-OUT mandate, library choices, forbidden anti-patterns (vitest/winston/zod/p-retry/BullMQ standards), authority protocol, quality gates, TDD cycle, four-pillar doc sync, and checkpointing protocol. They are injected the same way KERNL context is injected.

**DEV_PROTOCOLS.md** (in this repo) documents these files, their GregLite-specific extracts, fallback behavior if they cannot be loaded, and version tracking. Any execution session that cannot reach D:\Dev\ should consult DEV_PROTOCOLS.md before proceeding.

**Cold start target:** Under 60 seconds from app open to strategic thread interactive.

```
0-3s    Tauri shell, Rust core, SQLite connections
3-10s   AEGIS handshake (STARTUP profile)
        KERNL loads active workstreams and last session summary
        Dev protocols loaded from disk
5-20s   UI renders with thread thumbnails and context panel populated
20-45s  Context injection package built and first API call sent
45-60s  Strategic thread ready; background indexing continues
```

### §2.2 Mid-Session

- Every Claude response → checkpoint diff written to SQLite (Layer 1). Not every N turns — every response. Diff, not full dump.
- Every 5 minutes → KERNL indexes new messages, updates embeddings.
- Every significant decision (keyword detection + explicit markers) → written to KERNL decision registry with timestamp, project context, rationale, alternatives considered.
- On Agent SDK spawn → job appears in queue with manifest hash; KERNL links thread ↔ job.
- On workload change → AEGIS signal sent (max transition frequency: 5 seconds, anti-flap).

### §2.3 Session End (Amendment 1)

David never signals session end. Session end is inferred from three triggers:

**Trigger 1 — Tauri `on_window_event` (hard stop)**
Fires when the app window closes. Always fires. Highest priority. Used for clean shutdown regardless of other state.

**Trigger 2 — Idle timeout**
No user input for a configurable period. Default: 20 minutes. Configurable per session type (worker sessions may have longer idle tolerance during long-running jobs).

**Trigger 3 — Explicit thread close**
David closes a specific thread via UI action. Thread-level close, not app-level.

All three triggers feed the same end sequence:
```
END SEQUENCE
1. Final checkpoint — full thread state, conversation, artifacts
2. Decision extraction — dedicated Claude API call (separate from 
   strategic thread) to extract decisions from session
3. Session summary — written to KERNL
4. Blockers persisted — unresolved issues stored with thread metadata  
5. Cross-context trigger — pattern detection runs async
6. AEGIS signal — SUSPEND or LOW_POWER based on whether other 
   threads are still active
```

The decision extraction call is separate from the strategic thread conversation to avoid polluting the conversation history with administrative summaries.

---

## §3 — ARCHITECTURE: FIVE LAYERS

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5 — PRESENTATION (Tauri + Next.js + React)           │
│  Cockpit UI. Thread tabs. Job queue panel. Context panel.   │
│  Monaco Editor. Sandpack. Markdown renderer.                │
│  Command palette (Cmd+K). Owns: what David sees.            │
├─────────────────────────────────────────────────────────────┤
│  LAYER 4 — ORCHESTRATION (TypeScript)                       │
│  Session manager. Thread router. Council trigger.           │
│  Agent SDK dispatcher. Manifest generator.                  │
│  AEGIS signaler. Job queue manager.                         │
│  Owns: what happens when, and who does it.                  │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3 — INTELLIGENCE (TypeScript modules)                │
│  KERNL (memory). Cross-context engine. Pattern detector.    │
│  SHIM (quality). Eye of Sauron (deep scan).                 │
│  Context injector. Manifest validator.                      │
│  Owns: what is known and what it means.                     │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2 — EXECUTION (TypeScript + Rust bindings)           │
│  Claude API client (streaming, multi-thread).               │
│  Agent SDK interface. AEGIS API client.                     │
│  Oktyv (browser automation).                                │
│  Owns: talking to external systems.                         │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1 — PERSISTENCE (Rust + SQLite)                      │
│  KERNL database. Vector store. Session store.               │
│  Conversation archive. Pattern index. Decision log.         │
│  Checkpoint store. Quality log.                             │
│  Owns: everything that survives a process death.            │
└─────────────────────────────────────────────────────────────┘
```

**Critical principle:** Layer 1 cannot be corrupted by a crash in any layer above it. Every write to Layer 1 is atomic. WAL mode enabled on all SQLite databases. Crash survivability is a persistence problem, not an application problem.

**Module integration:** KERNL, SHIM, Oktyv, Continuity, and AEGIS are imported as TypeScript modules. Direct function calls. Zero MCP protocol overhead. No separate processes to die.

---

## §3.1 — KERNL STORAGE SCHEMA (SQLite)

This is the Phase 1 schema. Ghost Thread fields (marked `-- GHOST`) must exist from Phase 1 even though Ghost is Phase 6. No migration pain when Ghost arrives.

```sql
-- Core thread tracking
CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  type TEXT CHECK(type IN ('strategic','worker','research','council','background','self_evolution')),
  status TEXT CHECK(status IN ('active','suspended','completed','failed')),
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL,
  context_hash TEXT,
  checkpoint_path TEXT,
  -- GHOST: needed for cross-thread pattern detection
  session_summary TEXT,
  decisions_extracted INTEGER DEFAULT 0
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  embedding BLOB,        -- vector as binary blob (sqlite-vec)
  timestamp INTEGER NOT NULL,
  tokens INTEGER,
  FOREIGN KEY(thread_id) REFERENCES threads(id)
);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  alternatives TEXT,     -- JSON array
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
  active_threads TEXT    -- JSON array of thread IDs
);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  manifest_id TEXT,
  path TEXT NOT NULL,
  type TEXT,
  content_hash TEXT,
  created_at INTEGER NOT NULL,
  project_id TEXT,
  FOREIGN KEY(thread_id) REFERENCES threads(id)
);

-- Agent SDK / worker session tracking (Amendment 4)
CREATE TABLE manifests (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL DEFAULT '1.0',
  spawned_by_thread TEXT NOT NULL,
  strategic_thread_id TEXT NOT NULL,
  created_at TEXT NOT NULL,         -- ISO timestamp
  status TEXT CHECK(status IN ('pending','running','complete','partial','failed')),
  task_type TEXT,
  title TEXT,
  description TEXT,
  project_path TEXT,
  dependencies TEXT,                -- JSON array of manifest IDs (Amendment 6)
  quality_gates TEXT,               -- JSON object
  is_self_evolution INTEGER DEFAULT 0,  -- Amendment 7: tag self-evolution sessions
  self_evolution_branch TEXT,           -- staging branch name if self-evolution
  result_report TEXT,               -- JSON result report on completion
  tokens_used INTEGER,
  cost_usd REAL,
  FOREIGN KEY(spawned_by_thread) REFERENCES threads(id)
);

-- Pattern registry for cross-context engine
CREATE TABLE patterns (
  id TEXT PRIMARY KEY,
  pattern_type TEXT,
  description TEXT,
  source_threads TEXT,   -- JSON array
  first_seen INTEGER,
  last_seen INTEGER,
  occurrence_count INTEGER DEFAULT 1,
  weight REAL DEFAULT 1.0
);

-- Suggestion tracking for threshold calibration
CREATE TABLE suggestions (
  id TEXT PRIMARY KEY,
  suggestion_type TEXT,
  similarity_score REAL,
  source_content TEXT,
  target_thread TEXT,
  surfaced_at INTEGER,
  user_action TEXT CHECK(user_action IN ('accepted','dismissed','ignored',NULL)),
  acted_at INTEGER
);

-- AEGIS signal log
CREATE TABLE aegis_signals (
  id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  source_thread TEXT,
  sent_at INTEGER NOT NULL,
  is_override INTEGER DEFAULT 0
);

-- Full-text search virtual table
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content=messages,
  content_rowid=rowid
);

-- GHOST: unified content chunks (Phase 1 schema, shared by Cross-Context + Ghost)
CREATE TABLE content_chunks (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,    -- 'conversation' | 'file' | 'email' | 'email_attachment'
  source_id TEXT NOT NULL,
  chunk_index INTEGER,
  content TEXT NOT NULL,
  metadata TEXT,                -- JSON blob
  created_at INTEGER,
  indexed_at INTEGER,
  model_id TEXT
);

-- GHOST: email accounts
CREATE TABLE email_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  email TEXT NOT NULL,
  auth_data TEXT,               -- encrypted JSON
  enabled BOOLEAN DEFAULT 1,
  last_sync INTEGER,
  sync_status TEXT
);

-- GHOST: email messages
CREATE TABLE email_messages (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES email_accounts(id),
  thread_id TEXT,
  from_address TEXT,
  to_addresses TEXT,
  subject TEXT,
  date INTEGER,
  snippet TEXT,
  has_attachments BOOLEAN,
  indexed_at INTEGER
);

-- GHOST: source tracking
CREATE TABLE ghost_sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  identifier TEXT NOT NULL,
  last_ingested INTEGER,
  is_active BOOLEAN DEFAULT 1
);

-- GHOST: exclusion rules
CREATE TABLE ghost_exclusions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  created_at INTEGER
);

-- GHOST: interrupt history
CREATE TABLE ghost_interrupt_history (
  id TEXT PRIMARY KEY,
  chunk_id TEXT REFERENCES content_chunks(id),
  score REAL,
  shown_at INTEGER,
  action TEXT CHECK(action IN ('dismissed','clicked','ignored')),
  feedback_at INTEGER
);

-- GHOST: interrupt queue
CREATE TABLE ghost_interrupt_queue (
  id TEXT PRIMARY KEY,
  chunk_id TEXT REFERENCES content_chunks(id),
  summary TEXT,
  score REAL,
  scheduled_for INTEGER,
  displayed_at INTEGER,
  expires_at INTEGER
);

-- GHOST: audit log
CREATE TABLE ghost_indexed_items (
  id TEXT PRIMARY KEY,
  chunk_id TEXT REFERENCES content_chunks(id),
  source_type TEXT,
  source_id TEXT,
  indexed_at INTEGER,
  exclusion_rule_applied TEXT
);

-- vec_index (loaded via sqlite-vec extension in Rust layer)
-- CREATE VIRTUAL TABLE vec_index USING vec0(
--   chunk_id TEXT PRIMARY KEY,
--   embedding FLOAT[384] distance_metric=cosine
-- );
```

---

## §4 — WORKER SESSIONS (CLAUDE AGENT SDK) (Amendment 4)

**Critical amendment:** All previous "Cowork Integration" references are replaced by Claude Agent SDK Integration. Cowork is a UI product with no CLI and no programmatic entry point. The Agent SDK (`@anthropic-ai/claude-agent-sdk`) is the correct tool: programmatic spawn via `query()`, working directory scoping, custom in-process MCP tools, `acceptEdits` and `bypassPermissions` permission modes.

The manifest schema is unchanged. It becomes the structured system prompt injected into each Agent SDK session.

### §4.1 Task Manifest Schema (Amendment 6: dependency fields required)

```typescript
interface TaskManifest {
  manifest_id: string;                // UUID
  version: "1.0";
  spawned_by: {
    thread_id: string;
    strategic_thread_id: string;
    timestamp: string;                // ISO
  };
  task: {
    id: string;
    type: "code" | "test" | "docs" | "research" | "deploy" | "self_evolution";
    title: string;
    description: string;
    success_criteria: string[];
  };
  context: {
    project_path: string;
    files: {
      path: string;
      purpose: "read" | "modify" | "create";
      initial_content?: string;
    }[];
    environment: {
      node_version?: string;
      python_version?: string;
      env_vars?: Record<string, string>;
    };
    // Amendment 6: required from Phase 1, not optional
    dependencies: string[];           // manifest_ids that must complete first
    dependency_graph_notes?: string;
  };
  protocol: {
    output_format: "json" | "markdown" | "code" | "mixed";
    reporting_interval: number;       // seconds
    max_duration: number;             // minutes
  };
  return_to_thread: {
    id: string;
    on_success: "report" | "commit" | "pr";
    on_failure: "retry" | "report" | "escalate";
  };
  quality_gates: {
    shim_required: boolean;
    eos_required: boolean;
    tests_required: boolean;
  };
  // Amendment 7: self-evolution tagging
  is_self_evolution: boolean;
  self_evolution_branch?: string;
}
```

### §4.2 Result Report Schema

```typescript
interface ResultReport {
  manifest_id: string;
  status: "success" | "failure" | "partial";
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  output: {
    files_created: string[];
    files_modified: string[];
    test_results?: { passed: number; failed: number; coverage?: number };
    artifacts: { name: string; path: string; type: string }[];
    logs_path: string;
  };
  quality_results: {
    shim?: { score: number; issues: any[] };
    eos?: { vulnerabilities: any[]; drifts: any[] };
  };
  tokens_used: number;
  cost_usd: number;
  errors?: { message: string; phase: string }[];
}
```

---

## §4.3 — AGENT SDK INTEGRATION (DETAIL)

All six Council members converged on the same foundational model. The Claude Agent SDK is a **co-processor**, not a chatbot. Every session is scoped, metered, auditable, killable, and reproducible.

### §4.3.1 Manifest Injection — Exact Format

The manifest is injected verbatim as JSON, wrapped in a System Contract Header. No YAML, no XML transformation.

```
You are a bounded execution worker operating inside Gregore Lite.

The following JSON is a SYSTEM CONTRACT.
It is authoritative and non-negotiable.

Rules:
- Treat all fields as binding constraints.
- Success is defined ONLY by `success_criteria`.
- If goals conflict with constraints, constraints win.
- You may not infer additional scope.
- You may only modify files explicitly listed in the manifest.

--- BEGIN SYSTEM MANIFEST (JSON) ---
{MANIFEST_JSON}
--- END SYSTEM MANIFEST ---

Execution Protocol:
- Execute deterministically.
- Do not emit chain-of-thought.
- Write files directly using provided tools.
- If blocked, stop and report precisely why.

Completion Protocol:
- Summarize changes made.
- List all modified files.
- Confirm which success criteria were met and which were not.
```

Manifest JSON is whitespace-stripped before injection to minimize context window consumption.

### §4.3.2 Streaming Results

SDK events map to KERNL state and job queue UI transitions:

| Agent SDK Event | Job Queue State | KERNL Write |
|---|---|---|
| Session spawned | `SPAWNING` | Manifest hash, session ID |
| First text delta | `RUNNING` | Timestamp |
| `tool_call` | `WORKING` | Tool name, arguments |
| `tool_result` | `WORKING` | Tool result summary, step count |
| SHIM validation | `VALIDATING` | SHIM score, issues |
| `error` (recoverable) | `BLOCKED` | Error message, tool trace |
| `error` (terminal) | `FAILED` | Full error context |
| `final` | `COMPLETED` | Result report, token usage, cost |
| App crash | `INTERRUPTED` | Last checkpoint offset |

State machine: `SPAWNING → RUNNING → WORKING → VALIDATING → COMPLETED / FAILED / INTERRUPTED`

Checkpoint written every 5 tool calls or 60 seconds to `job_state` table. On restart, any session in `running/working/validating` moves to `INTERRUPTED`. Live output is opt-in, off by default.

### §4.3.3 Permission Matrix

| Session Type | `permissionMode` | Custom Tools | CWD |
|---|---|---|---|
| **code** | `acceptEdits` | fs read/write, test runner, in-session SHIM | Project root |
| **test** | `acceptEdits` | fs read/write, test runner | Project root |
| **documentation** | `acceptEdits` | fs write (docs only), markdown linter | `/docs` |
| **research** | `readOnly` | Oktyv browser, KERNL search | Temp workspace |
| **analysis** | `readOnly` | fs read, SHIM read-only | Project root |
| **self_evolution** | `acceptEdits` | fs read/write, git, SHIM, test runner | `D:\Projects\GregLite\` (branch-locked) |

Permissions enforced at the tool layer, not via prompts. Write scope enforcement: filesystem intercept checks every write against manifest `files[].path` list. Writes outside that list are rejected and logged.

### §4.3.4 Error Handling

Sessions are **non-resumable but restartable**. Every failure yields a Handoff Report. Restart injects: original manifest + list of files written + failure reason + steps completed. Claude reads existing artifacts like a returning engineer.

| Failure | Detection | Retry |
|---|---|---|
| Context limit | SDK `stop_reason: max_tokens` | Manual — David may split manifest |
| Tool error | SDK `error` event | Auto 3× with backoff; then FAILED |
| Network | SDK timeout | 1 auto-retry; then FAILED |
| Impossible task | Claude returns impossibility | No retry; revise manifest |
| App crash | `job_state` running on restart | David: restart with handoff or cancel |
| SHIM loop (3× same block) | Retry counter | Escalate to strategic thread |

### §4.3.5 Cost Accounting

Token usage captured from SDK `usage` events, written to `session_costs` per checkpoint. Pricing in configurable `pricing.yaml`. Live cost ticker per session in job queue. Per-session soft cap (default $2, warn at 80%). Global daily hard cap (default $15, blocks new sessions). Kill switch aborts SDK call immediately; files written to that point preserved.

### §4.3.6 Concurrency — Swarm Governor

Max 8 parallel sessions. Priority: strategic thread > self-evolution > code/test > docs/research > Ghost. Global token bucket rate limiter over 60-second rolling window. Session 9+ queues with visible position.

AEGIS signals by session count:
- 0 workers: `DEEP_FOCUS`
- 1-2 workers: `COWORK_BATCH`
- 3-5 workers: `PARALLEL_BUILD`
- 5+ workers: `PARALLEL_BUILD` + Ghost indexing paused

---

## §5 — CROSS-CONTEXT ENGINE

The Cross-Context Engine prevents David from re-solving solved problems, re-building existing components, and repeating architectural mistakes. All six Council members converged on the same stack.

### §5.1 Embedding Model

**Locked:** `BAAI/bge-small-en-v1.5` via `@xenova/transformers` (ONNX, 8-bit quantized). Fully offline, fully private. 384 dimensions. Every embedding record stores `model_id` for future migration. Raw text always retained.

```typescript
import { pipeline } from '@xenova/transformers';
let embedder: any = null;
export async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { quantized: true });
  }
  return embedder;
}
export async function embedText(text: string): Promise<Float32Array> {
  const extractor = await getEmbedder();
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return result.data;
}
```

Chunking: 512-token window, 50-token overlap, recursive character splitting. Messages under 200 chars not indexed.

### §5.2 Vector Index

**Locked:** `sqlite-vec` (loadable SQLite extension) via Rust bindings. No external vector DB, no FAISS sidecar, no separate process. Single portable KERNL file.

```sql
SELECT load_extension('vec0');
CREATE VIRTUAL TABLE vec_index USING vec0(
  chunk_id TEXT PRIMARY KEY,
  embedding FLOAT[384] distance_metric=cosine
);
```

Query SLA: sub-200ms for k=10 on full index. Hot tier under 10ms.

### §5.3 Threshold Calibration

Starting thresholds — provisional, designed to move:

| Context | Threshold |
|---|---|
| Pattern detection (background) | 0.75 |
| On-input suggestion | 0.85 |
| "You already built this" gate | 0.72 |

Calibration: every 100 feedback events or 24 hours, background job recomputes acceptance rates. Thresholds move ±0.01 max per adjustment, clamped to [0.65, 0.92]. Per-pattern: 3 consecutive dismissals → +0.03 threshold. Feedback schema in `suggestion_feedback` table.

### §5.4 The "You Already Built This" Gate

Hard gate intercepting manifest generation before finalization. Interception modal shows match, similarity score, and three options: View Code (Monaco diff), Reuse as Base (copy + pre-fill manifest), Continue Anyway (log `overridden`). 3 overrides on same pattern → auto-increment threshold +0.05.

### §5.5 Cold Start — Three-Tier Index Warming

- **Tier 1 (T+2s):** `hot_cache.bin` — 1-2k most recent embeddings, memory-mapped, under 5ms
- **Tier 2 (T+5-10s):** 30-day window — ~10k embeddings, brute-force in-memory, ~2ms
- **Tier 3 (always):** Full `sqlite-vec` index

### §5.6 Background Indexer

Cadence: every 30 minutes, only if idle 5+ minutes. Out-of-schedule: after session end, after large job completion. Budget: 500ms CPU per run, yields if exceeded. AEGIS: `BUILD_SPRINT/COUNCIL` → suspend; `DEEP_FOCUS` → half speed; `IDLE` → full.

### §5.7 Proactive Surfacing

Max 2 suggestions visible simultaneously. Min display score: 0.70. Ranking: `similarity² × recencyFactor × (1 - dismissalPenalty) × valueBoost`. Suppression: 3 dismissals → 48h; 5 in 7 days → 7 days. "Context Library" safety valve exposes all suppressed suggestions on demand.

### §5.8 Build Sequence (Phase 3)

| Task | Deliverable | Est. Sessions |
|---|---|---|
| 5A | Embedding pipeline | 2 |
| 5B | sqlite-vec integration | 2 |
| 5C | Three-tier cold start | 2 |
| 5D | Background indexer + AEGIS | 2 |
| 5E | Suggestion feedback + calibration | 2 |
| 5F | Artifact gate UI | 3 |
| 5G | Ranking and suppression | 2 |
| 5H | End-to-end integration | 2 |

**Total: 17 sessions, 6-8 days.**

---

## §6 — GHOST THREAD

The Ghost Thread watches David's full filesystem and all email, builds a semantic index, and speaks at most twice a day. Not a notification system — a cognitive conscience.

### §6.1 Architecture

Distinct background process. Shares KERNL SQLite and `vec_index`. Stateless in execution, stateful in memory — reconstructs context from KERNL each run, makes targeted API calls, stores results, terminates. No long-lived Claude session. Two jobs: **ingest** (continuous) and **interrupt evaluation** (6-hour cadence). Shuts down when Gregore Lite closes.

### §6.2 Delta-Based Ingest Pipeline

**Filesystem watcher:** Rust `notify` crate (`RecommendedWatcher`). Debounce + settle window: 750-1500ms. Allowlist: `.txt`, `.md`, `.ts`, `.tsx`, `.js`, `.py`, `.rs`, `.go`, `.java`, `.sql`, `.json`, `.yaml`, `.pdf`, `.docx`. Directory exclusions enforced in Rust before IO: `node_modules`, `.git`, `target`, `dist`, `.ssh`, `.gnupg`, `secrets`, `vault`, `private`, `personal`, `medical`, `legal`.

**Email connector:** OAuth 2.0 REST APIs only. IMAP rejected. Gmail API (`history.list`) and Microsoft Graph (delta queries). Tokens in OS keychain, fallback to KERNL vault. 15-minute polling. Individual messages indexed; attachments only if text-based and <10MB.

**Chunking:**

| Content | Chunk size | Overlap |
|---|---|---|
| Code | ~600 tokens (function boundaries) | 50 tokens |
| Documents/PDFs | ~700 tokens (paragraph-aware) | 100 tokens |
| Plain text | ~600 tokens | 100 tokens |
| Email | Full body if ≤700 tokens; else prose rules | 100 tokens |

**Embedding:** Same model as Cross-Context Engine (`bge-small-en-v1.5`). Writes to shared `vec_index`. Batches of 10, 100ms delay. AEGIS-governed queue — never drops, backs up.

### §6.3 Privacy Model — Four-Layer Exclusion

**Layer 1 (hard-coded):** `.env`, `.pem`, `.key`, `*password*`, `*secret*`, `*token*`, `BEGIN PRIVATE KEY` patterns, `.ssh`, `.gnupg`, `secrets`, `vault`, financial document patterns, encrypted files.

**Layer 2 (pre-embedding scan):** SSNs, credit card numbers (Luhn), medical identifiers, API keys, JWT tokens. Chunk discarded if triggered.

**Layer 3 (contextual defaults):** `private/personal/medical/legal` directories excluded by default; medical/legal domain emails excluded; "confidential/privileged/attorney-client" subjects excluded.

**Layer 4 (user-configurable):** `ghost_exclusions` table — path/glob/domain/sender/keyword patterns, managed via Privacy Dashboard.

All Ghost data AES-256 encrypted (SQLCipher). Key in OS keychain. Audit trail in `ghost_indexed_items`. David can inspect and delete any indexed item. One-click "purge all Ghost data."

### §6.4 Interrupt Threshold Engine

```
score = similarity × recency_boost × relevance_boost × (1 - dismissal_penalty) × importance_boost
```

- `recency_boost`: 1.0 for last 7 days, decays to 0.5 at 90 days
- `relevance_boost`: 1.2 if chunk belongs to active project
- `dismissal_penalty`: 0.2 × dismissals in last 30 days, capped at 0.8
- `importance_boost`: 1.5 if marked critical

Candidate generation every 6 hours: top 50 similar chunks, filter last 7 days, score remainder. Top 2 exceeding 0.75 threshold surfaced. Hard cap: 2 per rolling 24h. Critical override: similarity >0.95 AND importance_boost >1.3 bypasses cap.

Ghost cards appear in context panel only. Never in strategic thread. One-sentence summary, source, Tell me more / Noted dismiss. Auto-expire 4 hours if not acted on.

### §6.5 Phase 1 Schema Requirements

All Ghost tables must exist in Phase 1 schema — see §3.1 above. The `content_chunks` table is shared between Cross-Context Engine (conversation chunks) and Ghost (file/email chunks). Same `vec_index`, same semantic space.

### §6.6 Security

AES-256 at rest. Process isolation — network access only to Anthropic API + Gmail/Graph. All ingest content marked `[UNTRUSTED CONTENT]` before Claude sees it. Prompt injection defense built into context packaging.

### §6.7 Build Sequence (Phase 6)

| Task | Deliverable | Est. Sessions |
|---|---|---|
| 6A | Rust filesystem watcher | 2 |
| 6B | Email connectors (Gmail + Outlook) | 4 |
| 6C | Unified ingest pipeline | 2 |
| 6D | Privacy exclusion engine | 2 |
| 6E | Interrupt scoring engine | 3 |
| 6F | Ghost process lifecycle + IPC | 2 |
| 6G | Privacy Dashboard UI | 2 |
| 6H | Context panel Ghost cards | 1 |
| 6I | End-to-end integration + hardening | 2 |

**Total: 20 sessions, 7-9 days.**

---

## §7 — SELF-EVOLUTION MODE (FINAL)

Not a special code path — a session type using the same Agent SDK infrastructure with additional guardrails and a mandatory CI gate.

### §7.1 What It Is

Gregore Lite opens an Agent SDK session against `D:\Projects\GregLite\` — its own source code. Session commits to a staging branch. David reviews the GitHub PR. David is always the only merge gate. The system can upgrade itself. David controls whether upgrades land.

### §7.2 Trigger Conditions

**Explicitly invoked, never autonomous.** Manual: David types in strategic thread. Proactive: Cross-Context or Ghost may suggest. Ghost/Cross-Context cannot auto-spawn — suggest only.

### §7.3 Branch Management

Before session: verify clean repo, create `self-evolve/{YYYYMMDD-HHMM}-{slug}`, lock Agent SDK CWD to that branch. Session has `git_commit` tool — local commits only, no push authority.

### §7.4 KERNL Tagging

`is_self_evolution = 1`, `self_evolution_branch`, `target_component`, `goal_summary`, `shim_score_before`, `shim_score_after`.

### §7.5 Scope Guardrails

Protected paths enforced at filesystem tool layer (not prompt):
- `src/agent-sdk/` — the modification engine itself
- `src/kernl/core/` — KERNL core
- `src/self-evolution/` — self-evolution orchestrator
- Any file with `// @no-self-evolve`

`.gregignore` file in repo root for user-defined additional exclusions. Manifest generator reads `.gregignore` and rejects proposed manifests touching protected files.

### §7.6 SHIM Integration

Both in-session (iterative correction) and post-processing (final gate). Retry ceiling: 3 SHIM calls on same file without improvement → halt + escalate banner. Post-processing gate blocks PR creation if any file fails with `shim_required: true`.

### §7.7 CI Gate and PR Workflow

1. Session completes local commit, passes post-processing SHIM
2. Full local test suite runs against staging branch
3. GitHub PR created via GitHub API (PAT in KERNL vault)
4. PR description: goal, files changed, SHIM before/after, KERNL session log link
5. Gregore Lite polls GitHub CI every 5 minutes
6. CI passes → "Ready to merge" status + **[Merge PR]** button appears
7. David clicks [Merge PR] → squash merge via GitHub API
8. Merge confirmed → local pull + SHIM + tests as confirmation

**David is the only merge gate. No merge without David's explicit click.**

### §7.8 Failure Modes

| Failure | What Happens | Recovery |
|---|---|---|
| SHIM failure | FAILED, no PR, branch preserved | Review SHIM report, retry or discard |
| Passes SHIM, fails CI | PR exists, [Merge PR] never appears | Review CI output, retry or discard |
| Local test failure | FAILED, no PR | Review test output, retry |
| SHIM loop (3× no improvement) | Halt, escalation banner | Manual review or abort |
| Dirty repo at start | Aborted before any work | Commit/stash, retry |
| GitHub token expired | PR creation fails, notify | Re-auth, retry |
| App closes mid-session | INTERRUPTED, branch preserved | Restart session or discard branch |

### §7.9 Build Sequence (Phase 5 / Phase 7)

| Task | Deliverable | Est. Sessions |
|---|---|---|
| 7A | Agent SDK core: injection, query(), event streaming | 2 |
| 7B | Permission matrix + write scope enforcement | 2 |
| 7C | Error handling + restart + handoff reports | 2 |
| 7D | Cost accounting + session_costs UI | 2 |
| 7E | Concurrency scheduler + AEGIS | 2 |
| 7F | Job queue UI | 3 |
| 7G | SHIM hybrid: in-session tool + post-processing gate | 2 |
| 7H | Self-evolution: branch mgmt, .gregignore, CI, GitHub PR, [Merge PR] | 3 |

**Total: 18 sessions, 6-8 days.**

---

## §8 — DECISION GATE SYSTEM

**What this is not:** Multi-model orchestration. No tribunal, no parallel model calls, no consensus voting. That is Gregore Full's territory (Consensus engine). GregLite is single-model — one Claude session, one thread, one provider.

**What this is:** A UX safety mechanism. Claude detects high-stakes decision patterns in the conversation, pauses, and requires explicit human confirmation before proceeding. Prevents David from blowing past irreversible choices at velocity.

**Automatic triggers (OR logic):**
- Same architectural question in 3+ messages
- Decision involves ≥4 major tradeoffs
- Decision touches ≥2 projects
- Sacred principle potentially violated ("temporary fix", "technical debt", "MVP of", "just for now")
- Irreversible action detected (delete, deploy to prod, breaking schema change)
- Estimated build time >3 Agent SDK sessions for a single decision
- Decision contradicts a prior KERNL-logged decision
- Claude expresses confidence <60%

**Flow:** Trigger → pause thread → non-modal panel with trigger reason → David confirms or dismisses → 3 dismissals = mandatory gate → decision record written → David approves → logged to KERNL → thread resumes.

`decision_lock` flag blocks all API calls while active. Released only on David approval or manual override with written rationale (logged to KERNL).

**Funnel note:** When David outgrows single-model and wants genuine multi-model deliberation on hard decisions — that's the Gregore Full upsell. The Decision Gate is the moment he feels that ceiling.

---

## §9 — AEGIS INTEGRATION

Gregore Lite sends typed signals to AEGIS v1.0.0 (`D:\Dev\aegis\`) via local HTTP.

```typescript
type WorkloadProfile =
  | "STARTUP" | "DEEP_FOCUS" | "CODE_GEN" | "COWORK_BATCH"
  | "RESEARCH" | "BUILD" | "COUNCIL" | "IDLE" | "SUSPEND";
```

Anti-flap: minimum 5 seconds between transitions. Manual override in status bar, logged to KERNL.

---

## §10 — UI/UX LAYOUT

Borrows Gregore design system completely: CSS variable system, breathing animations, dark theme, Geyser G branding, keyboard-first design. Direct copy — no redesign.

```
┌──────────────────────────────────────────────────────────────────┐
│  GREGORE LITE              [★ Strategic] [⚙ Worker] [⚙ Worker] + │
├─────────────────────┬──────────────────────────┬─────────────────┤
│  CONTEXT PANEL      │   STRATEGIC THREAD       │   JOB QUEUE     │
│  (20% width)        │   (55% width)            │   (25% width)   │
│  Active: GHM        │   [conversation]         │   ● job_001     │
│  Session: #47       │                          │     running     │
│  Recent Decisions   │                          │     2/5 tasks   │
│  Suggestions: [1]   │                          │   ○ job_002     │
│  KERNL: ● indexed   │   ────────────────────   │     pending     │
│  AEGIS: DEEP_FOCUS  │   [input          ] [→]  │   [+ new job]   │
└─────────────────────┴──────────────────────────┴─────────────────┘
│  COUNCIL: 0 pending │  COST TODAY: $0.42  │  COWORK: 2 active    │
└──────────────────────────────────────────────────────────────────┘
```

Components carried from Gregore scaffold: `ChatInterface.tsx`, `MessageList.tsx`, `Message.tsx`, `InputField.tsx`, `Header.tsx`, `KeyboardShortcuts.tsx`, full CSS variable system.

---

## §11 — QUALITY LAYER

**SHIM:** Native TypeScript module (no MCP server process — no process to die). Runs on every Agent SDK result report and on file save. Never on strategic thread. False positive tracking: rules above 20% FP rate auto-suppressed.

**Eye of Sauron:** Scheduled deep scan on projects touched by Agent SDK sessions in last 24h. Checks: security vulnerabilities, architectural drift, dependency cycles. Output: KERNL project health scores. Score below 70 triggers Council escalation suggestion.

**Quality gates:** Every manifest declares required gates. Session cannot mark complete without passing declared gates.

---

## §12 — FAILURE MODES AND MITIGATIONS

| Failure Mode | Mitigation |
|---|---|
| KERNL index corruption | Daily backups, WAL mode, checksums, auto-restore |
| Agent SDK session fail mid-task | Per-manifest timeout, partial completion logged, retry/escalate |
| API rate limits under parallel load | Token bucket, request queuing, strategic thread first, backoff |
| Context window exhaustion | Auto-compression at 70% utilization — oldest 30% replaced with KERNL summary |
| Council lock infinite loop | 24h timeout, manual override with written rationale |
| Memory leak in long session | Continuity checkpoint every 30s; >2GB → auto-restart |
| AEGIS signal mismatch | Signal log in context panel, one-click override |
| Self-evolution breaks build | Mandatory staging branch, CI gate, David-only merge |
| SHIM false positive spikes | FP DB tracks dismissals, auto-suppress above 20% FP rate |
| Bootstrap exceeds 60s | Tiered hydration: show UI immediately, fill async |

---

## §13 — BUILD ORDER (Amendment 3)

**Phase 0 — Scaffold Setup (Day 1, ~2-3 hours, manual)**

Copy `D:\Projects\Gregore\app\` to `D:\Projects\GregLite\app\`. Audit fully before writing a single new line. Estimated time savings: 40-60% of Phase 1 work already exists.

Stack (identical to Gregore): Tauri + Next.js 16 + React 19 + TypeScript strict, Zustand, SQLite via better-sqlite3, BullMQ + Redis, Vercel AI SDK, Vitest, Husky, Prettier, ESLint.

**What to take from Gregore scaffold:**

UI components — carry wholesale, zero modification:
- `app/lib/components/ChatInterface.tsx`
- `app/lib/components/MessageList.tsx`
- `app/lib/components/Message.tsx`
- `app/lib/components/InputField.tsx`
- `app/lib/components/Header.tsx`
- `app/lib/components/KeyboardShortcuts.tsx`
- Full CSS variable system and dark theme
- Geyser G branding assets

Service layer — carry wholesale:
- `app/lib/services/ai-sdk-service.ts` — Vercel AI SDK wrapper, multi-provider
- `app/lib/services/pricing.ts` — model pricing table (Anthropic + OpenAI)
- `app/lib/services/patterns/cascade.ts` — Haiku→Sonnet→Opus fallback (useful for cost-tiered worker sessions)

Infrastructure — carry wholesale:
- `app/lib/audit/logger.ts` — database-backed audit logger
- `app/lib/repositories/base-repository.ts` — generic CRUD base class
- Database schema patterns (adapt to §3.1 schema, not copy verbatim)

**What to leave in Gregore — do not copy:**

All of `app/lib/orchestration/` — this is Gregore's moat:
- `consensus/` — multi-model voting (Gregore Full only)
- `parallax/` — semantic search engine (Gregore Full only)
- `novelty/` — anti-filter-bubble engine (Gregore Full only)
- `outlier/` — minority viewpoint protection (Gregore Full only)
- `tribunal/` patterns from `services/patterns/` — multi-model (Gregore Full only)

Cognitive plane systems — not needed in Phase 1, revisit later:
- `app/lib/world/` — claim ledger and world model
- `app/lib/homeostasis/` — behavioral state machine
- `app/lib/aot/self-model/` — confidence calibration
- `app/lib/self-model/` — self-observer

Gregore-UI-specific:
- `app/lib/override-policies.ts` — Ghost UI React hook, Gregore-specific

**Phase 1 — Foundation (3-5 sessions, days 1-3, sequential)**

| Session | Deliverable | Gate |
|---|---|---|
| 1A | Tauri shell + full SQLite schema (§3.1) + WAL mode | Schema migrations clean |
| 1B | Claude API client + streaming + single strategic thread UI | Conversation end to end |
| 1C | KERNL native module — read/write, decision log | Session survives restart |
| 1D | Continuity diff checkpoint — every response | Crash → restart → intact |
| 1E | Bootstrap sequence — KERNL hydration + dev protocols + AEGIS | Cold start <60s measured |

**Phase 1 completion gate: conversation survives app restart with full context restored.**

**Phase 2 — Parallel Workstreams (days 4-10)**

| Workstream | Deliverable | Est. Sessions |
|---|---|---|
| 2A — Agent SDK Integration | Manifest impl, spawn, streaming, job queue UI, cost accounting | 4-5 |
| 2B — Context Panel + KERNL UI | Bootstrap display, decisions, KERNL status, suggestions | 3-4 |
| 2C — AEGIS Integration | Signal sender, API client, override UI | 2-3 |
| 2D — Artifact Rendering | Monaco, Sandpack, markdown, artifact panel | 3-4 |
| 2E — War Room Foundation | Dependency graph schema, UI with dependency lines | 2-3 |

**Phase 3 — Intelligence Layer** — ✅ COMPLETE (March 1, 2026). Vector index (sqlite-vec), embedding pipeline (bge-small-en-v1.5), three-tier cold start, background indexer (30-min cadence, AEGIS throttled), suggestion feedback + threshold calibration, already-built gate (Monaco diff modal), proactive surfacing (Zustand store, SuggestionCard, max-2 cap, 4h auto-expire). Performance: k=10 @ 1000 chunks = 1.66ms, hot cache = 2.36ms, 374/374 tests passing. See §5 and SPRINT_3H_COMPLETE.md.

**Phase 4 — Decision Gate** — ✅ COMPLETE (March 2, 2026). 8-condition trigger detection (5 live keyword/semantic + 3 Haiku NLP inference), non-modal GatePanel UI, HTTP 423 API lock enforcement, approve/dismiss/override flow, mandatory gate at 3 dismissals, KERNL decision logging, getValueBoost() wired to decisions table. False positive rate: 0/10 normal scenarios in integration testing. Sync analysis path: 1ms on 20-message conversation. 474/474 tests passing. See SPRINT_4A/4B/4C_COMPLETE.md.

**Phase 5 — Quality Layer** — ✅ COMPLETE (March 2, 2026). Eye of Sauron: character forensics (INVISIBLE_CHAR, HOMOGLYPH, SMART_QUOTE, GREEK_SEMICOLON, MIXED_INDENT), pattern precognition (MEMORY_LEAK, EVENT_LISTENER_LEAK), health score formula (100 − critical×8 − warning×2 − cycles×10), FP tracker with 20% auto-suppression threshold. PatternLearner native migration (shim_patterns, shim_improvements tables, KERNL-backed persistence, predictSuccess before spawn). Quality gate: `eos_required=true` + score<70 downgrades manifest to FAILED. result_report backfill writes `quality_results.eos.healthScore` for War Room display. EoS badge on completed JobNode (green ≥80 / amber ≥60 / red <60). scoreClass utility extracted to `lib/eos/score-class.ts`. FP dismiss UI (EoSIssueRow × button, `/api/eos/fp` route). 22-test integration suite. Self-scan baseline: 82/100 health score, 242 files, 208ms. 584/584 tests passing. See SPRINT_5C_COMPLETE.md.

**Phase 6 — Ghost Thread** — ✅ COMPLETE (March 2, 2026). Filesystem watcher (Rust Tauri plugin, 4-layer privacy exclusion engine), email connectors (OAuth IMAP/SMTP poller), ingest pipeline (queue-based chunker, sqlite-vec embeddings, source:ghost metadata), interrupt scorer (buildActiveContextVector, generateCandidates, canSurface 24h window, criticalOverride, Haiku summary), Ghost context panel cards (GhostCard, GhostCardList, GhostCardActions, Tell me more injection, Noted feedback, 4h auto-expire on render, activeThreadId bridge via ghost store), Privacy Dashboard (delete item, add/remove exclusions, purge all). [UNTRUSTED CONTENT] boundary verified on all paths. EoS: 82/100 (303 files, no regression from Phase 5). Performance: JS startup <1ms, JS shutdown <1ms (production estimate <200ms incl. Tauri IPC). 736/736 tests passing (33 new integration tests in phase6-integration.test.ts). See SPRINT_6I_COMPLETE.md.

**Phase 7 — Self-Evolution Mode** — Agent SDK sessions on own source, CI gate, David merge workflow. Council Session 3 complete — see §7. ✅ COMPLETE (commit 9b5789d). tsc clean, 890/890 tests, EoS 82/100.

**Phase 8 — Ship Prep: v1.0.0** — ✅ COMPLETE (March 4, 2026). Security hardening: execSync → execFileSync (shell injection closed), OS keychain for GitHub PAT and Anthropic API key (keytar/Windows Credential Manager), merge route auth (HMAC desktop token). Leak fixes: executor.ts EventListener leak closed (removeEventListener in all 3 paths), rate-limiter.ts setInterval leak closed (clearInterval in destroy()). EoS FP suppression: phase5-integration.test.ts:246 suppressed. EoS: 0→100/85 target. NSIS installer, tauri-plugin-updater, build-installer.bat, tauri-prebuild.bat (static export with API route relocation). First-run onboarding (4-step wizard: API key validation + keychain storage, KERNL init status, AEGIS ping with graceful skip, launch summary). README rewritten as product document. 887/890 tests passing (3 pre-existing artifact detector failures, no regression). git tag v1.0.0. Commits: 8e25a72 (8A), b154aad (8B), 5de4800 (8C).

**Phase 9 — The Full Cockpit: v1.1.0** — ✅ COMPLETE (commit ac634bd, March 3, 2026). 22 sprints, 4 waves. Every keyboard shortcut in KeyboardShortcuts.tsx fires a real action. tsc clean, 890 tests throughout.

**Sprint 10.x — Daily Driver Polish** — ✅ COMPLETE (Sprints 10.5–10.9, March 3–4, 2026). Post-v1.1.0 polish for daily use. SSE streaming, flat messages, density toggle, light/dark theme, settings gear, thread CRUD, War Room fix, AEGIS audit, StatusBar event wiring, 404 route stubs. **NOTE:** Sprint 10.6 STATUS entry falsely claimed "Transit Map data foundation shipped" — zero Transit Map code exists.

**Remaining work mapped in SPRINT_ROADMAP.md:** Sprint 11.0 (cleanup), 11.1 (Agent SDK stubs), 11.2–11.7 (Transit Map Phases A–F), 12.0 (cost optimization).

Wave 0: schema migrations (manifest_templates, ghost_preferences tables).

Wave 1 (parallel): multi-thread tabs (per-tab Zustand state isolation, ThreadTabBar, Cmd+N); command palette (fuzzy search, command registry, all day-1 commands wired, Cmd+K); notification display (ToastStack, NotificationBell, all background events wired); status bar (cost today/active jobs/AEGIS profile/KERNL status, live polling); morning briefing (auto-generated from KERNL on cold start, once per day, 6 sections); Ghost Teach Me (ghost_preferences table, scorer boost_factor, Privacy Dashboard Preferences tab); manifest templates (save-as-template, template picker, quick-spawn from Workers tab); in-thread search (Cmd+F, client highlight, server-side FTS5 fallback, messages_fts); EoS sparkline (80×24 SVG trend from eos_reports, delta, color thresholds, EoSHistoryPanel); cost breakdown by project (session_costs GROUP BY project_id, today/week/all tabs); job retry/edit (Edit & Retry on failed jobs, ManifestBuilder pre-fill, superseded status); chat history panel (Cmd+[, search, load thread into tab, pin/archive).

Wave 2 (parallel): settings panel (Cmd+,, theme/budget caps/Ghost cadence/AEGIS port/API key status); inspector drawer (Cmd+I, 5 tabs: Thread/KERNL/Quality/Jobs/Costs); push notifications/tray (tauri-plugin-notification, Windows native toasts, tray icon + badge, escalated events); decision browser (Cmd+D, filter by project/category/impact/date, FTS, markdown export, thread links); artifact library (Cmd+L, cross-session browse, filter by type/language/project, re-attach); KERNL health panel (DB size, tables, messages, chunks, decisions, last indexer run — Inspector KERNL tab); project quick-switcher (clickable project name in context panel, popover, command palette registration); edit last message/regenerate (hover actions on last messages, Cmd+E/Cmd+R, truncate-after API).

Wave 3 (design): memory modal deprecated — Cmd+M removed from KeyboardShortcuts, decision logged to KERNL decisions table. Command palette KERNL search (Cmd+K) + Decision Browser (Cmd+D) cover the use case. No build required.

---

## §14 — PRODUCT FUNNEL

Lite → Full delta: Consensus multi-model engine, multi-tenant architecture, user accounts, billing, marketplace API, team KERNL. Everything in Lite carries forward. Nothing gets rewritten.

**Funnel:** Power Claude Desktop users hit the ceiling → discover Gregore Lite → experience the cockpit → outgrow single-model → upsell to Full is natural, felt, not sold.

---

## COUNCIL SESSIONS — COMPLETE

| Session | Topic | Status | Detail |
|---|---|---|---|
| Session 1 | Cross-Context Engine | ✅ Complete | See §5 and BLUEPRINT_S5_CrossContext.md |
| Session 2 | Ghost Thread | ✅ Complete | See §6 and BLUEPRINT_S6_Ghost.md |
| Session 3 | Agent SDK + Self-Evolution | ✅ Complete | See §4.3, §7, and BLUEPRINT_S7_AgentSDK_SelfEvolution.md |

All sections fully specified. No sections pending. Ready for Phase 0 execution.

---

*Blueprint locked as of February 28, 2026.*  
*All three Council sessions complete. §4.3, §5, §6, §7 fully detailed. Ready for Phase 0 execution.*
