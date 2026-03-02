/**
 * Event Mapper — Phase 7A
 *
 * Maps raw Anthropic SDK streaming events to the JobStatus state machine
 * per BLUEPRINT §4.3.2.
 *
 * State machine:
 *   SPAWNING → RUNNING → WORKING → VALIDATING → COMPLETED / FAILED / INTERRUPTED / BLOCKED
 *
 * This module is pure logic — no side effects, no DB writes.
 * query.ts owns the checkpoint writes.
 */

import type { AgentEvent, JobStatus } from './types';
import type Anthropic from '@anthropic-ai/sdk';

// ─── SDK event shapes we care about ──────────────────────────────────────────

type SDKStreamEvent = Anthropic.MessageStreamEvent;

// ─── State transition table per §4.3.2 ───────────────────────────────────────

/**
 * Determine the next JobStatus given the current status and an AgentEvent.
 *
 * Transitions are additive — state only moves forward or to terminal states.
 * INTERRUPTED and FAILED are terminal; BLOCKED is recoverable.
 */
export function mapEventToStatus(
  current: JobStatus,
  event: AgentEvent
): JobStatus {
  // Terminal states do not transition further
  if (current === 'completed' || current === 'failed' || current === 'interrupted') {
    return current;
  }

  switch (event.type) {
    case 'session_spawned':
      return 'spawning';

    case 'text_delta':
      // First text delta → RUNNING (only advance from SPAWNING)
      if (current === 'spawning') return 'running';
      return current;

    case 'tool_call':
      // tool_call → WORKING regardless of prior state (RUNNING or WORKING)
      return 'working';

    case 'tool_result':
      // tool_result → stay WORKING; steps_completed incremented by caller
      return 'working';

    case 'shim_validation':
      return 'validating';

    case 'error_recoverable':
      return 'blocked';

    case 'error_terminal':
      return 'failed';

    case 'session_final':
      return 'completed';

    case 'session_killed':
      return 'failed';

    case 'session_interrupted':
      return 'interrupted';

    default:
      return current;
  }
}

// ─── SDK stream event → AgentEvent ───────────────────────────────────────────

/**
 * Convert a raw Anthropic SDK stream event to our typed AgentEvent.
 * Returns null for event types we don't need to process.
 */
export function sdkEventToAgentEvent(
  sdkEvent: SDKStreamEvent,
  context: {
    isFirstTextDelta: boolean;
    currentToolUseId?: string;
    currentToolName?: string;
    accumulatedInput?: string;
  }
): AgentEvent | null {
  switch (sdkEvent.type) {
    case 'content_block_start': {
      const block = sdkEvent.content_block;
      if (block.type === 'tool_use') {
        // tool_call event — input is accumulated across input_json_delta events
        return {
          type: 'tool_call',
          toolName: block.name,
          toolUseId: block.id,
          inputSummary: '', // filled in when content_block_stop arrives
        };
      }
      return null;
    }

    case 'content_block_delta': {
      const delta = sdkEvent.delta;
      if (delta.type === 'text_delta' && delta.text.length > 0) {
        return { type: 'text_delta', text: delta.text };
      }
      return null;
    }

    case 'content_block_stop': {
      // Signals completion of a tool_use block input accumulation
      if (context.currentToolUseId && context.currentToolName) {
        return {
          type: 'tool_call',
          toolName: context.currentToolName,
          toolUseId: context.currentToolUseId,
          inputSummary: summariseInput(context.accumulatedInput ?? ''),
        };
      }
      return null;
    }

    case 'message_stop':
      // Final event — handled by finalMessage() in query.ts
      return null;

    default:
      return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Produce a short summary of tool input JSON for logging. Max 120 chars. */
function summariseInput(input: string): string {
  if (!input) return '{}';
  const trimmed = input.replace(/\s+/g, ' ').trim();
  return trimmed.length > 120 ? trimmed.slice(0, 117) + '...' : trimmed;
}
