import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Row store (mutable per-test) ──────────────────────────────────────────────

type SourceRow = {
  id: string;
  type: string;
  label: string;
  status: string;
  path_or_config: string | null;
  indexed_count: number;
  total_count: number | null;
  started_at: number | null;
  completed_at: number | null;
  synthesis_text: string | null;
  combination_text: string | null;
  created_at: number;
};

const rowStore: Record<string, SourceRow> = {};

// ── Database mock ─────────────────────────────────────────────────────────────

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn((sql: string) => ({
      get: vi.fn((arg?: string) => {
        // Aggregate query — _checkAllComplete / similar (called with no arg)
        if (arg === undefined) {
          if (sql.includes('SUM') || (sql.includes('COUNT') && !sql.includes('WHERE'))) {
            const rows = Object.values(rowStore);
            const pending = rows.filter(r =>
              ['pending', 'indexing'].includes(r.status),
            ).length;
            const complete = rows.filter(r => r.status === 'complete').length;
            return { pending, complete };
          }
          return undefined;
        }

        // SELECT by id — works for all "WHERE id = ?" queries
        if (sql.includes('WHERE id')) return rowStore[arg] ?? undefined;

        return undefined;
      }),

      all: vi.fn(() => {
        const rows = Object.values(rowStore);
        if (sql.includes("WHERE status = 'complete'")) {
          return rows.filter(r => r.status === 'complete');
        }
        return rows;
      }),

      run: vi.fn((...args: unknown[]) => {
        // INSERT INTO indexing_sources
        // args: (id, type, label, path_or_config, created_at)
        // status='pending' and indexed_count=0 are hardcoded in SQL
        if (sql.includes('INSERT INTO indexing_sources')) {
          const [id, type, label, path_or_config, created_at] = args as [
            string,
            string,
            string,
            string | null,
            number,
          ];
          rowStore[id] = {
            id,
            type,
            label,
            status: 'pending',
            path_or_config,
            indexed_count: 0,
            total_count: null,
            started_at: null,
            completed_at: null,
            synthesis_text: null,
            combination_text: null,
            created_at,
          };
          return;
        }

        // UPDATE SET status = 'skipped' WHERE id = ?
        // args: (sourceId)
        if (sql.includes("status = 'skipped'")) {
          const [id] = args as [string];
          if (rowStore[id]) rowStore[id].status = 'skipped';
          return;
        }

        // UPDATE SET status = 'indexing', started_at = ? WHERE id = ?
        // args: (started_at, sourceId)
        if (sql.includes("status = 'indexing'")) {
          const [started_at, id] = args as [number, string];
          if (rowStore[id]) {
            rowStore[id].status = 'indexing';
            rowStore[id].started_at = started_at;
          }
          return;
        }

        // UPDATE SET status = 'complete', completed_at = ? WHERE id = ?
        // args: (completed_at, sourceId)
        if (sql.includes("status = 'complete'")) {
          const [completed_at, id] = args as [number, string];
          if (rowStore[id]) {
            rowStore[id].status = 'complete';
            rowStore[id].completed_at = completed_at;
          }
          return;
        }

        // UPDATE SET status = 'error' WHERE id = ?
        // args: (sourceId)
        if (sql.includes("status = 'error'")) {
          const [id] = args as [string];
          if (rowStore[id]) rowStore[id].status = 'error';
          return;
        }

        // UPDATE SET indexed_count = ?, [total_count = ?] WHERE id = ?
        if (sql.includes('indexed_count') && sql.includes('SET')) {
          if (sql.includes('total_count')) {
            const [indexed_count, total_count, id] = args as [number, number, string];
            if (rowStore[id]) {
              rowStore[id].indexed_count = indexed_count;
              rowStore[id].total_count = total_count;
            }
          } else {
            const [indexed_count, id] = args as [number, string];
            if (rowStore[id]) rowStore[id].indexed_count = indexed_count;
          }
          return;
        }

        // UPDATE SET synthesis_text / combination_text — after synthesis generation
        if (sql.includes('synthesis_text') && sql.includes('SET')) {
          const id = args[args.length - 1] as string;
          if (rowStore[id] && typeof args[0] === 'string') {
            rowStore[id].synthesis_text = args[0];
          }
          return;
        }

        // Ignore all other SQL (telemetry INSERTs, etc.)
      }),
    })),
  })),
}));

// ── Generator / master mocks ──────────────────────────────────────────────────

