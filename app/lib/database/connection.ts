/**
 * Database Connection Factory
 *
 * Provides singleton SQLite database connection with proper initialization,
 * error handling, and resource management.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { appDataDir } from '@tauri-apps/api/path';

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
let dbPath: string | null = null;

/**
 * Get database file path
 *
 * In development: ./data/gregore.db
 * In production: User data directory from Tauri
 */
async function getDatabasePath(): Promise<string> {
  if (dbPath) return dbPath;

  try {
    // Try to get Tauri app data directory
    const appData = await appDataDir();
    dbPath = join(appData, 'gregore.db');
  } catch {
    // Fallback for non-Tauri environment (tests, development)
    dbPath = join(process.cwd(), 'data', 'gregore.db');
  }

  return dbPath;
}

/**
 * Initialize database connection
 *
 * Creates singleton connection with proper configuration.
 * Safe to call multiple times - returns existing connection.
 */
export async function initializeDatabase(
  config: DatabaseConfig = {}
): Promise<DatabaseConnection> {
  if (dbInstance) {
    return {
      db: dbInstance,
      close: closeDatabase,
      isOpen: () => dbInstance !== null && dbInstance.open,
    };
  }

  const filename = config.filename || (await getDatabasePath());

  try {
    dbInstance = new Database(filename, {
      readonly: config.readonly ?? false,
      fileMustExist: config.fileMustExist ?? false,
      timeout: config.timeout ?? 5000,
      verbose: config.verbose,
    });

    // Enable foreign keys
    dbInstance.pragma('foreign_keys = ON');

    // Set WAL mode for better concurrency
    dbInstance.pragma('journal_mode = WAL');

    // Performance optimizations
    dbInstance.pragma('synchronous = NORMAL'); // Balance safety and speed
    dbInstance.pragma('cache_size = -64000'); // 64MB cache
    dbInstance.pragma('temp_store = MEMORY'); // Store temp tables in memory
    dbInstance.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O
    dbInstance.pragma('page_size = 4096'); // Optimal page size

    // Query optimizer settings
    dbInstance.pragma('optimize'); // Run optimizer on startup

    return {
      db: dbInstance,
      close: closeDatabase,
      isOpen: () => dbInstance !== null && dbInstance.open,
    };
  } catch (error) {
    throw new Error(
      `Failed to initialize database at ${filename}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get existing database connection
 *
 * @throws Error if database not initialized
 */
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.'
    );
  }

  if (!dbInstance.open) {
    throw new Error('Database connection is closed.');
  }

  return dbInstance;
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
      dbPath = null;
    }
  }
}

/**
 * Execute database transaction
 *
 * Automatically handles commit/rollback and provides type-safe callback.
 *
 * @example
 * ```typescript
 * const result = await executeTransaction(async (db) => {
 *   db.prepare('INSERT INTO ...').run();
 *   db.prepare('UPDATE ...').run();
 *   return { success: true };
 * });
 * ```
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
  const path = await getDatabasePath();
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
  const path = await getDatabasePath();
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
