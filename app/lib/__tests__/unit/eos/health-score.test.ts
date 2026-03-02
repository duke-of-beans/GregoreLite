import { describe, it, expect } from 'vitest';
import { computeHealthScore } from '@/lib/eos/health-score';
import type { HealthIssue } from '@/lib/eos/types';

function makeIssues(critical: number, warning: number, info = 0): HealthIssue[] {
  return [
    ...Array.from({ length: critical }, (_, i) => ({
      ruleId: 'HOMOGLYPH',
      severity: 'critical' as const,
      message: 'critical',
      file: `file${i}.ts`,
    })),
    ...Array.from({ length: warning }, (_, i) => ({
      ruleId: 'SMART_QUOTE',
      severity: 'warning' as const,
      message: 'warning',
      file: `file${i}.ts`,
    })),
    ...Array.from({ length: info }, (_, i) => ({
      ruleId: 'INFO',
      severity: 'info' as const,
      message: 'info',
      file: `file${i}.ts`,
    })),
  ];
}

describe('computeHealthScore', () => {
  it('returns 100 for a clean scan', () => {
    const { score, grade } = computeHealthScore([]);
    expect(score).toBe(100);
    expect(grade).toBe('excellent');
  });

  it('applies critical weight of 8', () => {
    const { score } = computeHealthScore(makeIssues(1, 0));
    expect(score).toBe(92); // 100 - 8
  });

  it('applies warning weight of 2', () => {
    const { score } = computeHealthScore(makeIssues(0, 1));
    expect(score).toBe(98); // 100 - 2
  });

  it('info issues have no weight', () => {
    const { score } = computeHealthScore(makeIssues(0, 0, 5));
    expect(score).toBe(100);
  });

  it('applies dependency cycle penalty of 10 each', () => {
    const { score } = computeHealthScore([], 2);
    expect(score).toBe(80); // 100 - 20
  });

  it('combines all penalties correctly', () => {
    // 1 critical × 8 + 2 warning × 2 + 1 cycle × 10 = 8 + 4 + 10 = 22
    const { score } = computeHealthScore(makeIssues(1, 2), 1);
    expect(score).toBe(78);
  });

  it('clamps score at 0 (never negative)', () => {
    const { score } = computeHealthScore(makeIssues(20, 0));
    expect(score).toBe(0); // 100 - 160 → clamped
  });

  it('clamps score at 100 (never above)', () => {
    const { score } = computeHealthScore([], -5); // nonsense cycles
    expect(score).toBe(100);
  });

  it('grades correctly: excellent ≥ 90', () => {
    expect(computeHealthScore(makeIssues(0, 0)).grade).toBe('excellent');
    expect(computeHealthScore(makeIssues(0, 5)).grade).toBe('excellent'); // 100-10 = 90
  });

  it('grades correctly: good 70–89', () => {
    expect(computeHealthScore(makeIssues(0, 6)).grade).toBe('good'); // 100-12 = 88
    expect(computeHealthScore(makeIssues(0, 15)).grade).toBe('good'); // 100-30 = 70
  });

  it('grades correctly: attention 50–69', () => {
    expect(computeHealthScore(makeIssues(0, 16)).grade).toBe('attention'); // 100-32 = 68
  });

  it('grades correctly: critical < 50', () => {
    expect(computeHealthScore(makeIssues(7, 0)).grade).toBe('critical'); // 100-56 = 44
  });

  it('returns correct counts', () => {
    const { critical, warning } = computeHealthScore(makeIssues(3, 4));
    expect(critical).toBe(3);
    expect(warning).toBe(4);
  });
});
