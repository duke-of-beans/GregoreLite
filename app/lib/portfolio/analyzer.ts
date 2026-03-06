/**
 * Portfolio Attention Analyzer — Sprint 26.0
 *
 * Reads ProjectCard data and produces a prioritized attention queue.
 * Checks staleness (type-aware), blockers, test health, deadlines, velocity.
 *
 * Public API:
 *   analyzeAttention(projects)   — returns AttentionItem[] sorted by severity
 *
 * RULES:
 * - Type-aware staleness thresholds — research is different from code.
 * - Max 10 items returned — never overwhelm.
 * - Muted projects are skipped entirely.
 * - High-velocity projects (active < 24h, no blockers) get an "on track" note.
 * - All copy comes from ATTENTION section of copy-templates.ts.
 */

import { ATTENTION } from '@/lib/voice/copy-templates';
import type { ProjectCard, ProjectType, AttentionItem, AttentionSeverity } from './types';

// ── Staleness thresholds (days) by project type ───────────────────────────────

interface StalenessThresholds {
  amber: number; // days until amber
  red: number;   // days until red
}

const THRESHOLDS: Record<ProjectType, StalenessThresholds> = {
  code:     { amber: 7,  red: 14 },
  research: { amber: 14, red: 30 },
  business: { amber: 5,  red: 10 },
  creative: { amber: 14, red: 30 },
  custom:   { amber: 10, red: 21 },
};

// ── Blocker keywords ──────────────────────────────────────────────────────────

const BLOCKER_KEYWORDS = [
  'BLOCKED', 'blocked', 'waiting on', 'depends on', "can't proceed",
  'cannot proceed', 'on hold', 'blocking', 'waiting for',
];

// ── Date parsing helpers ──────────────────────────────────────────────────────

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const ms = new Date(isoDate).getTime();
  if (isNaN(ms)) return null;
  return (Date.now() - ms) / (1000 * 60 * 60 * 24);
}

function isWithinDays(isoDate: string | null, days: number): boolean {
  const d = daysSince(isoDate);
  if (d === null) return false;
  // "within N days" from today = the date is in the future or within N days past
  // We need the opposite: check if a future deadline is approaching within N days
  const ms = new Date(isoDate!).getTime();
  const future = ms - Date.now();
  return future >= 0 && future <= days * 24 * 60 * 60 * 1000;
}

// ── Deadline detection ────────────────────────────────────────────────────────

/** Extract ISO date strings that look like deadlines from free text */
function extractDeadlines(text: string | null): string[] {
  if (!text) return [];
  const found: string[] = [];
  // Match YYYY-MM-DD patterns
  const datePattern = /\b(20\d{2}-\d{2}-\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = datePattern.exec(text)) !== null) {
    const candidate = m[1]!;
    const ms = new Date(candidate).getTime();
    if (!isNaN(ms)) found.push(candidate);
  }
  return found;
}

// ── Blocker detection ─────────────────────────────────────────────────────────

function hasBlockers(project: ProjectCard): boolean {
  // ProjectCard.healthReason already captures blockers from scanner
  if (project.health === 'red' && project.healthReason.toLowerCase().includes('blocker')) return true;
  // Also check phase/nextAction text
  const text = `${project.phase ?? ''} ${project.nextAction ?? ''}`;
  return BLOCKER_KEYWORDS.some((kw) => text.includes(kw));
}

// ── Mute check ────────────────────────────────────────────────────────────────

function isMuted(project: ProjectCard): boolean {
  if (!project.attentionMutedUntil) return false;
  return Date.now() < project.attentionMutedUntil;
}

// ── Main analyzer ─────────────────────────────────────────────────────────────

/**
 * Analyze a list of ProjectCards and return a prioritized attention queue.
 * Max 10 items. Sorted high → medium → low, then by staleness.
 * Muted projects are skipped.
 */
