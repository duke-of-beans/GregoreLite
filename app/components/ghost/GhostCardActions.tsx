'use client';

import type { GhostSuggestion } from '@/lib/ghost/scorer/types';
import { handleTellMeMore, handleNoted } from '@/lib/ghost/card-actions';

interface GhostCardActionsProps {
  suggestion: GhostSuggestion;
  threadId: string | null;
  onTeach: () => void;
}

const btnBase: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--shadow, #2a2a3a)',
  borderRadius: '3px',
  cursor: 'pointer',
  fontSize: '9px',
  letterSpacing: '0.04em',
  padding: '2px 7px',
};

export function GhostCardActions({ suggestion, threadId, onTeach }: GhostCardActionsProps) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
      <button
        onClick={() => void handleTellMeMore(suggestion, threadId)}
        style={{ ...btnBase, color: 'var(--teal-300, #5eead4)' }}
        title="Inject this content as context for the next Claude response"
      >
        Tell me more
      </button>
      <button
        onClick={() => void handleNoted(suggestion)}
        style={{ ...btnBase, color: 'var(--mist, #888)' }}
        title="Dismiss this suggestion"
      >
        Noted
      </button>
      <button
        onClick={onTeach}
        style={{ ...btnBase, color: 'var(--amber, #f59e0b)' }}
        title="Teach Ghost to surface more like this"
      >
        📌 Teach Ghost
      </button>
    </div>
  );
}
