/**
 * action-journal.test.ts — Sprint 19.0 Task 10
 *
 * Tests Law 3 (Reversibility) action journal implementation.
 * Mocks both the database and fs module.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock fs ──────────────────────────────────────────────────────────────────

const mockFiles: Record<string, string> = {};
let deletedFiles: string[] = [];

vi.mock('fs', () => ({
  default: {
    existsSync: (p: string) => p in mockFiles,
    readFileSync: (p: string) => {
      if (!(p in mockFiles)) throw new Error(`ENOENT: ${p}`);
      return mockFiles[p];
    },
    writeFileSync: (p: string, content: string) => { mockFiles[p] = content; },
    unlinkSync: (p: string) => {
      deletedFiles.push(p);
      delete mockFiles[p];
    },
    mkdirSync: () => undefined,
  },
}));

// ─── Mock database ────────────────────────────────────────────────────────────

type DbRow = {
  id: string;
  session_id: string;
  tool_name: string;
  action_type: string;
  target_path: string | null;
  before_state: string | null;
  after_state: string | null;
  command: string | null;
  reversible: number;
  undone: number;
  created_at: number;
};

const dbRows: Record<string, DbRow> = {};

function makeStmt(sql: string) {
  const up = sql.trim().toUpperCase();
  return {
    run(...args: unknown[]) {
      if (up.startsWith('INSERT')) {
        const p = args[0] as Record<string, unknown>;
        const id = p['id'] as string;
        dbRows[id] = {
          id,
          session_id: p['session_id'] as string,
          tool_name: p['tool_name'] as string,
          action_type: p['action_type'] as string,
          target_path: (p['target_path'] as string | null) ?? null,
          before_state: (p['before_state'] as string | null) ?? null,
          after_state: (p['after_state'] as string | null) ?? null,
          command: (p['command'] as string | null) ?? null,
          reversible: p['reversible'] as number,
          undone: p['undone'] as number,
          created_at: p['created_at'] as number,
        };
      } else if (up.includes('SET AFTER_STATE')) {
        const after = args[0] as string | null;
        const id = args[1] as string;
        if (dbRows[id]) dbRows[id]!.after_state = after;
      } else if (up.includes('SET UNDONE')) {
        const id = args[0] as string;
        if (dbRows[id]) dbRows[id]!.undone = 1;
      }
    },
    get(id: string) {
      return dbRows[id] ?? undefined;
    },
    all(sessionId: string) {
      return Object.values(dbRows)
        .filter((r) => r.session_id === sessionId)
        .sort((a, b) => b.created_at - a.created_at);
    },
  };
}

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({ prepare: (s: string) => makeStmt(s) }),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

const {
  journalBeforeWrite,
  journalAfterWrite,
  journalCommand,
  undoAction,
  getSessionActions,
} = await import('../action-journal');

// ─── Reset ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  Object.keys(dbRows).forEach((k) => delete dbRows[k]);
  Object.keys(mockFiles).forEach((k) => delete mockFiles[k]);
  deletedFiles = [];
});

// ─── journalBeforeWrite ───────────────────────────────────────────────────────

describe('journalBeforeWrite', () => {
  it('returns an entry ID', () => {
    const id = journalBeforeWrite('sess1', '/tmp/new.ts');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('captures null before_state for new files', () => {
    const id = journalBeforeWrite('sess1', '/tmp/new.ts');
    const row = dbRows[id];
    expect(row?.before_state).toBeNull();
  });

  it('captures existing file contents as before_state', () => {
    mockFiles['/tmp/existing.ts'] = 'export const x = 1;';
    const id = journalBeforeWrite('sess1', '/tmp/existing.ts');
    const row = dbRows[id];
    expect(row?.before_state).toBe('export const x = 1;');
  });

  it('sets action_type to file_write', () => {
    const id = journalBeforeWrite('sess1', '/tmp/x.ts');
    expect(dbRows[id]?.action_type).toBe('file_write');
  });

  it('sets reversible = 1', () => {
    const id = journalBeforeWrite('sess1', '/tmp/x.ts');
    expect(dbRows[id]?.reversible).toBe(1);
  });

  it('sets undone = 0', () => {
    const id = journalBeforeWrite('sess1', '/tmp/x.ts');
    expect(dbRows[id]?.undone).toBe(0);
  });

  it('stores the session_id', () => {
    const id = journalBeforeWrite('session-abc', '/tmp/x.ts');
    expect(dbRows[id]?.session_id).toBe('session-abc');
  });
});

// ─── journalAfterWrite ────────────────────────────────────────────────────────

describe('journalAfterWrite', () => {
  it('updates after_state with current file content', () => {
    const id = journalBeforeWrite('sess1', '/tmp/out.ts');
    mockFiles['/tmp/out.ts'] = 'const y = 2;';
    journalAfterWrite(id, '/tmp/out.ts');
    expect(dbRows[id]?.after_state).toBe('const y = 2;');
  });

  it('does not throw when file does not exist after write', () => {
    const id = journalBeforeWrite('sess1', '/tmp/gone.ts');
    expect(() => journalAfterWrite(id, '/tmp/gone.ts')).not.toThrow();
  });
});

// ─── journalCommand ───────────────────────────────────────────────────────────

describe('journalCommand', () => {
  it('returns an entry ID', () => {
    const id = journalCommand('sess1', 'pnpm test');
    expect(typeof id).toBe('string');
  });

  it('stores the command', () => {
    const id = journalCommand('sess1', 'git status');
    expect(dbRows[id]?.command).toBe('git status');
  });

  it('sets reversible = 0', () => {
    const id = journalCommand('sess1', 'rm -rf dist');
    expect(dbRows[id]?.reversible).toBe(0);
  });

  it('sets action_type to command for run_command tool', () => {
    const id = journalCommand('sess1', 'ls', 'run_command');
    expect(dbRows[id]?.action_type).toBe('command');
  });

  it('sets action_type to git_commit for git_commit tool', () => {
    const id = journalCommand('sess1', 'feat: add thing', 'git_commit');
    expect(dbRows[id]?.action_type).toBe('git_commit');
  });

  it('stores afterState when provided', () => {
    const id = journalCommand('sess1', 'git commit', 'git_commit', 'abc123');
    expect(dbRows[id]?.after_state).toBe('abc123');
  });
});

// ─── undoAction ───────────────────────────────────────────────────────────────

describe('undoAction', () => {
  it('restores file contents from before_state', () => {
    mockFiles['/tmp/file.ts'] = 'before content';
    const id = journalBeforeWrite('sess1', '/tmp/file.ts');
    mockFiles['/tmp/file.ts'] = 'after content'; // simulate write
    journalAfterWrite(id, '/tmp/file.ts');

    const result = undoAction(id);
    expect(result.success).toBe(true);
    expect(mockFiles['/tmp/file.ts']).toBe('before content');
  });

  it('deletes file when before_state is null (new file)', () => {
    const id = journalBeforeWrite('sess1', '/tmp/newfile.ts');
    mockFiles['/tmp/newfile.ts'] = 'new content'; // simulate write
    journalAfterWrite(id, '/tmp/newfile.ts');

    const result = undoAction(id);
    expect(result.success).toBe(true);
    expect(deletedFiles).toContain('/tmp/newfile.ts');
  });

  it('marks entry as undone after successful undo', () => {
    mockFiles['/tmp/f.ts'] = 'old';
    const id = journalBeforeWrite('sess1', '/tmp/f.ts');
    mockFiles['/tmp/f.ts'] = 'new';
    undoAction(id);
    expect(dbRows[id]?.undone).toBe(1);
  });

  it('returns failure when entry not found', () => {
    const result = undoAction('nonexistent-id');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('returns failure when already undone', () => {
    mockFiles['/tmp/f.ts'] = 'old';
    const id = journalBeforeWrite('sess1', '/tmp/f.ts');
    mockFiles['/tmp/f.ts'] = 'new';
    undoAction(id);
    const second = undoAction(id);
    expect(second.success).toBe(false);
    expect(second.message).toContain('already been undone');
  });

  it('returns failure for non-reversible commands', () => {
    const id = journalCommand('sess1', 'rm dist');
    const result = undoAction(id);
    expect(result.success).toBe(false);
    expect(result.message).toContain('cannot be undone');
  });
});

// ─── getSessionActions ────────────────────────────────────────────────────────

describe('getSessionActions', () => {
  it('returns entries for the given session', () => {
    journalBeforeWrite('sess-A', '/tmp/a.ts');
    journalBeforeWrite('sess-B', '/tmp/b.ts');
    const actions = getSessionActions('sess-A');
    expect(actions.every((a) => a.session_id === 'sess-A')).toBe(true);
    expect(actions).toHaveLength(1);
  });

  it('returns entries newest-first', () => {
    const id1 = journalBeforeWrite('sess1', '/tmp/first.ts');
    const id2 = journalBeforeWrite('sess1', '/tmp/second.ts');
    // Force order via created_at
    dbRows[id1]!.created_at = 1000;
    dbRows[id2]!.created_at = 2000;
    const actions = getSessionActions('sess1');
    expect(actions[0]?.id).toBe(id2);
    expect(actions[1]?.id).toBe(id1);
  });

  it('returns empty array when no entries exist', () => {
    expect(getSessionActions('empty-session')).toHaveLength(0);
  });
});
