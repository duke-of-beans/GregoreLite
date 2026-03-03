/**
 * tool-injector.ts — Tool Injection Layer — Phase 7B
 *
 * Builds the concrete Anthropic SDK Tool array for a given session type.
 * Every entry in PERMISSION_CONFIG.tools must have a matching definition here.
 * Stub tools return a NOT_IMPLEMENTED error until 7G/7H implement them.
 *
 * BLUEPRINT §4.3.3
 */

import type { Tool } from '@anthropic-ai/sdk/resources';
import type { TaskType } from './types';
import type { TaskManifest } from './types';
import { PERMISSION_CONFIG } from './permission-config';
import { SHIM_CHECK_TOOL_DEFINITION } from './shim-tool-definition';

// ─── Stub sentinel ────────────────────────────────────────────────────────────

export const STUB_NOT_IMPLEMENTED = 'NOT_IMPLEMENTED';

// ─── Full tool registry ───────────────────────────────────────────────────────

/**
 * Registry of all known tool definitions.
 * Key = tool name used in PERMISSION_CONFIG.
 * Stub tools are annotated so callers can detect them via isStubTool().
 */
const TOOL_DEFINITIONS: Record<string, Tool & { _stub?: true }> = {

  // ── Filesystem: real tools ─────────────────────────────────────────────────

  fs_read: {
    name: 'fs_read',
    description:
      'Read the contents of a file. Returns the file content as a UTF-8 string.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute or project-relative file path.' },
      },
      required: ['path'],
    },
  },

  list_directory: {
    name: 'list_directory',
    description:
      'List files and directories at a path. Returns a JSON array of absolute paths.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path:      { type: 'string',  description: 'Directory path to list.' },
        recursive: { type: 'boolean', description: 'Recurse into subdirectories.' },
      },
      required: ['path'],
    },
  },

  fs_write: {
    name: 'fs_write',
    description:
      'Write content to a file. Path must be in the manifest files[] list. ' +
      'Creates parent directories if needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path:    { type: 'string', description: 'Absolute or project-relative file path.' },
        content: { type: 'string', description: 'Full file content to write.' },
      },
      required: ['path', 'content'],
    },
  },

  fs_write_docs_only: {
    name: 'fs_write_docs_only',
    description:
      'Write content to a file inside the /docs subdirectory only. ' +
      'Writes to any other path are rejected.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path:    { type: 'string', description: 'Path inside the /docs subdirectory.' },
        content: { type: 'string', description: 'Full file content to write.' },
      },
      required: ['path', 'content'],
    },
  },

  run_command: {
    name: 'run_command',
    description:
      'Run a shell command in the project directory. Returns stdout + stderr combined.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Shell command to execute.' },
        cwd:     { type: 'string', description: 'Working directory override (defaults to project_path).' },
      },
      required: ['command'],
    },
  },

  // ── Stub tools (7G/7H) ─────────────────────────────────────────────────────

  test_runner: {
    _stub: true,
    name: 'test_runner',
    description:
      'Run the project test suite and return a structured result. ' +
      '(NOT IMPLEMENTED — available in Sprint 7G)',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', description: 'Optional test name filter pattern.' },
      },
      required: [],
    },
  },

  // Sprint 7G: real implementation — local tsc + ESLint + LOC analyser
  shim_check: SHIM_CHECK_TOOL_DEFINITION,

  shim_readonly_audit: {
    _stub: true,
    name: 'shim_readonly_audit',
    description:
      'Run a read-only SHIM audit — no modifications applied. Returns score + issues. ' +
      '(NOT IMPLEMENTED — available in Sprint 7G)',
    input_schema: {
      type: 'object' as const,
      properties: {
        target: { type: 'string', description: 'File or directory to audit.' },
      },
      required: ['target'],
    },
  },

  markdown_linter: {
    _stub: true,
    name: 'markdown_linter',
    description:
      'Lint markdown files for formatting issues and return a list of violations. ' +
      '(NOT IMPLEMENTED — available in Sprint 7G)',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Markdown file or directory to lint.' },
      },
      required: ['path'],
    },
  },

  kernl_search_readonly: {
    _stub: true,
    name: 'kernl_search_readonly',
    description:
      'Search the KERNL knowledge base (read-only). Returns matching context snippets. ' +
      '(NOT IMPLEMENTED — available in Sprint 7G)',
    input_schema: {
      type: 'object' as const,
      properties: {
        query:      { type: 'string', description: 'Search query.' },
        max_results: { type: 'number', description: 'Maximum number of results to return.' },
      },
      required: ['query'],
    },
  },

  // Sprint 7H: real git tools (local operations only — no GitHub API from agent side)
  git_commit: {
    name: 'git_commit',
    description:
      'Stage specific files and create a git commit in the project repository. ' +
      'Only files within the manifest files[] scope may be staged. ' +
      'Returns the commit hash on success.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'Commit message. Should be concise and describe what changed.',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths to stage. Must be within manifest scope.',
        },
      },
      required: ['message', 'files'],
    },
  },

  git_status: {
    name: 'git_status',
    description:
      'Show the working tree status (modified, staged, untracked files). ' +
      'Returns short-format git status output.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },

  git_diff: {
    name: 'git_diff',
    description:
      'Show file diffs. Returns staged diff (--cached) first, then unstaged diff. ' +
      'Optionally scope to a specific file path.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Optional: limit diff to this file path.',
        },
      },
      required: [],
    },
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * selectTools — returns the Anthropic SDK Tool array for a session type.
 *
 * @param sessionType   The TaskType from the manifest.
 * @param _manifest     Reserved for future per-manifest tool customisation.
 * @returns             Array of Tool objects ready for the SDK messages.stream() call.
 * @throws              If a configured tool name has no definition (programming error).
 */
export function selectTools(sessionType: TaskType, _manifest: TaskManifest): Tool[] {
  const profile = PERMISSION_CONFIG[sessionType];
  return profile.tools.map((toolName) => {
    const def = TOOL_DEFINITIONS[toolName];
    if (!def) {
      throw new Error(
        `tool-injector: no definition found for tool "${toolName}" ` +
        `(session type: "${sessionType}"). Add it to TOOL_DEFINITIONS.`
      );
    }
    // Return a clean Tool without the internal _stub flag
    const { _stub: _ignored, ...sdkTool } = def as Tool & { _stub?: true };
    return sdkTool as Tool;
  });
}

/**
 * isStubTool — returns true if a tool name is a stub (not yet implemented).
 * Used by the executor to return a descriptive NOT_IMPLEMENTED response.
 */
export function isStubTool(toolName: string): boolean {
  const def = TOOL_DEFINITIONS[toolName] as (Tool & { _stub?: true }) | undefined;
  return def?._stub === true;
}

/**
 * getToolNames — returns the tool names for a session type (for testing).
 */
export function getToolNames(sessionType: TaskType): string[] {
  return [...PERMISSION_CONFIG[sessionType].tools];
}
