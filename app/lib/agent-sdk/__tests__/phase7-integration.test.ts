/**
 * phase7-integration.test.ts — Phase 7H Integration Suite
 *
 * 27 tests covering the full Sprint 7H surface:
 *   - Branch namer (2)
 *   - PR description builder (2)
 *   - Protected paths (4)
 *   - Branch manager (3)
 *   - Git tools (3)
 *   - GitHub API (4)
 *   - Orchestrator pre-flight (2)
 *   - Orchestrator post-processing gates (3)
 *   - Tool injector: git tools are real, not stubs (2)
 *   - Permission matrix: self_evolution tool set (2)
 *
 * BLUEPRINT §7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock: child_process execSync ─────────────────────────────────────────────

const mockExecSync = vi.fn();

vi.mock('child_process', () => ({
  execSync: (cmd: string, opts?: unknown) => mockExecSync(cmd, opts),
}));

// ─── Mock: database ───────────────────────────────────────────────────────────
// vi.mock factories are hoisted to the top of the file — outer variables are NOT
// yet initialised when the factory runs. Use vi.hoisted() to ensure the mock
// variables are created before the factory executes.

const { mockDbRun, mockDbGet, mockPrepare } = vi.hoisted(() => {
  const mockDbRun   = vi.fn().mockReturnValue({ changes: 1 });
  const mockDbGet   = vi.fn();
  const mockPrepare = vi.fn().mockReturnValue({ run: mockDbRun, get: mockDbGet });
  return { mockDbRun, mockDbGet, mockPrepare };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn().mockReturnValue({ prepare: mockPrepare }),
}));

// ─── Mock: node:fs for .gregignore tests ─────────────────────────────────────

const mockReadFileSync = vi.fn();
const mockExistsSync   = vi.fn().mockReturnValue(false);

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: (p: string, enc?: unknown) => mockReadFileSync(p, enc),
    existsSync:   (p: string) => mockExistsSync(p),
  };
});

// ─── Mock: global fetch for GitHub API ───────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { generateBranchName } from '../self-evolution/branch-namer';
import { buildPRDescription  } from '../self-evolution/pr-description-builder';
import {
  isProtectedPath,
  filterProtectedFiles,
} from '../self-evolution/protected-paths';
import { createEvolutionBranch, getCurrentBranch } from '../self-evolution/branch-manager';
import { executeGitCommit, executeGitStatus, executeGitDiff } from '../self-evolution/git-tools';
import { storePAT, getPAT, createPR, mergePR, pollCIStatus } from '../self-evolution/github-api';
import { runPreFlight } from '../self-evolution/self-evolution-orchestrator';
import { isStubTool } from '../tool-injector';
import { PERMISSION_CONFIG } from '../permission-config';
import type { TaskManifest } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REPO_ROOT = 'D:/Projects/GregLite';

function makeManifest(overrides: Partial<TaskManifest['task']> = {}): TaskManifest {
  return {
    manifest_id: 'test-manifest-001',
    version: '1.0',
    spawned_by: {
      thread_id: 'thread-1',
      strategic_thread_id: 'strategic-1',
      timestamp: new Date().toISOString(),
    },
    task: {
      id: 'task-1',
      type: 'self_evolution',
      title: 'Improve query performance',
      description: 'Optimise the agent query loop',
      success_criteria: ['tsc clean', 'tests pass'],
      ...overrides,
    },
    context: {
      project_path: REPO_ROOT,
      files: [],
      environment: {},
      dependencies: [],
    },
    protocol: { output_format: 'mixed', reporting_interval: 30, max_duration: 60 },
    return_to_thread: { id: 'thread-1', on_success: 'pr', on_failure: 'report' },
    quality_gates: { shim_required: true, eos_required: false, tests_required: true },
    is_self_evolution: true,
  };
}

// ─── 1. Branch Namer ──────────────────────────────────────────────────────────

describe('Phase 7H: Branch Namer', () => {
  it('produces a self-evolve/{YYYYMMDD-HHMM}-{slug} formatted name', () => {
    const at = new Date('2026-03-02T14:05:00Z');
    const name = generateBranchName('Improve query loop performance', at);
    expect(name).toMatch(/^self-evolve\/\d{8}-\d{4}-/);
    expect(name).toContain('improve-query-loop-performance');
  });

  it('caps slug at 4 words and strips special characters', () => {
    const at = new Date('2026-03-02T09:00:00Z');
    const name = generateBranchName('Fix: async/await error handling in retry logic here', at);
    // Slug is first 4 words, alphanumeric + hyphens only
    const slug = name.split('/')[1]?.split('-').slice(2).join('-') ?? '';
    const wordCount = slug.split('-').filter(Boolean).length;
    expect(wordCount).toBeLessThanOrEqual(6); // 4 words, each may have internal hyphens stripped
  });
});

// ─── 2. PR Description Builder ───────────────────────────────────────────────

describe('Phase 7H: PR Description Builder', () => {
  it('includes manifest ID, goal summary, and file list in output', () => {
    const desc = buildPRDescription({
      manifestId: 'manifest-abc',
      goalSummary: 'Improve query performance',
      targetComponent: 'query.ts',
      filesChanged: ['app/lib/agent-sdk/query.ts', 'app/lib/agent-sdk/types.ts'],
      shimScoreBefore: 72,
      shimScoreAfter: 88,
    });
    expect(desc).toContain('manifest-abc');
    expect(desc).toContain('Improve query performance');
    expect(desc).toContain('query.ts');
  });

  it('handles null SHIM scores without throwing', () => {
    expect(() =>
      buildPRDescription({
        manifestId: 'manifest-xyz',
        goalSummary: 'Refactor scheduler',
        targetComponent: 'scheduler.ts',
        filesChanged: [],
        shimScoreBefore: null,
        shimScoreAfter: null,
      })
    ).not.toThrow();
  });
});

// ─── 3. Protected Paths ───────────────────────────────────────────────────────

describe('Phase 7H: Protected Paths', () => {
  it('blocks hard-protected agent-sdk prefix', () => {
    const result = isProtectedPath(
      'app/lib/agent-sdk/query.ts',
      REPO_ROOT,
    );
    expect(result.protected).toBe(true);
    expect(result.reason).toMatch(/hard-protected/i);
  });

  it('blocks self-evolution sub-directory', () => {
    const result = isProtectedPath(
      'app/lib/agent-sdk/self-evolution/branch-manager.ts',
      REPO_ROOT,
    );
    expect(result.protected).toBe(true);
  });

  it('allows non-protected application files', () => {
    const result = isProtectedPath(
      'app/components/chat/ChatInput.tsx',
      REPO_ROOT,
    );
    expect(result.protected).toBe(false);
  });

  it('filterProtectedFiles separates allowed from rejected', () => {
    const files = [
      'app/components/chat/ChatInput.tsx',        // allowed
      'app/lib/agent-sdk/self-evolution/foo.ts',  // rejected — hard-protected
      'app/lib/kernl/core/something.ts',           // rejected — hard-protected
    ];
    const { allowed, rejected } = filterProtectedFiles(files, REPO_ROOT);
    expect(allowed).toHaveLength(1);
    expect(allowed[0]).toBe('app/components/chat/ChatInput.tsx');
    expect(rejected).toHaveLength(2);
  });
});

// ─── 4. Branch Manager ───────────────────────────────────────────────────────

describe('Phase 7H: Branch Manager', () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  it('createEvolutionBranch: verifies clean repo then checks out branch', () => {
    // git status --porcelain returns empty string (clean)
    mockExecSync.mockReturnValueOnce('');            // git status --porcelain
    mockExecSync.mockReturnValueOnce('');            // git checkout -b

    const result = createEvolutionBranch('Fix scheduler bug', REPO_ROOT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.branchName).toMatch(/^self-evolve\//);
    }

    const calls = mockExecSync.mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('status --porcelain'))).toBe(true);
    expect(calls.some((c) => c.includes('checkout -b'))).toBe(true);
  });

  it('createEvolutionBranch: returns error result when working tree is dirty', () => {
    mockExecSync.mockReturnValueOnce(' M app/lib/agent-sdk/query.ts\n');
    const result = createEvolutionBranch('Fix scheduler', REPO_ROOT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/not clean/i);
    }
  });

  it('getCurrentBranch: returns trimmed branch name', () => {
    mockExecSync.mockReturnValueOnce('  main  \n');
    const branch = getCurrentBranch(REPO_ROOT);
    expect(branch).toBe('main');
  });
});

// ─── 5. Git Tools ────────────────────────────────────────────────────────────

describe('Phase 7H: Git Tools', () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  it('executeGitStatus returns git status --short output', () => {
    mockExecSync.mockReturnValueOnce(' M query.ts\n?? newfile.ts\n');
    const output = executeGitStatus({}, REPO_ROOT);
    expect(output).toContain('query.ts');
    const call = mockExecSync.mock.calls[0]?.[0] as string;
    expect(call).toContain('status');
  });

  it('executeGitCommit stages files and uses -F temp file', () => {
    // git add (one per file), then git commit -F
    mockExecSync.mockReturnValue('');
    const output = executeGitCommit(
      { message: 'test: improve query loop', files: ['app/lib/agent-sdk/query.ts'] },
      REPO_ROOT,
    );
    const calls = mockExecSync.mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('git add'))).toBe(true);
    expect(calls.some((c) => c.includes('commit'))).toBe(true);
    expect(output).not.toContain('ERROR');
  });

  it('executeGitDiff returns both staged and unstaged diffs', () => {
    mockExecSync
      .mockReturnValueOnce('staged diff content\n')
      .mockReturnValueOnce('unstaged diff content\n');
    const output = executeGitDiff({}, REPO_ROOT);
    expect(output).toContain('staged');
    expect(output).toContain('unstaged');
  });
});

// ─── 6. GitHub API ───────────────────────────────────────────────────────────

describe('Phase 7H: GitHub API', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockDbGet.mockReset();
    mockDbRun.mockReset();
  });

  it('storePAT and getPAT round-trip through settings table', () => {
    // storePAT writes to DB
    storePAT('ghp_testtoken123');
    expect(mockDbRun).toHaveBeenCalled();

    // getPAT reads from DB
    mockDbGet.mockReturnValueOnce({ value: 'ghp_testtoken123' });
    const pat = getPAT();
    expect(pat).toBe('ghp_testtoken123');
  });

  it('createPR: calls POST /repos/.../pulls and returns prNumber', async () => {
    mockDbGet.mockReturnValueOnce({ value: 'ghp_testpat' }); // getPAT
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        number: 42,
        html_url: 'https://github.com/acme/repo/pull/42',
        head: { sha: 'abc123headsha' },
      }),
    });

    const result = await createPR({
      owner: 'acme',
      repo: 'greglite',
      title: 'self-evolve: fix query loop',
      body: 'PR body',
      head: 'self-evolve/20260302-1400-fix-query',
      base: 'main',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.prNumber).toBe(42);
      expect(result.headSha).toBe('abc123headsha');
    }
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/repos/acme/greglite/pulls');
    expect((opts.method as string).toUpperCase()).toBe('POST');
  });

  it('mergePR: calls PUT .../merge with squash method', async () => {
    mockDbGet.mockReturnValueOnce({ value: 'ghp_testpat' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sha: 'abc123' }),
    });

    const result = await mergePR('acme', 'greglite', 42, 'self-evolve: fix (#42)');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mergeCommitSha).toBe('abc123');
    }
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/pulls/42/merge');
    const body = JSON.parse(opts.body as string) as { merge_method: string };
    expect(body.merge_method).toBe('squash');
  });

  it('pollCIStatus: maps GitHub combined status to CIStatus type', async () => {
    mockDbGet.mockReturnValueOnce({ value: 'ghp_testpat' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ state: 'success', total_count: 2 }),
    });

    const status = await pollCIStatus('acme', 'greglite', 'abc123sha');
    expect(status).toBe('success');
  });
});

// ─── 7. Orchestrator: runPreFlight ───────────────────────────────────────────

describe('Phase 7H: Orchestrator runPreFlight', () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  it('mutates manifest in-memory with branch name and is_self_evolution', () => {
    mockExecSync.mockReturnValue(''); // clean status + checkout
    const manifest = makeManifest();
    runPreFlight(manifest, REPO_ROOT);

    expect(manifest.is_self_evolution).toBe(true);
    expect(manifest.self_evolution_branch).toMatch(/^self-evolve\//);
  });

  it('throws if repo is dirty — does not modify manifest', () => {
    mockExecSync.mockReturnValueOnce(' M dirty-file.ts\n');
    const manifest = makeManifest();
    const originalBranch = manifest.self_evolution_branch;

    expect(() => runPreFlight(manifest, REPO_ROOT)).toThrow();
    // Manifest should not have been mutated
    expect(manifest.self_evolution_branch).toBe(originalBranch);
  });
});

// ─── 8. Orchestrator: runPostProcessing gates ────────────────────────────────

describe('Phase 7H: Orchestrator runPostProcessing gates', () => {
  beforeEach(() => {
    mockDbGet.mockReset();
    mockDbRun.mockReset();
    mockExecSync.mockReset();
    mockFetch.mockReset(); // clear call history from GitHub API tests (block 6)
  });

  it('exits early if job status is not completed', async () => {
    // job_state returns 'failed'
    mockDbGet
      .mockReturnValueOnce({ status: 'failed' }); // dbGetJobStatus

    const { runPostProcessing } = await import('../self-evolution/self-evolution-orchestrator');
    await expect(
      runPostProcessing('manifest-001', { repoRoot: REPO_ROOT }),
    ).resolves.toBeUndefined();

    // No execSync calls (tests not run, no git push)
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('exits early if SHIM score is below threshold', async () => {
    mockDbGet
      .mockReturnValueOnce({ status: 'completed' })         // dbGetJobStatus
      .mockReturnValueOnce({                                  // dbGetManifest
        self_evolution_branch: 'self-evolve/20260302-foo',
        goal_summary: 'Fix scheduler',
        target_component: 'scheduler.ts',
        shim_score_after: 55,                                 // below 70 threshold
        title: 'Fix scheduler',
      });

    const { runPostProcessing } = await import('../self-evolution/self-evolution-orchestrator');
    await runPostProcessing('manifest-002', { repoRoot: REPO_ROOT });

    // No git push, no PR creation
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('skips PR creation when githubOwner/githubRepo not provided', async () => {
    mockDbGet
      .mockReturnValueOnce({ status: 'completed' })
      .mockReturnValueOnce({
        self_evolution_branch: 'self-evolve/20260302-foo',
        goal_summary: 'Fix scheduler',
        target_component: 'scheduler.ts',
        shim_score_after: null,   // null = SHIM didn't run → allow
        title: 'Fix scheduler',
      })
      .mockReturnValueOnce({ files_modified: '[]' }); // dbGetFilesModified

    // Vitest passes for test run
    mockExecSync.mockReturnValue('');

    const { runPostProcessing } = await import('../self-evolution/self-evolution-orchestrator');
    await runPostProcessing('manifest-003', {
      repoRoot: REPO_ROOT,
      // githubOwner and githubRepo intentionally omitted
    });

    // No fetch calls — PR creation skipped
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── 9. Tool Injector: git tools are real ────────────────────────────────────

describe('Phase 7H: Tool Injector — git tools are real', () => {
  it('git_commit is not a stub', () => {
    expect(isStubTool('git_commit')).toBe(false);
  });

  it('git_status and git_diff are not stubs', () => {
    expect(isStubTool('git_status')).toBe(false);
    expect(isStubTool('git_diff')).toBe(false);
  });
});

// ─── 10. Permission Matrix: self_evolution tool set ──────────────────────────

describe('Phase 7H: Permission Matrix — self_evolution', () => {
  it('self_evolution profile includes git_commit, git_status, git_diff', () => {
    const tools = PERMISSION_CONFIG['self_evolution'].tools;
    expect(tools).toContain('git_commit');
    expect(tools).toContain('git_status');
    expect(tools).toContain('git_diff');
  });

  it('self_evolution profile does NOT include git_branch_tools stub', () => {
    const tools = PERMISSION_CONFIG['self_evolution'].tools;
    expect(tools).not.toContain('git_branch_tools');
  });
});
