/**
 * DependencyGraph — SVG canvas rendering the full dependency graph.
 * Uses dagre for layout (layoutGraph), JobNode for nodes, JobEdge for edges.
 * Sprint 2E — Dependency Graph UI
 */

'use client';

import { useMemo } from 'react';
import {
  layoutGraph,
  computeCanvasSize,
  NODE_WIDTH,
  NODE_HEIGHT,
} from '@/lib/war-room/graph-builder';
import type { WarRoomGraph } from '@/lib/war-room/types';
import { JobNode } from './JobNode';
import { JobEdge } from './JobEdge';

export interface DependencyGraphProps {
  graph: WarRoomGraph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DependencyGraph({ graph, selectedId, onSelect }: DependencyGraphProps) {
  const positions = useMemo(() => layoutGraph(graph), [graph]);
  const { width, height } = useMemo(
    () => computeCanvasSize(positions),
    [positions],
  );

  return (
    <div className="h-full w-full overflow-auto">
      <svg
        width={width}
        height={height}
        aria-label="Dependency graph"
        role="img"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--muted)" fillOpacity={0.6} />
          </marker>
        </defs>

        {/* Edges first — rendered under nodes */}
        {graph.edges.map((edge) => {
          const fromPos = positions[edge.from];
          const toPos = positions[edge.to];
          if (!fromPos || !toPos) return null;
          return (
            <JobEdge
              key={`${edge.from}-${edge.to}`}
              from={fromPos}
              to={toPos}
              nodeWidth={NODE_WIDTH}
            />
          );
        })}

        {/* Nodes */}
        {graph.nodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;
          return (
            <JobNode
              key={node.id}
              node={node}
              position={pos}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              selected={selectedId === node.id}
              onClick={() => onSelect(node.id)}
            />
          );
        })}
      </svg>
    </div>
  );
}
