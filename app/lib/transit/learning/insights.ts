/**
 * Transit Map Learning Engine — Insight Generator & Confidence Scoring
 * Sprint 11.7 | TRANSIT_MAP_SPEC.md §6.2–§6.3
 *
 * Takes raw pattern results, applies confidence scoring, deduplication,
 * and conflict detection to produce polished LearningInsights.
 */

import type { EventMetadata } from '../types';
import type { LearningInsight, PatternResult } from './types';
import { getAllInsights } from './registry';

const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;

/**
 * Confidence scoring formula (§6.3):
 *   base = min(sample_size / 20 * 100, 90) — more data = higher confidence
 *   recency_boost = +5 if >50% of events are from last 7 days
 *   consistency_boost = +5 if pattern holds across multiple conversations
 *   max = 95 — never fully confident
 */
export function calculateConfidence(
  sampleSize: number,
  events: EventMetadata[],
): number {
  if (sampleSize === 0) return 0;
  const base = Math.min((sampleSize / 20) * 100, 90);

  // Recency boost
  const now = Date.now();
  const recentCount = events.filter((e) => now - e.created_at < MS_7_DAYS).length;
  const recencyBoost = events.length > 0 && recentCount / events.length > 0.5 ? 5 : 0;

  // Consistency boost — pattern held across >1 unique conversation
  const uniqueConversations = new Set(events.map((e) => e.conversation_id)).size;
  const consistencyBoost = uniqueConversations > 1 ? 5 : 0;

  return Math.min(base + recencyBoost + consistencyBoost, 95);
}

/**
 * Generate polished insights from pattern results.
 * Applies deduplication: if a new insight targets the same adjustment as an
 * existing 'proposed' or 'applied' insight, merge rather than duplicate.
 * Applies conflict detection: flags when two insights propose opposing adjustments.
 */
export function generateInsights(patterns: PatternResult[]): LearningInsight[] {
  const allNew: LearningInsight[] = patterns.flatMap((p) => p.insights);

  // Load existing insights for deduplication
  let existingInsights: LearningInsight[] = [];
  try {
    existingInsights = getAllInsights().filter(
      (i) => i.status === 'proposed' || i.status === 'approved' || i.status === 'applied',
    );
  } catch {
    // Registry may not be populated yet — proceed without dedup
    existingInsights = [];
  }

  const merged: LearningInsight[] = [];

  for (const insight of allNew) {
    // Check for duplicate: same pattern_type + same adjustment target
    const duplicate = existingInsights.find(
      (e) =>
        e.pattern_type === insight.pattern_type &&
        e.adjustment.type === insight.adjustment.type &&
        e.adjustment.target === insight.adjustment.target,
    );

    if (duplicate) {
      // Signal merge by replacing id — storeInsight upserts on conflict
      insight.id = duplicate.id;
    }

    // Check for conflict: applied insight proposes opposing value on same target
    const conflict = existingInsights.find(
      (e) =>
        e.id !== (duplicate?.id ?? '') &&
        e.adjustment.type === insight.adjustment.type &&
        e.adjustment.target === insight.adjustment.target &&
        e.status === 'applied' &&
        e.adjustment.proposed_value !== insight.adjustment.proposed_value,
    );

    if (conflict) {
      insight.description +=
        ` ⚠️ Conflicts with applied insight "${conflict.title}" — review before applying.`;
    }

    merged.push(insight);
  }

  return merged;
}
