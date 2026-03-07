/**
 * Tests for app/lib/capture/promote.ts — Sprint 29.0
 *
 * Coverage:
 *   - formatBacklogItem(): correct markdown format per classification
 *   - resolveTargetFile(): project-type → target filename mapping
 *   - promoteToBacklog(): DB lookup, file append, status update
 *
 * DB and fs (node:fs) are mocked.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── DB mock (hoisted) ─────────────────────────────────────────────────────────
const { mockRun, mockPrepare, mockGet } = vi.hoisted(() => {
  const mockRun = vi.fn().mockReturnValue({ changes: 1 });
  const mockGet = vi.fn().mockReturnValue(null);
  const mockStmt = { run: mockRun, get: mockGet };
  const mockPrepare = vi.fn().mockReturnValue(mockStmt);
  return { mockRun, mockPrepare, mockGet };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({ prepare: mockPrepare }),
}));

// ── fs mock ───────────────────────────────────────────────────────────────────
const { mockExistsSync, mockReadFileSync, mockAppendFileSync, mockWriteFileSync } = vi.hoisted(() => {
  const mockExistsSync = vi.fn().mockReturnValue(true);
  const mockReadFileSync = vi.fn().mockReturnValue('');
  const mockAppendFileSync = vi.fn();
  const mockWriteFileSync = vi.fn();
  return { mockExistsSync, mockReadFileSync, mockAppendFileSync, mockWriteFileSync };
});

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    appendFileSync: mockAppendFileSync,
    writeFileSync: mockWriteFileSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  appendFileSync: mockAppendFileSync,
  writeFileSync: mockWriteFileSync,
}));

import { formatBacklogItem, resolveTargetFile, promoteToBacklog } from '@/lib/capture/promote';
import type { CaptureNote } from '@/lib/capture/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNote(overrides: Partial<CaptureNote> = {}): CaptureNote {
  return {
    id: 'note-abc',
    project_id: 'proj-1',
    raw_text: 'GregLite: add export feature',
    parsed_project: 'GregLite',
    parsed_body: 'add export feature',
    classification: 'feature',
    mention_count: 1,
    merged_with: null,
    status: 'inbox',
    backlog_item_id: null,
    created_at: 1700000000000,
    last_mentioned_at: 1700000000000,
    ...overrides,
  };
}

beforeEach(() => {
  mockRun.mockReset();
  mockPrepare.mockReset();
  mockGet.mockReset();
  mockExistsSync.mockReset();
  mockReadFileSync.mockReset();
  mockAppendFileSync.mockReset();
  mockWriteFileSync.mockReset();

  mockRun.mockReturnValue({ changes: 1 });
  mockGet.mockReturnValue(null);
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue('');
  const mockStmt = { run: mockRun, get: mockGet };
  mockPrepare.mockReturnValue(mockStmt);
});

// ── formatBacklogItem ─────────────────────────────────────────────────────────

describe('formatBacklogItem()', () => {
  it('produces a markdown checkbox item', () => {
    const note = makeNote({ parsed_body: 'add export feature', classification: 'feature' });
    const result = formatBacklogItem(note);
    expect(result).toMatch(/^\- \[ \]/);
  });

  it('includes the classification label in uppercase bold', () => {
    const note = makeNote({ classification: 'bug', parsed_body: 'fix the crash on start' });
    const result = formatBacklogItem(note);
    expect(result).toMatch(/\*\*BUG:\*\*/i);
  });

  it('includes the parsed body text', () => {
    const note = makeNote({ parsed_body: 'implement dark mode' });
    const result = formatBacklogItem(note);
    expect(result).toContain('implement dark mode');
  });

  it('includes mention count when >1', () => {
    const note = makeNote({ mention_count: 3, parsed_body: 'some important thing' });
    const result = formatBacklogItem(note);
    expect(result).toContain('3x');
  });

  it('formats all classification types without throwing', () => {
    const classifications = ['bug', 'feature', 'question', 'idea'] as const;
    for (const cls of classifications) {
      expect(() => formatBacklogItem(makeNote({ classification: cls }))).not.toThrow();
    }
  });
});

