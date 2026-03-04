/**
 * Transit Map Learning Engine — Verbosity Pattern Detector
 * Sprint 11.7 | TRANSIT_MAP_SPEC.md §6.2
 *
 * Analyzes quality.interruption events.
 * Pattern: "Responses in the N-token range get interrupted >50% of the time."
 * Minimum: 10 interruption events (§6.3).
 */

import { nanoid } from 'nanoid';
import type { EventMetadata } from '../types';
import type { LearningInsight } from './types';
import { calculateConfidence } from './insights';

const MIN_SAMPLE = 10;
const INTERRUPTION_THRESHOLD = 0.5; // >50% of total interruptions in one bucket

interface TokenBucketDef {
  label: string;
  min: number;
  max: number;
}

const TOKEN_BUCKETS: TokenBucketDef[] = [
  { label: '0–500',  min: 0,    max: 500      },
  { label: '500–1k', min: 500,  max: 1000     },
  { label: '1k–2k',  min: 1000, max: 2000     },
  { label: '2k+',    min: 2000, max: Infinity },
];

/**
 * Detects verbosity patterns from quality.interruption events.
 *
 * @param interruptionEvents  quality.interruption events (pending, learnable)
 * @param _allFlowEvents      flow.message events — reserved for future topic context
 */
export function detectVerbosityPatterns(
  interruptionEvents: EventMetadata[],
  _allFlowEvents: EventMetadata[],
): LearningInsight[] {
  if (interruptionEvents.length < MIN_SAMPLE) return [];

  // Accumulate token counts per bucket
  const bucketCounts = TOKEN_BUCKETS.map(() => ({ total: 0, tokens: [] as number[] }));
  let usableEvents = 0;

  for (const event of interruptionEvents) {
    const payload = event.payload;
    const tokensGenerated =
      typeof payload['tokens_generated_before_stop'] === 'number'
        ? payload['tokens_generated_before_stop']
        : typeof payload['estimated_total_tokens'] === 'number'
          ? payload['estimated_total_tokens']
          : null;

    if (tokensGenerated === null) continue;
    usableEvents += 1;

    const idx = TOKEN_BUCKETS.findIndex(
      (b) => tokensGenerated >= b.min && tokensGenerated < b.max,
    );
    if (idx >= 0) {
      bucketCounts[idx]!.total += 1;
      bucketCounts[idx]!.tokens.push(tokensGenerated);
    }
  }

  if (usableEvents < MIN_SAMPLE) return [];

  const insights: LearningInsight[] = [];
  const now = Date.now();

  TOKEN_BUCKETS.forEach((bucketDef, idx) => {
    const bucket = bucketCounts[idx]!;
    if (bucket.total < 5) return; // Need at least 5 events in bucket

    const rate = bucket.total / usableEvents;
    if (rate <= INTERRUPTION_THRESHOLD) return;

    // Proposed max_tokens = 90% of median interruption point
    const sorted = [...bucket.tokens].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? bucketDef.min;
    const proposedMaxTokens = Math.max(256, Math.round(median * 0.9));

    const confidence = calculateConfidence(bucket.total, interruptionEvents);

    insights.push({
      id: nanoid(),
      pattern_type: 'verbosity',
      title: `High interruption rate in ${bucketDef.label} token range`,
      description:
        `${bucket.total} of ${usableEvents} interruptions ` +
        `(${Math.round(rate * 100)}%) occurred in the ${bucketDef.label} token range. ` +
        `Median interruption point: ${median} tokens. ` +
        `Reducing max_tokens to ${proposedMaxTokens} may improve response acceptance.`,
      confidence,
      sample_size: bucket.total,
      status: 'proposed',
      adjustment: {
        type: 'max_tokens',
        target: `token_range:${bucketDef.label}`,
        current_value: bucketDef.max === Infinity ? 4096 : bucketDef.max,
        proposed_value: proposedMaxTokens,
      },
      before_state: JSON.stringify({
        max_tokens: bucketDef.max === Infinity ? 4096 : bucketDef.max,
      }),
      after_state: null,
      created_at: now,
      applied_at: null,
      expires_at: now + 90 * 24 * 60 * 60 * 1000,
    });
  });

  return insights;
}
