/**
 * Cross-Context Engine — shared types (Sprint 3E)
 *
 * @module lib/cross-context/types
 */

export type FeedbackAction = 'accepted' | 'dismissed' | 'ignored';

export type SurfaceContext = 'on_input' | 'pattern' | 'already_built';

export interface ThresholdConfig {
  /** Background pattern detection threshold. Default 0.75. */
  patternDetection: number;
  /** On-input suggestion trigger threshold. Default 0.85. */
  onInputSuggestion: number;
  /** "You already built this" interception threshold. Default 0.72. */
  alreadyBuiltGate: number;
}

export interface Suggestion {
  id: string;
  chunkId: string;
  content: string;
  sourceType: string;
  sourceId: string;
  similarityScore: number;
  displayScore: number;
  surfacedAt: number;
}

export interface CalibrationResult {
  ranAt: number;
  eventsProcessed: number;
  thresholdsBefore: ThresholdConfig;
  thresholdsAfter: ThresholdConfig;
}

/** DB row shape for suggestions table queries */
export interface SuggestionRow {
  id: string;
  chunk_id: string;
  similarity_score: number;
  display_score: number;
  surface_context: SurfaceContext;
  user_action: FeedbackAction | null;
  acted_at: number | null;
  surfaced_at: number;
}
