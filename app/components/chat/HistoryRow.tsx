'use client';
/**
 * HistoryRow — Sprint S9-12
 *
 * Single conversation row in the ChatHistoryPanel.
 * Shows title, project name, relative timestamp, message count badge.
 * Right-click / long-press: rename, archive, pin.
 */


import { useState, useRef, useEffect } from 'react';

export interface HistoryRowProps {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: Date | null;
  pinned: boolean;
  archived: boolean;
  onClick: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onArchive: (id: string) => void;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
}

function relativeTime(date: Date | null): string {
  if (!date) return 'no messages';
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return date.toLocaleDateString();
}

export function HistoryRow({
  id, title, messageCount, lastMessageAt,
  pinned, archived,
  onClick, onRename, onArchive, onPin, onUnpin,
}: HistoryRowProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming && inputRef.current) inputRef.current.focus();
  }, [renaming]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function handleRenameSubmit() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== title) onRename(id, trimmed);
    setRenaming(false);
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        cursor: 'pointer',
        borderRadius: '4px',
        background: 'transparent',
        transition: 'background 0.1s',
      }}
      onClick={() => !renaming && onClick(id)}
      onContextMenu={handleContextMenu}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background =
          'color-mix(in srgb, var(--frost) 8%, transparent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {/* Pin indicator */}
      {pinned && (
        <span style={{ fontSize: '10px', color: 'var(--accent)', flexShrink: 0 }}>📌</span>
      )}

      {/* Title or rename input */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {renaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--accent)',
              borderRadius: '3px',
              color: 'var(--frost)',
              fontSize: '12px',
              padding: '2px 6px',
              width: '100%',
              outline: 'none',
            }}
          />
        ) : (
          <div
            style={{
              fontSize: '12px',
              color: archived ? 'var(--mist)' : 'var(--frost)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontStyle: archived ? 'italic' : 'normal',
            }}
            title={title}
          >
            {title}
          </div>
        )}
        <div style={{ fontSize: '10px', color: 'var(--mist)', marginTop: '2px' }}>
          {relativeTime(lastMessageAt)}
        </div>
      </div>

      {/* Message count badge */}
      <span
        style={{
          fontSize: '9px',
          color: 'var(--mist)',
          background: 'var(--surface)',
          borderRadius: '8px',
          padding: '1px 6px',
          flexShrink: 0,
        }}
      >
        {messageCount}
      </span>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 300,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            padding: '4px 0',
            minWidth: '140px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem
            label="Rename"
            onClick={() => { setContextMenu(null); setRenaming(true); setRenameValue(title); }}
          />
          <ContextMenuItem
            label={pinned ? 'Unpin' : 'Pin'}
            onClick={() => { setContextMenu(null); pinned ? onUnpin(id) : onPin(id); }}
          />
          {!archived && (
            <ContextMenuItem
              label="Archive"
              onClick={() => { setContextMenu(null); onArchive(id); }}
            />
          )}
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <ContextMenuItem
            label="Delete"
            disabled
            onClick={() => setContextMenu(null)}
            hint="Conversations cannot be deleted"
          />
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({ label, onClick, disabled, hint }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={hint}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        padding: '6px 12px',
        fontSize: '11px',
        color: disabled ? 'var(--mist)' : 'var(--frost)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background =
          'color-mix(in srgb, var(--frost) 10%, transparent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'none';
      }}
    >
      {label}
    </button>
  );
}
