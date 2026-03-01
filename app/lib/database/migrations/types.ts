/**
 * Migration System Types
 *
 * Defines interfaces and types for database migrations.
 */

export interface Migration {
  /** Migration version number (e.g., 1, 2, 3) */
  version: number;

  /** Human-readable migration name */
  name: string;

  /** SQL statements to apply migration */
  up: string[];

  /** SQL statements to rollback migration */
  down: string[];

  /** Optional timestamp when migration was created */
  createdAt?: Date;
}

export interface MigrationRecord {
  version: number;
  name: string;
  applied_at: number;
  success: number; // SQLite boolean
  error_message: string | null;
}

export interface MigrationStatus {
  current: number;
  pending: Migration[];
  applied: MigrationRecord[];
  canRollback: boolean;
}

export interface MigrationResult {
  success: boolean;
  version: number;
  name: string;
  message: string;
  error?: Error;
}
