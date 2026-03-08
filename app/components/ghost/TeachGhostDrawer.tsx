import { apiFetch } from '@/lib/api-client';
'use client';

/**
 * TeachGhostDrawer — Sprint 9-06
 *
 * Micro-drawer anchored below a GhostCard. Lets the user create a
 * ghost_preferences row to boost future Ghost suggestions matching
 * the card's source_type.
 *
 * Fields:
 *   - Source type (pre-filled from card, read-only display)
 *   - Topic hint (text input, e.g. "GHM competitor filings")
 *   - Boost factor slider (1.0x to 3.0x, default 1.5x)
 *
 * Submit writes via POST /api/ghost/preferences.
 */

import { useCallback, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeachGhostDrawerProps {
  sourceType: string;
  onClose: () => void;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const drawerStyle: React.CSSProperties = {
  background: 'var(--ghost-card-bg, #1a1f2e)',
  border: '1px solid var(--teal-800, #134e4a)',
  borderRadius: '4px',
  padding: '10px',
  marginTop: '4px',
  marginBottom: '6px',
};

const labelText: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--mist, #888)',
  marginBottom: '3px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-dark, #0f1219)',
  border: '1px solid var(--shadow, #2a2a3a)',
  borderRadius: '3px',
  color: 'var(--text, #ccc)',
  fontSize: '11px',
  padding: '4px 6px',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const btnBase: React.CSSProperties = {
  border: 'none',
  borderRadius: '3px',
  cursor: 'pointer',
  fontSize: '10px',
  fontWeight: 600,
  padding: '4px 10px',
};

const confirmStyle: React.CSSProperties = {
  background: 'var(--teal-600, #0d9488)',
  color: 'var(--text, #ccc)',
  fontSize: '10px',
  padding: '6px 14px',
  border: 'none',
  borderRadius: '3px',
  cursor: 'pointer',
  fontWeight: 600,
  marginTop: '8px',
  flex: '1',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TeachGhostDrawer({ sourceType, onClose }: TeachGhostDrawerProps) {
  const [topicHint, setTopicHint] = useState('');
  const [boostFactor, setBoostFactor] = useState(1.5);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!topicHint.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/ghost/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: sourceType === 'any' ? null : sourceType,
          topic_hint: topicHint.trim(),
          boost_factor: boostFactor,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(onClose, 1800);
      }
    } catch {
      /* best effort */
    } finally {
      setSaving(false);
    }
  }, [topicHint, boostFactor, sourceType, onClose]);

  if (saved) {
    return (
      <div style={{ ...drawerStyle, textAlign: 'center' as const }}>
        <span style={{ fontSize: '11px', color: 'var(--teal-400, #2dd4bf)' }}>
          Ghost will surface more from &ldquo;{topicHint}&rdquo;
        </span>
      </div>
    );
  }

  return (
    <div style={drawerStyle}>
      {/* Source type (read-only) */}
      <div style={{ marginBottom: '6px' }}>
        <div style={labelText}>Source type</div>
        <div style={{ fontSize: '10px', color: 'var(--teal-300, #5eead4)' }}>
          {sourceType}
        </div>
      </div>

      {/* Topic hint */}
      <div style={{ marginBottom: '6px' }}>
        <div style={labelText}>Topic label</div>
        <input
          type="text"
          value={topicHint}
          onChange={(e) => setTopicHint(e.target.value)}
          placeholder="e.g. GHM competitor filings"
          style={inputStyle}
          autoFocus
        />
      </div>

      {/* Boost slider */}
      <div style={{ marginBottom: '4px' }}>
        <div style={labelText}>Boost: {boostFactor.toFixed(1)}x</div>
        <input
          type="range"
          min={1.0}
          max={3.0}
          step={0.1}
          value={boostFactor}
          onChange={(e) => setBoostFactor(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--teal-400, #2dd4bf)' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => void handleSubmit()}
          disabled={saving || !topicHint.trim()}
          style={{
            ...confirmStyle,
            opacity: saving || !topicHint.trim() ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Teach Ghost'}
        </button>
        <button
          onClick={onClose}
          style={{ ...btnBase, color: 'var(--mist, #888)', background: 'none', marginTop: '8px' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
