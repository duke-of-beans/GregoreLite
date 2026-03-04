/**
 * permission-config.ts — Static Permission Matrix — Phase 7B
 *
 * Declarative source of truth mapping each session type to its permission
 * envelope: which tools are injected at spawn time and what CWD policy applies.
 * No session can access tools not listed here — they simply are not injected.
 *
 * Stub tools (marked below) will be implemented in 7G (SHIM) and 7H (git).
 *
 * BLUEPRINT §4.3.3
 */

import type { TaskType } from './types';

export type PermissionMode = 'acceptEdits' | 'readOnly';

/**
 * How the session's working directory is bounded:
 *   project_root   — session CWD is manifest.context.project_path
 *   docs_subdir    — session CWD is <project_path>/docs  (write scope further
 *                    enforced by fs_write_docs_only tool)
 *   temp_workspace — session CWD is os.tmpdir()/<manifest_id> (no project writes)
 */
export type CwdPolicy = 'project_root' | 'docs_subdir' | 'temp_workspace';

export interface PermissionProfile {
  permissionMode: PermissionMode;
  /** Tool names to inject. Every name must exist in TOOL_DEFINITIONS (tool-injector.ts). */
  tools: readonly string[];
  cwdPolicy: CwdPolicy;
}

/**
 * PERMISSION_CONFIG — the canonical permission matrix from §4.3.3.
 *
 * Tool legend:
 *   fs_read              — read any file within the session CWD / manifest scope  [REAL]
 *   list_directory       — list directory contents (read-only)                    [REAL]
 *   fs_write             — write files within manifest.files[] scope              [REAL]
 *   fs_write_docs_only   — fs_write variant; additionally enforces /docs prefix   [REAL]
 *   run_command          — execute shell commands in project CWD                  [REAL]
 *   test_runner          — run test suite and capture results                     [STUB → Sprint 11.1]
 *   shim_check           — run SHIM quality analysis in edit mode                 [REAL → 7G]
 *   shim_readonly_audit  — run SHIM analysis without modifications                [STUB → Sprint 11.1]
 *   markdown_linter      — lint markdown files for formatting issues              [STUB → Sprint 11.1]
 *   kernl_search_readonly — search KERNL knowledge base (no writes)              [STUB → Sprint 11.1]
 *   git_commit           — stage files and create git commits                    [REAL → 7H]
 *   git_status           — show working tree status                              [REAL → 7H]
 *   git_diff             — show staged and unstaged diffs                        [REAL → 7H]
 */
export const PERMISSION_CONFIG: Record<TaskType, PermissionProfile> = {
  code: {
    permissionMode: 'acceptEdits',
    tools: ['fs_read', 'list_directory', 'fs_write', 'run_command', 'test_runner', 'shim_check'],
    cwdPolicy: 'project_root',
  },

  test: {
    permissionMode: 'acceptEdits',
    tools: ['fs_read', 'list_directory', 'fs_write', 'run_command', 'test_runner'],
    cwdPolicy: 'project_root',
  },

  docs: {
    permissionMode: 'acceptEdits',
    // fs_write_docs_only enforces /docs subdirectory at the tool layer
    tools: ['fs_read', 'list_directory', 'fs_write_docs_only', 'markdown_linter'],
    cwdPolicy: 'docs_subdir',
  },

  research: {
    permissionMode: 'readOnly',
    tools: ['fs_read', 'list_directory', 'kernl_search_readonly'],
    cwdPolicy: 'temp_workspace',
  },

  analysis: {
    permissionMode: 'readOnly',
    tools: ['fs_read', 'list_directory', 'shim_readonly_audit'],
    cwdPolicy: 'project_root',
  },

  self_evolution: {
    permissionMode: 'acceptEdits',
    // git_branch_tools stub replaced with 3 real tools in Sprint 7H
    tools: [
      'fs_read', 'list_directory', 'fs_write', 'run_command',
      'git_commit', 'git_status', 'git_diff', 'shim_check', 'test_runner',
    ],
    cwdPolicy: 'project_root',
  },

  // deploy: not in core permission matrix; falls back to code-level tools
  deploy: {
    permissionMode: 'acceptEdits',
    tools: ['fs_read', 'list_directory', 'run_command'],
    cwdPolicy: 'project_root',
  },
};
