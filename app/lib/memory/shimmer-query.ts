/**
 * KERNL shimmer query — finds input tokens that match existing memory.
 *
 * Budget: <50ms total. Max 5 tokens queried per call.
 * Called server-side via /api/shimmer-matches route.
 *
 * Query strategy:
 *   1. Extract meaningful tokens from input (skip stopwords, length < 3)
 *   2. Skip if input < 10 chars or < 3 meaningful tokens
 *   3. For each token (up to 5), try messages FTS5, then decisions FTS5
 *   4. Return matches with character positions in the original input
 */

import { getDatabase } from '@/lib/kernl/database';

// ─── Stop words (shared with trigger-detector.ts) ────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
  'it', 'its', 'we', 'i', 'you', 'he', 'she', 'they', 'what', 'how',
  'why', 'when', 'where', 'which', 'who', 'if', 'then', 'so', 'as',
  'up', 'out', 'over', 'about', 'into', 'just', 'my', 'our', 'your', 'not',
  'no', 'yes', 'all', 'more', 'also', 'very', 'get', 'make', 'use',
  'new', 'old', 'now', 'here', 'there', 'me', 'her', 'him', 'his',
  'their', 'them', 'like', 'want',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShimmerMatch {
  /** The word/phrase in the input that matched */
  term: string;
  /** Start character index in the input string (inclusive) */
  startIndex: number;
  /** End character index in the input string (exclusive) */
  endIndex: number;
  /** Where the match came from */
  source: 'memory' | 'decision' | 'ghost';
  /** Thread ID or decision ID for navigation */
  sourceId: string;
  /** First 80 chars of the matching content */
  preview: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract meaningful tokens from input text.
 * Lowercase, remove punctuation, split on whitespace, filter stopwords + short tokens.
 */
export function extractTokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Find all word-boundary-aware positions of `term` in `input` (case-insensitive).
 */
function findPositions(
  input: string,
  term: string,
): Array<{ startIndex: number; endIndex: number }> {
  const positions: Array<{ startIndex: number; endIndex: number }> = [];
  const lower = input.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let idx = lower.indexOf(lowerTerm);
  while (idx !== -1) {
    // Word boundary check
    const before = idx === 0 ? ' ' : (lower[idx - 1] ?? ' ');
    const after = lower[idx + lowerTerm.length] ?? ' ';
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
      positions.push({ startIndex: idx, endIndex: idx + lowerTerm.length });
    }
    idx = lower.indexOf(lowerTerm, idx + 1);
  }
  return positions;
}

/**
 * Wrap a term in FTS5-safe double quotes, escaping any internal quotes.
 */
function escapeFts5(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Query KERNL for input tokens that have memory matches.
 *
 * @param input           Current textarea content
 * @param _conversationId Active conversation ID (reserved for future scoping)
 * @returns               Sorted, deduped array of ShimmerMatch
 */
export function queryShimmerMatches(
  input: string,
  _conversationId: string,
): ShimmerMatch[] {
  if (input.length < 10) return [];

  const tokens = extractTokens(input);
  if (tokens.length < 3) return [];

  // Budget: max 5 tokens to stay under 50ms
  const queryTokens = tokens.slice(0, 5);

  const db = getDatabase();
  const matches: ShimmerMatch[] = [];
  const seenTerms = new Set<string>();

  const msgStmt = db.prepare<[string, number]>(`
    SELECT m.id, m.thread_id, m.content
    FROM messages m
    JOIN messages_fts f ON m.rowid = f.rowid
    WHERE messages_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  const decStmt = db.prepare<[string, number]>(`
    SELECT d.id, d.title, d.rationale
    FROM decisions d
    JOIN decisions_fts df ON d.rowid = df.rowid
    WHERE decisions_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  for (const token of queryTokens) {
    if (seenTerms.has(token)) continue;
    seenTerms.add(token);

    try {
      const escaped = escapeFts5(token);

      // 1. Check messages FTS5 first
      const msgResults = msgStmt.all(escaped, 3) as Array<{
        id: string;
        thread_id: string;
        content: string;
      }>;

      if (msgResults.length > 0 && msgResults[0]) {
        const result = msgResults[0];
        const preview = result.content.trim().slice(0, 80);
        const positions = findPositions(input, token);
        for (const pos of positions) {
          matches.push({
            term: token,
            startIndex: pos.startIndex,
            endIndex: pos.endIndex,
            source: 'memory',
            sourceId: result.thread_id,
            preview,
          });
        }
        continue;
      }

      // 2. Check decisions FTS5
      const decResults = decStmt.all(escaped, 3) as Array<{
        id: string;
        title: string;
        rationale: string;
      }>;

      if (decResults.length > 0 && decResults[0]) {
        const result = decResults[0];
        const preview = result.title.trim().slice(0, 80);
        const positions = findPositions(input, token);
        for (const pos of positions) {
          matches.push({
            term: token,
            startIndex: pos.startIndex,
            endIndex: pos.endIndex,
            source: 'decision',
            sourceId: result.id,
            preview,
          });
        }
      }
    } catch {
      // FTS5 query error — skip token silently
    }
  }

  // Sort by startIndex, remove overlapping matches (keep first)
  matches.sort((a, b) => a.startIndex - b.startIndex);
  const deduped: ShimmerMatch[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.startIndex >= lastEnd) {
      deduped.push(m);
      lastEnd = m.endIndex;
    }
  }

  return deduped;
}
