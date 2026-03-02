/**
 * War Room — Core Types
 *
 * GraphNode/GraphEdge are the War Room's view of a manifest.
 * graph-builder.ts translates raw KERNL manifests table rows into this shape.
 *
 * Sprint 2E — Dependency Graph UI
 */

// ─── Node status ──────────────────────────────────────────────────────────────
// Subset of JobState mapped for display — spawning/working/validating collapse
// into 'running'; completed maps to 'complete' to keep the UI vocabulary clean.
export type NodeStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'partial'
  | 'failed'
  | 'interrupted';

// ─── Graph primitives ─────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;          // manifest_id
  title: string;
  status: NodeStatus;
  taskType: string;
  costUsd?: number;
  tokensUsed?: number;
  createdAt: number;   // epoch ms
  eosScore?: number;   // health score from EoS post-job scan (Sprint 5A/5C)
}

export interface GraphEdge {
  from: string;   // manifest_id that must complete first
  to: string;     // manifest_id that depends on `from`
}

export interface WarRoomGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Raw row from /api/kernl/manifests ───────────────────────────────────────

export interface ManifestRow {
  id: string;
  title: string | null;
  status: string;
  task_type: string | null;
  dependencies: string | null; // JSON array of manifest IDs
  result_report: string | null;
  tokens_used: number;
  cost_usd: number;
  created_at: string;          // ISO timestamp
}

// ─── Position (dagre output) ─────────────────────────────────────────────────

export interface NodePosition {
  x: number;
  y: number;
}

export type PositionMap = Record<string, NodePosition>;
