/**
 * shim-tool-definition.ts — SHIM Check Tool Definition — Phase 7G
 *
 * Anthropic SDK Tool definition object for the shim_check in-session tool.
 * Injected for 'code' and 'self_evolution' session types via tool-injector.ts.
 *
 * The tool schema matches the brief exactly:
 *   input:  { file_path: string }
 *   output: ShimCheckResult JSON (see shim-tool.ts)
 *
 * BLUEPRINT §4.3.3, §7.6
 */

import type { Tool } from '@anthropic-ai/sdk/resources';

export const SHIM_CHECK_TOOL_DEFINITION: Tool = {
  name: 'shim_check',
  description:
    'Run SHIM quality analysis on a file you have written or modified. ' +
    'Returns a health score (0-100) and any critical issues. ' +
    'Use this after writing a file to self-correct before finishing.',
  input_schema: {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description: 'Absolute path to the file to analyze.',
      },
    },
    required: ['file_path'],
  },
};
