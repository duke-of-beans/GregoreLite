/**
 * SubwayMarkerDot — Sprint 11.5 (Z2 Subway View)
 *
 * Small colored dot rendered on the track between stations for
 * non-station events. Shape/color read from registry config.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.2, §3.6
 */

'use client';

import type { EnrichedEvent } from '@/lib/transit/types';

export interface SubwayMarkerDotProps {
  event: EnrichedEvent;
  cx: number;
  cy: number;
  onClick: (eventId: string) => void;
}

/** Z2 dot sizes — smaller than Z3 marker sizes (spec §3.2) */
function dotRadius(size: string): number {
  switch (size) {
    case 'small':    return 3;
    case 'medium':   return 4;
    case 'large':    return 5;
    case 'landmark': return 6;
    default:         return 3;
  }
}

export function SubwayMarkerDot({ event, cx, cy, onClick }: SubwayMarkerDotProps) {
  const marker = event.config?.marker;
  if (!marker) return null;

  const r = dotRadius(marker.size);
  const label = event.config?.name ?? event.event_type;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={marker.color}
      opacity={0.8}
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(event.id)}
      role="button"
      aria-label={`Event: ${label}`}
    >
      <title>{label}</title>
    </circle>
  );
}
