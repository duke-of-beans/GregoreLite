/**
 * SubwayBranch — Sprint 11.5 (Z2 Subway View)
 *
 * Renders a branch fork/merge on the subway track.
 * Active branches render as solid; abandoned branches as dashed gray.
 * Branch angles off at ~20px vertical offset from the main trunk.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.6
 */

'use client';

export interface BranchSegment {
  /** X coordinate of fork point */
  forkX: number;
  /** X coordinate where branch ends (or rejoins trunk) */
  endX: number;
  /** Y of main trunk */
  trunkY: number;
  /** Whether this branch is active (user continued from it) */
  isActive: boolean;
  /** Label shown at fork point */
  label?: string;
}

export interface SubwayBranchProps {
  segment: BranchSegment;
}

const BRANCH_OFFSET = 20; // vertical px offset from trunk

export function SubwayBranch({ segment }: SubwayBranchProps) {
  const { forkX, endX, trunkY, isActive, label } = segment;
  const branchY = trunkY - BRANCH_OFFSET;

  // SVG cubic bezier: fork point curves up to branch Y, then runs straight
  const curveWidth = Math.min(24, (endX - forkX) * 0.3);
  const d = [
    `M ${forkX} ${trunkY}`,
    `C ${forkX + curveWidth} ${trunkY} ${forkX + curveWidth} ${branchY} ${forkX + curveWidth * 2} ${branchY}`,
    `L ${endX - curveWidth * 2} ${branchY}`,
    `C ${endX - curveWidth} ${branchY} ${endX - curveWidth} ${trunkY} ${endX} ${trunkY}`,
  ].join(' ');

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={isActive ? 'var(--frost)' : 'var(--shadow)'}
        strokeWidth={isActive ? 2 : 1.5}
        strokeDasharray={isActive ? undefined : '4 3'}
        opacity={isActive ? 0.5 : 0.3}
      />
      {/* Fork label */}
      {label && (
        <text
          x={forkX + 4}
          y={branchY - 4}
          fontSize={8}
          fill="var(--mist)"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {label}
        </text>
      )}
    </g>
  );
}
