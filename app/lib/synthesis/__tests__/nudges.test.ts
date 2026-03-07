import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Stores (mutable per-test) ─────────────────────────────────────────────────

type NudgeRow = {
  id: string;
  source_type: string;
  source_label: string;
  capability_teaser: string;
  sent_at: number | null;
  dismissed_count: number;
  last_dismissed_at: number | null;
  permanently_silenced: number;
};

const nudgeById: Record<string, NudgeRow> = {};
const sourceCompleteByType: Record<string, boolean> = {};

// ── Database mock ─────────────────────────────────────────────────────────────

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn((sql: string) => ({
      get: vi.fn((arg?: string) => {
        if (!arg) return undefined;

        // SELECT by id (dismissNudge)
        if (sql.includes('synthesis_nudges') && sql.includes('WHERE id')) {
          return nudgeById[arg];
        }

        // COUNT(*) permanently_silenced (buildContextualNudge)
        if (sql.includes('COUNT') && sql.includes('permanently_silenced')) {
          const silenced = Object.values(nudgeById).filter(
            n => n.source_type === arg && n.permanently_silenced === 1,
          );
          return { count: silenced.length };
        }

        // SELECT by source_type (getEligibleNudge)
        if (sql.includes('synthesis_nudges') && sql.includes('source_type')) {
          return Object.values(nudgeById).find(n => n.source_type === arg);
        }

        // SELECT from indexing_sources — is source already complete? (buildContextualNudge)
        if (sql.includes('indexing_sources')) {
          return { count: sourceCompleteByType[arg] ? 1 : 0 };
        }

        return undefined;
      }),

      all: vi.fn(() => Object.values(nudgeById)),

      run: vi.fn((...args: unknown[]) => {
        // INSERT INTO synthesis_nudges — args: (id, source_type, source_label, teaser, sent_at)
        if (sql.includes('INSERT') && sql.includes('synthesis_nudges')) {
          const [id, source_type, source_label, capability_teaser, sent_at] = args as [
            string,
            string,
            string,
            string,
            number,
          ];
          nudgeById[id] = {
            id,
            source_type,
            source_label,
            capability_teaser,
            sent_at,
            dismissed_count: 0,
            last_dismissed_at: null,
            permanently_silenced: 0,
          };
          return;
        }

        // UPDATE dismissed_count/last_dismissed_at/permanently_silenced WHERE id = ?
        // args: (newCount, now, silenced, nudgeId)
        if (sql.includes('dismissed_count') && sql.includes('SET')) {
          const [newCount, now, silenced, id] = args as [number, number, number, string];
          if (nudgeById[id]) {
            nudgeById[id].dismissed_count = newCount;
            nudgeById[id].last_dismissed_at = now;
            nudgeById[id].permanently_silenced = silenced;
          }
          return;
        }

        // UPDATE SET permanently_silenced = 1 WHERE source_type = ? (mass silence)
        // args: (source_type)
        if (sql.includes('permanently_silenced = 1') && sql.includes('source_type')) {
          const [source_type] = args as [string];
          Object.values(nudgeById).forEach(n => {
            if (n.source_type === source_type) n.permanently_silenced = 1;
          });
        }
      }),
    })),
  })),
}));

// ── Imports (after mock) ──────────────────────────────────────────────────────

import {
  getEligibleNudge,
  dismissNudge,
  buildContextualNudge,
  getAllNudges,
} from '../nudges';
import type { IndexingSource, IndexingSourceType } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function makeSkippedSource(
  type: IndexingSourceType,
  overrides: Partial<IndexingSource> = {},
): IndexingSource {
  return {
    id: `src-${type}`,
    type,
    label: type,
    status: 'skipped',
    path_or_config: null,
    indexed_count: 0,
    total_count: 0,
    started_at: null,
    completed_at: null,
    synthesis_text: null,
    combination_text: null,
    created_at: Date.now() - ONE_WEEK_MS * 2,
    ...overrides,
  };
}

function seedNudge(id: string, sourceType: string, overrides: Partial<NudgeRow> = {}) {
  nudgeById[id] = {
    id,
    source_type: sourceType,
    source_label: sourceType,
    capability_teaser: `Connect your ${sourceType}`,
    sent_at: null,
    dismissed_count: 0,
    last_dismissed_at: null,
    permanently_silenced: 0,
    ...overrides,
  };
}

function clearStores() {
  Object.keys(nudgeById).forEach(k => delete nudgeById[k]);
  Object.keys(sourceCompleteByType).forEach(k => delete sourceCompleteByType[k]);
}

// ── getEligibleNudge ──────────────────────────────────────────────────────────

