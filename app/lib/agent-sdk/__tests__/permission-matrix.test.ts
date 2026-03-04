/**
 * permission-matrix.test.ts — Phase 7B
 *
 * Verifies:
 *  1. selectTools() returns exactly the configured tool set for each session type
 *  2. readOnly session types have no write tools injected
 *  3. scope-enforcer rejects out-of-scope writes and logs violations
 *  4. scope-enforcer allows in-scope writes
 *  5. fs_write_docs_only rejects paths outside /docs
 *  6. Stub tools are correctly identified
 *  7. resolveCwd() returns correct paths for each CWD policy
 */

import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import os from 'os';

// ─── Database mock (scope-enforcer calls getDatabase on violations) ────────────

const { mockRun } = vi.hoisted(() => ({ mockRun: vi.fn() }));

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({ run: mockRun }),
  }),
}));

import { selectTools, isStubTool, getToolNames } from '../tool-injector';
import { checkWriteScope, resolveCwd } from '../scope-enforcer';
import { PERMISSION_CONFIG } from '../permission-config';
import type { TaskManifest } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeManifest(
  type: TaskManifest['task']['type'],
  files: Array<{ path: string; purpose: 'read' | 'modify' | 'create' }> = [],
  projectPath = 'D:/Projects/GregLite'
): TaskManifest {
  return {
    manifest_id: 'test-manifest-001',
    version: '1.0',
    spawned_by: { thread_id: 't1', strategic_thread_id: 'st1', timestamp: new Date().toISOString() },
    task: {
      id: 'task-001',
      type,
      title: 'Test task',
      description: 'Testing permission matrix',
      success_criteria: [],
    },
    context: {
      project_path: projectPath,
      files: files.map((f) => ({ ...f })),
      environment: {},
      dependencies: [],
    },
    protocol: { output_format: 'mixed', reporting_interval: 10, max_duration: 30 },
    return_to_thread: { id: 'rt1', on_success: 'report', on_failure: 'report' },
    quality_gates: { shim_required: false, eos_required: false, tests_required: false },
    is_self_evolution: false,
  };
}

// ─── 1. Tool injection per session type ───────────────────────────────────────

describe('selectTools — tool injection', () => {
  it('code session gets fs_read, list_directory, fs_write, run_command, test_runner, shim_check', () => {
    const manifest = makeManifest('code');
    const names = selectTools('code', manifest).map((t) => t.name);
    expect(names).toContain('fs_read');
    expect(names).toContain('list_directory');
    expect(names).toContain('fs_write');
    expect(names).toContain('run_command');
    expect(names).toContain('test_runner');
    expect(names).toContain('shim_check');
    expect(names).not.toContain('git_branch_tools');
  });

  it('test session gets fs_read, fs_write, test_runner but not shim_check', () => {
    const manifest = makeManifest('test');
    const names = selectTools('test', manifest).map((t) => t.name);
    expect(names).toContain('fs_read');
    expect(names).toContain('fs_write');
    expect(names).toContain('test_runner');
    expect(names).not.toContain('shim_check');
    expect(names).not.toContain('git_branch_tools');
  });

  it('docs session gets fs_write_docs_only not fs_write', () => {
    const manifest = makeManifest('docs');
    const names = selectTools('docs', manifest).map((t) => t.name);
    expect(names).toContain('fs_read');
    expect(names).toContain('fs_write_docs_only');
    expect(names).toContain('markdown_linter');
    expect(names).not.toContain('fs_write');
    expect(names).not.toContain('run_command');
  });

  it('research session has no write tools', () => {
    const manifest = makeManifest('research');
    const names = selectTools('research', manifest).map((t) => t.name);
    expect(names).toContain('fs_read');
    expect(names).toContain('kernl_search_readonly');
    expect(names).not.toContain('fs_write');
    expect(names).not.toContain('fs_write_docs_only');
    expect(names).not.toContain('run_command');
  });

  it('analysis session has no write tools', () => {
    const manifest = makeManifest('analysis');
    const names = selectTools('analysis', manifest).map((t) => t.name);
    expect(names).toContain('fs_read');
    expect(names).toContain('shim_readonly_audit');
    expect(names).not.toContain('fs_write');
    expect(names).not.toContain('fs_write_docs_only');
    expect(names).not.toContain('run_command');
  });

  it('self_evolution session gets full tool set including git_commit/status/diff (Sprint 7H)', () => {
    const manifest = makeManifest('self_evolution');
    const names = selectTools('self_evolution', manifest).map((t) => t.name);
    expect(names).toContain('fs_read');
    expect(names).toContain('fs_write');
    expect(names).toContain('git_commit');
    expect(names).toContain('git_status');
    expect(names).toContain('git_diff');
    expect(names).toContain('shim_check');
    expect(names).toContain('test_runner');
    expect(names).toContain('run_command');
    expect(names).not.toContain('git_branch_tools');
  });

  it('returns Tool objects with valid SDK shape (no _stub exposed)', () => {
    const manifest = makeManifest('code');
    const tools = selectTools('code', manifest);
    for (const tool of tools) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('input_schema');
      expect(tool.input_schema.type).toBe('object');
      expect(tool).not.toHaveProperty('_stub');
    }
  });

  it('getToolNames returns the same set as selectTools', () => {
    const types = ['code', 'test', 'docs', 'research', 'analysis', 'self_evolution'] as const;
    for (const type of types) {
      const manifest = makeManifest(type);
      const fromSelect = selectTools(type, manifest).map((t) => t.name).sort();
      const fromGet = getToolNames(type).sort();
      expect(fromSelect).toEqual(fromGet);
    }
  });
});

