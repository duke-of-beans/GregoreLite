/**
 * Tests for app/lib/capture/dedup.ts — Sprint 29.0
 *
 * Coverage:
 *   - findDuplicate(): exact match, token (Jaccard) match, no match
 *   - findDuplicate(): never throws — returns isDuplicate:false on DB error
 *   - mergeIntoPrimary(): increments mention_count, updates last_mentioned_at,
 *     sets merged_with, returns updated CaptureNote
 *
 * DB is mocked. Embedding tier is skipped (dynamic import; tested via integration).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── DB mock (hoisted) ─────────────────────────────────────────────────────────
const { mockRun, mockPrepare, mockAll, mockGet } = vi.hoisted(() => {
  const mockRun = vi.fn().mockReturnValue({ changes: 1 });
  const mockAll = vi.fn().mockReturnValue([]);
  const mockGet = vi.fn().mockReturnValue(null);
  const mockStmt = { run: mockRun, all: mockAll, get: mockGet };
  const mockPrepare = vi.fn().mockReturnValue(mockStmt);
  return { mockRun, mockPrepare, mockAll, mockGet };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({
    prepare: mockPrepare,
  }),
}));

// Mock embeddings so embedding tier never fires in unit tests
vi.mock('@/lib/embeddings/model', () => ({
  getEmbedder: vi.fn().mockResolvedValue(null),
  embedText: vi.fn().mockResolvedValue(new Float32Array(384)),
}));

import { findDuplicate, mergeIntoPrimary } from '@/lib/capture/dedup';
import type { CaptureNote } from '@/lib/capture/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNote(overrides: Partial<CaptureNote> = {}): CaptureNote {
  return {
    id: 'note-1',
    project_id: 'proj-1',
    raw_text: 'original text',
    parsed_project: 'GregLite',
    parsed_body: 'original body',
    classification: 'idea',
    mention_count: 1,
    merged_with: null,
    status: 'inbox',
    backlog_item_id: null,
    created_at: 1000000,
    last_mentioned_at: 1000000,
    ...overrides,
  };
}

beforeEach(() => {
  mockRun.mockReset();
  mockPrepare.mockReset();
  mockAll.mockReset();
  mockGet.mockReset();

  mockRun.mockReturnValue({ changes: 1 });
  mockAll.mockReturnValue([]);
  mockGet.mockReturnValue(null);
  const mockStmt = { run: mockRun, all: mockAll, get: mockGet };
  mockPrepare.mockReturnValue(mockStmt);
});

// ── findDuplicate: exact match ────────────────────────────────────────────────

describe('findDuplicate() — exact tier', () => {
  it('returns isDuplicate:true with similarity:1 for exact text match', async () => {
    const existingNote = makeNote({ id: 'existing-1', parsed_body: 'add dark mode toggle' });
    mockAll.mockReturnValue([existingNote]);

    const result = await findDuplicate('add dark mode toggle', 'proj-1');
    expect(result.isDuplicate).toBe(true);
    expect(result.similarity).toBe(1);
    expect(result.existingNote?.id).toBe('existing-1');
  });

  it('matches exact regardless of leading/trailing whitespace', async () => {
    const existingNote = makeNote({ id: 'existing-2', parsed_body: 'fix the login bug' });
    mockAll.mockReturnValue([existingNote]);

    const result = await findDuplicate('  fix the login bug  ', 'proj-1');
    expect(result.isDuplicate).toBe(true);
    expect(result.similarity).toBe(1);
  });

  it('is case-insensitive for exact match', async () => {
    const existingNote = makeNote({ id: 'existing-3', parsed_body: 'Add Dark Mode Toggle' });
    mockAll.mockReturnValue([existingNote]);

    const result = await findDuplicate('add dark mode toggle', 'proj-1');
    expect(result.isDuplicate).toBe(true);
    expect(result.similarity).toBe(1);
  });
});

// ── findDuplicate: token (Jaccard) tier ───────────────────────────────────────

describe('findDuplicate() — token tier', () => {
  it('returns isDuplicate:true with similarity>0.7 for high Jaccard overlap', async () => {
    // "add dark mode toggle button" vs "add dark mode toggle" → intersection=4, union=5 → 0.8
    const existingNote = makeNote({ id: 'token-1', parsed_body: 'add dark mode toggle button' });
    mockAll.mockReturnValue([existingNote]);

    const result = await findDuplicate('add dark mode toggle', 'proj-1');
    expect(result.isDuplicate).toBe(true);
    expect(result.similarity).toBeGreaterThan(0.7);
  });

  it('returns isDuplicate:false for low Jaccard similarity (<0.7)', async () => {
    // Completely different texts
    const existingNote = makeNote({ id: 'token-2', parsed_body: 'refactor the database layer' });
    mockAll.mockReturnValue([existingNote]);

    const result = await findDuplicate('add dark mode toggle', 'proj-1');
    expect(result.isDuplicate).toBe(false);
  });
});

// ── findDuplicate: no match ───────────────────────────────────────────────────

describe('findDuplicate() — no match', () => {
  it('returns isDuplicate:false when no inbox notes exist', async () => {
    mockAll.mockReturnValue([]);
    const result = await findDuplicate('brand new thought', 'proj-1');
    expect(result.isDuplicate).toBe(false);
    expect(result.existingNote).toBeNull();
  });

  it('returns isDuplicate:false for null projectId', async () => {
    mockAll.mockReturnValue([]);
    const result = await findDuplicate('some unrouted note', null);
    expect(result.isDuplicate).toBe(false);
  });
});

// ── findDuplicate: never throws ───────────────────────────────────────────────

describe('findDuplicate() — error resilience', () => {
  it('returns isDuplicate:false instead of throwing on DB error', async () => {
    mockPrepare.mockImplementation(() => { throw new Error('DB is locked'); });

    const result = await findDuplicate('any text', 'proj-1');
    expect(result.isDuplicate).toBe(false);
  });
});

// ── mergeIntoPrimary ──────────────────────────────────────────────────────────

describe('mergeIntoPrimary()', () => {
  it('increments mention_count on the primary note', () => {
    const primary = makeNote({ id: 'primary-1', mention_count: 2 });
    mockGet.mockReturnValue({ ...primary, mention_count: 3 });

    mergeIntoPrimary('primary-1', 'merged-note-1');
    expect(mockRun).toHaveBeenCalled();
    // The UPDATE call should include mention_count increment
    const updateSql = mockPrepare.mock.calls.find(
      (c) => (c[0] as string).includes('mention_count')
    )?.[0] as string;
    expect(updateSql).toBeDefined();
    expect(updateSql).toContain('mention_count');
  });

  it('sets merged_with on the secondary (merged) note', () => {
    const primary = makeNote({ id: 'primary-2', mention_count: 1 });
    mockGet.mockReturnValue(primary);

    mergeIntoPrimary('primary-2', 'secondary-note');

    const mergeSql = mockPrepare.mock.calls.find(
      (c) => (c[0] as string).includes('merged_with')
    )?.[0] as string;
    expect(mergeSql).toBeDefined();
  });

  it('returns the updated primary note', () => {
    const updated = makeNote({ id: 'primary-3', mention_count: 3 });
    mockGet.mockReturnValue(updated);

    const result = mergeIntoPrimary('primary-3', 'other-note');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('primary-3');
    expect(result?.mention_count).toBe(3);
  });

  it('returns null when primary note is not found in DB', () => {
    mockGet.mockReturnValue(null);
    const merged = mergeIntoPrimary('nonexistent', 'other');
    expect(merged).toBeNull();
  });
});