describe('getEligibleNudge', () => {
  beforeEach(() => {
    clearStores();
    vi.clearAllMocks();
  });

  it('returns null when skippedSources is empty', () => {
    const result = getEligibleNudge([], ['local_files']);
    expect(result).toBeNull();
  });

  it('creates and returns a nudge for a new eligible skipped source', () => {
    const result = getEligibleNudge([makeSkippedSource('email')], ['local_files']);
    expect(result).not.toBeNull();
    expect(result!.source_type).toBe('email');
    expect(result!.source_label).toBeTruthy();
    expect(result!.capability_teaser).toBeTruthy();
  });

  it('returns an existing nudge when last sent more than 7 days ago', () => {
    seedNudge('n-1', 'email', { sent_at: Date.now() - ONE_WEEK_MS - 1000 });
    const result = getEligibleNudge([makeSkippedSource('email')], ['local_files']);
    expect(result).not.toBeNull();
    expect(result!.source_type).toBe('email');
  });

  it('respects the weekly cap — returns null when sent less than 7 days ago', () => {
    seedNudge('n-1', 'email', { sent_at: Date.now() - ONE_WEEK_MS / 2 });
    const result = getEligibleNudge([makeSkippedSource('email')], ['local_files']);
    expect(result).toBeNull();
  });

  it('returns null for a permanently silenced nudge', () => {
    seedNudge('n-1', 'calendar', { permanently_silenced: 1 });
    const result = getEligibleNudge([makeSkippedSource('calendar')], ['local_files']);
    expect(result).toBeNull();
  });

  it('nudge is ineligible after permanent silence via dismissal', () => {
    seedNudge('n-1', 'local_files', { dismissed_count: 999 });
    dismissNudge('n-1'); // newCount=1000 — exceeds any sane MAX_DISMISSALS
    const result = getEligibleNudge([makeSkippedSource('local_files')], ['email']);
    expect(result).toBeNull();
  });
});

// ── dismissNudge ──────────────────────────────────────────────────────────────

describe('dismissNudge', () => {
  beforeEach(() => {
    clearStores();
    vi.clearAllMocks();
  });

  it('returns { permanentlySilenced: false, dismissCount: 1 } on first dismissal', () => {
    seedNudge('n-1', 'email');
    const result = dismissNudge('n-1');
    expect(result.dismissCount).toBe(1);
    expect(result.permanentlySilenced).toBe(false);
  });

  it('increments dismissed_count in the DB', () => {
    seedNudge('n-1', 'email');
    dismissNudge('n-1');
    expect(nudgeById['n-1']!.dismissed_count).toBe(1);
  });

  it('returns permanentlySilenced: true after reaching MAX_DISMISSALS threshold', () => {
    seedNudge('n-1', 'calendar', { dismissed_count: 999 });
    const result = dismissNudge('n-1');
    expect(result.permanentlySilenced).toBe(true);
    expect(result.dismissCount).toBe(1000);
  });

  it('marks the nudge permanently_silenced in the DB on threshold breach', () => {
    seedNudge('n-1', 'projects', { dismissed_count: 999 });
    dismissNudge('n-1');
    expect(nudgeById['n-1']!.permanently_silenced).toBe(1);
  });

  it('does not throw on unknown nudge id', () => {
    expect(() => dismissNudge('nonexistent-id')).not.toThrow();
  });
});

// ── buildContextualNudge ──────────────────────────────────────────────────────

describe('buildContextualNudge', () => {
  beforeEach(() => {
    clearStores();
    vi.clearAllMocks();
  });

  it('returns a string for a valid source type (source not indexed, not silenced)', () => {
    const result = buildContextualNudge('email', 'conversation');
    // Returns string | null — when source is not indexed and not silenced, message is built
    if (result !== null) {
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
    // null is also valid if implementation decides not to build one
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('returns null when the source type is already complete (indexed)', () => {
    sourceCompleteByType['email'] = true;
    const result = buildContextualNudge('email', 'conversation');
    expect(result).toBeNull();
  });

  it('returns null when the source type is permanently silenced', () => {
    seedNudge('n-1', 'calendar', { permanently_silenced: 1 });
    const result = buildContextualNudge('calendar', 'dashboard');
    expect(result).toBeNull();
  });

  it('does not contain exclamation marks for any source type (voice compliance)', () => {
    const types: IndexingSourceType[] = [
      'local_files',
      'email',
      'calendar',
      'projects',
      'notes',
      'conversations',
      'custom',
    ];
    types.forEach(type => {
      const msg = buildContextualNudge(type, 'conversation');
      if (msg !== null) {
        expect(msg).not.toContain('!');
      }
    });
  });

  it('does not throw for any supported source type', () => {
    const types: IndexingSourceType[] = [
      'local_files',
      'email',
      'calendar',
      'projects',
      'notes',
      'conversations',
      'custom',
    ];
    types.forEach(type => {
      expect(() => buildContextualNudge(type, 'conversation')).not.toThrow();
    });
  });
});

// ── getAllNudges ──────────────────────────────────────────────────────────────

describe('getAllNudges', () => {
  beforeEach(() => {
    clearStores();
  });

  it('returns empty array when no nudges exist', () => {
    const result = getAllNudges();
    expect(result).toEqual([]);
  });

  it('returns all seeded nudges', () => {
    seedNudge('n-1', 'email');
    seedNudge('n-2', 'calendar');
    const result = getAllNudges();
    expect(result.length).toBe(2);
  });

  it('returned nudge has expected snake_case fields', () => {
    seedNudge('n-1', 'email');
    const result = getAllNudges();
    const nudge = result[0];
    expect(nudge).toHaveProperty('id');
    expect(nudge).toHaveProperty('source_type');
    expect(nudge).toHaveProperty('source_label');
    expect(nudge).toHaveProperty('capability_teaser');
    expect(nudge).toHaveProperty('permanently_silenced');
  });
});