vi.mock('../generator', () => ({
  generateSourceSynthesis: vi.fn().mockResolvedValue({
    sourceId: 'src-1',
    sourceSynthesis: 'Organised by quarter.',
    combinationSynthesis: 'Overlaps with email patterns.',
    capabilitiesUnlocked: ['Cross-source timeline'],
  }),
}));

vi.mock('../master', () => ({
  generateMasterSynthesis: vi.fn().mockResolvedValue({
    id: 'ms-1',
    overview: 'I see you now.',
    patterns: ['Ships weekly'],
    insights: ['Morning energy spike'],
    blind_spots: ['Recovery underweighted'],
    capability_summary: 'Can predict sprint velocity.',
    sources_used: ['src-1'],
    generated_at: Date.now(),
    status: 'ready',
  }),
  loadMasterSynthesis: vi.fn().mockReturnValue(null),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { IndexingOrchestrator } from '../orchestrator';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IndexingOrchestrator', () => {
  let orchestrator: IndexingOrchestrator;

  beforeEach(() => {
    Object.keys(rowStore).forEach(k => delete rowStore[k]);
    vi.clearAllMocks();
    orchestrator = new IndexingOrchestrator();
  });

  // ── addSource ───────────────────────────────────────────────────────────────

  describe('addSource', () => {
    it('returns a source with pending status', () => {
      const source = orchestrator.addSource('local_files', null, 'My Documents');
      expect(source.status).toBe('pending');
      expect(source.type).toBe('local_files');
      expect(source.label).toBe('My Documents');
    });

    it('assigns a unique id to each source', () => {
      const a = orchestrator.addSource('local_files', null, 'Docs');
      const b = orchestrator.addSource('email', null, 'Gmail');
      expect(a.id).not.toBe(b.id);
    });

    it('persists the source to the database', () => {
      orchestrator.addSource('calendar', null, 'Google Cal');
      expect(Object.keys(rowStore).length).toBeGreaterThan(0);
    });

    it('returned source has zero indexed_count', () => {
      const source = orchestrator.addSource('local_files', null, 'Docs');
      expect(source.indexed_count).toBe(0);
    });
  });

  // ── skipSource ──────────────────────────────────────────────────────────────

  describe('skipSource', () => {
    it('marks source as skipped in getProgress', () => {
      const source = orchestrator.addSource('email', null, 'Gmail');
      orchestrator.skipSource(source.id);
      const progress = orchestrator.getProgress();
      const skipped = progress.sources.find(s => s.id === source.id);
      expect(skipped?.status).toBe('skipped');
    });

    it('does not throw on unknown source id', () => {
      expect(() => orchestrator.skipSource('nonexistent')).not.toThrow();
    });
  });

  // ── startIndexing ────────────────────────────────────────────────────────────

  describe('startIndexing', () => {
    it('transitions source from pending to indexing', () => {
      const source = orchestrator.addSource('local_files', null, 'Docs');
      orchestrator.startIndexing(source.id);
      const progress = orchestrator.getProgress();
      const updated = progress.sources.find(s => s.id === source.id);
      expect(updated?.status).toBe('indexing');
    });
  });

  // ── updateProgress ───────────────────────────────────────────────────────────

  describe('updateProgress', () => {
    it('updates indexed_count on the source', () => {
      const source = orchestrator.addSource('local_files', null, 'Docs');
      orchestrator.startIndexing(source.id);
      orchestrator.updateProgress(source.id, 42, 200);
      const progress = orchestrator.getProgress();
      const updated = progress.sources.find(s => s.id === source.id);
      expect(updated?.indexed_count).toBe(42);
    });

    it('accepts optional totalCount argument without throwing', () => {
      const source = orchestrator.addSource('local_files', null, 'Docs');
      orchestrator.startIndexing(source.id);
      expect(() => orchestrator.updateProgress(source.id, 10)).not.toThrow();
    });
  });

  // ── onSourceComplete ─────────────────────────────────────────────────────────

  describe('onSourceComplete', () => {
    it('marks source status as complete', () => {
      const source = orchestrator.addSource('projects', null, 'Jira');
      orchestrator.startIndexing(source.id);
      orchestrator.onSourceComplete(source.id);
      const progress = orchestrator.getProgress();
      const updated = progress.sources.find(s => s.id === source.id);
      expect(updated?.status).toBe('complete');
    });

    it('fires generateSourceSynthesis asynchronously', async () => {
      const { generateSourceSynthesis } = await import('../generator');
      const source = orchestrator.addSource('local_files', null, 'Docs');
      orchestrator.startIndexing(source.id);
      orchestrator.onSourceComplete(source.id);

      await new Promise(r => setTimeout(r, 50));
      expect(vi.mocked(generateSourceSynthesis)).toHaveBeenCalledWith(
        expect.objectContaining({ id: source.id }),
        expect.any(Array),
      );
    });
  });

  // ── onSourceError ────────────────────────────────────────────────────────────

  describe('onSourceError', () => {
    it('marks source status as error', () => {
      const source = orchestrator.addSource('local_files', null, 'Docs');
      orchestrator.startIndexing(source.id);
      orchestrator.onSourceError(source.id, 'Permission denied');
      const progress = orchestrator.getProgress();
      const updated = progress.sources.find(s => s.id === source.id);
      expect(updated?.status).toBe('error');
    });

    it('does not throw on unknown source id', () => {
      expect(() => orchestrator.onSourceError('nonexistent', 'boom')).not.toThrow();
    });
  });

  // ── getProgress ──────────────────────────────────────────────────────────────

  describe('getProgress', () => {
    it('returns SynthesisProgress with a sources array', () => {
      const progress = orchestrator.getProgress();
      expect(progress).toHaveProperty('sources');
      expect(Array.isArray(progress.sources)).toBe(true);
    });

    it('reflects all added sources', () => {
      orchestrator.addSource('local_files', null, 'Docs');
      orchestrator.addSource('email', null, 'Gmail');
      const progress = orchestrator.getProgress();
      expect(progress.sources.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── master synthesis auto-trigger ────────────────────────────────────────────

  describe('master synthesis auto-trigger', () => {
    it('calls generateMasterSynthesis when all non-skipped sources complete', async () => {
      const { generateMasterSynthesis } = await import('../master');

      const s1 = orchestrator.addSource('local_files', null, 'Docs');
      const s2 = orchestrator.addSource('email', null, 'Gmail');

      orchestrator.startIndexing(s1.id);
      orchestrator.onSourceComplete(s1.id);

      orchestrator.startIndexing(s2.id);
      orchestrator.onSourceComplete(s2.id);

      await new Promise(r => setTimeout(r, 50));
      expect(vi.mocked(generateMasterSynthesis)).toHaveBeenCalled();
    });

    it('does not call generateMasterSynthesis while a source is still pending', async () => {
      const { generateMasterSynthesis } = await import('../master');

      const s1 = orchestrator.addSource('local_files', null, 'Docs');
      orchestrator.addSource('email', null, 'Gmail'); // s2 stays pending

      orchestrator.startIndexing(s1.id);
      orchestrator.onSourceComplete(s1.id);

      await new Promise(r => setTimeout(r, 20));
      expect(vi.mocked(generateMasterSynthesis)).not.toHaveBeenCalled();
    });

    it('fires exactly once after both sources complete', async () => {
      const { generateMasterSynthesis } = await import('../master');

      const s1 = orchestrator.addSource('local_files', null, 'Docs');
      const s2 = orchestrator.addSource('email', null, 'Gmail');

      orchestrator.startIndexing(s1.id);
      orchestrator.onSourceComplete(s1.id);
      orchestrator.startIndexing(s2.id);
      orchestrator.onSourceComplete(s2.id);

      await new Promise(r => setTimeout(r, 50));
      expect(vi.mocked(generateMasterSynthesis)).toHaveBeenCalled();
    });
  });

  // ── generateMasterNow ────────────────────────────────────────────────────────

  describe('generateMasterNow', () => {
    it('calls generateMasterSynthesis immediately regardless of source state', async () => {
      const { generateMasterSynthesis } = await import('../master');
      orchestrator.addSource('local_files', null, 'Docs');
      await orchestrator.generateMasterNow();
      expect(vi.mocked(generateMasterSynthesis)).toHaveBeenCalled();
    });
  });

  // ── telemetry helpers ────────────────────────────────────────────────────────

  describe('telemetry helpers', () => {
    it('recordReadTime does not throw', () => {
      expect(() => orchestrator.recordReadTime('src-1', 4500)).not.toThrow();
    });

    it('recordEarlyExit does not throw', () => {
      expect(() => orchestrator.recordEarlyExit()).not.toThrow();
    });

    it('recordNudgeConversion does not throw', () => {
      expect(() =>
        orchestrator.recordNudgeConversion('email' as Parameters<
          typeof orchestrator.recordNudgeConversion
        >[0]),
      ).not.toThrow();
    });
  });
});
