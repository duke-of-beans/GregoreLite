/**
 * Migration Registry
 *
 * Central registry of all database migrations.
 * Import migration SQL files and define rollback procedures.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Migration } from './types';

/**
 * Load SQL migration file
 */
function loadMigrationSQL(filename: string): string {
  // __dirname is unreliable in Next.js (Turbopack resolves to .next output dir).
  // Use process.cwd() which always points to the project root.
  const filepath = join(process.cwd(), 'lib', 'database', 'migrations', filename);
  return readFileSync(filepath, 'utf-8');
}

/**
 * All available migrations in order
 */
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: [loadMigrationSQL('001_initial_schema.sql')],
    down: [
      // Rollback: drop all tables and views
      'DROP VIEW IF EXISTS messages_with_attachments',
      'DROP VIEW IF NOT EXISTS conversations_with_stats',
      'DROP TABLE IF EXISTS attachments',
      'DROP TABLE IF EXISTS messages_fts',
      'DROP TABLE IF EXISTS messages',
      'DROP TABLE IF EXISTS conversations_fts',
      'DROP TABLE IF EXISTS conversations',
    ],
    createdAt: new Date('2026-01-15'),
  },
  {
    version: 2,
    name: 'performance_indexes',
    up: [loadMigrationSQL('002_performance_indexes.sql')],
    down: [
      // Rollback: drop all performance indexes
      'DROP INDEX IF EXISTS idx_attachments_mime_type',
      'DROP INDEX IF EXISTS idx_attachments_msg_created',
      'DROP INDEX IF EXISTS idx_attachments_large_files',
      'DROP INDEX IF EXISTS idx_attachments_type_message',
      'DROP INDEX IF EXISTS idx_messages_conv_created',
      'DROP INDEX IF EXISTS idx_messages_assistant',
      'DROP INDEX IF EXISTS idx_messages_model_usage',
      'DROP INDEX IF EXISTS idx_messages_token_analytics',
      'DROP INDEX IF EXISTS idx_messages_conversation_role_time',
      'DROP INDEX IF EXISTS idx_conversations_cost_tracking',
      'DROP INDEX IF EXISTS idx_conversations_model_analytics',
      'DROP INDEX IF EXISTS idx_conversations_list_pinned',
      'DROP INDEX IF EXISTS idx_conversations_list_archived',
    ],
    createdAt: new Date('2026-01-15'),
  },
  {
    version: 3,
    name: 'data_constraints',
    up: [loadMigrationSQL('003_data_constraints.sql')],
    down: [
      // Rollback: drop all constraint triggers
      'DROP TRIGGER IF EXISTS messages_update_conversation_stats_on_delete',
      'DROP TRIGGER IF EXISTS messages_update_conversation_stats_on_update',
      'DROP TRIGGER IF EXISTS messages_update_conversation_timestamp',
      'DROP TRIGGER IF EXISTS prevent_conversation_deletion_with_messages',
      'DROP TRIGGER IF EXISTS check_attachment_size_reasonable',
      'DROP TRIGGER IF EXISTS check_attachment_data_not_empty',
      'DROP TRIGGER IF EXISTS check_attachment_mime_not_empty',
      'DROP TRIGGER IF EXISTS check_attachment_name_not_empty',
      'DROP TRIGGER IF EXISTS check_message_token_consistency',
      'DROP TRIGGER IF EXISTS check_message_timestamps',
      'DROP TRIGGER IF EXISTS check_message_content_not_empty',
      'DROP TRIGGER IF EXISTS check_conversation_model_not_empty',
      'DROP TRIGGER IF EXISTS check_conversation_timestamps',
      'DROP TRIGGER IF EXISTS check_conversation_title_not_empty_update',
      'DROP TRIGGER IF EXISTS check_conversation_title_not_empty',
    ],
    createdAt: new Date('2026-01-15'),
  },
  {
    version: 4,
    name: 'performance_indexes_composite',
    up: [loadMigrationSQL('004_performance_indexes.sql')],
    down: [
      // Rollback: drop composite indexes
      'DROP INDEX IF EXISTS idx_conversations_archived_updated',
      'DROP INDEX IF EXISTS idx_conversations_tier_updated',
      'DROP INDEX IF EXISTS idx_conversations_created_archived',
      'DROP INDEX IF EXISTS idx_conversations_cost',
      'DROP INDEX IF EXISTS idx_messages_conversation_role',
    ],
    createdAt: new Date('2026-01-16'),
  },
  {
    version: 5,
    name: 'advanced_optimizations',
    up: [loadMigrationSQL('005_advanced_optimizations.sql')],
    down: [
      // Rollback: drop advanced optimization indexes
      'DROP INDEX IF EXISTS idx_conversations_list_covering',
      'DROP INDEX IF EXISTS idx_conversations_pinned_covering',
      'DROP INDEX IF EXISTS idx_conversations_active_only',
      'DROP INDEX IF EXISTS idx_conversations_archived_only',
      'DROP INDEX IF EXISTS idx_conversations_expensive',
      'DROP INDEX IF EXISTS idx_messages_pagination',
      'DROP INDEX IF EXISTS idx_messages_tokens',
      'DROP INDEX IF EXISTS idx_attachments_large_files',
    ],
    createdAt: new Date('2026-01-16'),
  },
];

/**
 * Get migration by version
 */
export function getMigration(version: number): Migration | undefined {
  return migrations.find((m) => m.version === version);
}

/**
 * Get all migrations after version
 */
export function getMigrationsAfter(version: number): Migration[] {
  return migrations.filter((m) => m.version > version);
}

/**
 * Get latest migration version
 */
export function getLatestVersion(): number {
  if (migrations.length === 0) return 0;
  return Math.max(...migrations.map((m) => m.version));
}
