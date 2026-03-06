/**
 * Tests for app/lib/war-room/ — Sprint 2E
 *
 * Coverage:
 *   - graph-builder: buildGraph() status mapping, edge extraction,
 *     malformed dependencies JSON, missing nodes in edges (guard)
 *   - graph-builder: layoutGraph() returns positions for all nodes
 *   - graph-builder: computeCanvasSize() padding and empty-graph fallback
 *   - poller: startWarRoomPolling() fires onUpdate on first tick,
 *     skips onUpdate when graph unchanged, calls onError on fetch failure
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ManifestRow, WarRoomGraph } from '@/lib/war-room/types';

// ── fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeFetchOk(rows: ManifestRow[]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(rows),
  });
}

function makeFetchFail(status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Internal Server Error',
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function row(overrides: Partial<ManifestRow> = {}): ManifestRow {
  return {
    id: 'manifest-a',
    title: 'Test Job',
    status: 'completed',
    task_type: 'code',
    dependencies: '[]',
    result_report: null,
    tokens_used: 100,
    cost_usd: 0.0012,
    created_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── graph-builder ─────────────────────────────────────────────────────────────

describe('graph-builder', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  describe('buildGraph()', () => {
    it('maps completed → complete', async () => {
      makeFetchOk([row({ status: 'completed' })]);
      const { buildGraph } = await import('@/lib/war-room/graph-builder');
      const g = await buildGraph();
      expect(g.nodes[0]?.status).toBe('complete');
    }, 10_000);

    it('maps spawning/working/validating → running', async () => {
      const { buildGraph } = await import('@/lib/war-room/graph-builder');

      for (const raw of ['spawning', 'working', 'validating']) {
        makeFetchOk([row({ id: raw, status: raw })]);
        const g = await buildGraph();
        expect(g.nodes[0]?.status).toBe('running');
      }
    });

    it('maps pending/failed/interrupted unchanged', async () => {
      const { buildGraph } = await import('@/lib/war-room/graph-builder');

      for (const s of ['pending', 'failed', 'interrupted'] as const) {
        makeFetchOk([row({ id: s, status: s })]);
        const g = await buildGraph();
        expect(g.nodes[0]?.status).toBe(s);
      }
    });

    it('falls back to "pending" for unknown status strings', async () => {
      makeFetchOk([row({ status: 'bogus-state' })]);
      const { buildGraph } = await import('@/lib/war-room/graph-builder');
      const g = await buildGraph();
      expect(g.nodes[0]?.status).toBe('pending');
    });

    it('builds edges from dependencies JSON array', async () => {
      makeFetchOk([
        row({ id: 'a', dependencies: '[]' }),
        row({ id: 'b', dependencies: '["a"]' }),
      ]);
      const { buildGraph } = await import('@/lib/war-room/graph-builder');
      const g = await buildGraph();
      expect(g.edges).toHaveLength(1);
      expect(g.edges[0]).toEqual({ from: 'a', to: 'b' });
    });

    it('builds diamond pattern edges correctly', async () => {
      makeFetchOk([
        row({ id: 'a', dependencies: '[]' }),
        row({ id: 'b', dependencies: '["a"]' }),
        row({ id: 'c', dependencies: '["a"]' }),
        row({ id: 'd', dependencies: '["b","c"]' }),
      ]);
      const { buildGraph } = await import('@/lib/war-room/graph-builder');
      const g = await buildGraph();
      expect(g.edges).toHaveLength(4);
      expect(g.edges.find((e) => e.from === 'a' && e.to === 'b')).toBeTruthy();
      expect(g.edges.find((e) => e.from === 'a' && e.to === 'c')).toBeTruthy();
      expect(g.edges.find((e) => e.from === 'b' && e.to === 'd')).toBeTruthy();
      expect(g.edges.find((e) => e.from === 'c' && e.to === 'd')).toBeTruthy();
    });

    it('handles malformed dependencies JSON gracefully (empty edges)', async () => {
      makeFetchOk([row({ dependencies: 'not-valid-json' })]);
      const { buildGraph } = await import('@/lib/war-room/graph-builder');
      const g = await buildGraph();
      expect(g.edges).toHaveLength(0);
    });

    it('handles null dependencies gracefully', async () => {
      makeFetchOk([row({ dependencies: null })]);
      const { buildGraph } = await import('@/lib/war-room/graph-builder');
      const g = await buildGraph();
      expect(g.edges).toHaveLength(0);
    });

    it('sets node title to "Untitled" when title is null', async () => {
      makeFetchOk([row({ title: null })]);
      const { buildGraph } = await import('@/lib/war-room/graph-builder');
      const g = await buildGraph();
      expect(g.nodes[0]?.title).toBe('Untitled');
    });

    it('throws on non-OK fetch response', async () => {
      makeFetchFail(503);
      const { buildGraph } = await import('@/lib/war-room/graph-builder');
      await expect(buildGraph()).rejects.toThrow('503');
    });

    it('returns empty nodes and edges for empty manifests table', async () => {
      makeFetchOk([]);
      const { buildGraph } = await import('@/lib/war-room/graph-builder');
      const g = await buildGraph();
      expect(g.nodes).toHaveLength(0);
      expect(g.edges).toHaveLength(0);
    });
  });

  describe('layoutGraph()', () => {
    it('returns positions for every node', async () => {
      const { layoutGraph } = await import('@/lib/war-room/graph-builder');
      const graph: WarRoomGraph = {
        nodes: [
          { id: 'a', title: 'A', status: 'pending', taskType: 'code', createdAt: 0 },
          { id: 'b', title: 'B', status: 'running', taskType: 'code', createdAt: 0 },
        ],
        edges: [{ from: 'a', to: 'b' }],
      };
      const positions = layoutGraph(graph);
      expect(positions['a']).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
      expect(positions['b']).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    });

    it('layouts left-to-right: node with no deps has smaller x', async () => {
      const { layoutGraph } = await import('@/lib/war-room/graph-builder');
      const graph: WarRoomGraph = {
        nodes: [
          { id: 'root', title: 'Root', status: 'complete', taskType: 'code', createdAt: 0 },
          { id: 'child', title: 'Child', status: 'pending', taskType: 'code', createdAt: 0 },
        ],
        edges: [{ from: 'root', to: 'child' }],
      };
      const pos = layoutGraph(graph);
      // LR layout: root should be left (smaller x) of child
      expect(pos['root']!.x).toBeLessThan(pos['child']!.x);
    });

    it('silently skips edges where an endpoint node is missing', async () => {
      const { layoutGraph } = await import('@/lib/war-room/graph-builder');
      const graph: WarRoomGraph = {
        nodes: [
          { id: 'a', title: 'A', status: 'pending', taskType: 'code', createdAt: 0 },
        ],
        // edge references 'ghost' which doesn't exist in nodes
        edges: [{ from: 'a', to: 'ghost' }],
      };
      expect(() => layoutGraph(graph)).not.toThrow();
      const positions = layoutGraph(graph);
      expect(positions['a']).toBeDefined();
    });
  });

  describe('computeCanvasSize()', () => {
    it('returns fallback dimensions for empty position map', async () => {
      const { computeCanvasSize } = await import('@/lib/war-room/graph-builder');
      const size = computeCanvasSize({});
      expect(size.width).toBeGreaterThanOrEqual(400);
      expect(size.height).toBeGreaterThanOrEqual(300);
    });

    it('accounts for node dimensions and padding', async () => {
      const { computeCanvasSize, NODE_WIDTH, NODE_HEIGHT } = await import('@/lib/war-room/graph-builder');
      const positions = { a: { x: 200, y: 100 } };
      const size = computeCanvasSize(positions);
      expect(size.width).toBeGreaterThan(200 + NODE_WIDTH / 2);
      expect(size.height).toBeGreaterThan(100 + NODE_HEIGHT / 2);
    });
  });
});

// ── poller ────────────────────────────────────────────────────────────────────

describe('startWarRoomPolling()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onUpdate immediately on first tick', async () => {
    makeFetchOk([row()]);
    const { startWarRoomPolling } = await import('@/lib/war-room/poller');
    const onUpdate = vi.fn();
    const stop = startWarRoomPolling(onUpdate);

    // Flush the immediate async tick (advance 0ms + drain microtasks)
    await vi.advanceTimersByTimeAsync(0);

    expect(onUpdate).toHaveBeenCalledOnce();
    stop();
  });

  it('calls onError when fetch fails', async () => {
    makeFetchFail();
    const { startWarRoomPolling } = await import('@/lib/war-room/poller');
    const onError = vi.fn();
    const stop = startWarRoomPolling(vi.fn(), onError);

    await vi.advanceTimersByTimeAsync(0);

    expect(onError).toHaveBeenCalledOnce();
    stop();
  });

  it('does not call onUpdate again when graph is unchanged', async () => {
    const rows = [row()];
    makeFetchOk(rows);
    makeFetchOk(rows); // second poll tick — same data

    const { startWarRoomPolling } = await import('@/lib/war-room/poller');
    const onUpdate = vi.fn();
    const stop = startWarRoomPolling(onUpdate);

    // First tick — drain initial async tick
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).toHaveBeenCalledOnce();

    // Advance exactly 5s → fires setInterval callback, then drain its async work
    await vi.advanceTimersByTimeAsync(5000);

    // Still only once — data unchanged
    expect(onUpdate).toHaveBeenCalledOnce();
    stop();
  });

  it('calls onUpdate again when graph changes', async () => {
    makeFetchOk([row({ status: 'pending' })]);
    makeFetchOk([row({ status: 'completed' })]);

    const { startWarRoomPolling } = await import('@/lib/war-room/poller');
    const onUpdate = vi.fn();
    const stop = startWarRoomPolling(onUpdate);

    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(5000);

    expect(onUpdate).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stop() prevents further onUpdate calls', async () => {
    makeFetchOk([row()]);
    makeFetchOk([row({ status: 'failed' })]);

    const { startWarRoomPolling } = await import('@/lib/war-room/poller');
    const onUpdate = vi.fn();
    const stop = startWarRoomPolling(onUpdate);

    await vi.advanceTimersByTimeAsync(0);
    stop(); // stop before second tick

    await vi.advanceTimersByTimeAsync(5000);

    expect(onUpdate).toHaveBeenCalledOnce();
  });
});
