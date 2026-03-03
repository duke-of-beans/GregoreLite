/**
 * branch-namer.ts — Branch Name Generator — Phase 7H
 *
 * Generates deterministic, human-readable branch names for self-evolution sessions.
 * Format: self-evolve/{YYYYMMDD-HHMM}-{slug}
 * Slug: first 4 words of goal_summary, lowercased, hyphenated, alphanumeric only.
 *
 * Example: self-evolve/20260302-0930-improve-shim-retry-logic
 *
 * BLUEPRINT §7.3
 */

/**
 * generateBranchName — produce a branch name from a goal summary string and optional date.
 *
 * @param goalSummary  Plain-English goal (e.g. "Improve SHIM retry logic for TypeScript files")
 * @param at           Optional date override (defaults to now). Used for deterministic testing.
 */
export function generateBranchName(goalSummary: string, at: Date = new Date()): string {
  const datePart = formatDatePart(at);
  const slug = buildSlug(goalSummary);
  return `self-evolve/${datePart}-${slug}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDatePart(d: Date): string {
  const yyyy = d.getFullYear().toString();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  const hh   = String(d.getHours()).padStart(2, '0');
  const min  = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}`;
}

function buildSlug(goalSummary: string): string {
  return goalSummary
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')   // strip non-alphanumeric (keep spaces)
    .trim()
    .split(/\s+/)                   // split on whitespace
    .slice(0, 4)                    // first 4 words
    .join('-') || 'auto';
}
