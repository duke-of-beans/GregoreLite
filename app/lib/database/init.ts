/**
 * Database Initialization
 *
 * Handles database schema creation and verification.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { getDatabase, initializeDatabase } from './connection';

export interface InitializationResult {
  success: boolean;
  message: string;
  tablesCreated: string[];
  indexesCreated: string[];
  error?: Error;
}

/**
 * Initialize database with schema
 *
 * Creates all tables, indexes, triggers, and views.
 * Safe to call multiple times - idempotent.
 */
export async function initializeSchema(): Promise<InitializationResult> {
  try {
    // Ensure connection is established
    await initializeDatabase();
    const db = getDatabase();

    // Read schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Execute schema
    db.exec(schema);

    // Verify tables were created
    const tables = db
      .prepare(
        `
        SELECT name FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `
      )
      .all() as { name: string }[];

    const indexes = db
      .prepare(
        `
        SELECT name FROM sqlite_master 
        WHERE type = 'index' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `
      )
      .all() as { name: string }[];

    return {
      success: true,
      message: `Database initialized successfully. Created ${tables.length} tables and ${indexes.length} indexes.`,
      tablesCreated: tables.map((t) => t.name),
      indexesCreated: indexes.map((i) => i.name),
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to initialize database schema',
      tablesCreated: [],
      indexesCreated: [],
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Verify database schema integrity
 *
 * Checks that all expected tables and indexes exist.
 */
export function verifySchema(): {
  valid: boolean;
  missingTables: string[];
  missingIndexes: string[];
} {
  const db = getDatabase();

  const expectedTables = [
    'conversations',
    'messages',
    'attachments',
    'conversations_fts',
    'messages_fts',
  ];

  const expectedIndexes = [
    'idx_conversations_created_at',
    'idx_conversations_updated_at',
    'idx_conversations_archived',
    'idx_conversations_pinned',
    'idx_conversations_model_tier',
    'idx_messages_conversation_id',
    'idx_messages_created_at',
    'idx_messages_role',
    'idx_attachments_message_id',
    'idx_attachments_type',
    'idx_attachments_size',
  ];

  const existingTables = db
    .prepare(
      `
      SELECT name FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
    `
    )
    .all() as { name: string }[];

  const existingIndexes = db
    .prepare(
      `
      SELECT name FROM sqlite_master 
      WHERE type = 'index' 
      AND name NOT LIKE 'sqlite_%'
    `
    )
    .all() as { name: string }[];

  const existingTableNames = new Set(existingTables.map((t) => t.name));
  const existingIndexNames = new Set(existingIndexes.map((i) => i.name));

  const missingTables = expectedTables.filter(
    (t) => !existingTableNames.has(t)
  );
  const missingIndexes = expectedIndexes.filter(
    (i) => !existingIndexNames.has(i)
  );

  return {
    valid: missingTables.length === 0 && missingIndexes.length === 0,
    missingTables,
    missingIndexes,
  };
}

/**
 * Get database schema version
 *
 * Returns schema_version from SQLite pragma.
 */
export function getSchemaVersion(): number {
  const db = getDatabase();
  return db.pragma('schema_version', { simple: true }) as number;
}

/**
 * Check if database is empty
 */
export function isDatabaseEmpty(): boolean {
  const db = getDatabase();

  const tables = db
    .prepare(
      `
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
    `
    )
    .get() as { count: number };

  return tables.count === 0;
}

/**
 * Drop all tables (DANGEROUS - use only for tests)
 */
export function dropAllTables(): void {
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

  // Drop each table
  for (const table of tables) {
    db.prepare(`DROP TABLE IF EXISTS ${table.name}`).run();
  }
}
