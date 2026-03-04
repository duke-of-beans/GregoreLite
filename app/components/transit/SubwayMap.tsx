/**
 * SubwayMap — Sprint 11.5 (Z2 Subway View)
 *
 * Horizontal SVG subway map showing conversation topology as stations
 * connected by transit lines. Stations are auto-generated from event
 * registry config — nothing hardcoded.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.3, §3.6
 *
 * NOTE: Full implementation built in Phase 2 (Task 9).
 * This stub satisfies TypeScript imports during Phase 1 checkpoint.
 */

'use client';

export interface SubwayMapProps {
  conversationId?: string | undefined;
  /** Height of the map container in pixels (default 120) */
  height?: number;
  /** Called when user clicks a station — scrolls to that message */
  onStationClick?: (messageIndex: number) => void;
}

export function SubwayMap({ conversationId, height = 120 }: SubwayMapProps) {
  if (!conversationId) return null;

  return (
    <div
      style={{
        width: '100%',
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--deep-space)',
        borderBottom: '1px solid var(--shadow)',
        color: 'var(--mist)',
        fontSize: 12,
      }}
      aria-label="Transit subway map"
    >
      {/* Phase 2 Task 9: SVG renderer renders here */}
    </div>
  );
}
