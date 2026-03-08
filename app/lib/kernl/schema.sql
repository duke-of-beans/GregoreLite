-- GregLite KERNL Schema
-- WAL mode for concurrent reads, crash safety
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ─── THREADS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS threads (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL DEFAULT 'New Thread',
  project_id   TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
  meta         TEXT  -- JSON blob for extensible metadata
);

-- ─── MESSAGES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY,
  thread_id    TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content      TEXT NOT NULL,
  model        TEXT,
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd     REAL DEFAULT 0,
  latency_ms   INTEGER DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
  meta         TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);

-- ─── DECISIONS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id           TEXT PRIMARY KEY,
  thread_id    TEXT REFERENCES threads(id) ON DELETE SET NULL,
  category     TEXT NOT NULL,
  title        TEXT NOT NULL,
  rationale    TEXT NOT NULL,
  alternatives TEXT, -- JSON array
  impact       TEXT CHECK(impact IN ('high', 'medium', 'low')),
  created_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
  meta         TEXT
);

CREATE INDEX IF NOT EXISTS idx_decisions_category ON decisions(category);
CREATE INDEX IF NOT EXISTS idx_decisions_thread ON decisions(thread_id);

-- ─── PROJECTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  path         TEXT,
  description  TEXT,
  status       TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'paused')),
  created_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
  meta         TEXT
);

-- ─── ARTIFACTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artifacts (
  id           TEXT PRIMARY KEY,
  thread_id    TEXT REFERENCES threads(id) ON DELETE SET NULL,
  project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,  -- 'file' | 'snippet' | 'diagram' | 'plan'
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  language     TEXT,
  file_path    TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
  meta         TEXT
);

-- ─── CHECKPOINTS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkpoints (
  id           TEXT PRIMARY KEY,
  thread_id    TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  message_id   TEXT REFERENCES messages(id) ON DELETE SET NULL,
  snapshot     TEXT NOT NULL, -- JSON: full thread messages at this point
  created_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_thread ON checkpoints(thread_id, created_at DESC);

-- ─── WORKSTREAMS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workstreams (
  id           TEXT PRIMARY KEY,
  project_id   TEXT REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  status       TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed')),
  priority     INTEGER DEFAULT 50,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
  meta         TEXT
);

-- ─── PATTERNS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patterns (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT,
  template     TEXT NOT NULL,
  category     TEXT,
  use_count    INTEGER DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)
);

