/**
 * Transit Map Learning Engine — Batch Processing Pipeline
 * Sprint 11.7 | TRANSIT_MAP_SPEC.md §6.1
 *
 * Processes pending learnable events in batches.
 * Groups by event_type, routes to pattern detectors, stores insights.
 * Marks processed events as learning_status = 'processed'.
 *
 * Runs:
 *   1. Manually via POST /api/transit/insights { action: 'run_pipeline' }
 *   2. On a 6-hour schedule started by startLearningScheduler()
 *
 * CRITICAL: ALL errors are caught. Learning failures NEVER crash the app.
 */

import { getDatabase } from '@/lib/kernl/database';
import { getAllEventTypes } from '@/lib/transit/registry';
import type { EventMetadata } from '@/lib/transit/types';
import type { PatternResult } from './types';
import { detectVerbosityPatterns } from './verbosity';
import { detectRegenerationPatterns } from './regeneration';
import { detectModelRoutingPatterns } from './model-routing';
import { generateInsights } from './insights';
import { storeInsight, decayExpiredInsights } from './registry';

const MIN_SAMPLE = 10;

// ── Event reading ─────────────────────────────────────────────────────────────

function getLearnableEventTypes(): string[] {
  return getAllEventTypes()
    .filter((def) => def.learnable)
    .map((def) => def.id);
}

/**
 * Read all pending learnable events.
 * Converts the ISO `timestamp` column → unix ms `created_at` for EventMetadata.
 */
