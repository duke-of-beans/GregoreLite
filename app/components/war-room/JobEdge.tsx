'use client';
/**
 * JobEdge — SVG path + arrowhead between two dependency nodes.
 * Draws a cubic bezier from the right edge of `from` to the left edge of `to`.
 * Sprint 2E — Dependency Graph UI
 */


export interface JobEdgeProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  nodeWidth: number;
}

export function JobEdge({ from, to, nodeWidth }: JobEdgeProps) {
  // Connect right-center of source → left-center of target
  const x1 = from.x + nodeWidth / 2;
  const y1 = from.y;
  const x2 = to.x - nodeWidth / 2;
  const y2 = to.y;

  // Control points for a smooth horizontal bezier
  const cp = Math.abs(x2 - x1) * 0.5;
  const d = `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;

  // Suppress if positions overlap (guard for single-node or layout edge case)
  if (x1 >= x2 - 4) return null;

  return (
    <path
      d={d}
      fill="none"
      stroke="var(--muted)"
      strokeWidth={1.5}
      strokeOpacity={0.6}
      markerEnd="url(#arrowhead)"
      aria-hidden="true"
    />
  );
}
