/**
 * Capture Types — Sprint 29.0
 *
 * Quick Capture Pad: data model for capture_notes table and related types.
 * Mirrors the SQLite schema in database.ts (Sprint 29 migration block).
 */

// ── Classification ────────────────────────────────────────────────────────────

export type CaptureClassification = 'bug' | 'feature' | 'question' | 'idea';

// ── Status ────────────────────────────────────────────────────────────────────

export type CaptureStatus = 'inbox' | 'backlogged' | 'dismissed';

// ── CaptureNote — mirrors capture_notes SQLite row ────────────────────────────

export interface CaptureNote {
  /** UUID — primary key */
  id: string;
  /** FK to portfolio_projects.id — NULL if unrouted */
  project_id: string | null;
  /** Exactly what the user typed */
  raw_text: string;
  /** Project name extracted from prefix, e.g. "CadBrix: …" → "CadBrix" */
  parsed_project: string | null;
  /** Note content after stripping project prefix */
  parsed_body: string;
  /** Keyword-heuristic classification */
  classification: CaptureClassification;
  /** Incremented on semantic duplicate detection */
  mention_count: number;
  /** ID of the primary note this was merged into (NULL if primary) */
  merged_with: string | null;
  /** Inbox / backlogged / dismissed */
  status: CaptureStatus;
  /** Once promoted, reference the backlog item (e.g. line number or marker) */
  backlog_item_id: string | null;
  /** Unix ms — creation timestamp */
  created_at: number;
  /** Unix ms — updated on each new mention/merge */
  last_mentioned_at: number;
}

// ── API response types ────────────────────────────────────────────────────────

export interface CaptureCreateResult {
  note: CaptureNote;
  wasDuplicate: boolean;
  mergedWith?: string;
}

export interface CaptureInboxItem extends CaptureNote {
  /** Resolved project name (denormalized for display) */
  project_name: string | null;
}

export interface CaptureStats {
  /** Per-project note counts (project_id → count) */
  perProject: Record<string, number>;
  /** Unrouted (no project) count */
  unrouted: number;
  /** Notes with mention_count >= 3 */
  highMention: CaptureNote[];
  /** Classification breakdown */
  byClassification: Record<CaptureClassification, number>;
}
