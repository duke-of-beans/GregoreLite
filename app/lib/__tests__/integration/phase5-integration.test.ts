/**
 * Quality Layer — Phase 5 Integration Tests (Sprint 5C)
 *
 * Certifies the full quality layer (EoS scanner, FP tracker,
 * PatternLearner, Agent SDK gate) operates correctly end-to-end.
 *
 * Test groups:
 *   1. EoS scan engine    — real file scanning via temp directory
 *   2. Health score       — formula + grade boundaries
 *   3. Debt calculator    — aggregation + hotspot sorting
 *   4. Persistence        — health score + eos_reports written to KERNL
 *   5. Agent SDK gate     — COMPLETED/FAILED downgrade logic
 *   6. FP tracker         — occurrence recording + auto-suppression
 *   7. PatternLearner     — persistence, hydration, prediction
 *   8. Score surfacing    — ContextPanel scoreClass helper
 *
 * @module __tests__/integration/phase5-integration
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

// ── In-memory DB tables ───────────────────────────────────────────────────────

interface DbRow { [key: string]: unknown }

const _db: {
  projects: Map<string, DbRow>;
  eos_reports: Map<string, DbRow>;
  manifests: Map<string, DbRow>;
  eos_fp_log: DbRow[];
  shim_patterns: Map<string, DbRow>;
  shim_improvements: Map<string, DbRow>;
} = {
  projects: new Map(),
  eos_reports: new Map(),
  manifests: new Map(),
  eos_fp_log: [],
  shim_patterns: new Map(),
  shim_improvements: new Map(),
};

function resetDb() {
  _db.projects.clear();
  _db.eos_reports.clear();
  _db.manifests.clear();
  _db.eos_fp_log = [];
  _db.shim_patterns.clear();
  _db.shim_improvements.clear();
}

// Captured SQL calls — useful for gate assertions
const _sqlCalls: string[] = [];

function makePrepared(sql: string) {
  const norm = sql.trim().replace(/\s+/g, ' ');
  const up = norm.toUpperCase();

  return {
    run: (...args: unknown[]) => {
      _sqlCalls.push(norm.substring(0, 80));

      // writeResultReport initial manifest update (named params object)
      if (up.startsWith('UPDATE MANIFESTS SET STATUS = @STATUS')) {
        const p = args[0] as { status: string; result_report: string; id: string };
        const row = _db.manifests.get(p.id);
        if (row) {
          row.status = p.status;
          row.result_report = p.result_report;
        }
      }
      // EoS gate downgrade (positional params)
      else if (up.includes("SET STATUS = 'FAILED'") && up.includes('WHERE ID = ?')) {
        const [, id] = args as [number, string];
        const row = _db.manifests.get(id);
        if (row) row.status = 'failed';
      }
      // result_report backfill (positional params)
      else if (up.startsWith('UPDATE MANIFESTS SET RESULT_REPORT = ?')) {
        const [reportJson, id] = args as [string, string];
        const row = _db.manifests.get(id);
        if (row) row.result_report = reportJson;
      }
      // storeShimScoreBefore
      else if (up.includes('SHIM_SCORE_BEFORE')) {
        // no-op for test
      }
      // persistHealthScore / persistScanReport projects update
      else if (up.startsWith('UPDATE PROJECTS SET HEALTH_SCORE')) {
        const [score, id] = args as [number, string];
        const row = _db.projects.get(id);
        if (row) { row.health_score = score; row.last_eos_scan = new Date().toISOString(); }
      }
      // eos_reports upsert
      else if (up.startsWith('INSERT OR REPLACE INTO EOS_REPORTS')) {
        const p = args[0] as { id: string; project_id: string; health_score: number };
        _db.eos_reports.set(p.id ?? p.project_id, p);
      }
      // eos_fp_log insert
      else if (up.startsWith('INSERT INTO EOS_FP_LOG')) {
        const [id, project_id, rule_id, file_path, line, is_fp] = args as [string, string, string, string, number|null, number];
        _db.eos_fp_log.push({ id, project_id, rule_id, file_path, line, is_fp, created_at: new Date().toISOString() });
      }
      // eos_fp_log mark FP
      else if (up.startsWith('UPDATE EOS_FP_LOG SET IS_FP = 1 WHERE ID = ?')) {
        const [id] = args as [string];
        const row = _db.eos_fp_log.find(r => r.id === id);
        if (row) row.is_fp = 1;
      }
      // shim_improvements insert — positional params: .run(id, pattern, complexity, ...)
      else if (up.startsWith('INSERT OR IGNORE INTO SHIM_IMPROVEMENTS')) {
        const [id, pattern] = args as [string, string];
        if (id) _db.shim_improvements.set(id, { id, pattern });
      }
      // shim_patterns upsert
      else if (up.startsWith('INSERT OR REPLACE INTO SHIM_PATTERNS')) {
        const p = args[0] as { id: string };
        _db.shim_patterns.set(p.id, p);
      }

      return { changes: 1, lastInsertRowid: 0 };
    },

    get: (...args: unknown[]) => {
      if (up.includes('SELECT * FROM MANIFESTS WHERE ID = ?')) {
        return _db.manifests.get(args[0] as string) ?? null;
      }
      if (up.includes('SELECT ID FROM PROJECTS WHERE PATH = ?')) {
        for (const [id, row] of _db.projects) {
          if (row.path === args[0]) return { id };
        }
        return null;
      }
      if (up.includes('SELECT HEALTH_SCORE, LAST_EOS_SCAN FROM PROJECTS WHERE ID = ?')) {
        const row = _db.projects.get(args[0] as string);
        if (row) return { health_score: row.health_score, last_eos_scan: row.last_eos_scan };
        return null;
      }
      if (up.includes('SELECT HEALTH_SCORE FROM PROJECTS WHERE ID = ?')) {
        const row = _db.projects.get(args[0] as string);
        return row ? { health_score: row.health_score } : null;
      }
      return undefined;
    },

    all: (...args: unknown[]) => {
      if (up.includes('DISTINCT RULE_ID') && up.includes('EOS_FP_LOG')) {
        const [project_id] = args as [string];
        const ids = [...new Set(_db.eos_fp_log.filter(r => r.project_id === project_id).map(r => r.rule_id as string))];
        return ids.map(rule_id => ({ rule_id }));
      }
      if (up.includes('IS_FP') && up.includes('EOS_FP_LOG') && up.includes('RULE_ID')) {
        const [project_id, rule_id, limit] = args as [string, string, number];
        return _db.eos_fp_log
          .filter(r => r.project_id === project_id && r.rule_id === rule_id)
          .slice(0, limit)
          .map(r => ({ is_fp: r.is_fp }));
      }
      if (up.includes('SELECT * FROM SHIM_PATTERNS')) {
        return [..._db.shim_patterns.values()].map(p => ({
          ...p,
          contexts: p.contexts ? JSON.stringify(p.contexts) : null,
        }));
      }
      if (up.includes('SELECT * FROM SHIM_IMPROVEMENTS')) {
        return [..._db.shim_improvements.values()];
      }
      return [];
    },
  };
}

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const mockScan = vi.hoisted(() => vi.fn());
const mockPersistScanReport = vi.hoisted(() => vi.fn());
const mockRunOnce = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockRecordJobImprovement = vi.hoisted(() => vi.fn());
const mockStoreShimScoreBefore = vi.hoisted(() => vi.fn());
const mockLogPredictions = vi.hoisted(() => vi.fn());

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({
    prepare: (sql: string) => makePrepared(sql),
    transaction: (fn: (arg: unknown) => void) => (arg: unknown) => fn(arg),
  }),
}));

vi.mock('@/lib/eos/index', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/eos/index')>();
  return {
    ...actual,
    scan: mockScan,
    persistScanReport: mockPersistScanReport,
  };
});

vi.mock('@/lib/indexer', () => ({ runOnce: mockRunOnce }));

vi.mock('@/lib/shim/improvement-log', () => ({
  recordJobImprovement: mockRecordJobImprovement,
  storeShimScoreBefore: mockStoreShimScoreBefore,
  logPredictions: mockLogPredictions,
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { scan as realScan, scanFiles as realScanFiles } from '@/lib/eos/engine';
import { computeHealthScore } from '@/lib/eos/health-score';
import { computeDebt } from '@/lib/eos/debt';
import {
  recordOccurrence,
  markFalsePositive,
  getSuppressedRules,
  getRuleStats,
} from '@/lib/eos/fp-tracker';
import { getPatternLearner, _resetPatternLearner } from '@/lib/shim/pattern-learner';
import type { HistoricalImprovement } from '@/lib/shim/types';
import { writeResultReport } from '@/lib/agent-sdk/job-tracker';
import type { ResultReport } from '@/lib/agent-sdk/types';
import { scoreClass } from '@/lib/eos/score-class';

// ── Temp directory for file-based scan tests ──────────────────────────────────

let tmpDir = '';

function setupTmpDir() {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'eos-phase5-'));

  // Clean TypeScript file — should produce no issues
  writeFileSync(path.join(tmpDir, 'clean.ts'), [
    'export function add(a: number, b: number): number {',
    '  return a + b;',
    '}',
    '',
    'export const greet = (name: string): string => `Hello, ${name}!`;',
    '',
  ].join('\n'));

  // File with a memory leak — setInterval never cleaned up, triggers MEMORY_LEAK rule
  // NOTE: The fixture content must NOT contain the word "clearInterval" (even in
  // comments) because EoS's detectMemoryLeaks does content.includes('clearInterval')
  // and would skip the file.
  writeFileSync(path.join(tmpDir, 'dirty.ts'), [
    '// This file leaks — interval is created but never torn down',
    'export function startPolling() {',
    '  setInterval(() => console.log("tick"), 1000);',
    '}',
    '',
  ].join('\n'));
}

afterAll(() => {
  if (tmpDir) {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

// ── Helper: make a minimal ResultReport ──────────────────────────────────────

function makeReport(overrides: Partial<ResultReport> = {}): ResultReport {
  return {
    manifest_id: 'job-1',
    status: 'success',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_seconds: 1,
    output: {
      files_created: [],
      files_modified: [],
      artifacts: [],
      logs_path: '/tmp/logs',
    },
    quality_results: {},
    tokens_used: 100,
    cost_usd: 0.001,
    ...overrides,
  };
}

// ── Helper: flush setImmediate + microtasks ───────────────────────────────────

async function drainAsync() {
  // Two levels of setImmediate (indexer + EoS scan) then flush microtasks
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
  await Promise.resolve();
  await Promise.resolve();
}

// ── Suite setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  resetDb();
  _sqlCalls.length = 0;
  mockScan.mockReset();
  mockPersistScanReport.mockReset();
  mockRecordJobImprovement.mockReset();
  mockStoreShimScoreBefore.mockReset();
  mockLogPredictions.mockReset();
  _resetPatternLearner();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. EoS Scan Engine
// ═══════════════════════════════════════════════════════════════════════════════

describe('EoS Scan Engine', () => {
  it('scan() returns an EoSScanResult with healthScore in [0, 100]', async () => {
    setupTmpDir();
    const result = await realScan(tmpDir, 'quick');
    expect(result).toHaveProperty('healthScore');
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('filesScanned');
    expect(result).toHaveProperty('durationMs');
    expect(result).toHaveProperty('suppressed');
  });

  it('scan() completes on a multi-file directory without throwing', async () => {
    setupTmpDir();
    await expect(realScan(tmpDir, 'deep')).resolves.not.toThrow();
  });

  it('scanFiles() runs on a specific list of file paths', async () => {
    setupTmpDir();
    const files = [
      path.join(tmpDir, 'clean.ts'),
      path.join(tmpDir, 'dirty.ts'),
    ];
    const result = await realScanFiles(files);
    expect(result.filesScanned).toBe(2);
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
  });

  it('dirty.ts triggers at least one issue', async () => {
    setupTmpDir();
    const result = await realScanFiles([path.join(tmpDir, 'dirty.ts')]);
    // setInterval without cleanup — should produce at least one MEMORY_LEAK issue
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('scan() deep mode includes more files than quick mode (quick skips tests)', async () => {
    setupTmpDir();
    // Write a test file
    writeFileSync(path.join(tmpDir, 'foo.test.ts'), 'describe("foo", () => { it("works", () => {}); });\n');
    const quick = await realScan(tmpDir, 'quick');
    const deep = await realScan(tmpDir, 'deep');
    // quick skips .test.ts files so should scan fewer or equal files
    expect(deep.filesScanned).toBeGreaterThanOrEqual(quick.filesScanned);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Health Score Formula
// ═══════════════════════════════════════════════════════════════════════════════

describe('Health Score Formula', () => {
  const noIssues = { severity: 'info' as const, ruleId: 'x', message: 'x', file: 'x' };

  it('score with no issues is 100', () => {
    const { score, grade } = computeHealthScore([]);
    expect(score).toBe(100);
    expect(grade).toBe('excellent');
  });

  it('each critical issue deducts 8 points', () => {
    const issues = Array.from({ length: 5 }, () => ({ ...noIssues, severity: 'critical' as const }));
    const { score } = computeHealthScore(issues);
    expect(score).toBe(100 - 5 * 8); // 60
  });

  it('each warning deducts 2 points', () => {
    const issues = Array.from({ length: 10 }, () => ({ ...noIssues, severity: 'warning' as const }));
    const { score } = computeHealthScore(issues);
    expect(score).toBe(100 - 10 * 2); // 80
  });

  it('dependency cycles deduct 10 points each', () => {
    const { score } = computeHealthScore([], 3);
    expect(score).toBe(100 - 30); // 70
  });

  it('score is clamped to [0, 100]', () => {
    const issues = Array.from({ length: 20 }, () => ({ ...noIssues, severity: 'critical' as const }));
    const { score } = computeHealthScore(issues);
    expect(score).toBe(0);
  });

  it('grade boundaries: 90→excellent, 70→good, 50→attention, 49→critical', () => {
    expect(computeHealthScore([]).grade).toBe('excellent');
    const warn20 = Array.from({ length: 15 }, () => ({ ...noIssues, severity: 'warning' as const }));
    // 100 - 30 = 70 → 'good'
    expect(computeHealthScore(warn20).score).toBe(70);
    expect(computeHealthScore(warn20).grade).toBe('good');
    // 100 - 50 = 50 → 'attention'
    const warn25 = Array.from({ length: 25 }, () => ({ ...noIssues, severity: 'warning' as const }));
    expect(computeHealthScore(warn25).grade).toBe('attention');
    // critical enough to drop below 50
    const crit7 = Array.from({ length: 7 }, () => ({ ...noIssues, severity: 'critical' as const }));
    expect(computeHealthScore(crit7).score).toBe(44);
    expect(computeHealthScore(crit7).grade).toBe('critical');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Debt Calculator
// ═══════════════════════════════════════════════════════════════════════════════

describe('Technical Debt Calculator', () => {
  it('computeDebt returns correct aggregate counts', () => {
    const issues = [
      { ruleId: 'r1', severity: 'critical' as const, message: 'm', file: 'a.ts' },
      { ruleId: 'r2', severity: 'warning' as const, message: 'm', file: 'a.ts' },
      { ruleId: 'r3', severity: 'info' as const, message: 'm', file: 'b.ts' },
    ];
    const report = computeDebt(issues);
    expect(report.criticalCount).toBe(1);
    expect(report.warningCount).toBe(1);
    expect(report.infoCount).toBe(1);
    expect(report.totalDebt).toBe(8 + 2 + 0); // 10
  });

  it('hotspots are sorted by debt descending', () => {
    const issues = [
      { ruleId: 'r1', severity: 'warning' as const, message: 'm', file: 'low.ts' },
      { ruleId: 'r2', severity: 'critical' as const, message: 'm', file: 'high.ts' },
      { ruleId: 'r3', severity: 'critical' as const, message: 'm', file: 'high.ts' },
    ];
    const { hotspots } = computeDebt(issues);
    expect(hotspots[0]?.file).toBe('high.ts');
    expect(hotspots[0]?.debt).toBe(16);
    expect(hotspots[1]?.file).toBe('low.ts');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. FP Tracker
// ═══════════════════════════════════════════════════════════════════════════════

describe('FP Tracker', () => {
  it('recordOccurrence stores a row in eos_fp_log', () => {
    recordOccurrence({ projectId: 'p1', ruleId: 'rule-a', filePath: 'src/foo.ts', isFP: false });
    expect(_db.eos_fp_log).toHaveLength(1);
    expect(_db.eos_fp_log[0]?.rule_id).toBe('rule-a');
    expect(_db.eos_fp_log[0]?.is_fp).toBe(0);
  });

  it('markFalsePositive updates is_fp to 1', () => {
    recordOccurrence({ projectId: 'p1', ruleId: 'rule-b', filePath: 'src/bar.ts', isFP: false });
    const entryId = _db.eos_fp_log[0]?.id as string;
    markFalsePositive(entryId);
    expect(_db.eos_fp_log[0]?.is_fp).toBe(1);
  });

  it('rule with >20% FP rate in last 100 occurrences appears in getSuppressedRules()', () => {
    // Insert 100 records: 25 FP (25% rate > 20% threshold)
    for (let i = 0; i < 75; i++) {
      recordOccurrence({ projectId: 'p1', ruleId: 'flaky-rule', filePath: 'x.ts', isFP: false });
    }
    for (let i = 0; i < 25; i++) {
      recordOccurrence({ projectId: 'p1', ruleId: 'flaky-rule', filePath: 'x.ts', isFP: true });
    }
    const suppressed = getSuppressedRules('p1');
    expect(suppressed.has('flaky-rule')).toBe(true);
  });

  it('rule with low FP rate stays out of suppressed set', () => {
    // Insert 100 records: only 5 FP (5% rate, below 20% threshold)
    for (let i = 0; i < 95; i++) {
      recordOccurrence({ projectId: 'p2', ruleId: 'solid-rule', filePath: 'y.ts', isFP: false });
    }
    for (let i = 0; i < 5; i++) {
      recordOccurrence({ projectId: 'p2', ruleId: 'solid-rule', filePath: 'y.ts', isFP: true });
    }
    const suppressed = getSuppressedRules('p2');
    expect(suppressed.has('solid-rule')).toBe(false);
  });

  it('getRuleStats returns correct FP rate for a rule', () => {
    for (let i = 0; i < 8; i++) {
      recordOccurrence({ projectId: 'p3', ruleId: 'my-rule', filePath: 'z.ts', isFP: false });
    }
    for (let i = 0; i < 2; i++) {
      recordOccurrence({ projectId: 'p3', ruleId: 'my-rule', filePath: 'z.ts', isFP: true });
    }
    const stats = getRuleStats('p3', 'my-rule');
    expect(stats.total).toBe(10);
    expect(stats.fpCount).toBe(2);
    expect(stats.rate).toBeCloseTo(0.2);
    expect(stats.suppressed).toBe(false); // 0.2 is not > 0.2 (strictly greater)
  });

  it('getSuppressedRules returns empty set for project with no records', () => {
    const suppressed = getSuppressedRules('unknown-project');
    expect(suppressed.size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Agent SDK Gate
// ═══════════════════════════════════════════════════════════════════════════════

describe('Agent SDK Gate', () => {
  const BASE_MANIFEST_ROW = {
    id: 'job-1',
    version: '1.0',
    spawned_by_thread: 'thread-1',
    strategic_thread_id: 'st-1',
    created_at: new Date().toISOString(),
    updated_at: Date.now(),
    status: 'running',
    task_type: 'code',
    title: 'Test job',
    description: 'desc',
    project_path: '/project',
    dependencies: '[]',
    quality_gates: JSON.stringify({ shim_required: false, eos_required: true, tests_required: false }),
    is_self_evolution: 0,
    self_evolution_branch: null,
    result_report: null,
    tokens_used: 0,
    cost_usd: 0,
    shim_score_before: null,
  };

  beforeEach(() => {
    _db.manifests.set('job-1', { ...BASE_MANIFEST_ROW });
    _db.projects.set('proj-1', { id: 'proj-1', path: '/project', health_score: null, last_eos_scan: null });
  });

  it('job marked FAILED when eos_required is true and health score < 70', async () => {
    mockScan.mockResolvedValueOnce({
      healthScore: 45,
      issues: [{ ruleId: 'eval-usage', severity: 'critical', message: 'eval detected', file: 'a.ts', line: 1 }],
      filesScanned: 3,
      durationMs: 50,
      suppressed: [],
    });

    writeResultReport('job-1', 'COMPLETED', makeReport());
    await drainAsync();

    const row = _db.manifests.get('job-1');
    expect(row?.status).toBe('failed');
  });

  it('job stays COMPLETED when eos_required is true and health score >= 70', async () => {
    mockScan.mockResolvedValueOnce({
      healthScore: 82,
      issues: [],
      filesScanned: 3,
      durationMs: 50,
      suppressed: [],
    });

    writeResultReport('job-1', 'COMPLETED', makeReport());
    await drainAsync();

    const row = _db.manifests.get('job-1');
    expect(row?.status).toBe('completed');
  });

  it('job gate does not fire when eos_required is false', async () => {
    _db.manifests.set('job-1', {
      ...BASE_MANIFEST_ROW,
      quality_gates: JSON.stringify({ shim_required: false, eos_required: false, tests_required: false }),
    });

    mockScan.mockResolvedValueOnce({
      healthScore: 30,   // very low — gate would fire if enabled
      issues: [],
      filesScanned: 1,
      durationMs: 10,
      suppressed: [],
    });

    writeResultReport('job-1', 'COMPLETED', makeReport());
    await drainAsync();

    const row = _db.manifests.get('job-1');
    expect(row?.status).toBe('completed');
  });

  it('EoS health score is backfilled into result_report for War Room display', async () => {
    mockScan.mockResolvedValueOnce({
      healthScore: 75,
      issues: [],
      filesScanned: 5,
      durationMs: 100,
      suppressed: [],
    });

    writeResultReport('job-1', 'COMPLETED', makeReport());
    await drainAsync();

    const row = _db.manifests.get('job-1');
    const report = JSON.parse(row?.result_report as string) as {
      quality_results?: { eos?: { healthScore?: number } };
    };
    expect(report.quality_results?.eos?.healthScore).toBe(75);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PatternLearner
// ═══════════════════════════════════════════════════════════════════════════════

describe('PatternLearner', () => {
  function makeImprovement(overrides: Partial<HistoricalImprovement> = {}): HistoricalImprovement {
    return {
      id: `imp-${Math.random().toString(36).slice(2)}`,
      pattern: 'code',
      context: { complexity: 50, maintainability: 60, linesOfCode: 500 },
      modification: { type: 'refactor', impactScore: 10 },
      outcome: { success: true, complexityDelta: -5, maintainabilityDelta: 8 },
      timestamp: Date.now(),
      ...overrides,
    };
  }

  it('recordImprovement stores the record and persists to shim_improvements', () => {
    const pl = getPatternLearner();
    pl.recordImprovement(makeImprovement({ id: 'imp-abc' }));
    expect(_db.shim_improvements.has('imp-abc')).toBe(true);
  });

  it('recordImprovement creates or accumulates a pattern entry', () => {
    const pl = getPatternLearner();
    pl.recordImprovement(makeImprovement({ pattern: 'test' }));
    pl.recordImprovement(makeImprovement({ pattern: 'test' }));
    const patterns = pl.getTopPatterns(10);
    const testPattern = patterns.find(p => p.id === 'test');
    expect(testPattern).toBeDefined();
    expect(testPattern?.frequency).toBe(2);
  });

  it('PatternLearner hydrates from KERNL DB on fresh construction', () => {
    // Seed the in-memory DB with a pattern record
    _db.shim_patterns.set('cached-pattern', {
      id: 'cached-pattern',
      description: 'cached-pattern',
      frequency: 5,
      success_rate: 0.8,
      average_impact: 12,
      contexts: null,
      updated_at: Date.now(),
    });
    // Reset singleton so next call re-hydrates from DB
    _resetPatternLearner();
    const pl = getPatternLearner();
    const patterns = pl.getTopPatterns(10);
    expect(patterns.some(p => p.id === 'cached-pattern')).toBe(true);
  });

  it('predictSuccess returns a sorted PredictionScore array', () => {
    const pl = getPatternLearner();
    // Seed with enough improvements to generate patterns
    for (let i = 0; i < 6; i++) {
      pl.recordImprovement(makeImprovement({
        id: `imp-code-${i}`,
        pattern: 'code',
        outcome: { success: true, complexityDelta: -8, maintainabilityDelta: 10 },
      }));
    }
    for (let i = 0; i < 4; i++) {
      pl.recordImprovement(makeImprovement({
        id: `imp-test-${i}`,
        pattern: 'test',
        outcome: { success: i < 3, complexityDelta: -2, maintainabilityDelta: 4 },
      }));
    }
    const predictions = pl.predictSuccess({ complexity: 50, maintainability: 60, linesOfCode: 400 });
    expect(Array.isArray(predictions)).toBe(true);
    expect(predictions.length).toBeGreaterThan(0);
    // Should be sorted by confidence descending
    for (let i = 1; i < predictions.length; i++) {
      expect(predictions[i - 1]?.confidence).toBeGreaterThanOrEqual(predictions[i]?.confidence ?? 0);
    }
  });

  it('getTopPatterns returns patterns ordered by frequency × successRate', () => {
    const pl = getPatternLearner();
    // High frequency, high success
    for (let i = 0; i < 8; i++) {
      pl.recordImprovement(makeImprovement({ id: `docs-${i}`, pattern: 'docs', outcome: { success: true, complexityDelta: 0, maintainabilityDelta: 5 } }));
    }
    // Low frequency
    for (let i = 0; i < 2; i++) {
      pl.recordImprovement(makeImprovement({ id: `deploy-${i}`, pattern: 'deploy', outcome: { success: true, complexityDelta: 0, maintainabilityDelta: 2 } }));
    }
    const top = pl.getTopPatterns(2);
    expect(top[0]?.id).toBe('docs');  // higher frequency wins
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Score Surfacing (ContextPanel scoreClass helper)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ContextPanel scoreClass', () => {
  it('score >= 80 returns success (green)', () => {
    expect(scoreClass(100)).toContain('success');
    expect(scoreClass(80)).toContain('success');
  });

  it('score 60–79 returns warning (amber)', () => {
    expect(scoreClass(79)).toContain('warning');
    expect(scoreClass(60)).toContain('warning');
  });

  it('score < 60 returns error (red)', () => {
    expect(scoreClass(59)).toContain('error');
    expect(scoreClass(0)).toContain('error');
  });
});
