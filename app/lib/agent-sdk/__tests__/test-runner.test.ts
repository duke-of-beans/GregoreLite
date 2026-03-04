/**
 * test-runner.test.ts — Sprint 11.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTestRunner } from '../tools/test-runner';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'child_process';
const mockExec = vi.mocked(execFileSync);

const PASSING_OUTPUT = `
 ✓ src/foo.test.ts (3)

 Test Files  1 passed (1)
 Tests  3 passed (3)
 Duration  1.23s
`;

const FAILING_OUTPUT = `
 × src/foo.test.ts > suite > should do X
   AssertionError: expected 1 to equal 2

 × src/bar.test.ts > suite > should do Y
   TypeError: Cannot read property 'x' of undefined

 Test Files  2 failed (2)
 Tests  2 failed | 5 passed (7)
 Duration  0.88s
`;

describe('runTestRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses passing test output correctly', () => {
    mockExec.mockReturnValue(Buffer.from(PASSING_OUTPUT));

    const result = runTestRunner('/fake/project');

    expect(result.passed).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(3);
    expect(result.failures).toHaveLength(0);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('parses failing test output with 2 failures', () => {
    const err = Object.assign(new Error('Process exited with code 1'), {
      stdout: FAILING_OUTPUT,
      stderr: '',
      signal: null,
    });
    mockExec.mockImplementation(() => { throw err; });

    const result = runTestRunner('/fake/project');

    expect(result.failed).toBe(2);
    expect(result.passed).toBe(5);
    expect(result.total).toBe(7);
    expect(result.failures).toHaveLength(2);
    expect(result.failures[0]?.test).toContain('should do X');
    expect(result.failures[0]?.error).toContain('AssertionError');
  });

  it('returns timeout error result on SIGTERM', () => {
    const err = Object.assign(new Error('spawnSync pnpm.cmd ETIMEDOUT'), {
      stdout: '',
      stderr: '',
      signal: 'SIGTERM',
    });
    mockExec.mockImplementation(() => { throw err; });

    const result = runTestRunner('/fake/project');

    expect(result.failed).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.test).toBe('<timeout>');
    expect(result.failures[0]?.error).toContain('120 second');
  });

  it('returns exec_error when no output is available', () => {
    const err = Object.assign(new Error('pnpm not found'), {
      stdout: '',
      stderr: '',
      signal: null,
    });
    mockExec.mockImplementation(() => { throw err; });

    const result = runTestRunner('/fake/project');

    expect(result.failed).toBe(1);
    expect(result.failures[0]?.test).toBe('<exec_error>');
    expect(result.failures[0]?.error).toContain('pnpm not found');
  });

  it('passes filter argument through to pnpm', () => {
    mockExec.mockReturnValue(Buffer.from(PASSING_OUTPUT));
    runTestRunner('/fake/project', 'my-test-pattern');
    expect(mockExec).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--testNamePattern', 'my-test-pattern']),
      expect.any(Object),
    );
  });
});
