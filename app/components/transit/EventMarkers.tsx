/**
 * EventMarkers — Sprint 11.4 (Z3 Detail Annotations)
 *
 * Renders small SVG marker icons for events attached to a specific message.
 * Shapes and colors are read from the registry — nothing is hardcoded here.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.2
 * Shape→category mapping: circle=flow, diamond=quality, square=system,
 *   triangle=context, hexagon=cognitive
 */

'use client';

import type { EnrichedEvent } from '@/lib/transit/types';
import type { MarkerShape, MarkerSize } from '@/lib/transit/types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EventMarkersProps {
  events: EnrichedEvent[];
  onMarkerClick: (eventId: string) => void;
}

// ── Size mapping ──────────────────────────────────────────────────────────────

/** Z3 marker sizes — slightly larger than Z2 subway dots per spec */
export function markerSizePx(size: MarkerSize): number {
  switch (size) {
    case 'small':    return 8;
    case 'medium':   return 12;
    case 'large':    return 16;
    case 'landmark': return 20;
  }
}

// ── SVG shape renderers ────────────────────────────────────────────────────────

interface ShapeProps {
  size: number;
  color: string;
}

function CircleShape({ size, color }: ShapeProps) {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={r} cy={r} r={r - 0.5} fill={color} />
    </svg>
  );
}

function DiamondShape({ size, color }: ShapeProps) {
  const half = size / 2;
  // Rotated square: points at top, right, bottom, left
  const pts = `${half},0.5 ${size - 0.5},${half} ${half},${size - 0.5} 0.5,${half}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <polygon points={pts} fill={color} />
    </svg>
  );
}

function SquareShape({ size, color }: ShapeProps) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <rect x={0.5} y={0.5} width={size - 1} height={size - 1} fill={color} rx={1} />
    </svg>
  );
}

function TriangleShape({ size, color }: ShapeProps) {
  // Upward-pointing triangle
  const pts = `${size / 2},0.5 ${size - 0.5},${size - 0.5} 0.5,${size - 0.5}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <polygon points={pts} fill={color} />
    </svg>
  );
}

function HexagonShape({ size, color }: ShapeProps) {
  // Flat-top hexagon
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - 0.5;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <polygon points={points} fill={color} />
    </svg>
  );
}

/** Render the correct SVG shape based on the registry shape string */
export function renderMarkerShape(shape: MarkerShape, size: number, color: string) {
  switch (shape) {
    case 'circle':  return <CircleShape size={size} color={color} />;
    case 'diamond': return <DiamondShape size={size} color={color} />;
    case 'square':  return <SquareShape size={size} color={color} />;
    case 'triangle': return <TriangleShape size={size} color={color} />;
    case 'hexagon': return <HexagonShape size={size} color={color} />;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EventMarkers({ events, onMarkerClick }: EventMarkersProps) {
  // Only render events that have registry config with marker info
  const renderable = events.filter((e) => e.config?.marker != null);
  if (renderable.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexWrap: 'wrap',
        marginTop: '4px',
      }}
    >
      {renderable.map((e) => {
        const marker = e.config!.marker!;
        const px = markerSizePx(marker.size);
        const label = e.config?.name ?? e.event_type;

        return (
          <button
            key={e.id}
            onClick={() => onMarkerClick(e.id)}
            title={label}
            aria-label={`Event: ${label}`}
            className="transit-marker-btn"
          >
            {renderMarkerShape(marker.shape, px, marker.color)}
          </button>
        );
      })}
    </div>
  );
}
