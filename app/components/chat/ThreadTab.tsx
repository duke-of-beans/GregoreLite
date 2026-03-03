/**
 * ThreadTab — Individual tab in the thread tab bar.
 *
 * Sprint S9-01: Multi-Thread Tabs
 *
 * Displays tab title with active indicator, close button, and status badges.
 * Double-click to rename. Shows cyan dot when Ghost context active, amber
 * when Decision Gate active in that tab.
 */

'use client';

import { useState, useRef, useEffect } from 'react';

interface ThreadTabProps {
  id: string;
  title: string;
  active: boolean;
  ghostActive: boolean;
  gateActive: boolean;
  closable: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (title: string) => void;
}

export function ThreadTab({
  id,
  title,
  active,
  ghostActive,
  gateActive,
  closable,
  onSelect,
  onClose,
  onRename,
}: ThreadTabProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleDoubleClick = () => {
    setEditValue(title);
    setEditing(true);
  };

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div
      className={[
        'group flex items-center gap-1 px-3 py-1.5 text-xs font-medium cursor-pointer',
        'border-r border-[var(--shadow)] select-none transition-colors',
        active
          ? 'bg-[var(--deep-space)] text-[var(--ice-white)] border-b-2 border-b-[var(--cyan)]'
          : 'bg-[var(--elevated)] text-[var(--mist)] hover:text-[var(--frost)] border-b-2 border-b-transparent',
      ].join(' ')}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      role="tab"
      aria-selected={active}
      data-tab-id={id}
    >
      {/* Status badges */}
      {ghostActive && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-[var(--cyan)] flex-shrink-0"
          title="Ghost context active"
        />
      )}
      {gateActive && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-[var(--amber)] flex-shrink-0"
          title="Decision Gate active"
        />
      )}

      {/* Title or edit input */}
      {editing ? (
        <input
          ref={inputRef}
          className="w-20 bg-transparent border-b border-[var(--cyan)] text-[var(--ice-white)] text-xs outline-none px-0"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          maxLength={40}
        />
      ) : (
        <span className="truncate max-w-[120px]">{title}</span>
      )}

      {/* Close button */}
      {closable && !editing && (
        <button
          className="opacity-0 group-hover:opacity-100 ml-1 text-[var(--mist)] hover:text-[var(--ice-white)] transition-opacity flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={`Close ${title}`}
          title="Close tab"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
