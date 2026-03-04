/**
 * kernl-search.ts — Sprint 11.1
 *
 * Searches the KERNL FTS5 index (messages_fts), read-only.
 * Returns matching messages ranked by BM25 relevance.
 */

import { getDatabase } from '../../kernl/database';

export interface SearchResultItem {
  threadId: string;
  messageId: string;
  content: string;
  rank: number;
}

export interface SearchResult {
  results: SearchResultItem[];
  query: string;
  totalResults: number;
}

// ─── FTS5 query safety ───────────────────────────────────────────────────────

/**
 * Escape a user query for FTS5 to prevent syntax errors from special chars.
 * Wraps each whitespace-separated token in double-quotes.
 * FTS5 special chars: " * ^ ( ) OR AND NOT
 */
function escapeFts5Query(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/[^a-zA-Z0-9_\-']/g, ''))  // strip FTS5 specials
    .filter(Boolean)                                            // drop tokens that became empty
    .map((token) => `"${token}"`)                              // wrap in double-quotes
    .join(' ');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Search KERNL's FTS5 messages_fts index.
 *
 * @param query       Natural language search string.
 * @param maxResults  Max results to return (default 10, capped at 100).
 * @returns           Ranked list of matching messages with thread IDs.
 */
export function runKernlSearch(query: string, maxResults = 10): SearchResult {
  if (!query.trim()) {
    return { results: [], query, totalResults: 0 };
  }

  const limit   = Math.min(Math.max(1, maxResults), 100);
  const escaped = escapeFts5Query(query);

  try {
    const db = getDatabase();

    const rows = db
      .prepare(
        `SELECT
           m.id        AS messageId,
           m.thread_id AS threadId,
           m.content   AS content,
           fts.rank    AS rank
         FROM messages_fts AS fts
         JOIN messages AS m ON m.id = fts.rowid
         WHERE messages_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(escaped, limit) as Array<{
        messageId: string;
        threadId:  string;
        content:   string;
        rank:      number;
      }>;

    const results: SearchResultItem[] = rows.map((row) => ({
      messageId: row.messageId,
      threadId:  row.threadId,
      content:   row.content,
      rank:      row.rank,
    }));

    return { results, query, totalResults: results.length };
  } catch (err) {
    // FTS5 table may not exist on a fresh DB (before first message is indexed)
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('no such table') || msg.includes('messages_fts')) {
      return { results: [], query, totalResults: 0 };
    }
    throw err;
  }
}
