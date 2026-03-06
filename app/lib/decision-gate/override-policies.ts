/**
 * Override Policy — persistent single-use and permanent bypasses for decision gate triggers.
 *
 * Three scopes:
 *   'once'     — single-use bypass; auto-deletes after first hasActivePolicy() hit
 *   'category' — bypass only when the conversation matches a specific topic category
 *   'always'   — permanent bypass for that trigger type regardless of context
 *
 * Stored in SQLite (gate_override_policies table) — survives app restarts.
 * Migration: runMigrations() in database.ts.
 */

import { nanoid } from 'nanoid';
import { getDatabase } from '@/lib/kernl/database';
import type { GateTrigger } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OverridePolicy {
  id: string;
  trigger_type: GateTrigger;
  scope: 'once' | 'category' | 'always';
  category?: string;
  created_at: number;
  expires_at: number | null;
}

/** Row shape as stored in SQLite (category/expires_at may be null) */
interface PolicyRow {
  id: string;
  trigger_type: string;
  scope: string;
  category: string | null;
  created_at: number;
  expires_at: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToPolicy(row: PolicyRow): OverridePolicy {
  return {
    id: row.id,
    trigger_type: row.trigger_type as GateTrigger,
    scope: row.scope as OverridePolicy['scope'],
    // exactOptionalPropertyTypes: only spread category when present
    ...(row.category !== null ? { category: row.category } : {}),
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

function isExpired(policy: OverridePolicy): boolean {
  if (policy.expires_at === null) return false;
  return Date.now() > policy.expires_at;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Create and persist a new override policy.
 * 'once' scope: no expiry (auto-deleted on first use via hasActivePolicy).
 * 'category' and 'always' scope: permanent (expires_at null).
 */
export function createPolicy(
  trigger: GateTrigger,
  scope: 'once' | 'category' | 'always',
  category?: string,
): OverridePolicy {
  const db = getDatabase();
  const policy: OverridePolicy = {
    id: nanoid(),
    trigger_type: trigger,
    scope,
    // exactOptionalPropertyTypes: only include category when defined
    ...(category !== undefined ? { category } : {}),
    created_at: Date.now(),
    expires_at: null,
  };

  db.prepare(`
    INSERT INTO gate_override_policies (id, trigger_type, scope, category, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    policy.id,
    policy.trigger_type,
    policy.scope,
    policy.category ?? null,
    policy.created_at,
    policy.expires_at,
  );

  return policy;
}

/**
 * Retrieve all override policies (including expired — caller decides how to filter).
 */
export function getPolicies(): OverridePolicy[] {
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM gate_override_policies ORDER BY created_at DESC`)
    .all() as PolicyRow[];
  return rows.map(rowToPolicy);
}

/**
 * Retrieve all active (non-expired) policies for a specific trigger type.
 * Fails open (returns []) if the DB or table is unavailable.
 */
export function getPoliciesForTrigger(trigger: GateTrigger): OverridePolicy[] {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM gate_override_policies
      WHERE trigger_type = ?
      ORDER BY created_at DESC
    `).all(trigger) as PolicyRow[];
    return rows.map(rowToPolicy).filter((p) => !isExpired(p));
  } catch {
    // DB unavailable or table missing — fail open (no bypass)
    return [];
  }
}

/**
 * Delete a specific policy by ID.
 */
export function deletePolicy(id: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM gate_override_policies WHERE id = ?`).run(id);
}

/**
 * Delete all override policies (reset to factory).
 */
export function deleteAllPolicies(): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM gate_override_policies`).run();
}

/**
 * Check whether an active policy exists that would bypass the given trigger.
 *
 * Scope logic:
 *   'always'   — matches any context for this trigger type
 *   'category' — matches only when provided category equals policy.category
 *   'once'     — matches once, then self-destructs (deleted immediately)
 *
 * Returns true if a matching, non-expired policy was found.
 * Side-effect: 'once' policies are deleted after the first positive match.
 */
export function hasActivePolicy(trigger: GateTrigger, category?: string): boolean {
  const policies = getPoliciesForTrigger(trigger);

  for (const policy of policies) {
    const matches = (() => {
      switch (policy.scope) {
        case 'always':
          return true;
        case 'category':
          return policy.category !== undefined && policy.category === category;
        case 'once':
          return true;
      }
    })();

    if (matches) {
      // 'once' policies self-destruct on first use
      if (policy.scope === 'once') {
        deletePolicy(policy.id);
      }
      return true;
    }
  }

  return false;
}
