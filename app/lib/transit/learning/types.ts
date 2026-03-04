/**
 * Transit Map Learning Engine — Type Definitions
 * Sprint 11.7 — Phase F Self-Improvement Telemetry
 * Source of truth: TRANSIT_MAP_SPEC.md §6
 */

export type InsightStatus =
  | 'proposed'
  | 'approved'
  | 'applied'
  | 'dismissed'
  | 'rolled_back'
  | 'expired';

export interface InsightAdjustment {
  /** What kind of value is being adjusted */
  type: 'max_tokens' | 'system_prompt' | 'model_route' | 'gate_threshold' | 'custom';
  /** What's being targeted, e.g. "topic:code_review" or "model:haiku" */
  target: string;
  /** Snapshot of the current value before any change */
  current_value: unknown;
  /** The proposed new value */
  proposed_value: unknown;
}

export interface LearningInsight {
  /** nanoid — primary key in learning_insights table */
  id: string;
  /** 'verbosity' | 'regeneration' | 'model_routing' | custom */
  pattern_type: string;
  /** Human-readable title shown in InsightReviewPanel */
  title: string;
  /** Detailed explanation of what pattern was found */
  description: string;
  /** 0–95. Never exceeds 95%. Below 70 = experimental, not auto-surfaced. */
  confidence: number;
  /** Number of events that produced this insight */
  sample_size: number;
  status: InsightStatus;
  /** The proposed system adjustment */
  adjustment: InsightAdjustment;
  /**
   * JSON snapshot of state before applying.
   * Always populated so rollback is always possible (§6.3).
   */
  before_state: string;
  /**
   * JSON snapshot after applying. null until status = 'applied'.
   */
  after_state: string | null;
  /** Unix ms creation timestamp */
  created_at: number;
  /** Unix ms when status changed to 'applied'. null until then. */
  applied_at: number | null;
  /** Unix ms expiry — 90 days from created_at (§6.3 decay rule) */
  expires_at: number;
}

export interface PatternResult {
  pattern_type: string;
  events_analyzed: number;
  insights: LearningInsight[];
}

/** Internal row shape when reading learning_insights from DB */
export interface LearningInsightRow {
  id: string;
  pattern_type: string;
  title: string;
  description: string;
  confidence: number;
  sample_size: number;
  status: string;
  adjustment: string; // JSON
  before_state: string; // JSON
  after_state: string | null;
  created_at: number;
  applied_at: number | null;
  expires_at: number;
}
