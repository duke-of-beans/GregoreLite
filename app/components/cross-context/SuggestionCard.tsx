import { apiFetch } from '@/lib/api-client';
'use client';

/**
 * SuggestionCard — proactive suggestion card (Sprint 3G)
 *
 * Shows a matched chunk with source label, similarity score, a one-sentence
 * summary, and two action buttons:
 *   - "Tell me more" → injects chunk content into the active thread as context
 *   - "Noted"        → records dismissed feedback and removes the card
 *
 * @module components/cross-context/SuggestionCard
 */

import { useConversationStore } from '@/lib/stores/conversation-store';
import { recordSuggestionFeedback } from '@/lib/api/conversation-client';
import type { Suggestion } from '@/lib/cross-context/types';

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-2, #1a1a2e)',
  border: '1px solid var(--border, #2a2a4a)',
  borderRadius: '4px',
  padding: '8px 10px',
  marginBottom: '6px',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '4px',
};

const sourceStyle: React.CSSProperties = {
  fontSize: '9px',
  letterSpacing: '0.06em',
  color: 'var(--mist, #888)',
  textTransform: 'uppercase' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
  maxWidth: '140px',
};

const scoreStyle: React.CSSProperties = {
  fontSize: '9px',
  color: 'var(--frost, #aaa)',
  whiteSpace: 'nowrap' as const,
  marginLeft: '8px',
};

const summaryStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text, #ccc)',
  lineHeight: '1.4',
  margin: '0 0 6px 0',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical' as const,
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
};

const btnBaseStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border, #2a2a4a)',
  borderRadius: '3px',
  cursor: 'pointer',
  fontSize: '9px',
  letterSpacing: '0.04em',
  padding: '2px 7px',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: Suggestion;
  onDismiss: (id: string) => void;
}

export function SuggestionCard({ suggestion, onDismiss }: SuggestionCardProps) {
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId
  );

  const sourceLabel =
    suggestion.sourceType === 'conversation'
      ? `thread:${suggestion.sourceId.slice(0, 8)}\u2026`
      : suggestion.sourceId;

  const matchPct = (suggestion.displayScore * 100).toFixed(0);

  const summary =
    suggestion.content.length > 140
      ? suggestion.content.slice(0, 137) + '\u2026'
      : suggestion.content;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTellMeMore = () => {
    // Fire-and-forget: inject chunk content as system context into active thread
    apiFetch('/api/cross-context/inject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: suggestion.content,
        sourceId: suggestion.sourceId,
        sourceType: suggestion.sourceType,
        threadId: activeConversationId ?? undefined,
      }),
    }).catch(() => {
      // intentional no-op — non-blocking
    });
  };

  const handleDismiss = () => {
    recordSuggestionFeedback(suggestion.id, 'dismissed');
    onDismiss(suggestion.id);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="suggestion-card" style={cardStyle}>
      <div style={headerStyle}>
        <span style={sourceStyle} title={suggestion.sourceId}>
          {sourceLabel}
        </span>
        <span style={scoreStyle}>{matchPct}% match</span>
      </div>
      <p style={summaryStyle}>{summary}</p>
      <div style={actionsStyle}>
        <button
          onClick={handleTellMeMore}
          style={{ ...btnBaseStyle, color: 'var(--frost, #aaa)' }}
        >
          Tell me more
        </button>
        <button
          onClick={handleDismiss}
          style={{ ...btnBaseStyle, color: 'var(--mist, #888)' }}
        >
          Noted
        </button>
      </div>
    </div>
  );
}
