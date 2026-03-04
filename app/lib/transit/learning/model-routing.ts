/**
 * Transit Map Learning Engine — Model Routing Pattern Detector
 * Sprint 11.7 | TRANSIT_MAP_SPEC.md §6.2
 *
 * Cross-references system.model_route events with quality outcomes.
 * Pattern: "Haiku on [task type] → quality failure rate >2× Sonnet's."
 * Returns empty if below minimum sample size — sparse data expected initially.
 */

import { nanoid } from 'nanoid';
import type { EventMetadata } from '../types';
import type { LearningInsight } from './types';
import { calculateConfidence } from './insights';
import { classifyTaskType } from './regeneration';

const MIN_SAMPLE = 10;
const FAILURE_RATE_MULTIPLIER = 2; // Worst model must be >2× best model's rate

interface ModelStats {
  total: number;
  failures: number; // count of regen + interruption quality events
}

/**
 * Detects model routing quality issues by comparing failure rates across models
 * for the same task type.
 *
 * @param routeEvents    system.model_route events
 * @param qualityEvents  quality.regeneration + quality.interruption events
 * @param flowEvents     flow.message events (for user content lookup)
 */
export function detectModelRoutingPatterns(
  routeEvents: EventMetadata[],
  qualityEvents: EventMetadata[],
  flowEvents: EventMetadata[],
): LearningInsight[] {
  if (routeEvents.length < MIN_SAMPLE) return [];

  // message_id → selected_model
  const messageModelMap = new Map<string, string>();
  for (const event of routeEvents) {
    if (event.message_id) {
      const model = event.payload['selected_model'];
      if (typeof model === 'string') {
        messageModelMap.set(event.message_id, model);
      }
    }
  }

  // message_id → user content (for task type classification)
  const messageContentMap = new Map<string, string>();
  for (const event of flowEvents) {
    if (event.payload['role'] === 'user' && event.message_id) {
      const content = event.payload['content'];
      if (typeof content === 'string') {
        messageContentMap.set(event.message_id, content);
      }
    }
  }

  // message IDs that had quality failures
  const failureMessageIds = new Set<string>();
  for (const event of qualityEvents) {
    if (
      (event.event_type === 'quality.regeneration' ||
        event.event_type === 'quality.interruption') &&
      event.message_id
    ) {
      failureMessageIds.add(event.message_id);
    }
  }

  // Accumulate stats: `${model}::${taskType}` → ModelStats
  const stats = new Map<string, ModelStats>();

  for (const event of routeEvents) {
    if (!event.message_id) continue;
    const model = messageModelMap.get(event.message_id);
    if (!model) continue;

    const content = messageContentMap.get(event.message_id) ?? '';
    const taskType = classifyTaskType(content);
    const key = `${model}::${taskType}`;

    const existing = stats.get(key) ?? { total: 0, failures: 0 };
    existing.total += 1;
    if (failureMessageIds.has(event.message_id)) existing.failures += 1;
    stats.set(key, existing);
  }

  // Collect unique task types
  const taskTypes = new Set<string>();
  for (const key of stats.keys()) {
    const parts = key.split('::');
    if (parts[1]) taskTypes.add(parts[1]);
  }

  const insights: LearningInsight[] = [];
  const now = Date.now();

  for (const taskType of taskTypes) {
    // Per-model stats for this task type
    const modelStats: Record<string, ModelStats> = {};
    for (const [key, s] of stats) {
      const [model, kt] = key.split('::');
      if (kt === taskType && model) modelStats[model] = s;
    }

    const models = Object.keys(modelStats);
    if (models.length < 2) continue;

    const sorted = models
      .map((m) => ({
        model: m,
        rate: modelStats[m]!.total > 0 ? modelStats[m]!.failures / modelStats[m]!.total : 0,
        total: modelStats[m]!.total,
      }))
      .sort((a, b) => b.rate - a.rate);

    const worst = sorted[0]!;
    const best = sorted[sorted.length - 1]!;

    if (worst.total < 5 || best.total < 5) continue;

    // Failure rate gap must be significant
    if (best.rate === 0 || worst.rate <= best.rate * FAILURE_RATE_MULTIPLIER) continue;

    const totalSample = Object.values(modelStats).reduce((s, m) => s + m.total, 0);
    if (totalSample < MIN_SAMPLE) continue;

    const relevantEvents = routeEvents.filter((e) => {
      if (!e.message_id) return false;
      const m = messageModelMap.get(e.message_id);
      const c = messageContentMap.get(e.message_id) ?? '';
      return m !== undefined && classifyTaskType(c) === taskType;
    });

    const confidence = calculateConfidence(totalSample, relevantEvents);

    insights.push({
      id: nanoid(),
      pattern_type: 'model_routing',
      title: `${worst.model} underperforms on ${taskType} tasks`,
      description:
        `${worst.model} has a ${Math.round(worst.rate * 100)}% quality failure rate on ` +
        `${taskType} tasks vs ${best.model}'s ${Math.round(best.rate * 100)}% ` +
        `(>${FAILURE_RATE_MULTIPLIER}× threshold). ` +
        `Consider routing ${taskType} tasks to ${best.model} instead.`,
      confidence,
      sample_size: totalSample,
      status: 'proposed',
      adjustment: {
        type: 'model_route',
        target: `task_type:${taskType}`,
        current_value: worst.model,
        proposed_value: best.model,
      },
      before_state: JSON.stringify({
        model: worst.model,
        task_type: taskType,
        failure_rate: worst.rate,
      }),
      after_state: null,
      created_at: now,
      applied_at: null,
      expires_at: now + 90 * 24 * 60 * 60 * 1000,
    });
  }

  return insights;
}
