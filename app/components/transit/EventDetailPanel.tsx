/**
 * EventDetailPanel — Sprint 11.4 (Z3 Detail Annotations)
 *
 * Right slide-in drawer (follows InspectorDrawer pattern) shown when the
 * user clicks an event marker on a message. Displays full event payload,
 * learning status, and allows adding user annotations.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.7
 */

'use client';

import { useState, useEffect } from 'react';
import type { EnrichedEvent } from '@/lib/transit/types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EventDetailPanelProps {
  event: EnrichedEvent | null;   // null = panel closed
  onClose: () => void;
  onAnnotationAdd: (eventId: string, note: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function LearningStatusPill({ status }: { status?: string | undefined }) {
  const styles: Record<string, React.CSSProperties> = {
    pending:   { background: 'rgba(245,158,11,0.15)', color: 'var(--amber-400)', border: '1px solid var(--amber-400)' },
    processed: { background: 'rgba(52,211,153,0.15)', color: 'var(--green-400)', border: '1px solid var(--green-400)' },
    skipped:   { background: 'rgba(100,116,139,0.15)', color: 'var(--frost)',     border: '1px solid var(--frost)' },
  };
  const s = styles[status ?? 'pending'] ?? styles['pending']!;
  return (
    <span style={{
      ...s,
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: 10,
      fontWeight: 600,
    }}>
      {(status ?? 'pending').toUpperCase()}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      background: 'var(--elevated)',
      color: 'var(--frost)',
      border: '1px solid var(--shadow)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>
      {category}
    </span>
  );
}

function PayloadEntry({ k, v }: { k: string; v: unknown }) {
  const display = typeof v === 'object' && v !== null
    ? JSON.stringify(v, null, 2)
    : String(v);
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, color: 'var(--mist)', minWidth: 120, flexShrink: 0, paddingTop: 2 }}>
        {k}
      </span>
      <span style={{
        fontSize: 11,
        color: 'var(--ice-white)',
        fontFamily: 'monospace',
        wordBreak: 'break-all',
        whiteSpace: 'pre-wrap',
      }}>
        {display}
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EventDetailPanel({ event, onClose, onAnnotationAdd }: EventDetailPanelProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset note state whenever a new event opens
  useEffect(() => {
    setNoteOpen(false);
    setNoteText('');
  }, [event?.id]);

  // Escape to close
  useEffect(() => {
    if (!event) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [event, onClose]);

  if (!event) return null;

  const config = event.config;
  const ts = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(event.created_at));

  const payloadEntries = Object.entries(event.payload ?? {});

  const handleSaveNote = async () => {
    const note = noteText.trim();
    if (!note) return;
    setSaving(true);
    try {
      onAnnotationAdd(event.id, note);
    } finally {
      setSaving(false);
      setNoteText('');
      setNoteOpen(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 199 }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        background: 'var(--deep-space)', borderLeft: '1px solid var(--shadow)',
        zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--shadow)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ice-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {config?.name ?? event.event_type}
            </span>
            <CategoryBadge category={event.category} />
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--frost)', cursor: 'pointer',
            fontSize: 18, padding: '4px 8px', borderRadius: 4, flexShrink: 0,
          }} aria-label="Close event panel">✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* Timestamp + learning status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: 'var(--mist)' }}>{ts}</span>
            <LearningStatusPill status={event.learning_status ?? undefined} />
          </div>

          {/* Event type code */}
          <div style={{ marginBottom: 16 }}>
            <span style={{
              fontSize: 10, fontFamily: 'monospace', color: 'var(--cyan)',
              background: 'var(--elevated)', padding: '3px 8px', borderRadius: 4,
            }}>
              {event.event_type}
            </span>
          </div>

          {/* Description */}
          {config?.description && (
            <p style={{ fontSize: 12, color: 'var(--frost)', marginBottom: 16, lineHeight: 1.5 }}>
              {config.description}
            </p>
          )}

          {/* Payload */}
          {payloadEntries.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Payload
              </h4>
              <div style={{ borderLeft: '2px solid var(--shadow)', paddingLeft: 12 }}>
                {payloadEntries.map(([k, v]) => (
                  <PayloadEntry key={k} k={k} v={v} />
                ))}
              </div>
            </div>
          )}

          {/* Existing annotations */}
          {Array.isArray(event.annotations) && event.annotations.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Notes
              </h4>
              {event.annotations.map((note: unknown, i: number) => (
                <div key={i} style={{
                  fontSize: 12, color: 'var(--frost)', background: 'var(--elevated)',
                  borderRadius: 6, padding: '8px 12px', marginBottom: 6, lineHeight: 1.4,
                }}>
                  {String(note)}
                </div>
              ))}
            </div>
          )}

          {/* Add note UI */}
          {!noteOpen ? (
            <button
              onClick={() => setNoteOpen(true)}
              style={{
                background: 'none', border: '1px solid var(--shadow)', borderRadius: 6,
                color: 'var(--frost)', cursor: 'pointer', fontSize: 12, padding: '7px 14px',
                width: '100%', textAlign: 'left', transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cyan)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--shadow)'; }}
            >
              + Add Note
            </button>
          ) : (
            <div>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Enter note…"
                rows={3}
                autoFocus
                style={{
                  width: '100%', background: 'var(--elevated)', border: '1px solid var(--cyan)',
                  borderRadius: 6, color: 'var(--ice-white)', fontSize: 12, padding: '8px 12px',
                  resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => void handleSaveNote()}
                  disabled={!noteText.trim() || saving}
                  style={{
                    flex: 1, background: saving ? 'var(--elevated)' : 'var(--cyan)',
                    border: 'none', borderRadius: 6, color: saving ? 'var(--frost)' : 'var(--deep-space)',
                    cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                    padding: '7px 0',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Note'}
                </button>
                <button
                  onClick={() => { setNoteOpen(false); setNoteText(''); }}
                  style={{
                    background: 'none', border: '1px solid var(--shadow)', borderRadius: 6,
                    color: 'var(--frost)', cursor: 'pointer', fontSize: 12, padding: '7px 14px',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
