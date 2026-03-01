/**
 * Database Module
 *
 * Core database functionality for GREGORE.
 * Provides SQLite connection, schema management, and utilities.
 */

export {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  executeTransaction,
  databaseExists,
  getDatabaseSize,
  getDatabaseStats,
  type DatabaseConfig,
  type DatabaseConnection,
} from './connection';

export {
  initializeSchema,
  verifySchema,
  getSchemaVersion,
  isDatabaseEmpty,
  dropAllTables,
  type InitializationResult,
} from './init';

export {
  migrations,
  getMigration,
  getMigrationsAfter,
  getLatestVersion,
} from './migrations';

export {
  getCurrentVersion,
  getAppliedMigrations,
  getMigrationStatus,
  runMigration,
  migrateUp,
  migrateDown,
  migrateTo,
  resetDatabase,
} from './migrations/runner';

export type {
  Migration,
  MigrationRecord,
  MigrationResult,
  MigrationStatus,
} from './migrations/types';
