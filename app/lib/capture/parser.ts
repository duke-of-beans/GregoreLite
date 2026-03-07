/**
 * Capture Parser — Sprint 29.0
 *
 * parseCaptureInput: detects "ProjectName:" or "ProjectName -" prefix patterns,
 *   fuzzy-matches against registered project names, strips prefix from body.
 *
 * classifyNote: keyword heuristic classification — fast, no LLM required.
 */

import type { CaptureClassification } from './types';

// ── Signal lists ──────────────────────────────────────────────────────────────

const BUG_SIGNALS = [
  'broken', 'error', 'fix', 'bug', "doesn't work", 'doesnt work',
  'wrong', 'crash', '404', 'missing', 'fails', 'fail', 'broke',
  'not working', 'exception', 'undefined', 'null pointer', 'stack trace',
];

const FEATURE_SIGNALS = [
  'should', 'add', 'new', 'ability to', 'allow', 'enable',
  'support', 'want', 'need', 'could', 'would be nice', 'build',
  'implement', 'create', 'make it', 'let users', 'give users',
];

const QUESTION_SIGNALS = [
  '?', 'what is', 'how does', 'how do', 'how to', 'why', 'should we',
  'thoughts on', 'is it', 'are we', 'do we', 'should i',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalize a string for fuzzy comparison: lowercase, strip spaces/hyphens/underscores. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]/g, '');
}

/**
 * Fuzzy-match a candidate project name against the known project list.
 * Returns the canonical project name if matched, null otherwise.
 *
 * Strategy (in order):
 *   1. Exact normalized match ("greglite" === "greglite")
 *   2. Candidate is a prefix of project name (≥3 chars) — "greg" → "GregLite"
 *   3. Project name is a prefix of candidate (≥3 chars) — "greglitepro" → "GregLite"
 */
export function fuzzyMatchProject(candidate: string, knownProjects: string[]): string | null {
  const normCandidate = normalize(candidate);
  if (normCandidate.length < 2) return null;

  for (const project of knownProjects) {
    const normProject = normalize(project);
    if (normProject === normCandidate) return project;
    if (normProject.startsWith(normCandidate) && normCandidate.length >= 3) return project;
    if (normCandidate.startsWith(normProject) && normProject.length >= 3) return project;
  }
  return null;
}

// ── Exported API ──────────────────────────────────────────────────────────────

export interface ParsedCapture {
  /** Canonical project name from knownProjects, or null if unrouted */
  projectName: string | null;
  /** Body text with prefix stripped */
  body: string;
}

/**
 * Parse a raw capture input string.
 * Detects "ProjectName: body" or "ProjectName - body" prefix patterns.
 * Fuzzy-matches candidate against knownProjects from portfolio_projects table.
 * Returns { projectName: null } if no prefix is detected or matched.
 */
export function parseCaptureInput(raw: string, knownProjects: string[]): ParsedCapture {
  const trimmed = raw.trim();

  // Pattern 1: "ProjectName: body text" (colon separator)
  const colonMatch = trimmed.match(/^([^:\n]{1,50}):\s*(.+)/);
  if (colonMatch) {
    const candidate = colonMatch[1]!.trim();
    const body = colonMatch[2]!.trim();
    const matched = fuzzyMatchProject(candidate, knownProjects);
    if (matched) return { projectName: matched, body };
  }

  // Pattern 2: "ProjectName - body text" (dash separator)
  const dashMatch = trimmed.match(/^([^\n]{1,50})\s+-\s+(.+)/);
  if (dashMatch) {
    const candidate = dashMatch[1]!.trim();
    const body = dashMatch[2]!.trim();
    const matched = fuzzyMatchProject(candidate, knownProjects);
    if (matched) return { projectName: matched, body };
  }

  // No recognizable prefix — unrouted note
  return { projectName: null, body: trimmed };
}

/**
 * Keyword heuristic note classification.
 * Order: question > bug > feature > idea (fallthrough default).
 * Fast path — no LLM, no network.
 */
export function classifyNote(body: string): CaptureClassification {
  const lower = body.toLowerCase();

  // Question signals take priority (? is a strong signal)
  if (QUESTION_SIGNALS.some((s) => lower.includes(s))) return 'question';

  // Bug signals
  if (BUG_SIGNALS.some((s) => lower.includes(s))) return 'bug';

  // Feature signals
  if (FEATURE_SIGNALS.some((s) => lower.includes(s))) return 'feature';

  // Fallthrough: idea
  return 'idea';
}
