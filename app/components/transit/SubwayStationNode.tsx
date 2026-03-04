/**
 * SubwayStationNode — Sprint 11.5 (Z2 Subway View)
 *
 * Renders a single station: circle + label below.
 * Active station gets a highlighted ring.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.3, §3.6
 */

'use client';

import type { Station } from '@/lib/transit/types';

export interface SubwayStationNodeProps {
  station: Station;
  cx: number;
  cy: number;
  isActive: boolean;
  onClick: (station: Station) => void;
}

const RADIUS = 8;
const ACTIVE_RING = 13;

export function SubwayStationNode({
  station,
  cx,
  cy,
  isActive,
  onClick,
}: SubwayStationNodeProps) {
  // Truncate label to avoid overlap at high station density
  const label = station.icon + ' ' + (
    station.name.length > 18 ? station.name.slice(0, 16) + '…' : station.name
  );

  return (
    <g
      onClick={() => onClick(station)}
      style={{ cursor: 'pointer' }}
      role="button"
      aria-label={`Station: ${station.name}`}
    >
      {/* Active highlight ring */}
      {isActive && (
        <circle
          cx={cx}
          cy={cy}
          r={ACTIVE_RING}
          fill="none"
          stroke="var(--cyan)"
          strokeWidth={1.5}
          opacity={0.6}
        />
      )}

      {/* Station circle */}
      <circle
        cx={cx}
        cy={cy}
        r={RADIUS}
        fill={isActive ? 'var(--cyan)' : 'var(--elevated)'}
        stroke={isActive ? 'var(--cyan)' : 'var(--frost)'}
        strokeWidth={isActive ? 0 : 1.5}
      />

      {/* Label below the circle */}
      <text
        x={cx}
        y={cy + RADIUS + 13}
        textAnchor="middle"
        fontSize={9}
        fill={isActive ? 'var(--ice-white)' : 'var(--frost)'}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}
