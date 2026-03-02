/**
 * FP Tracker tests
 *
 * better-sqlite3 cannot load in Vitest's child process, so the database is
 * mocked with an in-memory eos_fp_log store — matching the established
 * project pattern (see kernl-project-store.test.ts).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── In-memory eos_fp_log store ────────────────────────────────────────────────

interface FPRow {
  id: string;
  project_id: string;
  rule_id: string;
  file_path: string;
  line: number | null;
  is_fp: number;
  created_at: string;
}

let _fpLog: FPRow[] = [];

function makePrepared(sql: string) {
  const up = sql.trimStart().toUpperCase();

  return {
    run: (...params: unknown[]) => {
      if (up.startsWith('INSERT INTO EOS_FP_LOG')) {
        const [id, project_id, rule_id, file_path, line, is_fp] = params as [
          string, string, string, string, number | null, number,
        ];
        _fpLog.push({
          id,
          project_id,
          rule_id,
          file_path,
          line,
          is_fp,
          created_at: new Date().toISOString(),
        });
      } else if (up.startsWith('UPDATE EOS_FP_LOG')) {
        // markFalsePositive: UPDATE eos_fp_log SET is_fp = 1 WHERE id = ?
        const [id] = params as [string];
        const row = _fpLog.find((r) => r.id === id);
        if (row) row.is_fp = 1;
      }
      return { changes: 1 };
    },

    all: (...params: unknown[]) => {
      if (sql.includes('DISTINCT rule_id')) {
        const [project_id] = params as [string];
        const ruleIds = [...new Set(
          _fpLog.filter((r) => r.project_id === project_id).map((r) => r.rule_id),
        )];
        return ruleIds.map((rule_id) => ({ rule_id }));
      }

      // SELECT is_fp FROM eos_fp_log WHERE project_id = ? AND rule_id = ? ORDER BY ... LIMIT ?
      if (sql.includes('is_fp') && sql.includes('project_id') && sql.includes('rule_id')) {
        const [project_id, rule_id, limit] = params as [string, string, number];
        return _fpLog
          .filter((r) => r.project_id === project_id && r.rule_id === rule_id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, limit)
          .map((r) => ({ is_fp: r.is_fp }));
      }

      return [];
    },

    get: () => undefined,
  };
}

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({ prepare: (sql: string) => makePrepared(sql) }),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => `id-${Math.random().toString(36).slice(2)}`),
}));

// Imports AFTER vi.mock declarations
import { recordOccurrence, markFalsePositive, getSuppressedRules, getRuleStats } from '@/lib/eos/fp-tracker';

const PROJECT = 'proj-1';
const RULE = 'INVISIBLE_CHAR';
const FILE = 'src/foo.ts';

beforeEach(() => { _fpLog = []; });

// ---------------------------------------------------------------------------

describe('recordOccurrence', () => {
  it('stores a true-positive entry', () => {
    recordOccurrence({ projectId: PROJECT, ruleId: RULE, filePath: FILE, isFP: false });
    expect(_fpLog).toHaveLength(1);
    expect(_fpLog[0]?.is_fp).toBe(0);
  });

  it('stores a false-positive entry', () => {
    recordOccurrence({ projectId: PROJECT, ruleId: RULE, filePath: FILE, isFP: true });
    expect(_fpLog[0]?.is_fp).toBe(1);
  });

  it('stores optional line number', () => {
    recordOccurrence({ projectId: PROJECT, ruleId: RULE, filePath: FILE, line: 42, isFP: false });
    expect(_fpLog[0]?.line).toBe(42);
  });
});

describe('markFalsePositive', () => {
  it('flips is_fp to 1 for an existing entry', () => {
    // Seed a TP entry with a known id
    _fpLog.push({ id: 'known-id', project_id: PROJECT, rule_id: RULE, file_path: FILE, line: null, is_fp: 0, created_at: new Date().toISOString() });
    markFalsePositive('known-id');
    expect(_fpLog.find((r) => r.id === 'known-id')?.is_fp).toBe(1);
  });
});

describe('getSuppressedRules', () => {
  function seedEntries(rule: string, total: number, fpCount: number) {
    for (let i = 0; i < total; i++) {
      _fpLog.push({
        id: `id-${rule}-${i}`,
        project_id: PROJECT,
        rule_id: rule,
        file_path: FILE,
        line: null,
        is_fp: i < fpCount ? 1 : 0,
        created_at: new Date(Date.now() + i).toISOString(),
      });
    }
  }

  it('suppresses rule with FP rate > 20%', () => {
    seedEntries(RULE, 10, 3); // 30% FP — above threshold
    const suppressed = getSuppressedRules(PROJECT);
    expect(suppressed.has(RULE)).toBe(true);
  });

  it('does not suppress rule at exactly 20% FP rate', () => {
    seedEntries(RULE, 10, 2); // 20% FP — not strictly above
    const suppressed = getSuppressedRules(PROJECT);
    expect(suppressed.has(RULE)).toBe(false);
  });

  it('does not suppress rule with low FP rate', () => {
    seedEntries(RULE, 10, 1); // 10% FP
    const suppressed = getSuppressedRules(PROJECT);
    expect(suppressed.has(RULE)).toBe(false);
  });

  it('returns empty set when no entries exist', () => {
    expect(getSuppressedRules(PROJECT).size).toBe(0);
  });

  it('suppresses only the rule that exceeds the threshold', () => {
    seedEntries('HIGH_FP_RULE', 10, 5);  // 50% — suppress
    seedEntries('LOW_FP_RULE',  10, 1);  // 10% — keep
    const suppressed = getSuppressedRules(PROJECT);
    expect(suppressed.has('HIGH_FP_RULE')).toBe(true);
    expect(suppressed.has('LOW_FP_RULE')).toBe(false);
  });
});

describe('getRuleStats', () => {
  it('returns zeros for a rule with no history', () => {
    const stats = getRuleStats(PROJECT, RULE);
    expect(stats.total).toBe(0);
    expect(stats.fpCount).toBe(0);
    expect(stats.rate).toBe(0);
    expect(stats.suppressed).toBe(false);
  });

  it('computes rate and suppression flag correctly', () => {
    for (let i = 0; i < 10; i++) {
      _fpLog.push({ id: `s${i}`, project_id: PROJECT, rule_id: RULE, file_path: FILE, line: null, is_fp: i < 3 ? 1 : 0, created_at: new Date().toISOString() });
    }
    const stats = getRuleStats(PROJECT, RULE);
    expect(stats.total).toBe(10);
    expect(stats.fpCount).toBe(3);
    expect(stats.rate).toBeCloseTo(0.3);
    expect(stats.suppressed).toBe(true);
  });
});