export function analyzeAttention(projects: ProjectCard[]): AttentionItem[] {
  const now = Date.now();
  const items: AttentionItem[] = [];

  for (const project of projects) {
    if (project.status !== 'active') continue;
    if (isMuted(project)) continue;

    const age = daysSince(project.lastActivity);
    const thresholds = THRESHOLDS[project.type];

    // ── High velocity: active < 24h, no issues → skip or mark on-track ───────
    if (age !== null && age < 1) {
      const failingTests =
        project.testCount != null &&
        project.testPassing != null &&
        project.testPassing < project.testCount;
      if (!failingTests && project.health !== 'red') {
        // On track — include as low-severity positive signal (capped contribution)
        items.push({
          projectId: project.id,
          projectName: project.name,
          severity: 'low',
          reason: ATTENTION.velocity(project.name),
          actionSuggestion: ATTENTION.actionKeepGoing,
          triggerType: 'velocity',
        });
        continue;
      }
    }

    // ── Failing tests ─────────────────────────────────────────────────────────
    if (
      project.testCount != null &&
      project.testPassing != null &&
      project.testPassing < project.testCount
    ) {
      const failing = project.testCount - project.testPassing;
      items.push({
        projectId: project.id,
        projectName: project.name,
        severity: 'high',
        reason: ATTENTION.testFailures(project.name, failing),
        actionSuggestion: ATTENTION.actionRunTests,
        triggerType: 'tests',
      });
      continue; // Test failures trump other signals
    }

    // ── Blockers ──────────────────────────────────────────────────────────────
    if (hasBlockers(project)) {
      items.push({
        projectId: project.id,
        projectName: project.name,
        severity: 'high',
        reason: ATTENTION.blockers(project.name),
        actionSuggestion: ATTENTION.actionReviewBlockers,
        triggerType: 'blockers',
      });
      continue;
    }

    // ── Approaching deadline ──────────────────────────────────────────────────
    const phaseText = `${project.phase ?? ''} ${project.nextAction ?? ''}`;
    const deadlines = extractDeadlines(phaseText);
    const approaching = deadlines.find((d) => isWithinDays(d, 7));
    if (approaching) {
      const daysLeft = Math.ceil(
        (new Date(approaching).getTime() - now) / (1000 * 60 * 60 * 24),
      );
      items.push({
        projectId: project.id,
        projectName: project.name,
        severity: 'high',
        reason: ATTENTION.deadlineApproaching(project.name, daysLeft),
        actionSuggestion: ATTENTION.actionReviewDeadline,
        triggerType: 'deadline',
      });
      continue;
    }

    // ── Staleness ─────────────────────────────────────────────────────────────
    if (age !== null) {
      if (age >= thresholds.red) {
        const days = Math.round(age);
        const nextSprint = project.nextAction ? ` ${project.nextAction.slice(0, 60)}.` : '';
        items.push({
          projectId: project.id,
          projectName: project.name,
          severity: 'high',
          reason: ATTENTION.staleRed(project.name, days, nextSprint),
          actionSuggestion: ATTENTION.actionPickUp,
          triggerType: 'staleness',
        });
      } else if (age >= thresholds.amber) {
        const days = Math.round(age);
        items.push({
          projectId: project.id,
          projectName: project.name,
          severity: 'medium',
          reason: ATTENTION.staleAmber(project.name, days),
          actionSuggestion: ATTENTION.actionPickUp,
          triggerType: 'staleness',
        });
      }
    } else if (project.lastActivity === null) {
      // Never been active
      items.push({
        projectId: project.id,
        projectName: project.name,
        severity: 'low',
        reason: ATTENTION.neverActive(project.name),
        actionSuggestion: ATTENTION.actionPickUp,
        triggerType: 'staleness',
      });
    }
  }

  // ── Sort: high → medium → low, then by severity within group ─────────────
  const severityOrder: Record<AttentionSeverity, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Return max 10, excluding low-severity velocity items beyond index 5
  const filtered = items.slice(0, 10);
  return filtered;
}
