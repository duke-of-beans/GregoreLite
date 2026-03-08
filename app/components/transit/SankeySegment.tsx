'use client';
/**
 * SankeySegment — Sprint 11.6 (Z1 Sankey View)
 *
 * Rounded rect node representing a conversation segment between stations.
 * Fill: qualityColor at 20% opacity. Border: qualityColor at 80%.
 * Abandoned branches: gray, dashed, 50% opacity.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.5
 */


import { useState } from 'react';
import type { SankeyNode } from '@/lib/transit/sankey';

export interface SankeySegmentProps {
  node: SankeyNode;
  x: number;
  y: number;
  width: number;
  height: number;
  qualityColor: string;
  isActive: boolean;
  onClick: () => void;
}

/** Truncate label to fit inside the node rect */
function truncateLabel(label: string, maxChars: number): string {
  if (label.length <= maxChars) return label;
  return label.slice(0, maxChars - 1) + '\u2026';
}

export function SankeySegment({
  node,
  x,
  y,
  width,
  height,
  qualityColor,
  isActive,
  onClick,
}: SankeySegmentProps) {
  const [hovered, setHovered] = useState(false);

  const isAbandoned = node.branchId !== null && !isActive;
  const fillColor = isAbandoned ? 'var(--shadow)' : qualityColor;
  const borderColor = isAbandoned ? 'var(--mist)' : qualityColor;
  const maxLabelChars = Math.max(4, Math.floor(width / 7));

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`Segment: ${node.label} — ${node.messageCount} messages, ${node.tokenCount.toLocaleString()} tokens`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      {/* Background rect */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={fillColor}
        fillOpacity={isAbandoned ? 0.15 : 0.2}
        stroke={borderColor}
        strokeWidth={hovered ? 2 : 1}
        strokeOpacity={isAbandoned ? 0.4 : 0.8}
        strokeDasharray={isAbandoned ? '4 3' : undefined}
        opacity={isAbandoned ? 0.5 : 1}
        style={{ transition: 'stroke-width 0.15s ease, opacity 0.15s ease, fill-opacity 0.15s ease' }}
      />

      {/* Label */}
      <text
        x={x + width / 2}
        y={y + height / 2 - (hovered ? 4 : 0)}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={500}
        fill={isAbandoned ? 'var(--mist)' : 'var(--ice-white)'}
        opacity={isAbandoned ? 0.6 : 0.9}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {truncateLabel(node.label, maxLabelChars)}
      </text>

      {/* Hover metrics */}
      {hovered && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="var(--mist)"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {node.messageCount} msgs · {node.tokenCount.toLocaleString()} tok · {node.dominantModel}
        </text>
      )}

      {/* Tooltip (native SVG title) */}
      <title>
        {`${node.label}\n${node.messageCount} messages (${node.messageIndexStart}–${node.messageIndexEnd})\n${node.tokenCount.toLocaleString()} tokens · ${node.dominantModel}\nQuality: ${node.qualitySignal}${node.branchId ? '\nBranch: ' + (isActive ? 'active' : 'abandoned') : ''}`}
      </title>
    </g>
  );
}
