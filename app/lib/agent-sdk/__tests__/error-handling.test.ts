/**
 * error-handling.test.ts — Phase 7C
 *
 * Unit tests for failure mode detection, backoff logic, handoff report generation,
 * and session restart mechanics.
 *
 * Simulates all six failure modes per BLUEPRINT §4.3.4.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectContextLimit,
  detectImpossibleTask,
  isNetworkError,
  isToolError,
  detectShimLoop,
  FailureMode,
} from '../failure-modes';
import {
  withBackoff,
  classifyStopReason,
  classifyError,
  RETRY_CONFIG,
} from '../error-handler';
import { buildHandoffReport } from '../handoff-report';

// ─── Database mock ─────────────────────────────────────────────────────────────

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({ get: mockGet, run: vi.fn() }),
  }),
}));

// ─── Mock readJobState used by buildHandoffReport ────────────────────────────

vi.mock('../query', () => ({
  readJobState: vi.fn(),
}));

import { readJobState } from '../query';
const mockReadJobState = vi.mocked(readJobState);

// ─── FailureMode enum ─────────────────────────────────────────────────────────

describe('FailureMode enum', () => {
  it('has all six modes', () => {
    expect(FailureMode.CONTEXT_LIMIT).toBe('CONTEXT_LIMIT');
    expect(FailureMode.TOOL_ERROR).toBe('TOOL_ERROR');
    expect(FailureMode.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(FailureMode.IMPOSSIBLE_TASK).toBe('IMPOSSIBLE_TASK');
    expect(FailureMode.APP_CRASH).toBe('APP_CRASH');
    expect(FailureMode.SHIM_LOOP).toBe('SHIM_LOOP');
  });
});

// ─── detectContextLimit ───────────────────────────────────────────────────────

describe('detectContextLimit', () => {
  it('returns true for max_tokens', () => {
    expect(detectContextLimit('max_tokens')).toBe(true);
  });

  it('returns false for end_turn', () => {
    expect(detectContextLimit('end_turn')).toBe(false);
  });

  it('returns false for null', () => {
    expect(detectContextLimit(null)).toBe(false);
  });

  it('returns false for tool_use', () => {
    expect(detectContextLimit('tool_use')).toBe(false);
  });
});

// ─── detectImpossibleTask ─────────────────────────────────────────────────────

describe('detectImpossibleTask', () => {
  it('detects "impossible" with no files written', () => {
    expect(detectImpossibleTask('This task is impossible to complete.', [])).toBe(true);
  });

  it('detects "cannot" with no files written', () => {
    expect(detectImpossibleTask('I cannot access the database directly.', [])).toBe(true);
  });

  it('detects "not possible" with no files written', () => {
    expect(detectImpossibleTask('It is not possible to perform this operation.', [])).toBe(true);
  });

  it('returns false when files were written despite impossibility phrase', () => {
    // Avoids false positives on cautionary disclaimers after partial work
    expect(detectImpossibleTask('cannot guarantee accuracy', ['src/foo.ts'])).toBe(false);
  });

  it('returns false for normal completion text with no files', () => {
    expect(detectImpossibleTask('All tasks completed successfully.', [])).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(detectImpossibleTask('IMPOSSIBLE to proceed.', [])).toBe(true);
  });
});

// ─── isNetworkError / isToolError ────────────────────────────────────────────

describe('isNetworkError', () => {
  it('detects ECONNRESET', () => {
    expect(isNetworkError(new Error('read ECONNRESET'))).toBe(true);
  });

  it('detects ETIMEDOUT', () => {
    expect(isNetworkError(new Error('connect ETIMEDOUT 192.168.1.1:443'))).toBe(true);
  });

  it('detects socket hang up', () => {
    expect(isNetworkError(new Error('socket hang up'))).toBe(true);
  });

  it('returns false for non-network errors', () => {
    expect(isNetworkError(new Error('Cannot read property "foo" of undefined'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isNetworkError('string error')).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('isToolError', () => {
  it('returns true for non-network Error', () => {
    expect(isToolError(new Error('Tool execution failed'))).toBe(true);
  });

  it('returns false for network errors', () => {
    expect(isToolError(new Error('read ECONNRESET'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isToolError('string')).toBe(false);
  });
});

// ─── detectShimLoop (Sprint 11.1 — real implementation) ─────────────────────

describe('detectShimLoop', () => {
  it('returns false for empty history', () => {
    expect(detectShimLoop([])).toBe(false);
  });

  it('returns false with fewer than 3 entries for the same file', () => {
    expect(detectShimLoop([
      { file: 'a.ts', score: 70 },
      { file: 'a.ts', score: 65 },
    ])).toBe(false);
  });

  it('returns true when 3 consecutive calls on the same file have non-improving scores', () => {
    expect(detectShimLoop([
      { file: 'a.ts', score: 70 },
      { file: 'a.ts', score: 70 },
      { file: 'a.ts', score: 70 },
    ])).toBe(true);
  });

  it('returns true when scores are strictly decreasing', () => {
    expect(detectShimLoop([
      { file: 'a.ts', score: 80 },
      { file: 'a.ts', score: 75 },
      { file: 'a.ts', score: 70 },
    ])).toBe(true);
  });

  it('returns false when scores are strictly increasing (making progress)', () => {
    expect(detectShimLoop([
      { file: 'a.ts', score: 60 },
      { file: 'a.ts', score: 70 },
      { file: 'a.ts', score: 80 },
    ])).toBe(false);
  });

  it('returns false when the repeated file has fewer than 3 hits in history', () => {
    expect(detectShimLoop([
      { file: 'b.ts', score: 50 },
      { file: 'a.ts', score: 70 },
      { file: 'a.ts', score: 70 },
    ])).toBe(false);
  });
});

// ─── classifyStopReason ───────────────────────────────────────────────────────

describe('classifyStopReason', () => {
  it('classifies max_tokens as CONTEXT_LIMIT', () => {
    const result = classifyStopReason('max_tokens', '', []);
    expect(result).not.toBeNull();
    expect(result!.mode).toBe(FailureMode.CONTEXT_LIMIT);
    expect(result!.message).toContain('Context limit');
  });

  it('classifies impossible task on end_turn with no files', () => {
    const result = classifyStopReason(null, 'I cannot complete this task.', []);
    expect(result).not.toBeNull();
    expect(result!.mode).toBe(FailureMode.IMPOSSIBLE_TASK);
    expect(result!.message).toContain('impossible');
  });

  it('returns null for normal end_turn completion', () => {
    const result = classifyStopReason(null, 'All files written successfully.', ['src/foo.ts']);
    expect(result).toBeNull();
  });

  it('returns null for end_turn with no impossibility text', () => {
    const result = classifyStopReason(null, 'Done.', []);
    expect(result).toBeNull();
  });
});

// ─── classifyError ────────────────────────────────────────────────────────────

describe('classifyError', () => {
  it('classifies ECONNRESET as NETWORK_ERROR', () => {
    const result = classifyError(new Error('read ECONNRESET'));
    expect(result.mode).toBe(FailureMode.NETWORK_ERROR);
    expect(result.message).toContain('Network error');
  });

  it('classifies generic Error as TOOL_ERROR', () => {
    const result = classifyError(new Error('Unexpected token in JSON'));
    expect(result.mode).toBe(FailureMode.TOOL_ERROR);
    expect(result.message).toContain('Tool error');
  });
});

// ─── withBackoff ─────────────────────────────────────────────────────────────

describe('withBackoff', () => {
  // Use baseDelayMs=0 throughout to avoid real/fake timer complications.
  // delay = 0 * 2^attempt = 0ms — no actual waiting, no unhandled rejections.

  it('succeeds on first attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await expect(withBackoff(fn, 3, 0)).resolves.toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries 1+maxRetries times then throws on total failure', async () => {
    const fn = vi.fn().mockImplementation(async () => { throw new Error('fail'); });
    await expect(withBackoff(fn, 3, 0)).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('succeeds after one failed attempt', async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new Error('transient');
    });
    await expect(withBackoff(fn, 3, 0)).resolves.toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects maxRetries=0 — no retries, just the single attempt', async () => {
    const fn = vi.fn().mockImplementation(async () => { throw new Error('fail'); });
    await expect(withBackoff(fn, 0, 0)).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('aborts immediately when signal fires before first attempt', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn().mockResolvedValue(undefined);
    await expect(withBackoff(fn, 3, 100, controller.signal)).rejects.toThrow('aborted');
    expect(fn).not.toHaveBeenCalled();
  });

  it('RETRY_CONFIG: tool errors use 3 retries at 1s base', () => {
    expect(RETRY_CONFIG.toolError.maxRetries).toBe(3);
    expect(RETRY_CONFIG.toolError.baseDelayMs).toBe(1000);
  });

  it('RETRY_CONFIG: network errors use 1 retry at 2s base', () => {
    expect(RETRY_CONFIG.networkError.maxRetries).toBe(1);
    expect(RETRY_CONFIG.networkError.baseDelayMs).toBe(2000);
  });
});

// ─── buildHandoffReport ───────────────────────────────────────────────────────

describe('buildHandoffReport', () => {
  beforeEach(() => {
    mockReadJobState.mockReset();
  });

  it('returns safe fallback when no job_state exists', () => {
    mockReadJobState.mockReturnValue(null);
    const report = buildHandoffReport('missing-manifest');
    expect(report).toContain('PRIOR EXECUTION CONTEXT');
    expect(report).toContain('previously attempted');
  });

  it('interpolates files_modified into the report', () => {
    mockReadJobState.mockReturnValue({
      manifest_id: 'test-123',
      status: 'failed',
      steps_completed: 5,
      files_modified: JSON.stringify(['src/foo.ts', 'src/bar.ts']),
      last_event: JSON.stringify({ type: 'error', message: 'context limit' }),
      log_path: null,
      tokens_used_so_far: 1000,
      cost_so_far: 0.01,
      updated_at: Date.now(),
    });
    const report = buildHandoffReport('test-123');
    expect(report).toContain('src/foo.ts');
    expect(report).toContain('src/bar.ts');
    expect(report).toContain('Steps completed before failure: 5');
    expect(report).toContain('context limit');
  });

  it('handles empty files_modified gracefully', () => {
    mockReadJobState.mockReturnValue({
      manifest_id: 'test-456',
      status: 'failed',
      steps_completed: 0,
      files_modified: '[]',
      last_event: JSON.stringify({ type: 'session_spawned' }),
      log_path: null,
      tokens_used_so_far: 0,
      cost_so_far: 0,
      updated_at: Date.now(),
    });
    const report = buildHandoffReport('test-456');
    expect(report).toContain('none');
  });

  it('handles malformed JSON in files_modified', () => {
    mockReadJobState.mockReturnValue({
      manifest_id: 'test-789',
      status: 'failed',
      steps_completed: 2,
      files_modified: 'NOT_JSON',
      last_event: '{}',
      log_path: null,
      tokens_used_so_far: 500,
      cost_so_far: 0.005,
      updated_at: Date.now(),
    });
    const report = buildHandoffReport('test-789');
    expect(report).toContain('none'); // fallback for invalid JSON
  });

  it('produces a compact report (prompt length safety)', () => {
    mockReadJobState.mockReturnValue({
      manifest_id: 'test-length',
      status: 'interrupted',
      steps_completed: 12,
      files_modified: JSON.stringify(['src/a.ts', 'src/b.ts', 'src/c.ts']),
      last_event: JSON.stringify({ type: 'error_terminal', message: 'Network error: ECONNRESET', context: 'NETWORK_ERROR' }),
      log_path: null,
      tokens_used_so_far: 5000,
      cost_so_far: 0.05,
      updated_at: Date.now(),
    });
    const report = buildHandoffReport('test-length');
    // Report should be well under 2000 chars — safe to prepend to any system prompt
    expect(report.length).toBeLessThan(2000);
    expect(report).toContain('PRIOR EXECUTION CONTEXT');
  });
});