-- ─── MANIFESTS (Agent SDK worker sessions) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS manifests (
  id                    TEXT PRIMARY KEY,
  version               TEXT NOT NULL DEFAULT '1.0',
  spawned_by_thread     TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  strategic_thread_id   TEXT NOT NULL,
  created_at            TEXT NOT NULL,  -- ISO timestamp
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','spawning','running','working','validating','completed','failed','interrupted')),
  task_type             TEXT CHECK(task_type IN ('code','test','docs','research','deploy','self_evolution')),
  title                 TEXT,
  description           TEXT,
  project_path          TEXT,
  dependencies          TEXT,           -- JSON array of manifest IDs
  quality_gates         TEXT,           -- JSON object
  is_self_evolution     INTEGER DEFAULT 0,
  self_evolution_branch TEXT,
  result_report         TEXT,           -- JSON ResultReport on completion
  tokens_used           INTEGER DEFAULT 0,
  cost_usd              REAL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_manifests_status ON manifests(status);
CREATE INDEX IF NOT EXISTS idx_manifests_thread ON manifests(spawned_by_thread);

-- ─── AEGIS SIGNALS ───────────────────────────────────────────────────────────
-- Workload profile signal log. Sprint 2C writes here; 2B reads latest row.
CREATE TABLE IF NOT EXISTS aegis_signals (
  id       TEXT PRIMARY KEY,
  profile  TEXT NOT NULL,
  source_thread TEXT,
  sent_at  INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
  is_override INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_aegis_signals_sent_at ON aegis_signals(sent_at DESC);

-- ─── CONTENT CHUNKS (Sprint 3A — Embedding Pipeline) ────────────────────────
-- Stores chunked text + metadata. Vectors written to vec_index by Sprint 3B.
-- Joined by chunk_id.
CREATE TABLE IF NOT EXISTS content_chunks (
  id           TEXT PRIMARY KEY,              -- chunk_id (nanoid)
  source_type  TEXT NOT NULL CHECK(source_type IN ('conversation','file','email','email_attachment')),
  source_id    TEXT NOT NULL,                 -- thread_id, file path, email_id
  chunk_index  INTEGER NOT NULL,              -- 0-based within source
  content      TEXT NOT NULL,                 -- raw chunk text
  metadata     TEXT,                          -- JSON: embedding_dim etc.
  model_id     TEXT NOT NULL,                 -- 'Xenova/bge-small-en-v1.5' — required for migration
  created_at   INTEGER NOT NULL,
  indexed_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_source ON content_chunks(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_model  ON content_chunks(model_id);

-- ─── SUGGESTIONS (Sprint 3E — Cross-Context feedback) ────────────────────────
-- Tracks surfaced suggestions and user feedback for threshold calibration.
CREATE TABLE IF NOT EXISTS suggestions (
  id              TEXT PRIMARY KEY,
  chunk_id        TEXT NOT NULL,              -- references content_chunks.id
  similarity_score REAL NOT NULL,
  display_score   REAL NOT NULL,
  surface_context TEXT NOT NULL CHECK(surface_context IN ('on_input','pattern','already_built')),
  user_action     TEXT CHECK(user_action IN ('accepted','dismissed','ignored')),
  acted_at        INTEGER,
  surfaced_at     INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_suggestions_chunk ON suggestions(chunk_id, acted_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_context ON suggestions(surface_context, acted_at DESC);

-- ─── SETTINGS (Sprint 3E — Persisted key/value config) ───────────────────────
-- Stores threshold_config JSON + last_calibration_at timestamp.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
);

-- ─── EYE OF SAURON — Phase 5A ────────────────────────────────────────────────

-- health_score: 0–100 computed by EoS health score formula
-- last_eos_scan: ISO datetime of last scan
-- Phase 5A column additions handled in database.ts runMigrations()

-- False-positive feedback log (rolling window for auto-suppression)
CREATE TABLE IF NOT EXISTS eos_fp_log (
  id          TEXT    PRIMARY KEY,
  project_id  TEXT    NOT NULL,
  rule_id     TEXT    NOT NULL,
  file_path   TEXT    NOT NULL,
  line        INTEGER,
  is_fp       INTEGER NOT NULL DEFAULT 0,    -- 1 = user confirmed FP
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eos_fp_log_rule
  ON eos_fp_log (project_id, rule_id, created_at DESC);

-- Persisted scan reports (one row per scan run)
CREATE TABLE IF NOT EXISTS eos_reports (
  id            TEXT    PRIMARY KEY,
  project_id    TEXT    NOT NULL,
  health_score  REAL    NOT NULL,
  issues_json   TEXT    NOT NULL,            -- JSON: HealthIssue[]
  files_scanned INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER NOT NULL DEFAULT 0,
  suppressed    TEXT    NOT NULL DEFAULT '[]', -- JSON: string[] (suppressed rule IDs)
  scan_mode     TEXT    NOT NULL DEFAULT 'quick' CHECK(scan_mode IN ('quick','deep')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  scanned_at    TEXT    DEFAULT NULL         -- ISO timestamp set by scanner pipeline
);

CREATE INDEX IF NOT EXISTS idx_eos_reports_project
  ON eos_reports (project_id, created_at DESC);

-- ─── SHIM — Phase 5B ─────────────────────────────────────────────────────────

-- Pattern learning table: persists PatternLearner.patterns Map across restarts
CREATE TABLE IF NOT EXISTS shim_patterns (
  id             TEXT    PRIMARY KEY,
  description    TEXT    NOT NULL,
  frequency      INTEGER DEFAULT 0,
  success_rate   REAL    DEFAULT 0,
  average_impact REAL    DEFAULT 0,
  contexts       TEXT,   -- JSON: Array<{complexity, maintainability, linesOfCode}>
  updated_at     INTEGER NOT NULL
);

-- Historical improvement log: one row per Agent SDK job COMPLETED
CREATE TABLE IF NOT EXISTS shim_improvements (
  id                    TEXT    PRIMARY KEY,
  pattern               TEXT    NOT NULL,
  complexity            REAL,
  maintainability       REAL,
  lines_of_code         INTEGER,
  modification_type     TEXT,
  impact_score          REAL,
  success               INTEGER DEFAULT 0,  -- 0 = false, 1 = true
  complexity_delta      REAL,
  maintainability_delta REAL,
  recorded_at           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shim_improvements_pattern
  ON shim_improvements (pattern, recorded_at DESC);

-- EoS health score at manifest spawn time (used for before/after delta)
-- Phase 5B column addition handled in database.ts runMigrations()

-- ─── GHOST EMAIL STATE — Phase 6B ────────────────────────────────────────────
-- Per-account connector state: OAuth cursor, error counter, last sync time
CREATE TABLE IF NOT EXISTS ghost_email_state (
  id            TEXT PRIMARY KEY,
  provider      TEXT NOT NULL CHECK(provider IN ('gmail', 'outlook')),
  account       TEXT NOT NULL,
  last_sync_at  INTEGER,
  history_cursor TEXT,       -- historyId for Gmail, delta link for Microsoft Graph
  error_count   INTEGER DEFAULT 0,
  connected_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ghost_email_state_provider
  ON ghost_email_state (provider, account);

-- ─── GHOST INGEST — Phase 6C ─────────────────────────────────────────────────
-- source_type already exists in content_chunks (Sprint 3A).
-- Add source_path and source_account columns for Ghost provenance tracking.
-- Phase 6C column additions handled in database.ts runMigrations()

-- Audit trail for the Privacy Dashboard (Sprint 6G). One row per ingest op.
CREATE TABLE IF NOT EXISTS ghost_indexed_items (
  id            TEXT PRIMARY KEY,
  source_type   TEXT NOT NULL,         -- 'file' | 'email'
  source_path   TEXT,
  source_account TEXT,
  chunk_count   INTEGER DEFAULT 0,
  indexed_at    INTEGER NOT NULL,
  deleted       INTEGER DEFAULT 0,     -- soft delete for Privacy Dashboard
  deleted_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ghost_indexed_items_type
  ON ghost_indexed_items (source_type, indexed_at DESC);

-- ─── GHOST PRIVACY ENGINE — Phase 6D ────────────────────────────────────────
-- User-configurable exclusion rules (Layer 4)
CREATE TABLE IF NOT EXISTS ghost_exclusions (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK(type IN ('path_glob','domain','sender','keyword','subject_contains')),
  pattern    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  note       TEXT
);

CREATE INDEX IF NOT EXISTS idx_ghost_exclusions_type
  ON ghost_exclusions (type);

-- Audit log — every exclusion decision written here for Privacy Dashboard
CREATE TABLE IF NOT EXISTS ghost_exclusion_log (
  id          TEXT PRIMARY KEY,
  source_type TEXT,        -- 'file' | 'email'
  source_path TEXT,
  layer       INTEGER,
  reason      TEXT,
  pattern     TEXT,
  logged_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ghost_exclusion_log_source
  ON ghost_exclusion_log (source_type, logged_at DESC);

-- ─── GHOST SCORER — Phase 6E ─────────────────────────────────────────────────
-- critical flag on indexed items (set by Privacy Dashboard / Ghost card UI)
-- Phase 6E column addition handled in database.ts runMigrations()

-- Feedback log: dismissed/noted/expanded actions per chunk
CREATE TABLE IF NOT EXISTS ghost_suggestion_feedback (
  id          TEXT PRIMARY KEY,
  chunk_id    TEXT,
  source_path TEXT,
  action      TEXT CHECK(action IN ('dismissed', 'noted', 'expanded')),
  logged_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ghost_feedback_source
  ON ghost_suggestion_feedback (source_path, logged_at DESC);

-- Rolling window: tracks suggestions surfaced in the last 24h
CREATE TABLE IF NOT EXISTS ghost_surfaced (
  id           TEXT PRIMARY KEY,
  chunk_id     TEXT NOT NULL,
  score        REAL,
  surfaced_at  INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,   -- surfaced_at + 4 hours (auto-expire)
  dismissed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ghost_surfaced_at
  ON ghost_surfaced (surfaced_at DESC);

-- ─── AGENT SDK JOB STATE — Phase 7A ─────────────────────────────────────────
-- Fine-grained per-step state for active worker sessions.
-- Checkpointed every 5 tool calls OR every 60 seconds.
-- On restart: running/working/validating rows → INTERRUPTED.
CREATE TABLE IF NOT EXISTS job_state (
  manifest_id        TEXT PRIMARY KEY,
  status             TEXT CHECK(status IN ('spawning','running','working','validating','completed','failed','blocked','interrupted')),
  steps_completed    INTEGER DEFAULT 0,
  files_modified     TEXT,       -- JSON array of paths
  last_event         TEXT,       -- JSON of last SDK event for debugging
  log_path           TEXT,       -- temp file path if session >5 min
  tokens_used_so_far INTEGER DEFAULT 0,
  cost_so_far        REAL DEFAULT 0,
  updated_at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_state_status ON job_state(status);

-- Phase 7A: manifests column additions are handled in database.ts runMigrations()
-- to avoid ALTER TABLE IF NOT EXISTS syntax which requires SQLite ≥3.37.0

-- ─── FTS VIRTUAL TABLE ───────────────────────────────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- ─── PHASE 7B: SCOPE VIOLATIONS LOG ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scope_violations (
  id            TEXT    PRIMARY KEY,
  manifest_id   TEXT    NOT NULL,
  attempted_path TEXT   NOT NULL,
  resolved_path  TEXT,
  session_type   TEXT,
  logged_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scope_violations_manifest ON scope_violations(manifest_id);
CREATE INDEX IF NOT EXISTS idx_scope_violations_logged  ON scope_violations(logged_at);

-- ─── PHASE 7C: SESSION RESTARTS ──────────────────────────────────────────────
-- Audit trail for every session restart. Populated by restart.ts spawnRestart().
CREATE TABLE IF NOT EXISTS session_restarts (
  id                   TEXT    PRIMARY KEY,
  original_manifest_id TEXT    NOT NULL,
  new_manifest_id      TEXT    NOT NULL,
  restart_reason       TEXT,        -- failure mode that caused the restart
  restarted_at         INTEGER NOT NULL,
  restarted_by         TEXT    DEFAULT 'user'  -- 'user' or 'auto' (future auto-restart)
);

CREATE INDEX IF NOT EXISTS idx_session_restarts_original ON session_restarts(original_manifest_id);

-- ─── PHASE 7D: SESSION COSTS ──────────────────────────────────────────────────
-- Per-session cost accounting. Created on spawn, updated on each checkpoint,
-- finalised (completed_at set) on session end. Daily total derived via SUM query.
CREATE TABLE IF NOT EXISTS session_costs (
  manifest_id        TEXT    PRIMARY KEY REFERENCES manifests(id),
  session_type       TEXT,
  model              TEXT,
  input_tokens       INTEGER DEFAULT 0,
  output_tokens      INTEGER DEFAULT 0,
  total_tokens       INTEGER DEFAULT 0,
  estimated_cost_usd REAL    DEFAULT 0,
  project_id         TEXT,
  started_at         INTEGER,
  completed_at       INTEGER,
  updated_at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_costs_started ON session_costs(started_at);
CREATE INDEX IF NOT EXISTS idx_session_costs_project ON session_costs(project_id, started_at DESC);

-- ─── PHASE 7D: BUDGET CONFIG ─────────────────────────────────────────────────
-- Key/value store for spend limits. David updates via Settings UI (stub in 7F).
-- Caps are read at spawn time — no code change needed when David adjusts limits.
CREATE TABLE IF NOT EXISTS budget_config (
  key        TEXT    PRIMARY KEY,
  value      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Default cap rows — only inserted when they do not yet exist.
INSERT OR IGNORE INTO budget_config (key, value, updated_at) VALUES
  ('session_soft_cap_usd',          '2.00',   unixepoch('now') * 1000),
  ('session_hard_cap_usd',          '10.00',  unixepoch('now') * 1000),
  ('daily_hard_cap_usd',            '15.00',  unixepoch('now') * 1000),
  ('rate_limit_tokens_per_minute',  '100000', unixepoch('now') * 1000),
  ('shim_retry_ceiling',            '3',      unixepoch('now') * 1000);

-- ─── PHASE 7E: SESSION QUEUE ─────────────────────────────────────────────────
-- Concurrency scheduler queue. One row per session attempt. Strategic thread
-- sessions (type='strategic_thread') bypass this table entirely.
-- Max 8 rows with status='running' at any time (enforced by scheduler.ts).
CREATE TABLE IF NOT EXISTS session_queue (
  id             TEXT    PRIMARY KEY,
  manifest_id    TEXT    NOT NULL,
  session_type   TEXT    NOT NULL,
  priority       INTEGER NOT NULL,
  status         TEXT    CHECK(status IN ('pending','running','completed','cancelled')),
  queue_position INTEGER,
  enqueued_at    INTEGER NOT NULL,
  started_at     INTEGER,
  completed_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_session_queue_status
  ON session_queue (status, priority ASC, enqueued_at ASC);

-- ─── PHASE 7G: SHIM SESSION LOG ──────────────────────────────────────────────
-- One row per SHIM call (in-session or post-processing) for analytics and
-- false-positive tracking. call_number = 0 means post-processing run.
CREATE TABLE IF NOT EXISTS shim_session_log (
  id           TEXT    PRIMARY KEY,
  manifest_id  TEXT    NOT NULL,
  file_path    TEXT    NOT NULL,
  call_number  INTEGER NOT NULL,   -- 1, 2, 3... in-session; 0 = post-processing
  score_before REAL,               -- NULL on first in-session call or post-processing
  score_after  REAL    NOT NULL,
  shim_required INTEGER NOT NULL,  -- 1 if score_after < 70
  logged_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shim_session_log_manifest
  ON shim_session_log (manifest_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_shim_session_log_file
  ON shim_session_log (file_path, logged_at DESC);

-- ─── PHASE 9: MANIFEST TEMPLATES ─────────────────────────────────────────────
-- Saved ManifestBuilder templates for recurring jobs. One row per template.
-- use_count incremented on each spawn from this template.
CREATE TABLE IF NOT EXISTS manifest_templates (
  id                   TEXT    PRIMARY KEY,
  name                 TEXT    NOT NULL UNIQUE,
  description          TEXT,
  task_type            TEXT    NOT NULL,
  title                TEXT    NOT NULL,
  template_description TEXT    NOT NULL,
  success_criteria     TEXT    NOT NULL,  -- JSON array of strings
  project_path         TEXT    NOT NULL,
  use_count            INTEGER DEFAULT 0,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_manifest_templates_task
  ON manifest_templates (task_type);

-- ─── KERNL SETTINGS — Sprint 22.0 ───────────────────────────────────────────
-- App-level persistent key/value store. Separate from 'settings' (threshold config).
-- Holds tab layout, UI preferences, and other cross-session state.
CREATE TABLE IF NOT EXISTS kernl_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)
);

-- ─── PHASE 9: GHOST PREFERENCES ──────────────────────────────────────────────
-- Positive reinforcement preferences for Ghost scorer. Each row boosts the
-- score of Ghost cards matching the source_type (or all if NULL).
-- Exclusions always win over preferences — layer order preserved.
CREATE TABLE IF NOT EXISTS ghost_preferences (
  id           TEXT    PRIMARY KEY,
  source_type  TEXT,              -- 'file' | 'email' | NULL (any)
  topic_hint   TEXT    NOT NULL,  -- e.g. "GHM competitor intelligence"
  boost_factor REAL    DEFAULT 1.5,  -- multiplier applied to ghost scorer
  created_at   INTEGER NOT NULL,
  use_count    INTEGER DEFAULT 0  -- incremented when preference fires
);

CREATE INDEX IF NOT EXISTS idx_ghost_preferences_source
  ON ghost_preferences (source_type);

-- ─── TRANSIT MAP LEARNING ENGINE — Sprint 11.7 ───────────────────────────────
-- Stores proposed/applied/dismissed insights from the learning pipeline.
-- Every applied insight has before_state for one-click rollback (§6.3).
CREATE TABLE IF NOT EXISTS learning_insights (
  id           TEXT    PRIMARY KEY,
  pattern_type TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  confidence   INTEGER NOT NULL,
  sample_size  INTEGER NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'proposed',
  adjustment   TEXT    NOT NULL DEFAULT '{}',  -- JSON: InsightAdjustment
  before_state TEXT    NOT NULL DEFAULT '{}',  -- JSON snapshot before applying
  after_state  TEXT,                           -- JSON snapshot after applying (null until applied)
  created_at   INTEGER NOT NULL,
  applied_at   INTEGER,
  expires_at   INTEGER NOT NULL                -- 90 days from created_at
);

CREATE INDEX IF NOT EXISTS idx_insights_status  ON learning_insights(status);
CREATE INDEX IF NOT EXISTS idx_insights_pattern ON learning_insights(pattern_type);
CREATE INDEX IF NOT EXISTS idx_insights_expires ON learning_insights(expires_at);

-- ─── SPRINT 19.0: ACTION JOURNAL ─────────────────────────────────────────────
-- Per-tool-call undo log. Every agent file write is journaled BEFORE execution
-- so before_state can restore the file on undo. Law 3 (Reversibility) enforcement.
CREATE TABLE IF NOT EXISTS action_journal (
  id           TEXT    PRIMARY KEY,
  session_id   TEXT    NOT NULL,
  tool_name    TEXT    NOT NULL,
  action_type  TEXT    NOT NULL CHECK(action_type IN ('file_write','file_delete','command','git_commit')),
  target_path  TEXT,               -- absolute path for file actions
  before_state TEXT,               -- file contents before write; NULL = file was new
  after_state  TEXT,               -- file contents after write; NULL until journalAfterWrite()
  command      TEXT,               -- command string for run_command / git_commit
  reversible   INTEGER NOT NULL DEFAULT 1,  -- 0 for commands and git ops
  undone       INTEGER NOT NULL DEFAULT 0,  -- 1 once successfully undone
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_journal_session
  ON action_journal (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_journal_undone
  ON action_journal (undone, reversible);

-- ─── IMPORT: MEMORY SOURCES ───────────────────────────────────────────────────
-- Sprint 33.0 / EPIC-81: Cross-Platform Conversation Memory Import
CREATE TABLE IF NOT EXISTS imported_sources (
  id                 TEXT PRIMARY KEY,
  source_type        TEXT NOT NULL,   -- 'claude_ai_export' | 'chatgpt_export' | 'generic_json' | etc.
  source_path        TEXT,            -- file path on disk (for watchfolder tracking)
  display_name       TEXT NOT NULL,   -- human-readable label shown in UI
  conversation_count INTEGER DEFAULT 0,
  chunk_count        INTEGER DEFAULT 0,
  last_synced_at     INTEGER,
  created_at         INTEGER NOT NULL,
  meta               TEXT             -- JSON: format version, last known conversation ID, etc.
);

-- ─── IMPORT: CONVERSATION INDEX (deduplication) ───────────────────────────────
CREATE TABLE IF NOT EXISTS imported_conversations (
  id                  TEXT PRIMARY KEY,
  imported_source_id  TEXT NOT NULL REFERENCES imported_sources(id),
  external_id         TEXT NOT NULL,    -- original platform conversation ID
  title               TEXT,
  message_count       INTEGER DEFAULT 0,
  created_at_source   INTEGER,          -- timestamp from source platform
  imported_at         INTEGER NOT NULL,
  UNIQUE(imported_source_id, external_id)  -- deduplication index
);

CREATE INDEX IF NOT EXISTS idx_imported_convs_source ON imported_conversations(imported_source_id);