function getPendingLearnableEvents(learnableTypes: string[]): EventMetadata[] {
  if (learnableTypes.length === 0) return [];
  try {
    const db = getDatabase();
    const placeholders = learnableTypes.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT
        id,
        conversation_id,
        message_id,
        event_type,
        category,
        payload,
        CAST(strftime('%s', timestamp) * 1000 AS INTEGER) AS created_at
      FROM conversation_events
      WHERE learning_status = 'pending'
        AND event_type IN (${placeholders})
    `).all(...learnableTypes) as Array<{
      id: string;
      conversation_id: string;
      message_id: string | null;
      event_type: string;
      category: string;
      payload: string;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      message_id: row.message_id,
      event_type: row.event_type,
      category: row.category as EventMetadata['category'],
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.warn('[learning/pipeline] getPendingLearnableEvents failed:', err);
    return [];
  }
}

function markEventsProcessed(ids: string[]): void {
  if (ids.length === 0) return;
  try {
    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`
      UPDATE conversation_events
      SET learning_status = 'processed'
      WHERE id IN (${placeholders})
    `).run(...ids);
  } catch (err) {
    console.warn('[learning/pipeline] markEventsProcessed failed:', err);
  }
}

// ── Detector routing ──────────────────────────────────────────────────────────

function runDetector(
  eventType: string,
  events: EventMetadata[],
  allEvents: EventMetadata[],
): PatternResult | null {
  try {
    switch (eventType) {
      case 'quality.interruption': {
        const flowEvents = allEvents.filter((e) => e.event_type === 'flow.message');
        const insights = detectVerbosityPatterns(events, flowEvents);
        return { pattern_type: 'verbosity', events_analyzed: events.length, insights };
      }
      case 'quality.regeneration': {
        const flowEvents = allEvents.filter((e) => e.event_type === 'flow.message');
        const insights = detectRegenerationPatterns(events, flowEvents);
        return { pattern_type: 'regeneration', events_analyzed: events.length, insights };
      }
      case 'system.model_route': {
        const qualityEvents = allEvents.filter((e) =>
          e.event_type === 'quality.regeneration' ||
          e.event_type === 'quality.interruption',
        );
        const flowEvents = allEvents.filter((e) => e.event_type === 'flow.message');
        const insights = detectModelRoutingPatterns(events, qualityEvents, flowEvents);
        return { pattern_type: 'model_routing', events_analyzed: events.length, insights };
      }
      default:
        return null; // No detector registered for this event type yet
    }
  } catch (err) {
    console.warn(`[learning/pipeline] detector failed for ${eventType}:`, err);
    return null;
  }
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

/**
 * Run the full learning pipeline.
 * Non-blocking. ALL errors caught — learning failures NEVER crash the app.
 *
 * @returns PatternResult[] — results for logging/UI. Empty on error or no data.
 */
export async function runLearningPipeline(): Promise<PatternResult[]> {
  const results: PatternResult[] = [];

  try {
    // 1. Decay expired insights first
    try {
      const decayed = decayExpiredInsights();
      if (decayed > 0) console.log(`[learning/pipeline] Decayed ${decayed} expired insights`);
    } catch (err) {
      console.warn('[learning/pipeline] decayExpiredInsights failed (non-fatal):', err);
    }

    // 2. Get learnable event types from registry
    const learnableTypes = getLearnableEventTypes();
    if (learnableTypes.length === 0) {
      console.log('[learning/pipeline] No learnable event types registered');
      return results;
    }

    // 3. Load all pending learnable events
    const allEvents = getPendingLearnableEvents(learnableTypes);
    if (allEvents.length === 0) {
      console.log('[learning/pipeline] No pending learnable events — nothing to process');
      return results;
    }

    console.log(`[learning/pipeline] Processing ${allEvents.length} pending events`);

    // 4. Group events by event_type
    const grouped = new Map<string, EventMetadata[]>();
    for (const event of allEvents) {
      const group = grouped.get(event.event_type) ?? [];
      group.push(event);
      grouped.set(event.event_type, group);
    }

    // 5. Route each group to its detector
    const processedIds: string[] = [];

    for (const [eventType, events] of grouped) {
      // §6.3: minimum sample size — no garbage insights from small N
      if (events.length < MIN_SAMPLE) {
        console.log(`[learning/pipeline] Skipping ${eventType}: ${events.length} events < min ${MIN_SAMPLE}`);
        continue;
      }

      const result = runDetector(eventType, events, allEvents);
      if (result) results.push(result);

      // Mark all events in group as processed regardless of insight output
      processedIds.push(...events.map((e) => e.id));
    }

    // 6. Generate and store insights (with dedup/conflict detection)
    const allInsights = generateInsights(results);
    let stored = 0;
    for (const insight of allInsights) {
      try {
        storeInsight(insight);
        stored += 1;
      } catch (err) {
        console.warn('[learning/pipeline] storeInsight failed (non-fatal):', err);
      }
    }
    if (stored > 0) console.log(`[learning/pipeline] Stored ${stored} insights`);

    // 7. Mark events as processed
    markEventsProcessed(processedIds);
    if (processedIds.length > 0) {
      console.log(`[learning/pipeline] Marked ${processedIds.length} events as processed`);
    }

  } catch (err) {
    // Top-level safety catch — pipeline errors NEVER crash the app
    console.error('[learning/pipeline] Pipeline run failed (non-fatal):', err);
  }

  return results;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let _schedulerHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the learning pipeline on a recurring schedule.
 * Safe to call multiple times — only one interval runs at a time.
 */
export function startLearningScheduler(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (_schedulerHandle !== null) return; // Already running

  console.log(`[learning/pipeline] Scheduler started (interval: ${intervalMs / 3_600_000}h)`);

  _schedulerHandle = setInterval(() => {
    runLearningPipeline().catch((err) => {
      // Double-protection: pipeline has its own catch but belt-and-suspenders
      console.warn('[learning/pipeline] Scheduled run threw unexpectedly:', err);
    });
  }, intervalMs);

  // Allow Node.js to exit even if scheduler is active
  const handle = _schedulerHandle as NodeJS.Timeout;
  if (typeof handle.unref === 'function') handle.unref();
}

/** Stop the scheduler (e.g. on app close or in tests). */
export function stopLearningScheduler(): void {
  if (_schedulerHandle !== null) {
    clearInterval(_schedulerHandle);
    _schedulerHandle = null;
    console.log('[learning/pipeline] Scheduler stopped');
  }
}
