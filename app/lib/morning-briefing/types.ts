/**
 * Morning Briefing Types — Sprint S9-05
 */

export interface JobSummary {
  title: string;
  costUsd: number;
  failureMode?: string;
}

export interface BriefingData {
  /** Date this briefing covers (ISO date string, e.g. "2026-03-02") */
  forDate: string;
  generatedAt: number;

  /** Section 1: Yesterday's jobs */
  completedJobs: JobSummary[];
  failedJobs: JobSummary[];

  /** Section 2: Decisions logged yesterday */
  decisionsCount: number;
  recentDecisionTitles: string[];

  /** Section 3: Ghost surfaces */
  ghostItemsIndexed: number;

  /** Section 4: Budget summary */
  yesterdaySpendUsd: number;
  dailyCapUsd: number;
  weekTotalUsd: number;

  /** Section 5: EoS delta */
  eosCurrent: number | null;
  eosPrevious: number | null;

  /** Section 6: PRs pending */
  prsPending: number;
}