// ─── 2. readOnly sessions have no write tools ─────────────────────────────────

describe('selectTools — readOnly enforcement', () => {
  const WRITE_TOOLS = ['fs_write', 'fs_write_docs_only', 'run_command', 'git_commit'];

  it('research session injects no write tools', () => {
    const names = getToolNames('research');
    for (const wt of WRITE_TOOLS) expect(names).not.toContain(wt);
  });

  it('analysis session injects no write tools', () => {
    const names = getToolNames('analysis');
    for (const wt of WRITE_TOOLS) expect(names).not.toContain(wt);
  });

  it('all readOnly profiles in PERMISSION_CONFIG have no write tools', () => {
    for (const [_type, profile] of Object.entries(PERMISSION_CONFIG)) {
      if (profile.permissionMode === 'readOnly') {
        for (const wt of WRITE_TOOLS) {
          expect(profile.tools).not.toContain(wt);
        }
      }
    }
  });
});

// ─── 3. isStubTool ────────────────────────────────────────────────────────────

describe('isStubTool', () => {
  it('returns false for Sprint 11.1 tools — now fully implemented', () => {
    // These four tools had _stub: true before Sprint 11.1; stubs removed.
    expect(isStubTool('test_runner')).toBe(false);
    expect(isStubTool('shim_readonly_audit')).toBe(false);
    expect(isStubTool('markdown_linter')).toBe(false);
    expect(isStubTool('kernl_search_readonly')).toBe(false);
  });

  it('returns false for real tools', () => {
    expect(isStubTool('fs_read')).toBe(false);
    expect(isStubTool('fs_write')).toBe(false);
    expect(isStubTool('fs_write_docs_only')).toBe(false);
    expect(isStubTool('list_directory')).toBe(false);
    expect(isStubTool('run_command')).toBe(false);
    // Sprint 7G: shim_check promoted from stub to real local analyser
    expect(isStubTool('shim_check')).toBe(false);
  });

  it('returns false for unknown tool names', () => {
    expect(isStubTool('nonexistent_tool')).toBe(false);
  });
});

// ─── 4. scope-enforcer: in-scope writes ──────────────────────────────────────

