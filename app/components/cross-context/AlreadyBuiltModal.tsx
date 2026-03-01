/**
 * AlreadyBuiltModal — "You Already Built This" interception gate (Sprint 3F)
 *
 * Shown when ManifestBuilder detects a manifest description that matches
 * existing work above the alreadyBuiltGate threshold. Three options:
 *
 *   A — "View Code"      → toggle Monaco diff view
 *   B — "Reuse as Base"  → pre-fill manifest context with matched content
 *   C — "Continue Anyway" → log override, increment counter, proceed
 *
 * BLUEPRINT §5.4
 */

'use client';

import { useState } from 'react';
import type { GateMatch } from '@/lib/cross-context/gate';
import { SimilarityDiff } from './SimilarityDiff';

interface AlreadyBuiltModalProps {
  matches: GateMatch[];
  proposedTitle: string;
  proposedDescription: string;
  onReuseAsBase: (content: string) => void;
  onContinue: (chunkId: string) => void;
  onClose: () => void;
}

export function AlreadyBuiltModal({
  matches,
  proposedTitle,
  proposedDescription,
  onReuseAsBase,
  onContinue,
  onClose,
}: AlreadyBuiltModalProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showDiff, setShowDiff] = useState(false);

  const match = matches[selectedIdx];
  if (!match) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9000,
  };

  const modalStyle: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    width: '640px',
    maxWidth: '90vw',
    maxHeight: '80vh',
    overflow: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const btnBase: React.CSSProperties = {
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    padding: '8px 14px',
    transition: 'opacity 0.15s',
    border: '1px solid var(--border)',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--frost)', marginBottom: '4px' }}>
            You may have already built this
          </div>
          <div style={{ fontSize: '11px', color: 'var(--mist)' }}>
            Found {matches.length} similar chunk{matches.length !== 1 ? 's' : ''} in your knowledge base.
          </div>
        </div>

        {/* Match selector (if multiple) */}
        {matches.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {matches.map((m, i) => (
              <button
                key={m.chunkId}
                onClick={() => { setSelectedIdx(i); setShowDiff(false); }}
                style={{
                  ...btnBase,
                  background: i === selectedIdx ? 'var(--accent)' : 'var(--surface)',
                  color: i === selectedIdx ? 'var(--bg)' : 'var(--frost)',
                  border: i === selectedIdx ? '1px solid var(--accent)' : '1px solid var(--border)',
                  fontSize: '11px',
                  padding: '4px 10px',
                }}
              >
                {(m.similarity * 100).toFixed(0)}% match
              </button>
            ))}
          </div>
        )}

        {/* Match detail */}
        <div style={{ background: 'var(--surface)', borderRadius: '6px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', color: 'var(--mist)', letterSpacing: '0.06em' }}>MATCH</span>
            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>
              {(match.similarity * 100).toFixed(1)}% similarity
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ghost-text)', lineHeight: 1.5 }}>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', color: 'var(--mist)' }}>
              source: {match.sourceId}
            </span>
          </div>
          <pre
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: 'var(--frost)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.5,
              maxHeight: '100px',
              overflow: 'auto',
            }}
          >
            {match.content.slice(0, 400)}{match.content.length > 400 ? '…' : ''}
          </pre>
        </div>

        {/* Task title being proposed */}
        <div style={{ fontSize: '11px', color: 'var(--mist)' }}>
          Proposed: <span style={{ color: 'var(--frost)' }}>{proposedTitle}</span>
        </div>

        {/* Monaco diff (toggle) */}
        {showDiff && (
          <SimilarityDiff
            existingContent={match.content}
            proposedDescription={proposedDescription}
          />
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowDiff((v) => !v)}
            style={{ ...btnBase, background: 'var(--surface)', color: 'var(--frost)' }}
          >
            {showDiff ? 'Hide Diff' : 'View Code'}
          </button>
          <button
            onClick={() => { onReuseAsBase(match.content); onClose(); }}
            style={{ ...btnBase, background: 'var(--surface)', color: 'var(--frost)' }}
          >
            Reuse as Base
          </button>
          <button
            onClick={() => { onContinue(match.chunkId); onClose(); }}
            style={{ ...btnBase, background: 'var(--accent)', color: 'var(--bg)', border: '1px solid var(--accent)' }}
          >
            Continue Anyway
          </button>
        </div>

      </div>
    </div>
  );
}
