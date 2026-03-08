'use client';
/**
 * SankeyLink — Sprint 11.6 (Z1 Sankey View)
 *
 * SVG cubic bezier path between two Sankey nodes.
 * strokeWidth proportional to token volume (min 2px, max 40px).
 * Visual consistency with SubwayBranch.tsx bezier curves.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.5
 */


export interface SankeyLinkProps {
  sourceX: number;
  sourceY: number;
  sourceHeight: number;
  targetX: number;
  targetY: number;
  targetHeight: number;
  /** strokeWidth in pixels (pre-calculated by parent) */
  width: number;
  color: string;
  opacity?: number;
  isAbandoned?: boolean;
  onClick?: () => void;
}

/**
 * Scale a token volume to a stroke width between MIN_WIDTH and MAX_WIDTH.
 * Exported for use by SankeyView layout.
 */
export const MIN_LINK_WIDTH = 2;
export const MAX_LINK_WIDTH = 40;

export function scaleLinkWidth(
  tokenVolume: number,
  maxTokenVolume: number,
): number {
  if (maxTokenVolume <= 0) return MIN_LINK_WIDTH;
  const ratio = tokenVolume / maxTokenVolume;
  return MIN_LINK_WIDTH + ratio * (MAX_LINK_WIDTH - MIN_LINK_WIDTH);
}

export function SankeyLink({
  sourceX,
  sourceY,
  sourceHeight: _sourceHeight,
  targetX,
  targetY,
  targetHeight: _targetHeight,
  width,
  color,
  opacity = 0.5,
  isAbandoned = false,
  onClick,
}: SankeyLinkProps) {
  // Cubic bezier: smooth horizontal flow from source right edge to target left edge
  // Control points at 40% of the horizontal distance for a natural curve
  const midX = (sourceX + targetX) / 2;

  const d = [
    `M ${sourceX} ${sourceY}`,
    `C ${midX} ${sourceY} ${midX} ${targetY} ${targetX} ${targetY}`,
  ].join(' ');

  return (
    <path
      d={d}
      fill="none"
      stroke={isAbandoned ? 'var(--mist)' : color}
      strokeWidth={Math.max(MIN_LINK_WIDTH, width)}
      strokeDasharray={isAbandoned ? '6 4' : undefined}
      opacity={isAbandoned ? 0.25 : opacity}
      style={{ cursor: onClick ? 'pointer' : undefined, transition: 'opacity 0.2s ease, stroke-width 0.15s ease' }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as SVGPathElement).style.opacity = String(Math.min(1, (isAbandoned ? 0.25 : opacity) + 0.2)); }}
      onMouseLeave={(e) => { (e.currentTarget as SVGPathElement).style.opacity = String(isAbandoned ? 0.25 : opacity); }}
      onClick={onClick}
    >
      <title>{`${Math.round(width)}px flow`}</title>
    </path>
  );
}
