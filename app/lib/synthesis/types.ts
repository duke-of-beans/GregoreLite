/**
 * lib/synthesis/types.ts — Sprint 28.0 Ceremonial Onboarding
 *
 * Type definitions for the indexing source registry and synthesis pipeline.
 * These types mirror the SQLite tables in database.ts exactly.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type IndexingSourceType =
  | 'local_files'
  | 'projects'
  | 'email'
  | 'conversations'
  | 'calendar'
  | 'notes'
  | 'custom';

export type IndexingStatus =
  | 'pending'
  | 'indexing'
  | 'complete'
  | 'skipped'
  | 'error';

export type MasterSynthesisStatus = 'pending' | 'generating' | 'complete' | 'error';

// ── Core domain types ─────────────────────────────────────────────────────────

export interface IndexingSource {
  id: string;
  type: IndexingSourceType;
  label: string;
  status: IndexingStatus;
  path_or_config: string | null;
  indexed_count: number;
  total_count: number | null;
  started_at: number | null;
  completed_at: number | null;
  synthesis_text: string | null;       // Greg's per-source synthesis
  combination_text: string | null;     // Greg's combination synthesis
  created_at: number;
}

export interface MasterSynthesis {
  id: string;
  overview: string;                    // 2-3 sentences, the big picture
  patterns: string[];                  // 3-5 patterns Greg notices
  insights: string[];                  // 2-3 things that might surprise the user
  blind_spots: string[];               // 1-2 areas where data is thin
  capability_summary: string;          // what Greg can now do
  sources_used: string[];              // source IDs included in this synthesis
  generated_at: number;
  status: MasterSynthesisStatus;
}

// ── Synthesis result (output of generator) ────────────────────────────────────

export interface SynthesisResult {
  sourceId: string;
  sourceSynthesis: string;             // what Greg found in this source alone
  combinationSynthesis: string | null; // what combining with previous sources unlocks
  capabilitiesUnlocked: string[];      // concrete list of new abilities
}

// ── Orchestrator progress snapshot ────────────────────────────────────────────

export interface SynthesisProgress {
  sources: IndexingSource[];
  allComplete: boolean;
  masterSynthesis: MasterSynthesis | null;
  totalIndexed: number;
  totalSources: number;
  pendingNudgeSources: IndexingSource[];  // sources skipped that should get nudges
}

// ── Nudge record ──────────────────────────────────────────────────────────────

export interface SynthesisNudge {
  id: string;
  source_type: IndexingSourceType;
  source_label: string;
  capability_teaser: string;
  sent_at: number;
  dismissed_count: number;
  last_dismissed_at: number | null;
  permanently_silenced: boolean;
}

// ── Telemetry (no content, no paths — strictly behavioural) ──────────────────

export interface SynthesisTelemetryRecord {
  id: string;
  sources_added_order: string;         // JSON array of IndexingSourceType
  sources_skipped: string;             // JSON array
  per_source_read_time_ms: string;     // JSON object
  completed_master: number;            // SQLite boolean
  exited_early: number;                // SQLite boolean
  nudge_conversions: string;           // JSON array
  created_at: number;
}

// ── Source config helpers ─────────────────────────────────────────────────────

export interface LocalFilesConfig {
  rootPath: string;
  extensions?: string[];
  excludePatterns?: string[];
}

export interface EmailConfig {
  provider: 'gmail' | 'outlook' | 'imap';
  accountId: string;
}

export interface CalendarConfig {
  provider: 'google' | 'outlook';
  accountId: string;
}

export type SourceConfig =
  | LocalFilesConfig
  | EmailConfig
  | CalendarConfig
  | Record<string, unknown>;
