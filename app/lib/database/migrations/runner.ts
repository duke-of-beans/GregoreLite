/**
 * Migration Runner
 *
 * Manages database schema migrations with version tracking,
 * rollback support, and transactional safety.
 */

import { getDatabase } from '../connection';
import {
  Migration,
  MigrationRecord,
  MigrationResult,
  MigrationStatus,
} from './types';

const MIGRATIONS_TABLE = 'schema_migrations';

/**
 * Ensure migrations tracking table exists
 */
function ensureMigrationsTable(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch()),
      success INTEGER NOT NULL DEFAULT 1 CHECK(success IN (0, 1)),
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_migrations_applied_at 
      ON ${MIGRATIONS_TABLE}(applied_at DESC);
  `);
}

/**
 * Get current database schema version
 *
 * Returns highest successfully applied migration version.
 */
export function getCurrentVersion(): number {
  ensureMigrationsTable();
  const db = getDatabase();

  const result = db
    .prepare(
      `
      SELECT COALESCE(MAX(version), 0) as version 
      FROM ${MIGRATIONS_TABLE}
      WHERE success = 1
    `
    )
    .get() as { version: number };

  return result.version;
}

/**
 * Get all applied migrations
 */
export function getAppliedMigrations(): MigrationRecord[] {
  ensureMigrationsTable();
  const db = getDatabase();

  return db
    .prepare(
      `
      SELECT * FROM ${MIGRATIONS_TABLE}
      ORDER BY version ASC
    `
    )
    .all() as MigrationRecord[];
}

/**
 * Get migration status
 *
 * Returns current version, pending migrations, and rollback capability.
 */
export function getMigrationStatus(
  availableMigrations: Migration[]
): MigrationStatus {
  const current = getCurrentVersion();
  const applied = getAppliedMigrations();

  const pending = availableMigrations.filter((m) => m.version > current);

  const lastSuccessfulMigration = applied
    .filter((m) => m.success === 1)
    .sort((a, b) => b.version - a.version)[0];

  return {
    current,
    pending,
    applied,
    canRollback: lastSuccessfulMigration !== undefined,
  };
}

/**
 * Run a single migration
 *
 * Executes migration within transaction. Records success/failure.
 *
 * @param migration Migration to run
 * @param direction 'up' to apply, 'down' to rollback
 */
export function runMigration(
  migration: Migration,
  direction: 'up' | 'down' = 'up'
): MigrationResult {
  ensureMigrationsTable();
  const db = getDatabase();

  const statements = direction === 'up' ? migration.up : migration.down;

  try {
    // Run migration in transaction
    db.transaction(() => {
      // Execute all migration statements
      for (const statement of statements) {
        db.exec(statement);
      }

      // Record migration
      if (direction === 'up') {
        db.prepare(
          `
          INSERT OR REPLACE INTO ${MIGRATIONS_TABLE} 
          (version, name, applied_at, success, error_message)
          VALUES (?, ?, unixepoch(), 1, NULL)
        `
        ).run(migration.version, migration.name);
      } else {
        // For rollback, delete the migration record
        db.prepare(`DELETE FROM ${MIGRATIONS_TABLE} WHERE version = ?`).run(
          migration.version
        );
      }
    })();

    return {
      success: true,
      version: migration.version,
      name: migration.name,
      message: `Migration ${migration.version} (${migration.name}) ${direction === 'up' ? 'applied' : 'rolled back'} successfully`,
    };
  } catch (error) {
    // Record failed migration
    if (direction === 'up') {
      db.prepare(
        `
        INSERT OR REPLACE INTO ${MIGRATIONS_TABLE} 
        (version, name, applied_at, success, error_message)
        VALUES (?, ?, unixepoch(), 0, ?)
      `
      ).run(
        migration.version,
        migration.name,
        error instanceof Error ? error.message : String(error)
      );
    }

    return {
      success: false,
      version: migration.version,
      name: migration.name,
      message: `Migration ${migration.version} (${migration.name}) failed`,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Run all pending migrations
 *
 * Applies migrations in version order. Stops on first failure.
 */
export function migrateUp(migrations: Migration[]): MigrationResult[] {
  const current = getCurrentVersion();
  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);

  const results: MigrationResult[] = [];

  for (const migration of pending) {
    const result = runMigration(migration, 'up');
    results.push(result);

    if (!result.success) {
      // Stop on first failure
      break;
    }
  }

  return results;
}

/**
 * Rollback last migration
 *
 * Reverts most recently applied migration.
 */
export function migrateDown(migrations: Migration[]): MigrationResult {
  const current = getCurrentVersion();

  if (current === 0) {
    return {
      success: false,
      version: 0,
      name: '',
      message: 'No migrations to rollback',
    };
  }

  const migration = migrations.find((m) => m.version === current);

  if (!migration) {
    return {
      success: false,
      version: current,
      name: '',
      message: `Migration ${current} not found in available migrations`,
      error: new Error('Migration definition not found'),
    };
  }

  return runMigration(migration, 'down');
}

/**
 * Rollback to specific version
 *
 * Rolls back all migrations after target version.
 */
export function migrateTo(
  migrations: Migration[],
  targetVersion: number
): MigrationResult[] {
  const current = getCurrentVersion();

  if (targetVersion > current) {
    // Migrate up
    return migrateUp(migrations);
  } else if (targetVersion < current) {
    // Migrate down
    const results: MigrationResult[] = [];

    while (getCurrentVersion() > targetVersion) {
      const result = migrateDown(migrations);
      results.push(result);

      if (!result.success) {
        break;
      }
    }

    return results;
  } else {
    return [
      {
        success: true,
        version: current,
        name: '',
        message: 'Already at target version',
      },
    ];
  }
}

/**
 * Reset database (DANGEROUS - drops all tables)
 *
 * Use only for tests or fresh installations.
 */
export function resetDatabase(): void {
  const db = getDatabase();

  // Get all tables
  const tables = db
    .prepare(
      `
      SELECT name FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
    `
    )
    .all() as { name: string }[];

  // Drop all tables
  for (const table of tables) {
    db.exec(`DROP TABLE IF EXISTS ${table.name}`);
  }
}
