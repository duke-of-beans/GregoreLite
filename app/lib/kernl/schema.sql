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
