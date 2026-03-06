/**
 * Override policy tests — Sprint 18.0 Task 12
 *
 * Tests all lifecycle behaviors:
 *   - createPolicy / getPolicies / getPoliciesForTrigger
 *   - 'once' auto-delete after first hasActivePolicy hit
 *   - 'category' scope matching
 *   - 'always' scope bypasses regardless
 *   - deletePolicy removes individual record
 *   - deleteAllPolicies clears everything
 *   - expires_at null = permanent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPolicy,
  getPolicies,
  getPoliciesForTrigger,
  deletePolicy,
  deleteAllPolicies,
  hasActivePolicy,
} from '../override-policies';

// ─── Mock database ────────────────────────────────────────────────────────────

vi.mock('@/lib/kernl/database', () => {
  type Row = {
    id: string;
    trigger_type: string;
    scope: string;
    category: string | null;
    created_at: number;
    expires_at: number | null;
  };
  const rows: Record<string, Row> = {};

  const makeStmt = (sql: string) => ({
    run: (...args: unknown[]) => {
      const up = sql.trim().toUpperCase();
      if (up.startsWith('INSERT')) {
        const [id, trigger_type, scope, category, created_at, expires_at] =
          args as [string, string, string, string | null, number, number | null];
        rows[id] = { id, trigger_type, scope, category, created_at, expires_at };
      } else if (up.includes('WHERE ID')) {
        const [id] = args as [string];
        delete rows[id];
      } else if (up.startsWith('DELETE')) {
        Object.keys(rows).forEach((k) => delete rows[k]);
      }
    },
    all: (...args: unknown[]) => {
      const up = sql.trim().toUpperCase();
      if (up.includes('WHERE TRIGGER_TYPE')) {
        const [trigger] = args as [string];
        return Object.values(rows).filter((r) => r.trigger_type === trigger);
      }
      return Object.values(rows);
    },
  });

  return {
    getDatabase: () => ({ prepare: (s: string) => makeStmt(s) }),
  };
});

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  deleteAllPolicies();
});

describe('createPolicy', () => {
  it('creates a policy with required fields', () => {
    const p = createPolicy('irreversible_action', 'once');
    expect(p.id).toBeTruthy();
    expect(p.trigger_type).toBe('irreversible_action');
    expect(p.scope).toBe('once');
    expect(p.created_at).toBeGreaterThan(0);
    expect(p.expires_at).toBeNull();
  });

  it('stores category for category-scoped policies', () => {
    const p = createPolicy('sacred_principle_risk', 'category', 'shortcut_review');
    expect(p.category).toBe('shortcut_review');
  });

  it('allows multiple policies for the same trigger', () => {
    createPolicy('low_confidence', 'once');
    createPolicy('low_confidence', 'always');
    expect(getPoliciesForTrigger('low_confidence')).toHaveLength(2);
  });
});

describe('getPolicies', () => {
  it('returns all policies across all triggers', () => {
    createPolicy('irreversible_action', 'once');
    createPolicy('low_confidence', 'always');
    createPolicy('repeated_question', 'category', 'design');
    expect(getPolicies()).toHaveLength(3);
  });

  it('returns empty array when none exist', () => {
    expect(getPolicies()).toHaveLength(0);
  });
});

describe('getPoliciesForTrigger', () => {
  it('filters by trigger type', () => {
    createPolicy('irreversible_action', 'always');
    createPolicy('low_confidence', 'always');
    const results = getPoliciesForTrigger('irreversible_action');
    expect(results).toHaveLength(1);
    expect(results.at(0)?.trigger_type).toBe('irreversible_action');
  });
});

describe('deletePolicy', () => {
  it('removes the policy from storage', () => {
    const p = createPolicy('irreversible_action', 'always');
    deletePolicy(p.id);
    expect(getPoliciesForTrigger('irreversible_action')).toHaveLength(0);
  });

  it('is idempotent (double-delete does not throw)', () => {
    const p = createPolicy('low_confidence', 'once');
    expect(() => { deletePolicy(p.id); deletePolicy(p.id); }).not.toThrow();
  });
});

describe('deleteAllPolicies', () => {
  it('removes every policy', () => {
    createPolicy('irreversible_action', 'once');
    createPolicy('low_confidence', 'always');
    deleteAllPolicies();
    expect(getPolicies()).toHaveLength(0);
  });
});

describe('hasActivePolicy — always scope', () => {
  it('returns true regardless of category', () => {
    createPolicy('repeated_question', 'always');
    expect(hasActivePolicy('repeated_question')).toBe(true);
    expect(hasActivePolicy('repeated_question', 'any_category')).toBe(true);
  });

  it('does not delete the policy on match (permanent)', () => {
    createPolicy('repeated_question', 'always');
    hasActivePolicy('repeated_question');
    expect(getPoliciesForTrigger('repeated_question')).toHaveLength(1);
  });

  it('returns false for a different trigger type', () => {
    createPolicy('repeated_question', 'always');
    expect(hasActivePolicy('low_confidence')).toBe(false);
  });
});

describe('hasActivePolicy — once scope (self-destruct)', () => {
  it('returns true on first check', () => {
    createPolicy('irreversible_action', 'once');
    expect(hasActivePolicy('irreversible_action')).toBe(true);
  });

  it('auto-deletes after first positive match', () => {
    createPolicy('irreversible_action', 'once');
    hasActivePolicy('irreversible_action');
    expect(getPoliciesForTrigger('irreversible_action')).toHaveLength(0);
  });

  it('returns false on second check after self-destruct', () => {
    createPolicy('irreversible_action', 'once');
    hasActivePolicy('irreversible_action');
    expect(hasActivePolicy('irreversible_action')).toBe(false);
  });
});

describe('hasActivePolicy — category scope', () => {
  it('matches when provided category equals policy.category', () => {
    createPolicy('sacred_principle_risk', 'category', 'code_review');
    expect(hasActivePolicy('sacred_principle_risk', 'code_review')).toBe(true);
  });

  it('does not match when category differs', () => {
    createPolicy('sacred_principle_risk', 'category', 'code_review');
    expect(hasActivePolicy('sacred_principle_risk', 'other_topic')).toBe(false);
  });

  it('does not match when no category provided (category scope requires match)', () => {
    createPolicy('sacred_principle_risk', 'category', 'code_review');
    expect(hasActivePolicy('sacred_principle_risk')).toBe(false);
  });
});

describe('hasActivePolicy — expiry', () => {
  it('never-expiring policy (expires_at null) always matches', () => {
    const p = createPolicy('low_confidence', 'always');
    expect(p.expires_at).toBeNull();
    expect(hasActivePolicy('low_confidence')).toBe(true);
  });
});
