/**
 * Ghost Privacy Engine — Type Definitions
 *
 * ExclusionResult — returned by checkFile(), checkEmail(), checkChunk()
 * ExclusionReason — human-readable reason string
 * ExclusionLayer  — which of the four layers triggered
 * GhostExclusion  — one row from the ghost_exclusions table (Layer 4)
 */

// ─── Core exclusion result ────────────────────────────────────────────────────

export type ExclusionLayer = 1 | 2 | 3 | 4;

export interface ExclusionResult {
  /** True if the content should be discarded and never reach the ingest pipeline */
  excluded: boolean;
  /** Which layer triggered — undefined when excluded is false */
  layer?: ExclusionLayer;
  /** Human-readable description of why this was excluded */
  reason?: string;
  /** The specific pattern or rule that triggered */
  pattern?: string;
}

export const NOT_EXCLUDED: ExclusionResult = { excluded: false };

// ─── Layer 4 DB record ───────────────────────────────────────────────────────

export type ExclusionType =
  | 'path_glob'
  | 'domain'
  | 'sender'
  | 'keyword'
  | 'subject_contains';

export interface GhostExclusion {
  id: string;
  type: ExclusionType;
  pattern: string;
  created_at: number;
  note: string | null;
}

// ─── Audit log row ────────────────────────────────────────────────────────────

export interface ExclusionLogRow {
  id: string;
  sourceType: 'file' | 'email';
  sourcePath: string;
  layer: ExclusionLayer;
  reason: string;
  pattern: string | undefined;
  loggedAt: number;
}