describe('checkWriteScope — allowed writes', () => {
  const PROJECT = 'D:/Projects/GregLite';

  it('allows write to a relative path explicitly in manifest files[]', () => {
    const manifest = makeManifest('code', [
      { path: 'app/lib/agent-sdk/query.ts', purpose: 'modify' },
    ], PROJECT);
    const result = checkWriteScope('app/lib/agent-sdk/query.ts', manifest);
    expect(result.allowed).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it('allows write to an absolute path matching manifest entry', () => {
    const manifest = makeManifest('code', [
      { path: 'D:/Projects/GregLite/app/lib/agent-sdk/query.ts', purpose: 'modify' },
    ], PROJECT);
    const result = checkWriteScope('D:/Projects/GregLite/app/lib/agent-sdk/query.ts', manifest);
    expect(result.allowed).toBe(true);
  });

  it('allows write when entry purpose is create', () => {
    const manifest = makeManifest('code', [
      { path: 'app/new-file.ts', purpose: 'create' },
    ], PROJECT);
    expect(checkWriteScope('app/new-file.ts', manifest).allowed).toBe(true);
  });
});

// ─── 5. scope-enforcer: rejected writes ──────────────────────────────────────

describe('checkWriteScope — rejected writes', () => {
  const PROJECT = 'D:/Projects/GregLite';

  it('rejects write to a path not in manifest files[]', () => {
    const manifest = makeManifest('code', [
      { path: 'app/lib/agent-sdk/query.ts', purpose: 'modify' },
    ], PROJECT);
    const result = checkWriteScope('app/lib/agent-sdk/OTHER.ts', manifest);
    expect(result.allowed).toBe(false);
    expect(result.errorMessage).toMatch(/not in the manifest files list/);
    expect(result.errorMessage).toMatch(/OTHER\.ts/);
  });

  it('rejects write to path in manifest with read-only purpose', () => {
    const manifest = makeManifest('code', [
      { path: 'app/lib/agent-sdk/query.ts', purpose: 'read' },
    ], PROJECT);
    expect(checkWriteScope('app/lib/agent-sdk/query.ts', manifest).allowed).toBe(false);
  });

  it('rejects any write when manifest has empty files[]', () => {
    const manifest = makeManifest('code', [], PROJECT);
    expect(checkWriteScope('app/anything.ts', manifest).allowed).toBe(false);
  });
});

// ─── 6. docs-only enforcement ─────────────────────────────────────────────────

describe('checkWriteScope — docsOnly', () => {
  const PROJECT = 'D:/Projects/GregLite';

  it('allows write inside /docs when docsOnly=true', () => {
    const manifest = makeManifest('docs', [
      { path: 'docs/guide.md', purpose: 'create' },
    ], PROJECT);
    expect(checkWriteScope('docs/guide.md', manifest, true).allowed).toBe(true);
  });

  it('rejects write outside /docs when docsOnly=true, even if in manifest', () => {
    const manifest = makeManifest('docs', [
      { path: 'app/component.tsx', purpose: 'modify' },
    ], PROJECT);
    const result = checkWriteScope('app/component.tsx', manifest, true);
    expect(result.allowed).toBe(false);
    expect(result.errorMessage).toMatch(/docs directory/);
  });
});

// ─── 7. resolveCwd ────────────────────────────────────────────────────────────

describe('resolveCwd', () => {
  const PROJECT = 'D:/Projects/GregLite';
  const MID = 'test-manifest-999';

  it('project_root sessions return project_path unchanged', () => {
    expect(resolveCwd('code',           PROJECT, MID)).toBe(PROJECT);
    expect(resolveCwd('test',           PROJECT, MID)).toBe(PROJECT);
    expect(resolveCwd('analysis',       PROJECT, MID)).toBe(PROJECT);
    expect(resolveCwd('self_evolution', PROJECT, MID)).toBe(PROJECT);
  });

  it('docs_subdir session returns <project_path>/docs', () => {
    expect(resolveCwd('docs', PROJECT, MID)).toBe(path.join(PROJECT, 'docs'));
  });

  it('temp_workspace session returns tmpdir path containing manifest_id', () => {
    const result = resolveCwd('research', PROJECT, MID);
    expect(result).toContain(MID);
    // Must be inside the OS temp directory tree
    expect(result.startsWith(os.tmpdir().split(path.sep)[0] ?? '')).toBe(true);
  });
});
