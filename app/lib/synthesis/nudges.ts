/**
 * lib/synthesis/nudges.ts — Sprint 28.0 Ceremonial Onboarding
 *
 * Re-engagement nudges for users who completed onboarding with sources skipped.
 *
 * Rules (non-negotiable):
 * - Maximum 1 source nudge per week
 * - Dismissed twice for the same source → permanently silenced, never again
 * - Never guilt-trip. "Your call. I just wanted you to know what's possible."
 * - Voice: helpful, specific about what's gained, deadpan professional.
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '@/lib/kernl/database';
import { getCapabilityTeaser } from './generator';
import type {
  IndexingSource,
  IndexingSourceType,
  SynthesisNudge,
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DISMISSALS_BEFORE_SILENCE = 2;

// ── DB row → domain type ──────────────────────────────────────────────────────

type NudgeRow = {
  id: string;
  source_type: string;
  source_label: string;
  capability_teaser: string;
  sent_at: number;
  dismissed_count: number;
  last_dismissed_at: number | null;
  permanently_silenced: number;
};

function rowToNudge(row: NudgeRow): SynthesisNudge {
  return {
    id: row.id,
    source_type: row.source_type as IndexingSourceType,
    source_label: row.source_label,
    capability_teaser: row.capability_teaser,
    sent_at: row.sent_at,
    dismissed_count: row.dismissed_count,
    last_dismissed_at: row.last_dismissed_at,
    permanently_silenced: row.permanently_silenced === 1,
  };
}

// ── Core nudge logic ──────────────────────────────────────────────────────────

/**
 * Determine which skipped sources are eligible for a nudge right now.
 *
 * Eligibility:
 * 1. Source must be skipped (not already indexed)
 * 2. Not permanently silenced
 * 3. Last nudge for this source was > 1 week ago (or never sent)
 * 4. Only 1 nudge total may be surfaced per call (caller picks first eligible)
 */
export function getEligibleNudge(
  skippedSources: IndexingSource[],
  existingTypes: IndexingSourceType[],
): SynthesisNudge | null {
  const db = getDatabase();
  const now = Date.now();

  for (const source of skippedSources) {
    // Check if we already have a nudge record for this source type
    const existing = db.prepare<[string], NudgeRow>(`
      SELECT * FROM synthesis_nudges
      WHERE source_type = ?
      ORDER BY sent_at DESC
      LIMIT 1
    `).get(source.type) as NudgeRow | undefined;

    if (existing) {
      const nudge = rowToNudge(existing);

      // Permanently silenced → skip
      if (nudge.permanently_silenced) continue;

      // Too recent → skip
      if (nudge.sent_at > now - ONE_WEEK_MS) continue;
    }

    // Eligible — create and return this nudge
    const teaser = getCapabilityTeaser(source.type, existingTypes);
    const nudgeId = randomUUID();

    db.prepare(`
      INSERT INTO synthesis_nudges
        (id, source_type, source_label, capability_teaser, sent_at,
         dismissed_count, permanently_silenced)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `).run(nudgeId, source.type, source.label, teaser, now);

    return {
      id: nudgeId,
      source_type: source.type,
      source_label: source.label,
      capability_teaser: teaser,
      sent_at: now,
      dismissed_count: 0,
      last_dismissed_at: null,
      permanently_silenced: false,
    };
  }

  return null;
}

/**
 * Record that the user dismissed a nudge.
 * If dismissed_count reaches MAX_DISMISSALS_BEFORE_SILENCE,
 * the source is permanently silenced.
 */
export function dismissNudge(nudgeId: string): {
  permanentlySilenced: boolean;
  dismissCount: number;
} {
  const db = getDatabase();

  const row = db.prepare<[string], NudgeRow>(
    `SELECT * FROM synthesis_nudges WHERE id = ?`,
  ).get(nudgeId) as NudgeRow | undefined;

  if (!row) return { permanentlySilenced: false, dismissCount: 0 };

  const newCount = row.dismissed_count + 1;
  const silenced = newCount >= MAX_DISMISSALS_BEFORE_SILENCE;

  db.prepare(`
    UPDATE synthesis_nudges
    SET dismissed_count      = ?,
        last_dismissed_at    = ?,
        permanently_silenced = ?
    WHERE id = ?
  `).run(newCount, Date.now(), silenced ? 1 : 0, nudgeId);

  // Also silence all future nudges for this source type if threshold reached
  if (silenced) {
    db.prepare(`
      UPDATE synthesis_nudges
      SET permanently_silenced = 1
      WHERE source_type = ?
    `).run(row.source_type);
  }

  return { permanentlySilenced: silenced, dismissCount: newCount };
}

/**
 * Build a contextual nudge message for a specific moment.
 * E.g. user mentions a meeting → calendar nudge.
 * Returns null if the source is already indexed or silenced.
 */
export function buildContextualNudge(
  sourceType: IndexingSourceType,
  triggerContext: string,
): string | null {
  const db = getDatabase();

  // Check if source is already indexed
  const indexed = db.prepare<[string], { count: number }>(`
    SELECT COUNT(*) AS count
    FROM indexing_sources
    WHERE type = ? AND status = 'complete'
  `).get(sourceType) as { count: number } | undefined;

  if ((indexed?.count ?? 0) > 0) return null;

  // Check if permanently silenced
  const silenced = db.prepare<[string], { count: number }>(`
    SELECT COUNT(*) AS count
    FROM synthesis_nudges
    WHERE source_type = ? AND permanently_silenced = 1
  `).get(sourceType) as { count: number } | undefined;

  if ((silenced?.count ?? 0) > 0) return null;

  // Build contextual message
  const contextualMessages: Record<string, string> = {
    calendar: `If your calendar were connected, I'd already know about that. ${triggerContext}`,
    email:    `If your email were connected, I could pull context from related threads. ${triggerContext}`,
    projects: `If your projects were registered, I could cross-reference this against your active work.`,
    notes:    `If your notes were connected, I could surface relevant material you've written on this.`,
  };

  return contextualMessages[sourceType] ?? null;
}

/**
 * Get all nudge records — used by diagnostics/Inspector.
 */
export function getAllNudges(): SynthesisNudge[] {
  const db = getDatabase();
  const rows = db.prepare<[], NudgeRow>(
    `SELECT * FROM synthesis_nudges ORDER BY sent_at DESC`,
  ).all() as NudgeRow[];
  return rows.map(rowToNudge);
}

/**
 * Check how many days since GregLite was first used (proxy: earliest DB row).
 * Used by the "after 3 days of active use" nudge trigger.
 */
export function daysSinceFirstUse(): number {
  const db = getDatabase();
  const row = db.prepare<[], { earliest: number | null }>(`
    SELECT MIN(created_at) AS earliest FROM indexing_sources
  `).get() as { earliest: number | null } | undefined;

  if (!row?.earliest) return 0;
  return Math.floor((Date.now() - row.earliest) / (24 * 60 * 60 * 1000));
}
