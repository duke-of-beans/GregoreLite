/**
 * Database Performance Configuration
 *
 * Optimizes SQLite connection for GREGORE workload.
 * Sets PRAGMA directives for best performance.
 */

import Database from 'better-sqlite3';

/**
 * Performance configuration options
 */
export interface PerformanceConfig {
  /** Journal mode (default: WAL) */
  journalMode?: 'DELETE' | 'WAL' | 'MEMORY';

  /** Synchronous mode (default: NORMAL) */
  synchronous?: 'OFF' | 'NORMAL' | 'FULL';

  /** Cache size in KB (default: 64MB = 64000) */
  cacheSizeKB?: number;

  /** Temp store location (default: MEMORY) */
  tempStore?: 'DEFAULT' | 'FILE' | 'MEMORY';

  /** Memory-mapped I/O size in bytes (default: 30GB) */
  mmapSize?: number;

  /** Page size in bytes (default: 4096) */
  pageSize?: number;

  /** Enable auto-vacuum (default: INCREMENTAL) */
  autoVacuum?: 'NONE' | 'FULL' | 'INCREMENTAL';
}

/**
 * Default performance configuration
 * Optimized for desktop application with good SSD
 */
export const DEFAULT_PERFORMANCE_CONFIG: Required<PerformanceConfig> = {
  journalMode: 'WAL', // Write-Ahead Logging for concurrency
  synchronous: 'NORMAL', // Balance between safety and speed
  cacheSizeKB: 64000, // 64MB cache
  tempStore: 'MEMORY', // Temp tables in memory
  mmapSize: 30000000000, // 30GB memory-mapped I/O
  pageSize: 4096, // Standard page size
  autoVacuum: 'INCREMENTAL', // Gradual space reclamation
};

/**
 * Apply performance configuration to database connection
 */
export function applyPerformanceConfig(
  db: Database.Database,
  config: PerformanceConfig = {}
): void {
  const cfg = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };

  // Set journal mode (must be set before other pragmas)
  db.pragma(`journal_mode = ${cfg.journalMode}`);

  // Set synchronous mode
  db.pragma(`synchronous = ${cfg.synchronous}`);

  // Set cache size (negative value = KB, positive = pages)
  db.pragma(`cache_size = -${cfg.cacheSizeKB}`);

  // Set temp store
  db.pragma(`temp_store = ${cfg.tempStore}`);

  // Set memory-mapped I/O size
  db.pragma(`mmap_size = ${cfg.mmapSize}`);

  // Set page size (only works on empty database)
  // db.pragma(`page_size = ${cfg.pageSize}`);

  // Set auto-vacuum mode
  db.pragma(`auto_vacuum = ${cfg.autoVacuum}`);

  // Additional optimizations
  db.pragma('foreign_keys = ON'); // Enable foreign key constraints
  db.pragma('busy_timeout = 5000'); // 5 second timeout for locks
  db.pragma('wal_autocheckpoint = 1000'); // Checkpoint every 1000 pages
}

/**
 * Get current database performance settings
 */
export function getPerformanceConfig(
  db: Database.Database
): Record<string, unknown> {
  return {
    journal_mode: db.pragma('journal_mode', { simple: true }),
    synchronous: db.pragma('synchronous', { simple: true }),
    cache_size: db.pragma('cache_size', { simple: true }),
    temp_store: db.pragma('temp_store', { simple: true }),
    mmap_size: db.pragma('mmap_size', { simple: true }),
    page_size: db.pragma('page_size', { simple: true }),
    auto_vacuum: db.pragma('auto_vacuum', { simple: true }),
    foreign_keys: db.pragma('foreign_keys', { simple: true }),
    busy_timeout: db.pragma('busy_timeout', { simple: true }),
    wal_autocheckpoint: db.pragma('wal_autocheckpoint', { simple: true }),
  };
}
/**
 * Run database optimization tasks
 */
export function optimizeDatabase(db: Database.Database): void {
  console.log('[Database] Running optimization tasks...');

  // Update query planner statistics
  db.exec('ANALYZE');

  // Rebuild FTS indexes for optimal performance
  db.exec(
    "INSERT INTO conversations_fts(conversations_fts) VALUES('optimize')"
  );
  db.exec("INSERT INTO messages_fts(messages_fts) VALUES('optimize')");

  console.log('[Database] Optimization complete');
}

/**
 * Get database statistics
 */
export function getDatabaseStats(db: Database.Database): {
  sizeMB: number;
  pageCount: number;
  pageSize: number;
  freelistCount: number;
  walSize?: number;
} {
  const pageCount = db.pragma('page_count', { simple: true }) as number;
  const pageSize = db.pragma('page_size', { simple: true }) as number;
  const freelistCount = db.pragma('freelist_count', { simple: true }) as number;

  return {
    sizeMB: (pageCount * pageSize) / 1024 / 1024,
    pageCount,
    pageSize,
    freelistCount,
  };
}

/**
 * Check if database needs vacuuming
 * Returns true if more than 10% of pages are in freelist
 */
export function needsVacuum(db: Database.Database): boolean {
  const pageCount = db.pragma('page_count', { simple: true }) as number;
  const freelistCount = db.pragma('freelist_count', { simple: true }) as number;

  if (pageCount === 0) return false;

  const fragmentationPercent = (freelistCount / pageCount) * 100;
  return fragmentationPercent > 10;
}

/**
 * Run incremental vacuum
 * Reclaims unused pages without blocking database
 */
export function incrementalVacuum(
  db: Database.Database,
  pages: number = 100
): void {
  db.pragma(`incremental_vacuum(${pages})`);
}

/**
 * Check WAL (Write-Ahead Log) checkpoint status
 */
export function getWALStatus(db: Database.Database): {
  mode: string;
  checkpointThreshold: number;
} | null {
  const mode = db.pragma('journal_mode', { simple: true }) as string;

  if (mode !== 'wal') return null;

  const checkpointThreshold = db.pragma('wal_autocheckpoint', {
    simple: true,
  }) as number;

  return {
    mode,
    checkpointThreshold,
  };
}

/**
 * Force WAL checkpoint
 * Useful before backup or when WAL file is large
 */
export function checkpointWAL(
  db: Database.Database,
  mode: 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE' = 'RESTART'
): void {
  db.pragma(`wal_checkpoint(${mode})`);
}

/**
 * Get query performance profile
 * Returns EXPLAIN QUERY PLAN for a query
 */
export function explainQuery(
  db: Database.Database,
  query: string
): Array<{
  id: number;
  parent: number;
  notused: number;
  detail: string;
}> {
  const stmt = db.prepare(`EXPLAIN QUERY PLAN ${query}`);
  return stmt.all() as Array<{
    id: number;
    parent: number;
    notused: number;
    detail: string;
  }>;
}

/**
 * Performance monitoring helper
 * Logs slow queries in development
 */
export function monitorQuery<T>(
  db: Database.Database,
  query: string,
  params: unknown[],
  warnThresholdMs: number = 100
): T {
  const start = performance.now();
  const stmt = db.prepare(query);
  const result = stmt.all(...params) as T;
  const duration = performance.now() - start;

  if (duration > warnThresholdMs && process.env.NODE_ENV === 'development') {
    console.warn(
      `[Database] Slow query (${duration.toFixed(2)}ms):\n${query}\nParams:`,
      params
    );
  }

  return result;
}
