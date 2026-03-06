'use client';

/**
 * ShimmerOverlay — renders memory-match highlights over the input textarea.
 *
 * ARCHITECTURE: This is an OVERLAY — it never modifies the textarea value.
 * It sits as a sibling to the <textarea> inside InputField's relative wrapper,
 * with identical font/size/padding so text positions align pixel-perfectly.
 *
 * - Container: pointer-events: none (typing passes through to textarea)
 * - Match spans: pointer-events: auto + .memory-match class (shimmer glow + click)
 * - All text: color: transparent (only the cyan glow is visible)
 * - text-shadow on transparent text still renders in Chromium/WebKit
 */

import type { ShimmerMatch } from '@/lib/memory/shimmer-query';

interface ShimmerOverlayProps {
  matches: ShimmerMatch[];
  inputText: string;
  onMatchClick: (match: ShimmerMatch, event: React.MouseEvent<HTMLSpanElement>) => void;
}

/**
 * Splits inputText into segments: plain text and matched terms.
 * Segments are non-overlapping, sorted by position.
 */
function buildSegments(
  inputText: string,
  matches: ShimmerMatch[],
): Array<{ text: string; match: ShimmerMatch | null }> {
  if (matches.length === 0) return [{ text: inputText, match: null }];

  const segments: Array<{ text: string; match: ShimmerMatch | null }> = [];
  let cursor = 0;

  for (const match of matches) {
    // Text before this match
    if (match.startIndex > cursor) {
      segments.push({ text: inputText.slice(cursor, match.startIndex), match: null });
    }
    // The matched term
    segments.push({ text: inputText.slice(match.startIndex, match.endIndex), match });
    cursor = match.endIndex;
  }

  // Remaining text after last match
  if (cursor < inputText.length) {
    segments.push({ text: inputText.slice(cursor), match: null });
  }

  return segments;
}

export function ShimmerOverlay({ matches, inputText, onMatchClick }: ShimmerOverlayProps) {
  if (matches.length === 0) return null;

  const segments = buildSegments(inputText, matches);

  return (
    <div
      aria-hidden="true"
      style={{
        // Positioned to exactly cover the textarea
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // Identical text metrics to the textarea (InputField classes: px-4 py-3 text-sm)
        padding: '12px 16px',
        fontFamily: 'var(--font-sans)',
        fontSize: '14px',
        lineHeight: '1.6',
        // Match textarea wrapping behaviour
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        // Transparent — only glows are visible
        color: 'transparent',
        background: 'transparent',
        // Don't block typing in the textarea beneath
        pointerEvents: 'none',
        // Clip to textarea bounds
        overflow: 'hidden',
        // Must not shift layout
        boxSizing: 'border-box',
        // No border — we're purely decorative
        border: 'none',
        // Same max-height as textarea
        maxHeight: '200px',
        zIndex: 1,
      }}
    >
      {segments.map((seg, i) =>
        seg.match ? (
          <span
            key={i}
            className="memory-match"
            style={{
              // Allow clicks on this span even though parent is pointer-events: none
              pointerEvents: 'auto',
              cursor: 'pointer',
              // color stays transparent — shimmer keyframe adds text-shadow glow
              color: 'transparent',
            }}
            onClick={(e) => onMatchClick(seg.match!, e)}
            title={`Memory: ${seg.match.preview}`}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i} style={{ color: 'transparent' }}>
            {seg.text}
          </span>
        )
      )}
    </div>
  );
}