// ── resolveTargetFile ─────────────────────────────────────────────────────────

describe('resolveTargetFile()', () => {
  it('returns FEATURE_BACKLOG.md for code projects', () => {
    const result = resolveTargetFile('/projects/greglite', 'code');
    expect(result).toContain('FEATURE_BACKLOG.md');
  });

  it('returns RESEARCH_LOG.md for research projects', () => {
    const result = resolveTargetFile('/projects/hirm', 'research');
    expect(result).toContain('RESEARCH_LOG.md');
  });

  it('returns TASK_LIST.md for creative projects', () => {
    const result = resolveTargetFile('/projects/myproject', 'creative');
    expect(result).toContain('TASK_LIST.md');
  });

  it('returns TASK_LIST.md for custom projects', () => {
    const result = resolveTargetFile('/projects/myproject', 'custom');
    expect(result).toContain('TASK_LIST.md');
  });

  it('returns MILESTONES.md for business projects when it exists', () => {
    mockExistsSync.mockReturnValue(true);
    const result = resolveTargetFile('D:\\projects\\ghm', 'business');
    expect(result).toContain('MILESTONES.md');
  });

  it('returns TASK_LIST.md for business projects when MILESTONES.md does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const result = resolveTargetFile('D:\\projects\\ghm', 'business');
    expect(result).toContain('TASK_LIST.md');
  });

  it('result path is under the provided projectPath', () => {
    const result = resolveTargetFile('D:\\projects\\myapp', 'code');
    expect(result).toContain('myapp');
    expect(result).toContain('FEATURE_BACKLOG.md');
  });
});

// ── promoteToBacklog ──────────────────────────────────────────────────────────

describe('promoteToBacklog()', () => {
  it('returns error result when note is not found', async () => {
    mockGet.mockReturnValue(null);
    const result = await promoteToBacklog('nonexistent-id');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('promotes unrouted notes (null project_id) to fallback path', async () => {
    const note = makeNote({ project_id: null });
    mockGet.mockReturnValueOnce(note); // capture_notes lookup
    mockExistsSync.mockReturnValue(true);
    const result = await promoteToBacklog('note-abc');
    // Unrouted notes route to GREGLITE_ROOT or cwd — not an error
    expect(result.success).toBe(true);
  });

  it('returns success and updates note status to backlogged', async () => {
    const note = makeNote({ project_id: 'proj-1' });
    // First get: capture_note; second get: portfolio_project
    mockGet
      .mockReturnValueOnce(note)
      .mockReturnValueOnce({
        id: 'proj-1',
        name: 'GregLite',
        path: 'D:\\Projects\\GregLite',
        type: 'code',
      });

    const result = await promoteToBacklog('note-abc');
    expect(result.success).toBe(true);
    // Status update SQL should have been called
    const updateCall = mockPrepare.mock.calls.find(
      (c) => (c[0] as string).includes('backlogged')
    );
    expect(updateCall).toBeDefined();
  });

  it('appends formatted item to the target backlog file', async () => {
    const note = makeNote({ project_id: 'proj-1' });
    mockGet
      .mockReturnValueOnce(note)
      .mockReturnValueOnce({
        id: 'proj-1',
        name: 'GregLite',
        path: 'D:\\Projects\\GregLite',
        type: 'code',
      });
    mockExistsSync.mockReturnValue(true);

    await promoteToBacklog('note-abc');

    expect(mockAppendFileSync).toHaveBeenCalledOnce();
    const appendedContent = mockAppendFileSync.mock.calls[0]![1] as string;
    expect(appendedContent).toContain('add export feature');
  });

  it('creates target file with header when file does not exist', async () => {
    const note = makeNote({ project_id: 'proj-1' });
    mockGet
      .mockReturnValueOnce(note)
      .mockReturnValueOnce({
        id: 'proj-1',
        name: 'GregLite',
        path: 'D:\\Projects\\GregLite',
        type: 'code',
      });
    mockExistsSync.mockReturnValue(false);

    await promoteToBacklog('note-abc');

    expect(mockWriteFileSync).toHaveBeenCalled();
    const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
    expect(writtenContent).toContain('GregLite');
  });
});
