'use client';

/**
 * GhostCard — Sprint 6H
 *
 * Single Ghost suggestion card. Visual design: muted dark teal / charcoal —
 * distinct from Cross-Context suggestion cards (blue-tinted).
 *
 * Layout:
 *   [eye icon] Ghost
 *   [one sentence summary]
 *   Source: [label truncated at 50 chars]
 *   [Tell me more]  [Noted]
 *
 * Critical suggestions (isCritical: true) get an amber left border.
 * Score indicator shown only when score > 0.90.
 */

import type { GhostSuggestion } from '@/lib/ghost/scorer/types';
import { GhostCardActions } from './GhostCardActions';

// ── Styles ────────────────────────────────────────────────────────────────────

const cardBase: React.CSSProperties = {
  background: 'var(--ghost-card-bg, #1a1f2e)',
  border: '1px solid var(--ghost-card-border, #2a3040)',
  borderRadius: '4px',
  padding: '8px 10px',
  marginBottom: '6px',
};

const criticalBorder: React.CSSProperties = {
  borderLeft: '2px solid var(--amber, #f59e0b)',
  paddingLeft: '8px',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  marginBottom: '4px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--teal-400, #2dd4bf)',
};

const scoreStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  marginLeft: 'auto',
  fontSize: '9px',
  color: 'var(--amber, #f59e0b)',
};

const summaryStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text, #ccc)',
  lineHeight: '1.4',
  margin: '0 0 4px 0',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical' as const,
};

const sourceStyle: React.CSSProperties = {
  fontSize: '9px',
  color: 'var(--mist, #888)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

// ── Eye icon ──────────────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 20 20"
      fill="currentColor"
      style={{ color: 'var(--teal-400, #2dd4bf)', flexShrink: 0 }}
      aria-hidden
    >
      <path d="M10 3C5 3 1.73 7.11 1.05 9.78a1 1 0 000 .44C1.73 12.89 5 17 10 17s8.27-4.11 8.95-6.78a1 1 0 000-.44C18.27 7.11 15 3 10 3zm0 11a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GhostCardProps {
  suggestion: GhostSuggestion;
  threadId: string | null;
}

export function GhostCard({ suggestion, threadId }: GhostCardProps) {
  const truncatedSource =
    suggestion.source.length > 50
      ? suggestion.source.slice(0, 47) + '…'
      : suggestion.source;

  const showHighRelevance = suggestion.score > 0.90;

  const cardStyle: React.CSSProperties = {
    ...cardBase,
    ...(suggestion.isCritical ? criticalBorder : {}),
  };

  return (
    <div style={cardStyle}>
      {/* Header: eye icon + Ghost label + optional high-relevance dot */}
      <div style={headerStyle}>
        <EyeIcon />
        <span style={labelStyle}>Ghost</span>
        {showHighRelevance && (
          <span style={scoreStyle}>
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: 'var(--amber, #f59e0b)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            High relevance
          </span>
        )}
      </div>

      {/* One-sentence summary */}
      <p style={summaryStyle}>{suggestion.summary}</p>

      {/* Source label */}
      <p style={sourceStyle} title={suggestion.source}>
        {truncatedSource}
      </p>

      {/* Action buttons */}
      <GhostCardActions suggestion={suggestion} threadId={threadId} />
    </div>
  );
}
