import { apiFetch } from '@/lib/api-client';
/**
 * ContextLibrary — suppressed suggestions drawer (Sprint 3F)
 *
 * Full-height right drawer. Shows all dismissed suggestions with their
 * source, similarity score, and content preview. David can un-suppress
 * any item to return it to the active suggestion pool.
 *
 * Opens from the SuggestionSlot in the Context Panel.
 * Fetches from GET /api/cross-context/suppressed.
 * Un-suppress calls DELETE /api/cross-context/suppressed?id=<id>.
 *
 * BLUEPRINT §5.4
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

interface SuppressedItem {
  id: string;
  chunk_id: string;
  similarity_score: number;
  surface_context: string;
  acted_at: number;
  content: string;
  source_type: string;
  source_id: string;
}

interface ContextLibraryProps {
  onClose: () => void;
}

export function ContextLibrary({ onClose }: ContextLibraryProps) {
  const [items, setItems] = useState<SuppressedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/cross-context/suppressed');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { suppressed: SuppressedItem[] };
      setItems(data.suppressed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  async function handleUnsuppress(id: string) {
    try {
      await fetch(`/api/cross-context/suppressed?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // best-effort — leave item in list
    }
  }

  const drawerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '380px',
    maxWidth: '90vw',
    background: 'var(--bg)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 8000,
    boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 7999 }}
        onClick={onClose}
      />
      <div style={drawerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--frost)', letterSpacing: '0.08em' }}>
              CONTEXT LIBRARY
            </div>
            <div style={{ fontSize: '10px', color: 'var(--mist)', marginTop: '2px' }}>
              {items.length} suppressed suggestion{items.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--mist)',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {loading && (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--mist)' }}>
              Loading…
            </div>
          )}

          {error && (
            <div style={{ padding: '12px', fontSize: '11px', color: 'var(--error)' }}>
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--mist)' }}>
              No suppressed suggestions.
            </div>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '10px 12px',
                marginBottom: '8px',
              }}
            >
              {/* Meta row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--mist)', letterSpacing: '0.04em' }}>
                  {item.source_type} · {item.source_id.slice(0, 24)}{item.source_id.length > 24 ? '…' : ''}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--accent)' }}>
                  {(item.similarity_score * 100).toFixed(0)}%
                </span>
              </div>

              {/* Content preview */}
              <pre
                style={{
                  fontSize: '10px',
                  color: 'var(--frost)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.4,
                  maxHeight: '72px',
                  overflow: 'hidden',
                  marginBottom: '8px',
                }}
              >
                {item.content.slice(0, 200)}{item.content.length > 200 ? '…' : ''}
              </pre>

              {/* Context badge + unsuppress */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '9px',
                    color: 'var(--mist)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    padding: '1px 5px',
                    letterSpacing: '0.06em',
                  }}
                >
                  {item.surface_context.replace('_', ' ')}
                </span>
                <button
                  onClick={() => { void handleUnsuppress(item.id); }}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    color: 'var(--frost)',
                    cursor: 'pointer',
                    fontSize: '10px',
                    padding: '2px 8px',
                  }}
                >
                  Un-suppress
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
