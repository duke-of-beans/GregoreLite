/**
 * kernl-search.test.ts — Sprint 11.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runKernlSearch } from '../tools/kernl-search';

vi.mock('../../../lib/kernl/database', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from '../../kernl/database';
const mockGetDatabase = vi.mocked(getDatabase);

function makeDb(rows: unknown[]) {
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue(rows),
    }),
  };
}

describe('runKernlSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs FTS query and returns structured results', () => {
    const rows = [
      { messageId: 'msg-1', threadId: 'thread-1', content: 'Hello world', rank: -1.5 },
      { messageId: 'msg-2', threadId: 'thread-2', content: 'Another match', rank: -0.8 },
    ];
    mockGetDatabase.mockReturnValue(makeDb(rows) as unknown as ReturnType<typeof getDatabase>);

    const result = runKernlSearch('hello world');

    expect(result.query).toBe('hello world');
    expect(result.totalResults).toBe(2);
    expect(result.results[0]?.messageId).toBe('msg-1');
    expect(result.results[1]?.threadId).toBe('thread-2');
  });

  it('returns empty results for an empty query', () => {
    const result = runKernlSearch('   ');

    expect(mockGetDatabase).not.toHaveBeenCalled();
    expect(result.results).toHaveLength(0);
    expect(result.totalResults).toBe(0);
  });

  it('returns empty results when FTS table does not exist', () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockImplementation(() => {
          throw new Error('no such table: messages_fts');
        }),
      }),
    };
    mockGetDatabase.mockReturnValue(db as unknown as ReturnType<typeof getDatabase>);

    const result = runKernlSearch('some query');

    expect(result.results).toHaveLength(0);
    expect(result.totalResults).toBe(0);
  });

  it('escapes special FTS5 characters in the query', () => {
    const db = makeDb([]);
    mockGetDatabase.mockReturnValue(db as unknown as ReturnType<typeof getDatabase>);

    runKernlSearch('hello (world) OR "special"');

    const prepareCall = db.prepare.mock.calls[0];
    expect(prepareCall).toBeDefined();
    const allCall = db.prepare().all.mock.calls[0];
    // First argument to .all() should be the escaped query string
    const escapedQuery = allCall?.[0] as string;
    expect(escapedQuery).toContain('"hello"');
    expect(escapedQuery).not.toContain('(world)');
  });

  it('caps max_results at 100', () => {
    const db = makeDb([]);
    mockGetDatabase.mockReturnValue(db as unknown as ReturnType<typeof getDatabase>);

    runKernlSearch('test', 999);

    const allCall = db.prepare().all.mock.calls[0];
    const limitArg = allCall?.[1] as number;
    expect(limitArg).toBe(100);
  });
});
