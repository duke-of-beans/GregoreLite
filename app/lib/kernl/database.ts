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

  return _db;
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
`;
