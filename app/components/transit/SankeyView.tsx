'use client';
/**
 * SankeyView — Sprint 11.6 (Z1 Sankey View)
 *
 * Main SVG Sankey visualization. Calls buildSankeyGraph() to transform
 * shared transitEvents into nodes + links, positions left-to-right using
 * the same proportional logic as SubwayMap's indexToX.
 *
 * Header bar: total tokens, cost, messages.
 * Click segment → parent handles zoom to Z2.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.5
 */


import { useMemo, useRef } from 'react';
import { generateStations } from '@/lib/transit/stations';
import { buildSankeyGraph, getQualityColor } from '@/lib/transit/sankey';
import type { SankeyNode } from '@/lib/transit/sankey';
import type { EnrichedEvent } from '@/lib/transit/types';
import { SankeySegment } from './SankeySegment';
import { SankeyLink, scaleLinkWidth } from './SankeyLink';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SankeyViewProps {
  events: EnrichedEvent[];
  totalMessages: number;
  height?: number;
  onSegmentClick: (node: SankeyNode) => void;
  onForkClick?: (forkEventId: string) => void;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const PADDING_X = 60;
// PADDING_Y reserved for future vertical layout adjustment
const NODE_GAP = 12;     // horizontal gap between nodes
const MIN_NODE_HEIGHT = 30;
const MAX_NODE_HEIGHT = 80;
const MIN_NODE_WIDTH = 60;
const BRANCH_OFFSET_Y = 70;  // vertical offset for branch nodes below trunk
const HEADER_HEIGHT = 36;

// ── Proportional X positioning (same logic as SubwayMap.indexToX) ─────────────

function indexToX(index: number, totalMessages: number, width: number): number {
  if (totalMessages <= 1) return width / 2;
  const usable = width - PADDING_X * 2;
  return PADDING_X + (index / (totalMessages - 1)) * usable;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SankeyView({
  events,
  totalMessages,
  height = 200,
  onSegmentClick,
  onForkClick,
}: SankeyViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate stations + Sankey graph (pure computation)
  const stations = useMemo(() => generateStations(events), [events]);
  const graph = useMemo(
    () => buildSankeyGraph(events, stations, totalMessages),
    [events, stations, totalMessages],
  );

  // SVG dimensions — expand for wide conversations
  const trunkNodes = graph.nodes.filter((n) => n.branchId === null);
  const svgWidth = Math.max(600, trunkNodes.length * 140 + PADDING_X * 2);
  const svgHeight = height - HEADER_HEIGHT;

  // Max token volume for link width scaling
  const maxTokenVol = Math.max(1, ...graph.links.map((l) => l.tokenVolume));

  // Node height proportional to tokenCount
  const maxNodeTokens = Math.max(1, ...graph.nodes.map((n) => n.tokenCount));

  // Layout: compute x, y, width, height for each node
  const nodeLayouts = useMemo(() => {
    const layouts = new Map<string, { x: number; y: number; w: number; h: number }>();
    const trunkY = svgHeight * 0.4;

    for (const node of graph.nodes) {
      const startX = indexToX(node.messageIndexStart, totalMessages, svgWidth);
      const endX = indexToX(node.messageIndexEnd, totalMessages, svgWidth);
      const w = Math.max(MIN_NODE_WIDTH, endX - startX - NODE_GAP);

      // Height proportional to token count
      const tokenRatio = maxNodeTokens > 0 ? node.tokenCount / maxNodeTokens : 0;
      const h = MIN_NODE_HEIGHT + tokenRatio * (MAX_NODE_HEIGHT - MIN_NODE_HEIGHT);

      const isBranch = node.branchId !== null;
      const y = isBranch ? trunkY + BRANCH_OFFSET_Y : trunkY - h / 2;

      layouts.set(node.id, { x: startX, y, w, h });
    }

    return layouts;
  }, [graph.nodes, totalMessages, svgWidth, svgHeight, maxNodeTokens]);

  if (totalMessages === 0) {
    return (
      <div
        style={{
          width: '100%',
          height,
          background: 'var(--deep-space)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--mist)',
          fontSize: 12,
        }}
      >
        No conversation data for Sankey view
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height,
        background: 'var(--deep-space)',
        borderBottom: '1px solid var(--shadow)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      aria-label="Transit Sankey view"
    >
      {/* ── Header bar ── */}
      <div
        style={{
          height: HEADER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 16px',
          borderBottom: '1px solid var(--shadow)',
          fontSize: 11,
          color: 'var(--mist)',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--frost)', fontWeight: 600 }}>Z1 Sankey</span>
        <span>{graph.totalMessages} messages</span>
        <span>{graph.totalTokens.toLocaleString()} tokens</span>
        <span>${graph.totalCost.toFixed(4)}</span>
      </div>

      {/* ── SVG canvas (horizontally scrollable) ── */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ display: 'block', minWidth: '100%' }}
        >
          {/* Links — render behind nodes */}
          {graph.links.map((link) => {
            const sourceLayout = nodeLayouts.get(link.sourceId);
            const targetLayout = nodeLayouts.get(link.targetId);
            if (!sourceLayout || !targetLayout) return null;

            const targetNode = graph.nodes.find((n) => n.id === link.targetId);
            const isAbandoned = targetNode?.branchId !== null &&
              targetNode?.qualitySignal === 'negative';

            return (
              <SankeyLink
                key={`${link.sourceId}-${link.targetId}`}
                sourceX={sourceLayout.x + sourceLayout.w}
                sourceY={sourceLayout.y + sourceLayout.h / 2}
                sourceHeight={sourceLayout.h}
                targetX={targetLayout.x}
                targetY={targetLayout.y + targetLayout.h / 2}
                targetHeight={targetLayout.h}
                width={scaleLinkWidth(link.tokenVolume, maxTokenVol)}
                color={link.qualityColor}
                isAbandoned={isAbandoned}
              />
            );
          })}

          {/* Nodes (segments) */}
          {graph.nodes.map((node) => {
            const layout = nodeLayouts.get(node.id);
            if (!layout) return null;

            const isActive = node.branchId === null ||
              node.qualitySignal !== 'negative';

            return (
              <SankeySegment
                key={node.id}
                node={node}
                x={layout.x}
                y={layout.y}
                width={layout.w}
                height={layout.h}
                qualityColor={getQualityColor(node.qualitySignal)}
                isActive={isActive}
                onClick={() => {
                  if (node.branchId && onForkClick) {
                    onForkClick(node.branchId);
                  } else {
                    onSegmentClick(node);
                  }
                }}
              />
            );
          })}

          {/* Empty state */}
          {graph.nodes.length <= 1 && graph.nodes[0]?.id === 'seg-empty' && (
            <text
              x={svgWidth / 2}
              y={svgHeight / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--mist)"
              opacity={0.5}
              style={{ userSelect: 'none' }}
            >
              Conversation topology appears as messages flow
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
