/**
 * CollapsibleBlock — Sprint 10.6
 *
 * Generic accordion for thinking and tool-use blocks within messages.
 */

'use client';

import { useState } from 'react';

interface CollapsibleBlockProps {
  type: 'thinking' | 'tool_use' | 'tool_result';
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleBlock({ type, summary, children, defaultOpen = false }: CollapsibleBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  const icon = type === 'thinking' ? '🧠' : type === 'tool_use' ? '🔧' : '📋';
  const bgColor = type === 'thinking' ? 'var(--elevated)' : 'var(--shadow)';

  return (
    <div className="my-2 rounded border border-[var(--shadow)] overflow-hidden" style={{ background: bgColor }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--mist)] hover:text-[var(--frost)] transition-colors"
      >
        <span>{icon}</span>
        <span className="flex-1 text-left">{summary}</span>
        <span className="text-[var(--ghost-text)] text-[10px]">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--shadow)] px-3 py-2 text-[12px] text-[var(--frost)]">
          {children}
        </div>
      )}
    </div>
  );
}