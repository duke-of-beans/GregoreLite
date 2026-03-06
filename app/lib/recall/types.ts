/**
 * lib/recall/types.ts — Ambient Memory: recall event data model
 * Sprint 27.0
 */

// ── Recall type taxonomy ────────────────────────────────────────────────────

export type RecallType =
  | 'file_revisit'
  | 'conversation_callback'
  | 'project_milestone'
  | 'personal_moment'
  | 'work_anniversary'
  | 'pattern_insight';

export type RecallUserAction = 'appreciated' | 'dismissed' | 'snoozed';

export type RecallSourceType = 'file' | 'conversation' | 'project' | 'email' | 'custom';

// ── Core event interface ────────────────────────────────────────────────────

export interface RecallEvent {
  id: string;
  type: RecallType;
  source_type: RecallSourceType;
  source_id?: string | undefined;
  source_name: string;
  message: string;
  context_data?: string | undefined;  // JSON blob of supporting data
  relevance_score: number;             // 0-1
  surfaced_at?: number | undefined;    // ms epoch, NULL until shown
  user_action?: RecallUserAction | undefined;
  acted_at?: number | undefined;
  created_at: number;                  // ms epoch
}

// ── Scorer types ────────────────────────────────────────────────────────────

export interface RecallUserHistory {
  totalActions: number;
  appreciated: number;
  dismissed: number;
  snoozed: number;
  /** recent actions by recall type — used for per-type calibration */
  byType: Partial<Record<RecallType, { appreciated: number; dismissed: number; snoozed: number }>>;
}

export interface RecallCalibration {
  dismissalRate: number;    // 0-1
  appreciationRate: number; // 0-1
  autoReduced: boolean;
  suggestIncrease: boolean;
}

// ── Scheduler settings (stored in kernl_settings) ──────────────────────────

export interface RecallSchedulerSettings {
  enabled: boolean;
  detectionIntervalHours: number;  // default 2
  maxPerDay: number;               // default 3
  enabledTypes: RecallType[];      // all enabled by default
}

export const DEFAULT_RECALL_SETTINGS: RecallSchedulerSettings = {
  enabled: true,
  detectionIntervalHours: 2,
  maxPerDay: 3,
  enabledTypes: [
    'file_revisit',
    'conversation_callback',
    'project_milestone',
    'personal_moment',
    'work_anniversary',
    'pattern_insight',
  ],
};
