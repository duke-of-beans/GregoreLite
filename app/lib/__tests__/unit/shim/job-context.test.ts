/**
 * job-context unit tests
 *
 * Tests extractContext() and extractContextFromScore() produce
 * values in expected ranges and respect the proxy formulas.
 */

import { describe, it, expect } from 'vitest';
import { extractContext, extractContextFromScore } from '@/lib/shim/job-context';
import type { TaskManifest } from '@/lib/agent-sdk/types';
import type { EoSScanResult } from '@/lib/eos/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeManifest(fileCount: number): TaskManifest {
  return {
    manifest_id: 'test-manifest',
    version: '1.0',
    spawned_by: { thread_id: 't1', strategic_thread_id: 't1', timestamp: new Date().toISOString() },
    task: { id: 'task-1', type: 'code', title: 'Test', description: 'Test', success_criteria: [] },
    context: {
      project_path: 'D:\\test',
      files: Array.from({ length: fileCount }, (_, i) => ({
        path: `file-${i}.ts`,
        purpose: 'modify' as const,
      })),
      environment: {},
      dependencies: [],
    },
    protocol: { output_format: 'json', reporting_interval: 30, max_duration: 60 },
    return_to_thread: { id: 't1', on_success: 'report', on_failure: 'report' },
    quality_gates: { shim_required: false, eos_required: false, tests_required: false },
    is_self_evolution: false,
  };
}

function makeEosResult(healthScore: number, warnings = 0, filesScanned = 10): EoSScanResult {
  const issues = Array.from({ length: warnings }, (_, i) => ({
    ruleId: `rule-${i}`,
    severity: 'warning' as const,
    message: `Warning ${i}`,
    file: `file-${i}.ts`,
  }));
  return { healthScore, issues, filesScanned, durationMs: 100, suppressed: [] };
}

// ─── extractContext ───────────────────────────────────────────────────────────

describe('extractContext', () => {
  it('complexity = 100 - healthScore, clamped to 0–100', () => {
    const ctx = extractContext(makeManifest(5), makeEosResult(80));
    expect(ctx.complexity).toBe(20);
  });

  it('complexity is 0 when healthScore is 100', () => {
    expect(extractContext(makeManifest(1), makeEosResult(100)).complexity).toBe(0);
  });

  it('complexity is 100 when healthScore is 0', () => {
    expect(extractContext(makeManifest(1), makeEosResult(0)).complexity).toBe(100);
  });

  it('maintainability is close to 100 with no warnings', () => {
    const ctx = extractContext(makeManifest(5), makeEosResult(70, 0, 20));
    expect(ctx.maintainability).toBeCloseTo(100);
  });

  it('maintainability decreases with higher warning density', () => {
    const low = extractContext(makeManifest(5), makeEosResult(70, 1, 100));
    const high = extractContext(makeManifest(5), makeEosResult(70, 20, 100));
    expect(high.maintainability).toBeLessThan(low.maintainability);
  });

  it('maintainability is clamped to 0 at extreme warning density', () => {
    // 1000 warnings across 1 file (200 est lines) → huge density
    const ctx = extractContext(makeManifest(1), makeEosResult(50, 1000, 1));
    expect(ctx.maintainability).toBe(0);
  });

  it('linesOfCode = fileCount × 100', () => {
    const ctx = extractContext(makeManifest(7), makeEosResult(80));
    expect(ctx.linesOfCode).toBe(700);
  });

  it('linesOfCode is 0 when manifest has no files', () => {
    expect(extractContext(makeManifest(0), makeEosResult(80)).linesOfCode).toBe(0);
  });
});

// ─── extractContextFromScore ──────────────────────────────────────────────────

describe('extractContextFromScore', () => {
  it('complexity = 100 - healthScore', () => {
    const ctx = extractContextFromScore(75, 10);
    expect(ctx.complexity).toBe(25);
  });

  it('maintainability = healthScore', () => {
    const ctx = extractContextFromScore(75, 10);
    expect(ctx.maintainability).toBe(75);
  });

  it('linesOfCode = fileCount × 100', () => {
    const ctx = extractContextFromScore(80, 12);
    expect(ctx.linesOfCode).toBe(1200);
  });

  it('all values clamped to 0–100', () => {
    const lo = extractContextFromScore(0, 0);
    const hi = extractContextFromScore(100, 0);
    expect(lo.complexity).toBe(100);
    expect(lo.maintainability).toBe(0);
    expect(hi.complexity).toBe(0);
    expect(hi.maintainability).toBe(100);
  });
});
