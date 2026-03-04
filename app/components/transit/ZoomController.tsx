/**
 * ZoomController — Sprint 11.6 (Z1 Sankey View)
 *
 * Manages zoom state and transitions between Z1 (Sankey), Z2 (Subway),
 * Z3 (Detail/Messages). Crossfade transitions (300ms).
 * Keyboard shortcuts: Cmd+0 (reset Z2), Cmd+- (zoom out), Cmd+= (zoom in).
 *
 * Uses render-prop pattern so ChatInterface controls layout.
 *
 * Spec: TRANSIT_MAP_SPEC.md §1.1
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ZoomLevel = 'Z1' | 'Z2' | 'Z3';

export interface ZoomRenderProps {
  zoomLevel: ZoomLevel;
  setZoomLevel: (level: ZoomLevel) => void;
  zoomToSegment: (messageIndex: number) => void;
  zoomToMessage: (messageId: string) => void;
  focusIndex: number | null;
  focusMessageId: string | null;
  /** True during 300ms crossfade transition */
  isTransitioning: boolean;
  /** Outgoing zoom level during transition (for fade-out) */
  previousZoom: ZoomLevel | null;
}

export interface ZoomControllerProps {
  /** Whether keyboard shortcuts should be active (e.g., Transit tab is focused) */
  shortcutsActive?: boolean;
  children: (props: ZoomRenderProps) => React.ReactNode;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRANSITION_MS = 300;
const ZOOM_ORDER: ZoomLevel[] = ['Z1', 'Z2', 'Z3'];

// ── Component ─────────────────────────────────────────────────────────────────

export function ZoomController({
  shortcutsActive = true,
  children,
}: ZoomControllerProps) {
  const [zoomLevel, setZoomLevelInternal] = useState<ZoomLevel>('Z2');
  const [previousZoom, setPreviousZoom] = useState<ZoomLevel | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated zoom level change with crossfade
  const setZoomLevel = useCallback((newLevel: ZoomLevel) => {
    if (newLevel === zoomLevel) return;

    // Clear any pending transition
    if (transitionTimer.current) {
      clearTimeout(transitionTimer.current);
    }

    setPreviousZoom(zoomLevel);
    setIsTransitioning(true);
    setZoomLevelInternal(newLevel);

    transitionTimer.current = setTimeout(() => {
      setIsTransitioning(false);
      setPreviousZoom(null);
      transitionTimer.current = null;
    }, TRANSITION_MS);
  }, [zoomLevel]);

  // Z1 → Z2 centered on segment
  const zoomToSegment = useCallback((messageIndex: number) => {
    setFocusIndex(messageIndex);
    setFocusMessageId(null);
    setZoomLevel('Z2');
  }, [setZoomLevel]);

  // Z2 → Z3 centered on message
  const zoomToMessage = useCallback((messageId: string) => {
    setFocusMessageId(messageId);
    setZoomLevel('Z3');
  }, [setZoomLevel]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!shortcutsActive) return;

    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // Cmd+0 → reset to Z2
      if (e.key === '0' && !e.shiftKey) {
        e.preventDefault();
        setZoomLevel('Z2');
        return;
      }

      // Cmd+Shift+- → zoom out (Z3→Z2→Z1)
      // Using Shift to avoid browser zoom conflict
      if (e.shiftKey && e.key === '-') {
        // Cmd+Shift+- is already bound to density in ChatInterface
        // Use Alt+- instead for zoom
        return;
      }

      // Cmd+Shift+= → zoom in (Z1→Z2→Z3)
      if (e.shiftKey && (e.key === '=' || e.key === '+')) {
        // Also bound to density — skip
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcutsActive, setZoomLevel, zoomLevel]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, []);

  return (
    <>
      {children({
        zoomLevel,
        setZoomLevel,
        zoomToSegment,
        zoomToMessage,
        focusIndex,
        focusMessageId,
        isTransitioning,
        previousZoom,
      })}
    </>
  );
}

// ── Zoom indicator (inline in Transit tab header) ─────────────────────────────

export interface ZoomIndicatorProps {
  zoomLevel: ZoomLevel;
  onSetZoom: (level: ZoomLevel) => void;
}

export function ZoomIndicator({ zoomLevel, onSetZoom }: ZoomIndicatorProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 4,
        background: 'var(--shadow)',
        fontSize: 10,
        fontWeight: 500,
      }}
    >
      {ZOOM_ORDER.map((level) => (
        <button
          key={level}
          onClick={() => onSetZoom(level)}
          aria-current={level === zoomLevel ? 'true' : undefined}
          className="transit-interactive"
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            border: 'none',
            background: level === zoomLevel ? 'var(--cyan)' : 'transparent',
            color: level === zoomLevel ? 'var(--deep-space)' : 'var(--mist)',
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: level === zoomLevel ? 700 : 400,
          }}
          title={`Switch to ${level}`}
        >
          {level}
        </button>
      ))}
    </div>
  );
}
