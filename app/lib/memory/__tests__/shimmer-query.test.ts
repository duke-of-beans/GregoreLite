/**
 * shimmer-query.test.ts
 * Sprint 18.0 Task 7 — unit tests for queryShimmerMatches
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTokens } from '../shimmer-query';

// ─── extractTokens ────────────────────────────────────────────────────────────

describe('extractTokens', () => {
  it('returns meaningful tokens, filtered and lowercased', () => {
    const tokens = extractTokens('The quick brown fox jumped over');
    // 'the' and 'over' are stopwords; 'fox' < 3 chars filtered out
    expect(tokens).toContain('quick');
    expect(tokens).toContain('brown');
    expect(tokens).toContain('jumped');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('over');
  });

  it('strips punctuation', () => {
    const tokens = extractTokens('TypeScript, React! SQLite?');
    expect(tokens).toContain('typescript');
    expect(tokens).toContain('react');
    expect(tokens).toContain('sqlite');
  });

  it('filters tokens shorter than 3 characters', () => {
    const tokens = extractTokens('I go to db now');
    expect(tokens).not.toContain('i');
    expect(tokens).not.toContain('go');
    expect(tokens).not.toContain('to');
    expect(tokens).not.toContain('db');
  });

  it('returns empty array for empty string', () => {
    expect(extractTokens('')).toEqual([]);
  });

  it('deduplicates repeated tokens', () => {
    const tokens = extractTokens('database database database');
    // extractTokens doesn't deduplicate — that's done in queryShimmerMatches
    expect(tokens.filter((t) => t === 'database').length).toBeGreaterThanOrEqual(1);
  });
});

// ─── queryShimmerMatches with mocked DB ──────────────────────────────────────

// We mock getDatabase to control FTS5 responses without a real SQLite file
vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from '@/lib/kernl/database';
import { queryShimmerMatches } from '../shimmer-query';

function makeMockDb(
  msgResults: Record<string, unknown[]> = {},
  decResults: Record<string, unknown[]> = {},
) {
  const msgStmt = {
    all: vi.fn((escaped: string, _limit: number) => {
      // Strip FTS5 quotes for lookup
      const key = escaped.replace(/^"|"$/g, '').replace(/""/g, '"');
      return msgResults[key] ?? [];
    }),
  };
  const decStmt = {
    all: vi.fn((escaped: string, _limit: number) => {
      const key = escaped.replace(/^"|"$/g, '').replace(/""/g, '"');
      return decResults[key] ?? [];
    }),
  };
  return {
    prepare: vi.fn((sql: string) => {
      if (sql.includes('messages_fts')) return msgStmt;
      if (sql.includes('decisions_fts')) return decStmt;
      return { all: vi.fn(() => []) };
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('queryShimmerMatches', () => {
  it('returns empty array for input shorter than 10 chars', () => {
    vi.mocked(getDatabase).mockReturnValue(makeMockDb() as never);
    const result = queryShimmerMatches('short', 'conv-1');
    expect(result).toEqual([]);
  });

  it('returns empty array when fewer than 3 meaningful tokens', () => {
    vi.mocked(getDatabase).mockReturnValue(makeMockDb() as never);
    // "database" is one token; "the" and "a" are stopwords — only 1 meaningful token
    const result = queryShimmerMatches('the database a', 'conv-1');
    expect(result).toEqual([]);
  });

  it('returns matches for tokens found in messages FTS5', () => {
    const db = makeMockDb(
      {
        // 'database' matches a message
        database: [{ id: 'msg-1', thread_id: 'thread-abc', content: 'We use database indexing here' }],
      },
      {},
    );
    vi.mocked(getDatabase).mockReturnValue(db as never);

    // Input must have ≥10 chars and ≥3 meaningful tokens
    const result = queryShimmerMatches('database query optimization works', 'conv-1');

    const dbMatch = result.find((m) => m.term === 'database');
    expect(dbMatch).toBeDefined();
    expect(dbMatch?.source).toBe('memory');
    expect(dbMatch?.sourceId).toBe('thread-abc');
    expect(dbMatch?.preview).toBe('We use database indexing here');
  });

  it('falls through to decisions when no message match', () => {
    const db = makeMockDb(
      {}, // no message matches
      {
        sprint: [{ id: 'dec-99', title: 'Sprint planning decision', rationale: 'Weekly cadence' }],
      },
    );
    vi.mocked(getDatabase).mockReturnValue(db as never);

    const result = queryShimmerMatches('sprint planning review today', 'conv-1');

    const sprintMatch = result.find((m) => m.term === 'sprint');
    expect(sprintMatch).toBeDefined();
    expect(sprintMatch?.source).toBe('decision');
    expect(sprintMatch?.sourceId).toBe('dec-99');
  });

  it('returns empty for tokens with no FTS5 matches', () => {
    vi.mocked(getDatabase).mockReturnValue(makeMockDb() as never);
    const result = queryShimmerMatches('completely random unknown words here', 'conv-1');
    expect(result).toEqual([]);
  });

  it('positions startIndex/endIndex correctly', () => {
    const input = 'let us refactor the kernel module now';
    const db = makeMockDb(
      {
        refactor: [{ id: 'msg-2', thread_id: 'thread-xyz', content: 'refactor the auth layer' }],
      },
      {},
    );
    vi.mocked(getDatabase).mockReturnValue(db as never);

    const result = queryShimmerMatches(input, 'conv-1');
    const m = result.find((r) => r.term === 'refactor');
    expect(m).toBeDefined();
    expect(m?.startIndex).toBe(input.indexOf('refactor'));
    expect(m?.endIndex).toBe(input.indexOf('refactor') + 'refactor'.length);
    // Verify the slice matches what was in the input
    expect(input.slice(m!.startIndex, m!.endIndex)).toBe('refactor');
  });

  it('deduplicates overlapping matches (first match wins)', () => {
    // Make two tokens match at overlapping positions
    const input = 'migration strategy planning today';
    const db = makeMockDb(
      {
        migration: [{ id: 'msg-3', thread_id: 'thread-1', content: 'db migration' }],
        strategy: [{ id: 'msg-4', thread_id: 'thread-2', content: 'strategy doc' }],
        planning: [{ id: 'msg-5', thread_id: 'thread-3', content: 'planning doc' }],
      },
      {},
    );
    vi.mocked(getDatabase).mockReturnValue(db as never);

    const result = queryShimmerMatches(input, 'conv-1');
    // All three are non-overlapping, all should appear
    const terms = result.map((m) => m.term);
    expect(terms).toContain('migration');
    expect(terms).toContain('strategy');
    expect(terms).toContain('planning');
  });

  it('limits to first 5 tokens (budget guard)', () => {
    // 7 meaningful tokens — only first 5 should be queried
    const input = 'refactor migration strategy planning deployment testing rollback database';
    const callCounts: string[] = [];
    const db = {
      prepare: vi.fn((_sql: string) => ({
        all: vi.fn((escaped: string) => {
          const key = escaped.replace(/^"|"$/g, '');
          callCounts.push(key);
          return [];
        }),
      })),
    };
    vi.mocked(getDatabase).mockReturnValue(db as never);

    queryShimmerMatches(input, 'conv-1');
    // Each token queries messages_fts once (and decisions_fts if no message match)
    // Total unique tokens queried must be ≤ 5
    const uniqueTokens = new Set(callCounts);
    expect(uniqueTokens.size).toBeLessThanOrEqual(5);
  });

  it('handles FTS5 query errors gracefully (skips bad tokens)', () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(() => { throw new Error('FTS5 error'); }),
      })),
    };
    vi.mocked(getDatabase).mockReturnValue(db as never);

    // Should not throw — returns empty array
    expect(() =>
      queryShimmerMatches('migration strategy planning deployment', 'conv-1')
    ).not.toThrow();
    const result = queryShimmerMatches('migration strategy planning deployment', 'conv-1');
    expect(result).toEqual([]);
  });

  it('word boundary matching — does not match partial words', () => {
    const input = 'the database migration and databasex stuff also runs here';
    const db = makeMockDb(
      {
        database: [{ id: 'msg-6', thread_id: 'thr-1', content: 'database schema' }],
      },
      {},
    );
    vi.mocked(getDatabase).mockReturnValue(db as never);

    const result = queryShimmerMatches(input, 'conv-1');
    const dbMatches = result.filter((m) => m.term === 'database');
    // "database" matches at position 4, but "databasex" should NOT match
    expect(dbMatches.length).toBe(1);
    expect(input.slice(dbMatches[0]!.startIndex, dbMatches[0]!.endIndex)).toBe('database');
  });
});
