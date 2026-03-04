/**
 * Transit Map Learning Engine — Regeneration Pattern Detector
 * Sprint 11.7 | TRANSIT_MAP_SPEC.md §6.2
 *
 * Analyzes quality.regeneration events.
 * Pattern: "First response on [task type] gets regenerated N% of the time."
 * Minimum: 10 regeneration events (§6.3).
 */

import { nanoid } from 'nanoid';
import type { EventMetadata } from '../types';
import type { LearningInsight } from './types';
import { calculateConfidence } from './insights';

const MIN_SAMPLE = 10;
const REGEN_THRESHOLD = 0.3; // >30% of total regenerations in one task type

export type TaskType = 'code' | 'writing' | 'explanation' | 'review' | 'debugging' | 'general';

/**
 * Simple keyword heuristic for task type classification (§6.2).
 * Intentionally rough — the learning engine improves over time.
 */
export function classifyTaskType(content: string): TaskType {
  const lower = content.toLowerCase();

  if (/\b(code|function|class|component|implement|refactor|typescript|javascript|python)\b/.test(lower)) {
    return 'code';
  }
  if (/\b(write|draft|compose|create|generate|produce)\b/.test(lower)) {
    return 'writing';
  }
  if (/\b(explain|what is|how does|why does|what are|describe|clarify)\b/.test(lower)) {
    return 'explanation';
  }
  if (/\b(review|check|audit|evaluate|assess|critique|look at)\b/.test(lower)) {
    return 'review';
  }
  if (/\b(debug|fix|error|bug|crash|broken|failing|issue)\b/.test(lower)) {
    return 'debugging';
  }
  return 'general';
}

/**
 * Detects regeneration rate patterns grouped by task type.
 *
 * @param regenEvents    quality.regeneration events (pending, learnable)
 * @param allFlowEvents  flow.message events — used for user message content lookup
 */
export function detectRegenerationPatterns(
  regenEvents: EventMetadata[],
  allFlowEvents: EventMetadata[],
): LearningInsight[] {
  if (regenEvents.length < MIN_SAMPLE) return [];

  // Build message_id → user message content map from flow events
  const messageContentMap = new Map<string, string>();
  for (const event of allFlowEvents) {
    if (event.payload['role'] === 'user' && event.message_id) {
      const content = event.payload['content'];
      if (typeof content === 'string') {
        messageContentMap.set(event.message_id, content);
      }
    }
  }

  // Count regenerations per task type
  const regenCounts = new Map<TaskType, number>();
  const taskTypeEvents = new Map<TaskType, EventMetadata[]>();

  for (const event of regenEvents) {
    // Try to resolve user message content via original_message_id or topic hint
    let userContent = '';
    const originalMessageId = event.payload['original_message_id'] as string | undefined;
    if (originalMessageId) {
      userContent = messageContentMap.get(originalMessageId) ?? '';
    }
    if (!userContent && event.payload['topic']) {
      userContent = String(event.payload['topic']);
    }

    const taskType = classifyTaskType(userContent);
    regenCounts.set(taskType, (regenCounts.get(taskType) ?? 0) + 1);

    const bucket = taskTypeEvents.get(taskType) ?? [];
    bucket.push(event);
    taskTypeEvents.set(taskType, bucket);
  }

  const totalRegens = regenEvents.length;
  const insights: LearningInsight[] = [];
  const now = Date.now();

  for (const [taskType, count] of regenCounts) {
    if (count < 5) continue; // Need at least 5 per task type

    const rate = count / totalRegens;
    if (rate <= REGEN_THRESHOLD) continue;

    const events = taskTypeEvents.get(taskType) ?? [];
    const confidence = calculateConfidence(count, events);

    insights.push({
      id: nanoid(),
      pattern_type: 'regeneration',
      title: `High regeneration rate on ${taskType} tasks`,
      description:
        `${count} of ${totalRegens} regenerations (${Math.round(rate * 100)}%) ` +
        `occurred on ${taskType} tasks. ` +
        `This suggests first responses for ${taskType} tasks may not meet expectations. ` +
        `Consider reviewing system prompt instructions for ${taskType} task handling.`,
      confidence,
      sample_size: count,
      status: 'proposed',
      adjustment: {
        type: 'system_prompt',
        target: `task_type:${taskType}`,
        current_value: `Default ${taskType} task handling`,
        proposed_value: `Enhanced ${taskType} task instructions (manual review required)`,
      },
      before_state: JSON.stringify({ task_type: taskType, regen_rate: rate }),
      after_state: null,
      created_at: now,
      applied_at: null,
      expires_at: now + 90 * 24 * 60 * 60 * 1000,
    });
  }

  return insights;
}
