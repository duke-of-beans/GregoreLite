/**
 * Shared view type for the Job Queue UI (Sprint 7F).
 *
 * Merges manifest row + job_state row into a single shape returned by
 * GET /api/agent-sdk/jobs and GET /api/agent-sdk/jobs/:id.
 */

export interface AgentJobView {
  manifestId: string;
  title: string;
  taskType: string;
  /** Lowercase status — matches JobStatus union plus 'pending' for queued sessions */
  status: string;
  isSelfEvolution: boolean;
  selfEvolutionBranch: string | null;
  /** Sprint 7H: GitHub PR number (null until PR is created post-completion) */
  prNumber: number | null;
  /** Sprint 7H: CI gate result — null = pending/unknown, true = passed, false = failed */
  ciPassed: boolean | null;
  createdAt: string;   // ISO
  updatedAt: number;   // epoch ms
  tokensUsed: number;
  costUsd: number;
  resultReport: unknown | null;
  // job_state fields (0 / [] / null for pending sessions)
  stepsCompleted: number;
  filesModified: string[];
  lastEvent: unknown | null;
  logPath: string | null;
  tokensUsedSoFar: number;
  costSoFar: number;
  // scheduler fields (pending sessions only)
  queuePosition?: number;
  priority?: number;
}

/** Status values the 7F UI needs to handle */
export const ACTIVE_STATUSES = new Set([
  'spawning', 'running', 'working', 'validating', 'blocked',
]);

export const TERMINAL_STATUSES = new Set([
  'completed', 'failed', 'interrupted',
]);

export const KILLABLE_STATUSES = new Set([
  'spawning', 'running', 'working', 'validating',
]);
