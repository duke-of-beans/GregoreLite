/**
 * Ghost Preferences Store — Sprint 9-06
 *
 * CRUD operations for the ghost_preferences table.
 * Preferences boost Ghost scorer scores for matching source_type.
 * Exclusions always win over preferences — layer order preserved.
 */

import { nanoid } from 'nanoid';
import { getDatabase } from '@/lib/kernl/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GhostPreference {
  id: string;
  source_type: string | null;
  topic_hint: string;
  boost_factor: number;
  created_at: number;
  use_count: number;
}

export interface CreatePreferenceInput {
  source_type: string | null;
  topic_hint: string;
  boost_factor?: number;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getAllPreferences(): GhostPreference[] {
  const db = getDatabase();
  return db
    .prepare('SELECT id, source_type, topic_hint, boost_factor, created_at, use_count FROM ghost_preferences ORDER BY created_at DESC')
    .all() as GhostPreference[];
}

export function getPreferencesBySourceType(sourceType: string | null): GhostPreference[] {
  const db = getDatabase();
  if (sourceType === null) {
    return db
      .prepare('SELECT id, source_type, topic_hint, boost_factor, created_at, use_count FROM ghost_preferences WHERE source_type IS NULL')
      .all() as GhostPreference[];
  }
  // Return matching source_type OR wildcard (NULL) preferences
  return db
    .prepare('SELECT id, source_type, topic_hint, boost_factor, created_at, use_count FROM ghost_preferences WHERE source_type = ? OR source_type IS NULL')
    .all(sourceType) as GhostPreference[];
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function createPreference(input: CreatePreferenceInput): GhostPreference {
  const db = getDatabase();
  const id = nanoid();
  const now = Date.now();
  const boostFactor = input.boost_factor ?? 1.5;

  db.prepare(
    `INSERT INTO ghost_preferences (id, source_type, topic_hint, boost_factor, created_at, use_count)
     VALUES (?, ?, ?, ?, ?, 0)`
  ).run(id, input.source_type ?? null, input.topic_hint, boostFactor, now);

  return { id, source_type: input.source_type ?? null, topic_hint: input.topic_hint, boost_factor: boostFactor, created_at: now, use_count: 0 };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function updateBoostFactor(id: string, boostFactor: number): void {
  const db = getDatabase();
  const clamped = Math.min(3.0, Math.max(1.0, boostFactor));
  db.prepare('UPDATE ghost_preferences SET boost_factor = ? WHERE id = ?').run(clamped, id);
}

export function incrementUseCount(id: string): void {
  const db = getDatabase();
  db.prepare('UPDATE ghost_preferences SET use_count = use_count + 1 WHERE id = ?').run(id);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deletePreference(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM ghost_preferences WHERE id = ?').run(id);
}
