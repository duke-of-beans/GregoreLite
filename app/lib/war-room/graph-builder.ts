/**
 * War Room — Graph Builder
 *
 * Fetches manifests from KERNL via /api/kernl/manifests and builds a
 * WarRoomGraph (nodes + edges). Handles status mapping from JobState
 * vocabulary to War Room display vocabulary.
 *
 * Sprint 2E — Dependency Graph UI
 */

import dagre from 'dagre';
import type {
  GraphEdge,
  GraphNode,
  ManifestRow,
  NodePosition,
  NodeStatus,
  PositionMap,
  WarRoomGraph,
} from './types';

// ─── Status mapping ───────────────────────────────────────────────────────────
// KERNL JobState → War Room NodeStatus

const STATUS_MAP: Record<string, NodeStatus> = {
  pending: 'pending',
  spawning: 'running',
  running: 'running',
  working: 'running',
  validating: 'running',
  completed: 'complete',
  failed: 'failed',
  interrupted: 'interrupted',
};

function mapStatus(raw: string): NodeStatus {
  return STATUS_MAP[raw.toLowerCase()] ?? 'pending';
}

// ─── Graph builder ────────────────────────────────────────────────────────────

export async function buildGraph(): Promise<WarRoomGraph> {
  const res = await fetch('/api/kernl/manifests');
  if (!res.ok) {
    throw new Error(`[graph-builder] fetch failed: ${res.status} ${res.statusText}`);
  }

  const rows = (await res.json()) as ManifestRow[];

  const nodes: GraphNode[] = rows.map((row) => {
    let eosScore: number | undefined;
    if (row.result_report) {
      try {
        const report = JSON.parse(row.result_report) as {
          quality_results?: { eos?: { healthScore?: number } };
        };
        const hs = report.quality_results?.eos?.healthScore;
        if (typeof hs === 'number') eosScore = hs;
      } catch {
        // malformed JSON — skip
      }
    }

    return {
      id: row.id,
      title: row.title ?? 'Untitled',
      status: mapStatus(row.status),
      taskType: row.task_type ?? 'unknown',
      costUsd: row.cost_usd ?? undefined,
      tokensUsed: row.tokens_used ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      ...(eosScore !== undefined && { eosScore }),
    };
  });

  const edges: GraphEdge[] = [];
  for (const row of rows) {
    let deps: string[] = [];
    try {
      deps = JSON.parse(row.dependencies ?? '[]') as string[];
    } catch {
      deps = [];
    }
    for (const dep of deps) {
      edges.push({ from: dep, to: row.id });
    }
  }

  return { nodes, edges };
}

// ─── Dagre layout ─────────────────────────────────────────────────────────────

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 60;

export function layoutGraph(
  graph: WarRoomGraph,
  nodeWidth = NODE_WIDTH,
  nodeHeight = NODE_HEIGHT,
): PositionMap {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }

  // Only add edges where both endpoints exist (guard against stale dep refs)
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
      g.setEdge(edge.from, edge.to);
    }
  }

  dagre.layout(g);

  const positions: PositionMap = {};
  for (const node of graph.nodes) {
    const pos = g.node(node.id) as NodePosition | undefined;
    if (pos) {
      positions[node.id] = { x: pos.x, y: pos.y };
    }
  }

  return positions;
}

// ─── SVG canvas size ──────────────────────────────────────────────────────────

export function computeCanvasSize(
  positions: PositionMap,
  nodeWidth = NODE_WIDTH,
  nodeHeight = NODE_HEIGHT,
  padding = 60,
): { width: number; height: number } {
  const xs = Object.values(positions).map((p) => p.x);
  const ys = Object.values(positions).map((p) => p.y);

  if (xs.length === 0) return { width: 800, height: 400 };

  const maxX = Math.max(...xs) + nodeWidth / 2 + padding;
  const maxY = Math.max(...ys) + nodeHeight / 2 + padding;

  return { width: Math.max(maxX, 400), height: Math.max(maxY, 300) };
}
