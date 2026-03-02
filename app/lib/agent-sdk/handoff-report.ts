/**
 * handoff-report.ts — Phase 7C
 *
 * Builds a handoff context string appended to a new session's system prompt
 * when spawnRestart() is called. Lets the replacement session pick up context
 * without duplicating work already done.
 *
 * Template (per BLUEPRINT §4.3.4):
 *   "PRIOR EXECUTION CONTEXT:
 *   - This task was previously attempted. It did not complete.
 *   - The following files were written and exist on disk: {files_written}
 *   - The session was stopped because: {failure_reason}
 *   - Steps completed before failure: {steps_completed}
 *   - Last successful tool call: {last_tool_call}
 *   - Please inspect existing files before proceeding. Do not duplicate work already done."
 *
 * Data source: job_state table row for the original manifestId.
 * Max combined prompt length with buildSystemPrompt() is bounded at ~2K chars
 * (handoff report alone is ~400 chars with realistic job_state data).
 */

import { readJobState } from './query';

// ─── buildHandoffReport ───────────────────────────────────────────────────────

/**
 * buildHandoffReport — produce a handoff context string for a restarted session.
 *
 * Reads the job_state row for the original manifestId and interpolates the
 * template. Returns a safe fallback string if no state exists.
 */
export function buildHandoffReport(manifestId: string): string {
  const state = readJobState(manifestId);

  if (!state) {
    return [
      'PRIOR EXECUTION CONTEXT:',
      '- This task was previously attempted. It did not complete.',
      '- No prior execution state was recorded.',
      '- Please proceed carefully and inspect the project directory before starting.',
    ].join('\n');
  }

  const filesWritten   = parseFilesModified(state.files_modified);
  const failureReason  = parseFailureReason(state.last_event);
  const lastToolCall   = parseLastToolCall(state.last_event);
  const stepsCompleted = state.steps_completed ?? 0;

  return [
    'PRIOR EXECUTION CONTEXT:',
    '- This task was previously attempted. It did not complete.',
    `- The following files were written and exist on disk: ${filesWritten}`,
    `- The session was stopped because: ${failureReason}`,
    `- Steps completed before failure: ${stepsCompleted}`,
    `- Last successful tool call: ${lastToolCall}`,
    '- Please inspect existing files before proceeding. Do not duplicate work already done.',
  ].join('\n');
}

// ─── Parse helpers ────────────────────────────────────────────────────────────

function parseFilesModified(raw: string | null | undefined): string {
  try {
    const parsed = JSON.parse(raw ?? '[]') as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as string[]).join(', ');
    }
  } catch {
    // fallthrough
  }
  return 'none';
}

function parseFailureReason(raw: string | null | undefined): string {
  try {
    const event = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    return String(event['message'] ?? event['type'] ?? 'unknown');
  } catch {
    return 'unknown';
  }
}

function parseLastToolCall(raw: string | null | undefined): string {
  try {
    const event = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    if (event['type'] === 'tool_result') return String(event['toolName'] ?? 'unknown tool');
    if (event['type'] === 'checkpoint') return `checkpoint at step ${String(event['stepsCompleted'] ?? '?')}`;
    return String(event['type'] ?? 'unknown');
  } catch {
    return 'unknown';
  }
}
