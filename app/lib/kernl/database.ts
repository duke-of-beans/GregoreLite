import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let _db: Database.Database | null = null;

function getDbPath(): string {
  // In Tauri context, use app data dir. For Next.js dev, use project root.
  const base = process.env.KERNL_DB_PATH ?? path.join(process.cwd(), '.kernl');
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
  }
  return path.join(base, 'greglite.db');
}

function getSchemaPath(): string {
  // In Next.js dev, __dirname resolves to .next/server/ which won't have schema.sql.
  // Use cwd-relative path (Next.js always runs from the project root).
  // Tauri production builds bundle the schema via INLINE_SCHEMA fallback.
  const cwdPath = path.join(process.cwd(), 'lib', 'kernl', 'schema.sql');
  if (fs.existsSync(cwdPath)) return cwdPath;
  // Fallback: try __dirname for non-Next.js contexts (e.g. vitest)
  return path.join(__dirname, 'schema.sql');
}

export function getDatabase(): Database.Database {
  if (_db) return _db;

  const dbPath = getDbPath();

  try {
    _db = new Database(dbPath);
  } catch (err) {
    // If the DB file is corrupted, back it up and create a fresh one.
    // This prevents the app from being permanently bricked by a bad DB.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[kernl/database] Failed to open ${dbPath}: ${msg}`);

    if (fs.existsSync(dbPath)) {
      const backup = `${dbPath}.corrupt.${Date.now()}`;
      console.warn(`[kernl/database] Backing up corrupted DB to ${backup}`);
      try {
        fs.renameSync(dbPath, backup);
      } catch {
        // If rename fails, try to remove the corrupted file
        fs.unlinkSync(dbPath);
      }
    }

    // Retry with fresh DB
    _db = new Database(dbPath);
    console.warn('[kernl/database] Created fresh database after corruption recovery');
  }

  // Performance pragmas
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('cache_size = -64000'); // 64MB cache
  _db.pragma('temp_store = MEMORY');

  // Run schema migrations
  const schemaPath = getSchemaPath();
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    _db.exec(schema);
  } else {
    // Inline minimal schema if file not available (Tauri bundle fallback)
    _db.exec(INLINE_SCHEMA);
  }

  // Run additive column migrations (ALTER TABLE ADD COLUMN).
  // SQLite does not support IF NOT EXISTS in ALTER TABLE before v3.37.0.
  // We catch "duplicate column name" errors (SQLITE_ERROR code 1) and treat
  // them as success — idempotent on repeated startup.
  runMigrations(_db);

  return _db;
}

/**
 * Additive column migrations that cannot use IF NOT EXISTS.
 * SQLite does not support ALTER TABLE ... ADD COLUMN IF NOT EXISTS before v3.37.0,
 * and the better-sqlite3 bundled version is older than that.
 * Each statement is attempted independently; duplicate-column errors are swallowed.
 * Ordered by phase so dependencies are always satisfied.
 */
