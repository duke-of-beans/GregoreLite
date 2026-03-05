/**
 * CollapsibleBlock — Sprint 10.6 / Sprint 15.0
 *
 * Generic accordion for thinking and tool-use blocks within messages.
 *
 * Sprint 15.0 changes:
 * - Respects defaultCollapseToolBlocks preference from ui-store
 * - Tool blocks get visual distinction: monospace, cyan left border, elevated bg, tool name pill
 * - Thinking blocks get subtle purple left border
 */

'use client';

import { useState } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';

interface CollapsibleBlockProps {
  type: 'thinking' | 'tool_use' | 'tool_result';
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Tool name for the pill badge (tool_use blocks only) */
  toolName?: string;
}

export function CollapsibleBlock({ type, summary, children, defaultOpen, toolName }: CollapsibleBlockProps) {
  const collapseByDefault = useUIStore((s) => s.defaultCollapseToolBlocks);

  // Default open = true unless user preference says collapse by default.
  // Explicit defaultOpen prop overrides everything.
  const initialOpen = defaultOpen !== undefined ? defaultOpen : !collapseByDefault;
  const [open, setOpen] = useState(initialOpen);

  const isToolBlock = type === 'tool_use' || type === 'tool_result';
  const icon = type === 'thinking' ? '💭' : type === 'tool_use' ? '⚙' : '📋';

  // Sprint 15.0: Visual distinction — tool blocks get cyan border + elevated bg
  const borderColor = isToolBlock ? 'var(--cyan)' : 'var(--mist)';
  const bgColor = isToolBlock ? 'var(--elevated)' : 'var(--elevated)';

  return (
    <div
      className="my-2 overflow-hidden rounded"
      style={{
        background: bgColor,
        borderLeft: `3px solid ${borderColor}`,
        border: `1px solid var(--shadow)`,
        borderLeftWidth: '3px',
        borderLeftColor: borderColor,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--mist)] hover:text-[var(--frost)] transition-colors"
      >
        <span>{icon}</span>
        {/* Sprint 15.0: Tool name pill badge */}
        {isToolBlock && toolName && (
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px] font-medium"
            style={{
              background: 'color-mix(in srgb, var(--cyan) 15%, transparent)',
              color: 'var(--cyan)',
            }}
          >
            {toolName}
          </span>
        )}
        <span className="flex-1 text-left">{summary}</span>
        <span className="text-[var(--ghost-text)] text-[10px]">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div
          className="border-t border-[var(--shadow)] px-3 py-2 text-[12px]"
          style={{
            fontFamily: isToolBlock ? 'var(--font-mono, monospace)' : 'inherit',
            fontSize: isToolBlock ? '11px' : '12px',
            color: isToolBlock ? 'var(--frost)' : 'var(--frost)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}