'use client';
/**
 * SubwayMap — Sprint 11.5 (Z2 Subway View)
 *
 * Horizontal SVG subway map showing conversation topology as named stations
 * connected by a transit line. Stations are auto-generated from event registry
 * config — nothing hardcoded in this renderer.
 *
 * Layout: proportional left-to-right by messageIndex / totalMessages.
 * Between-station dots for non-station events.
 * Branch segments rendered via SubwayBranch for fork/merge events.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.3, §3.6
 */


import { useMemo } from 'react';
import { generateStations } from '@/lib/transit/stations';
import type { EnrichedEvent, Station } from '@/lib/transit/types';
import { SubwayStationNode } from './SubwayStationNode';
import { SubwayMarkerDot } from './SubwayMarkerDot';
import { SubwayBranch, type BranchSegment } from './SubwayBranch';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SubwayMapProps {
  conversationId?: string | undefined;
  /** All enriched events for this conversation (from shared MessageList fetch) */
  events?: EnrichedEvent[] | undefined;
  /** Total message count for proportional positioning */
  totalMessages?: number;
  /** ID of the currently "active" station (nearest to scroll position) */
  activeStationId?: string | null;
  /** Height of the SVG container in pixels */
  height?: number;
  /** Called when user clicks a station */
  onStationClick?: (station: Station) => void;
  /** Called when user clicks a between-station event dot */
  onMarkerClick?: (eventId: string) => void;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const SVG_PADDING_X = 40;   // horizontal padding so labels don't clip
const TRACK_Y_RATIO = 0.42; // track sits at 42% of container height

// ── Proportional positioning ──────────────────────────────────────────────────

/** Map a messageIndex to an X pixel coordinate within [paddingX, width - paddingX] */
export function indexToX(
  index: number,
  totalMessages: number,
  width: number,
  paddingX = SVG_PADDING_X,
): number {
  if (totalMessages <= 1) return width / 2;
  const usable = width - paddingX * 2;
  return paddingX + (index / (totalMessages - 1)) * usable;
}

// ── Branch segment extraction ─────────────────────────────────────────────────

/** Exported for unit testing — pure function, no side effects */
export function extractBranchSegments(
  events: EnrichedEvent[],
  totalMessages: number,
  svgWidth: number,
  trackY: number,
): BranchSegment[] {
  const forkEvents = events.filter((e) => e.event_type === 'flow.branch_fork');
  if (forkEvents.length === 0) return [];

  return forkEvents.map((fork) => {
    const forkIdx = fork.message_index ?? 0;
    // Branch ends at roughly 15% of remaining messages
    const remaining = totalMessages - forkIdx;
    const endIdx = forkIdx + Math.max(2, Math.round(remaining * 0.15));

    const isActive = (fork.payload as Record<string, unknown>)?.is_active === true;
    const branchType = String(
      (fork.payload as Record<string, unknown>)?.branch_type ?? 'branch',
    );

    return {
      forkX: indexToX(forkIdx, totalMessages, svgWidth),
      endX: indexToX(Math.min(endIdx, totalMessages - 1), totalMessages, svgWidth),
      trunkY: trackY,
      isActive,
      label: branchType,
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SubwayMap({
  conversationId,
  events = [],
  totalMessages = 1,
  activeStationId,
  height = 120,
  onStationClick,
  onMarkerClick,
}: SubwayMapProps) {
  // SVG is responsive — we use a fixed viewBox and let it scale.
  // Minimum 600px wide; expands for dense conversations.
  const stationCount = useMemo(
    () => events.filter((e) => e.config?.station?.enabled).length,
    [events],
  );
  const svgWidth = Math.max(600, stationCount * 140 + SVG_PADDING_X * 2);
  const trackY = Math.round(height * TRACK_Y_RATIO);

  // Auto-generate stations from registry config
  const stations = useMemo(() => generateStations(events), [events]);

  // Station IDs set for quick lookup
  const stationEventIds = useMemo(
    () => new Set(stations.map((s) => s.eventId)),
    [stations],
  );

  // Between-station events (non-null config, not a station trigger itself)
  const dotEvents = useMemo(
    () =>
      events.filter(
        (e) => e.config?.marker != null && !stationEventIds.has(e.id),
      ),
    [events, stationEventIds],
  );

  // Branch segments for fork events
  const branchSegments = useMemo(
    () => extractBranchSegments(events, totalMessages, svgWidth, trackY),
    [events, totalMessages, svgWidth, trackY],
  );

  if (!conversationId) return null;

  // Track endpoints
  const trackX1 = SVG_PADDING_X;
  const trackX2 = svgWidth - SVG_PADDING_X;

  const handleStationClick = (station: Station) => {
    onStationClick?.(station);
  };

  const handleMarkerClick = (eventId: string) => {
    onMarkerClick?.(eventId);
  };

  return (
    <div
      style={{
        width: '100%',
        height,
        background: 'var(--deep-space)',
        borderBottom: '1px solid var(--shadow)',
        overflowX: 'auto',
        overflowY: 'hidden',
        position: 'relative',
      }}
      aria-label="Transit subway map"
    >
      <svg
        width={svgWidth}
        height={height}
        viewBox={`0 0 ${svgWidth} ${height}`}
        style={{ display: 'block', minWidth: '100%' }}
      >
        {/* Branch segments — render behind trunk */}
        {branchSegments.map((seg, i) => (
          <SubwayBranch key={`branch-${i}`} segment={seg} />
        ))}

        {/* Main trunk track */}
        <line
          x1={trackX1}
          y1={trackY}
          x2={trackX2}
          y2={trackY}
          stroke="var(--frost)"
          strokeWidth={2}
          opacity={0.35}
        />

        {/* Between-station event dots */}
        {dotEvents.map((event) => {
          const idx = event.message_index ?? 0;
          const cx = indexToX(idx, totalMessages, svgWidth);
          return (
            <SubwayMarkerDot
              key={event.id}
              event={event}
              cx={cx}
              cy={trackY}
              onClick={handleMarkerClick}
            />
          );
        })}

        {/* Station nodes */}
        {stations.map((station) => {
          const cx = indexToX(station.messageIndex, totalMessages, svgWidth);
          return (
            <SubwayStationNode
              key={station.id}
              station={station}
              cx={cx}
              cy={trackY}
              isActive={station.id === activeStationId}
              onClick={handleStationClick}
            />
          );
        })}

        {/* Empty state label when no stations yet */}
        {stations.length === 0 && (
          <text
            x={svgWidth / 2}
            y={trackY + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fill="var(--mist)"
            opacity={0.5}
            style={{ userSelect: 'none' }}
          >
            No landmarks yet — topic shifts, artifacts, and gates appear here
          </text>
        )}
      </svg>
    </div>
  );
}
