/**
 * Database Connection Factory
 *
 * Provides singleton SQLite database connection with proper initialization,
 * error handling, and resource management.
 *
 * Sprint 10.8 Task 1: Auto-initializes on first getDatabase() call.
 * No longer requires initializeDatabase() to be called explicitly.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

export interface DatabaseConfig {
  filename?: string;
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
}

export interface DatabaseConnection {
  db: Database.Database;
  close: () => void;
  isOpen: () => boolean;
}

let dbInstance: Database.Database | null = null;

/**
 * Get (or auto-create) the singleton database connection.
 *
 * On first call: creates the data directory, opens the SQLite file,
 * sets pragmas, and runs any pending migrations.
 * On subsequent calls: returns the existing connection.
 */
export function getDatabase(): Database.Database {
  if (dbInstance && dbInstance.open) {
    return dbInstance;
  }

  const dbFile = join(process.cwd(), 'data', 'gregore.db');

  // Ensure data directory exists
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });

  dbInstance = new Database(dbFile, { timeout: 5000 });

  // Enable foreign keys
  dbInstance.pragma('foreign_keys = ON');
  // Set WAL mode for better concurrency
  dbInstance.pragma('journal_mode = WAL');
  // Performance optimizations
  dbInstance.pragma('synchronous = NORMAL');
  dbInstance.pragma('cache_size = -64000'); // 64MB cache
  dbInstance.pragma('temp_store = MEMORY');
  dbInstance.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O
  dbInstance.pragma('page_size = 4096');
  dbInstance.pragma('optimize');

  // Run migrations on first connect (Task 2)
  try {
    const { migrateUp } = require('./migrations/runner') as {
      migrateUp: (migrations: import('./migrations/types').Migration[]) => unknown[];
    };
    const { migrations } = require('./migrations/index') as {
      migrations: import('./migrations/types').Migration[];
    };
    migrateUp(migrations);
  } catch (err) {
    console.warn('[database] migration warning:', err);
  }

  return dbInstance;
}

/**
 * Initialize database connection (legacy async API — kept for Tauri production builds).
 *
 * In dev/Node.js, getDatabase() now auto-initializes. This function is only needed
 * when you want to pass a specific filename (e.g. Tauri appDataDir path).
 */
export async function initializeDatabase(
  config: DatabaseConfig = {}
): Promise<DatabaseConnection> {
  if (dbInstance && dbInstance.open) {
    return {
      db: dbInstance,
      close: closeDatabase,
      isOpen: () => dbInstance !== null && dbInstance.open,
    };
  }

  // If a specific filename is provided, open that file instead of the default
  if (config.filename) {
    mkdirSync(require('path').dirname(config.filename), { recursive: true });
    dbInstance = new Database(config.filename, {
      readonly: config.readonly ?? false,
      fileMustExist: config.fileMustExist ?? false,
      timeout: config.timeout ?? 5000,
      verbose: config.verbose,
    });

    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('synchronous = NORMAL');
    dbInstance.pragma('cache_size = -64000');
    dbInstance.pragma('temp_store = MEMORY');
    dbInstance.pragma('mmap_size = 268435456');
    dbInstance.pragma('page_size = 4096');
    dbInstance.pragma('optimize');
  } else {
    // Fall back to auto-init
    getDatabase();
  }

  return {
    db: dbInstance!,
    close: closeDatabase,
    isOpen: () => dbInstance !== null && dbInstance!.open,
  };
}

/**
 * Close database connection
 *
 * Safely closes connection and cleans up resources.
 * Safe to call multiple times.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (error) {
      console.error('Error closing database:', error);
    } finally {
      dbInstance = null;
    }
  }
}

/**
 * Execute database transaction
 */
export async function executeTransaction<T>(
  callback: (db: Database.Database) => T | Promise<T>
): Promise<T> {
  const db = getDatabase();

  const transaction = db.transaction(() => callback(db));

  try {
    return transaction();
  } catch (error) {
    throw new Error(
      `Transaction failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if database file exists
 */
export async function databaseExists(): Promise<boolean> {
  const path = join(process.cwd(), 'data', 'gregore.db');
  const fs = await import('fs/promises');

  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get database file size in bytes
 */
export async function getDatabaseSize(): Promise<number> {
  const path = join(process.cwd(), 'data', 'gregore.db');
  const fs = await import('fs/promises');

  try {
    const stats = await fs.stat(path);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): {
  pageCount: number;
  pageSize: number;
  freelistCount: number;
  schemaVersion: number;
} {
  const db = getDatabase();

  return {
    pageCount: db.pragma('page_count', { simple: true }) as number,
    pageSize: db.pragma('page_size', { simple: true }) as number,
    freelistCount: db.pragma('freelist_count', { simple: true }) as number,
    schemaVersion: db.pragma('schema_version', { simple: true }) as number,
  };
}
