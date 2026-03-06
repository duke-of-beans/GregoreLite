'use client';

/**
 * MemoryCard — popover shown when a shimmer match is clicked.
 *
 * Shows: source type badge, preview text, source title/thread, "View source →" link.
 * Dismisses on click-outside or Escape.
 * Fades in 150ms. Avoids clipping at screen edges.
 */

import { useEffect, useRef } from 'react';
import type { ShimmerMatch } from '@/lib/memory/shimmer-query';

interface MemoryCardProps {
  match: ShimmerMatch;
  position: { x: number; y: number };
  onClose: () => void;
  onNavigate: (sourceId: string) => void;
}

const SOURCE_LABELS: Record<ShimmerMatch['source'], string> = {
  memory: 'Memory',
  decision: 'Decision',
  ghost: 'Ghost',
};

const SOURCE_COLORS: Record<ShimmerMatch['source'], string> = {
  memory:   'var(--cyan)',
  decision: 'var(--purple-400)',
  ghost:    'var(--green-400)',
};

export function MemoryCard({ match, position, onClose, onNavigate }: MemoryCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Dismiss on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay so the click that opened the card doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Clamp position to viewport
  const CARD_WIDTH = 300;
  const CARD_APPROX_HEIGHT = 120;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const x = Math.min(position.x, vw - CARD_WIDTH - 12);
  const y = position.y + 20 + CARD_APPROX_HEIGHT > vh
    ? position.y - CARD_APPROX_HEIGHT - 8
    : position.y + 20;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Memory match"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: CARD_WIDTH,
        background: 'var(--elevated)',
        border: '1px solid rgba(0, 212, 232, 0.25)',
        borderRadius: '8px',
        padding: '12px 14px',
        zIndex: 9999,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        animation: 'fadeInCard 150ms ease-out forwards',
        fontSize: '13px',
        color: 'var(--frost)',
      }}
    >
      <style>{`
        @keyframes fadeInCard {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header row: badge + close */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            background: `${SOURCE_COLORS[match.source]}22`,
            color: SOURCE_COLORS[match.source],
            border: `1px solid ${SOURCE_COLORS[match.source]}44`,
          }}
        >
          {SOURCE_LABELS[match.source]}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--mist)',
            fontSize: '16px',
            lineHeight: 1,
            padding: '0 2px',
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Term */}
      <div style={{ marginBottom: 6, fontSize: '12px', color: 'var(--mist)' }}>
        Matched: <span style={{ color: 'var(--cyan)', fontWeight: 500 }}>&ldquo;{match.term}&rdquo;</span>
      </div>

      {/* Preview */}
      <p style={{ margin: '0 0 10px', lineHeight: 1.5, color: 'var(--frost)', fontSize: '12px' }}>
        {match.preview}
        {match.preview.length >= 80 ? '…' : ''}
      </p>

      {/* Navigate link */}
      <button
        onClick={() => { onNavigate(match.sourceId); onClose(); }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--cyan)',
          fontSize: '12px',
          fontWeight: 500,
          padding: 0,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        View source →
      </button>
    </div>
  );
}
