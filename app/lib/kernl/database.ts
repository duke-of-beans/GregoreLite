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
  // Resolve schema.sql relative to this file at runtime
  return path.join(__dirname, 'schema.sql');
}

export function getDatabase(): Database.Database {
  if (_db) return _db;

  const dbPath = getDbPath();
  _db = new Database(dbPath);

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