function runMigrations(db: Database.Database): void {
  const alterStatements: string[] = [
    // Phase 5A — EoS health score columns on projects
    'ALTER TABLE projects ADD COLUMN health_score  REAL DEFAULT NULL',
    'ALTER TABLE projects ADD COLUMN last_eos_scan TEXT DEFAULT NULL',
    // Phase 5B — SHIM score baseline on manifests
    'ALTER TABLE manifests ADD COLUMN shim_score_before REAL DEFAULT NULL',
    // Phase 6C — Ghost provenance tracking on content_chunks
    'ALTER TABLE content_chunks ADD COLUMN source_path    TEXT',
    'ALTER TABLE content_chunks ADD COLUMN source_account TEXT',
    // Phase 6E — critical flag on ghost_indexed_items
    'ALTER TABLE ghost_indexed_items ADD COLUMN critical INTEGER DEFAULT 0',
    // Phase 7A — Agent SDK self-evolution columns on manifests
    'ALTER TABLE manifests ADD COLUMN target_component TEXT',
    'ALTER TABLE manifests ADD COLUMN goal_summary     TEXT',
    'ALTER TABLE manifests ADD COLUMN shim_score_after REAL DEFAULT NULL',
    // Phase 7H — PR tracking for self-evolution [Merge PR] button
    'ALTER TABLE manifests ADD COLUMN pr_number  INTEGER DEFAULT NULL',
    'ALTER TABLE manifests ADD COLUMN ci_passed  INTEGER DEFAULT NULL',
    // Sprint 26 — Portfolio attention mute preference
    'ALTER TABLE portfolio_projects ADD COLUMN attention_muted_until INTEGER DEFAULT NULL',
    // Sprint 27 — Recall events table (CREATE handled in runMigrations block below)
  ];

  for (const sql of alterStatements) {
    try {
      db.exec(sql);
    } catch (err: unknown) {
      // SQLite error message for duplicate column: "table X already has column named Y"
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column name') && !msg.includes('already has column')) {
        throw err; // Unexpected error — re-throw
      }
      // Column already exists — silently continue
    }
  }

  // S9-16 — FTS5 virtual table for full-text search on decisions
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
        title, rationale,
        content='decisions', content_rowid='rowid'
      );
    `);
  } catch {
    // FTS table may already exist or fts5 may not be available
  }

  // Sprint 10.6 — Transit Map: conversation_events table
  // Sprint 22.0 — added created_at column (mirrors timestamp; timestamp kept for compat)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_events (
        id              TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        message_id      TEXT,
        event_type      TEXT NOT NULL,
        category        TEXT NOT NULL,
        timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        payload         TEXT NOT NULL DEFAULT '{}',
        schema_version  INTEGER NOT NULL DEFAULT 1,
        tags            TEXT DEFAULT '[]',
        annotations     TEXT DEFAULT '[]',
        learning_status TEXT DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS idx_events_conversation ON conversation_events(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON conversation_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_category ON conversation_events(category);
      CREATE INDEX IF NOT EXISTS idx_events_message ON conversation_events(message_id)
        WHERE message_id IS NOT NULL;
    `);
  } catch {
    // Table may already exist
  }

  // Sprint 11.7 — Learning Engine: learning_insights table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS learning_insights (
        id           TEXT    PRIMARY KEY,
        pattern_type TEXT    NOT NULL,
        title        TEXT    NOT NULL,
        description  TEXT    NOT NULL,
        confidence   INTEGER NOT NULL,
        sample_size  INTEGER NOT NULL,
        status       TEXT    NOT NULL DEFAULT 'proposed',
        adjustment   TEXT    NOT NULL DEFAULT '{}',
        before_state TEXT    NOT NULL DEFAULT '{}',
        after_state  TEXT,
        created_at   INTEGER NOT NULL,
        applied_at   INTEGER,
        expires_at   INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_insights_status  ON learning_insights(status);
      CREATE INDEX IF NOT EXISTS idx_insights_pattern ON learning_insights(pattern_type);
      CREATE INDEX IF NOT EXISTS idx_insights_expires ON learning_insights(expires_at);
    `);
  } catch {
    // Table may already exist
  }

  // Sprint 10.6 — Transit Map: tree structure columns on messages
  const treeColumns = [
    { name: 'parent_id', type: 'TEXT DEFAULT NULL' },
    { name: 'branch_index', type: 'INTEGER DEFAULT 0' },
    { name: 'is_active_branch', type: 'INTEGER DEFAULT 1' },
  ];
  for (const col of treeColumns) {
    try {
      db.exec(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.type}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column') && !msg.includes('already has column')) throw err;
    }
  }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id) WHERE parent_id IS NOT NULL`);
  } catch { /* index may already exist */ }

  // Sprint 18.0 — Adaptive Override System: gate_override_policies table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS gate_override_policies (
        id           TEXT PRIMARY KEY,
        trigger_type TEXT NOT NULL,
        scope        TEXT NOT NULL CHECK(scope IN ('once', 'category', 'always')),
        category     TEXT,
        created_at   INTEGER NOT NULL,
        expires_at   INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_gate_policies_trigger
        ON gate_override_policies(trigger_type);
    `);
  } catch {
    // Table may already exist
  }

  // Sprint 19.0 — Action Journal: agent tool undo infrastructure (Law 3)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS action_journal (
        id           TEXT    PRIMARY KEY,
        session_id   TEXT    NOT NULL,
        tool_name    TEXT    NOT NULL,
        action_type  TEXT    NOT NULL CHECK(action_type IN ('file_write','file_delete','command','git_commit')),
        target_path  TEXT,
        before_state TEXT,
        after_state  TEXT,
        command      TEXT,
        reversible   INTEGER NOT NULL DEFAULT 1,
        undone       INTEGER NOT NULL DEFAULT 0,
        created_at   INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_action_journal_session
        ON action_journal (session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_action_journal_undone
        ON action_journal (undone, reversible);
    `);
  } catch {
    // Table may already exist
  }

  // Sprint 22.0 — Schema gap fixes: conversation_events.created_at, eos_reports.scanned_at
  // These handle existing DBs that were created before these columns were added.
  const sprint22Migrations = [
    // conversation_events: add created_at (literal default for ALTER TABLE compat)
    `ALTER TABLE conversation_events ADD COLUMN created_at TEXT DEFAULT ''`,
    // eos_reports: add scanned_at (alias for created_at used by scanner pipeline)
    `ALTER TABLE eos_reports ADD COLUMN scanned_at TEXT DEFAULT NULL`,
  ];
  for (const sql of sprint22Migrations) {
    try {
      db.exec(sql);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column name') && !msg.includes('already has column')) {
        throw err;
      }
    }
  }

  // Sprint 22.0 — kernl_settings: app-level key/value store for persisted config
  // Separate from 'settings' (threshold config) — holds tab layout, UI state etc.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS kernl_settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)
      );
    `);
  } catch {
    // Table may already exist
  }

  // Sprint 24.0 — Portfolio Dashboard: project registry, telemetry, and archive tables
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS portfolio_projects (
        id              TEXT    PRIMARY KEY,
        name            TEXT    NOT NULL,
        path            TEXT    NOT NULL UNIQUE,
        type            TEXT    NOT NULL DEFAULT 'custom',
        type_label      TEXT,
        status          TEXT    NOT NULL DEFAULT 'active',
        registered_at   INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
        last_scanned_at INTEGER,
        scan_data       TEXT
      );

      CREATE TABLE IF NOT EXISTS portfolio_telemetry (
        id                          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_type                TEXT    NOT NULL,
        custom_type_label           TEXT,
        questions_asked             TEXT,
        metrics_configured          TEXT,
        template_used               TEXT,
        migration_vs_new            TEXT    NOT NULL,
        onboarding_duration_seconds INTEGER,
        created_at                  INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)
      );

      CREATE TABLE IF NOT EXISTS portfolio_archives (
        id               TEXT    PRIMARY KEY,
        project_id       TEXT    NOT NULL REFERENCES portfolio_projects(id),
        original_path    TEXT    NOT NULL,
        archive_path     TEXT    NOT NULL,
        archived_at      INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000),
        verified_by_user INTEGER NOT NULL DEFAULT 0,
        deleted_at       INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_portfolio_projects_status
        ON portfolio_projects(status);
      CREATE INDEX IF NOT EXISTS idx_portfolio_projects_type
        ON portfolio_projects(type);
      CREATE INDEX IF NOT EXISTS idx_portfolio_archives_project
        ON portfolio_archives(project_id);
    `);
  } catch {
    // Tables may already exist
  }

  // Sprint 28.0 — Ceremonial Onboarding: indexing sources + master synthesis + nudges + telemetry
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS indexing_sources (
        id               TEXT    PRIMARY KEY,
        type             TEXT    NOT NULL,
        label            TEXT    NOT NULL,
        status           TEXT    NOT NULL DEFAULT 'pending',
        path_or_config   TEXT,
        indexed_count    INTEGER NOT NULL DEFAULT 0,
        total_count      INTEGER,
        started_at       INTEGER,
        completed_at     INTEGER,
        synthesis_text   TEXT,
        combination_text TEXT,
        created_at       INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_indexing_sources_status
        ON indexing_sources(status);
      CREATE INDEX IF NOT EXISTS idx_indexing_sources_type
        ON indexing_sources(type);

      CREATE TABLE IF NOT EXISTS master_synthesis (
        id                  TEXT    PRIMARY KEY,
        overview            TEXT    NOT NULL DEFAULT '',
        patterns            TEXT    NOT NULL DEFAULT '[]',
        insights            TEXT    NOT NULL DEFAULT '[]',
        blind_spots         TEXT    NOT NULL DEFAULT '[]',
        capability_summary  TEXT    NOT NULL DEFAULT '',
        sources_used        TEXT    NOT NULL DEFAULT '[]',
        status              TEXT    NOT NULL DEFAULT 'pending',
        generated_at        INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
      );

      CREATE TABLE IF NOT EXISTS synthesis_nudges (
        id                    TEXT    PRIMARY KEY,
        source_type           TEXT    NOT NULL,
        source_label          TEXT    NOT NULL,
        capability_teaser     TEXT    NOT NULL,
        sent_at               INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000),
        dismissed_count       INTEGER NOT NULL DEFAULT 0,
        last_dismissed_at     INTEGER,
        permanently_silenced  INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_synthesis_nudges_type
        ON synthesis_nudges(source_type, permanently_silenced);

      CREATE TABLE IF NOT EXISTS synthesis_telemetry (
        id                      TEXT    PRIMARY KEY,
        sources_added_order     TEXT    NOT NULL DEFAULT '[]',
        sources_skipped         TEXT    NOT NULL DEFAULT '[]',
        per_source_read_time_ms TEXT    NOT NULL DEFAULT '{}',
        completed_master        INTEGER NOT NULL DEFAULT 0,
        exited_early            INTEGER NOT NULL DEFAULT 0,
        nudge_conversions       TEXT    NOT NULL DEFAULT '[]',
        created_at              INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
      );
    `);
  } catch {
    // Tables may already exist
  }

  // Sprint 27 — Recall events: ambient memory surfacing
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS recall_events (
        id              TEXT    PRIMARY KEY,
        type            TEXT    NOT NULL,
        source_type     TEXT    NOT NULL,
        source_id       TEXT,
        source_name     TEXT    NOT NULL,
        message         TEXT    NOT NULL,
        context_data    TEXT,
        relevance_score REAL    NOT NULL DEFAULT 0.5,
        surfaced_at     INTEGER,
        user_action     TEXT,
        acted_at        INTEGER,
        created_at      INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_recall_surfaced ON recall_events(surfaced_at, user_action);
      CREATE INDEX IF NOT EXISTS idx_recall_type     ON recall_events(type, created_at DESC);
    `);
  } catch {
    // Table may already exist
  }

  // S9-21 — Log Memory Modal deprecation decision (idempotent via fixed ID)
  try {
    db.exec(`
      INSERT OR IGNORE INTO decisions (id, thread_id, category, title, rationale, alternatives, impact, created_at)
      VALUES (
        'decision-s9-21-memory-modal-deprecated',
        NULL,
        'ui',
        'Memory Modal deprecated in favor of command palette KERNL search',
        'Cmd+M was originally intended as a standalone memory surface. After Phase 9, this functionality is fully covered by: (1) Command palette KERNL search (Cmd+K → kernl.search, kernl.decisions) which provides quick access to any KERNL content, and (2) Decision Browser (Cmd+D) which provides filtered, full-text-searchable browsing of all decisions with rationale and alternatives. A separate Memory Modal would duplicate these surfaces with no additional value. Cmd+M removed from KeyboardShortcuts.tsx; Cmd+D and Cmd+L added in its place.',
        '["Keep Cmd+M as alias for Decision Browser","Build Memory Modal as unified KERNL+Decision+Artifact search","Defer to Phase 10"]',
        'low',
        ${Date.now()}
      );
    `);
  } catch {
    // Decision already exists — silently continue
  }

  // Sprint 29.0 — Quick Capture Pad: capture_notes table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS capture_notes (
        id                TEXT    PRIMARY KEY,
        project_id        TEXT,
        raw_text          TEXT    NOT NULL,
        parsed_project    TEXT,
        parsed_body       TEXT    NOT NULL,
        classification    TEXT    NOT NULL DEFAULT 'idea',
        mention_count     INTEGER NOT NULL DEFAULT 1,
        merged_with       TEXT,
        status            TEXT    NOT NULL DEFAULT 'inbox',
        backlog_item_id   TEXT,
        created_at        INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000),
        last_mentioned_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_capture_project  ON capture_notes(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_capture_mentions ON capture_notes(mention_count DESC);
    `);
  } catch {
    // Table may already exist
  }
}

export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// Minimal inline schema as fallback when schema.sql not on disk
const INLINE_SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT 'New Thread', project_id TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec')*1000), updated_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec')*1000), meta TEXT);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('user','assistant','system')), content TEXT NOT NULL, model TEXT, input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0, cost_usd REAL DEFAULT 0, latency_ms INTEGER DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec')*1000), meta TEXT);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);
CREATE TABLE IF NOT EXISTS decisions (id TEXT PRIMARY KEY, thread_id TEXT REFERENCES threads(id) ON DELETE SET NULL, category TEXT NOT NULL, title TEXT NOT NULL, rationale TEXT NOT NULL, alternatives TEXT, impact TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec')*1000), meta TEXT);
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT UNIQUE NOT NULL, description TEXT, health_score REAL, last_eos_scan TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec')*1000), updated_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec')*1000));
CREATE TABLE IF NOT EXISTS checkpoints (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE, message_id TEXT REFERENCES messages(id) ON DELETE SET NULL, snapshot TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec')*1000));
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread ON checkpoints(thread_id, created_at DESC);
CREATE TABLE IF NOT EXISTS manifests (id TEXT PRIMARY KEY, version TEXT NOT NULL DEFAULT '1.0', spawned_by_thread TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE, strategic_thread_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec')*1000), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','spawning','running','working','validating','completed','failed','interrupted')), task_type TEXT CHECK(task_type IN ('code','test','docs','research','deploy','self_evolution')), title TEXT, description TEXT, project_path TEXT, dependencies TEXT, quality_gates TEXT, is_self_evolution INTEGER DEFAULT 0, self_evolution_branch TEXT, result_report TEXT, tokens_used INTEGER DEFAULT 0, cost_usd REAL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_manifests_status ON manifests(status);
CREATE INDEX IF NOT EXISTS idx_manifests_thread ON manifests(spawned_by_thread);
CREATE TABLE IF NOT EXISTS content_chunks (id TEXT PRIMARY KEY, source_type TEXT NOT NULL CHECK(source_type IN ('conversation','file','email','email_attachment')), source_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, metadata TEXT, model_id TEXT NOT NULL, created_at INTEGER NOT NULL, indexed_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_chunks_source ON content_chunks(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_model ON content_chunks(model_id);
CREATE TABLE IF NOT EXISTS suggestions (id TEXT PRIMARY KEY, chunk_id TEXT NOT NULL, similarity_score REAL NOT NULL, display_score REAL NOT NULL, surface_context TEXT NOT NULL CHECK(surface_context IN ('on_input','pattern','already_built')), user_action TEXT CHECK(user_action IN ('accepted','dismissed','ignored')), acted_at INTEGER, surfaced_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec')*1000));
CREATE INDEX IF NOT EXISTS idx_suggestions_chunk ON suggestions(chunk_id, acted_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_context ON suggestions(surface_context, acted_at DESC);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec')*1000));
`;
