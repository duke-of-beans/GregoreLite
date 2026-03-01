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
`;
