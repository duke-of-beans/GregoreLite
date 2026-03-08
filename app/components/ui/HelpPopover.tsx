'use client';

/**
 * HelpPopover — Sprint 39.0
 *
 * Tiny inline `?` button. Click to open a fixed-position popover showing
 * plain-language help text sourced from HELP_CONTENT in copy-templates.ts.
 *
 * Usage:
 *   <HelpPopover helpKey="quality" />
 *   <HelpPopover helpKey="settings_appearance" />
 */

import { useState, useRef, useEffect } from 'react';
import { HELP_CONTENT } from '@/lib/voice/copy-templates';

export type HelpKey = keyof typeof HELP_CONTENT;

interface HelpPopoverProps {
  helpKey: HelpKey;
  className?: string;
}

export function HelpPopover({ helpKey, className }: HelpPopoverProps) {
  const [open, setOpen]   = useState(false);
  const [pos,  setPos]    = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const entry = HELP_CONTENT[helpKey];

  function openPopover() {
    if (!btnRef.current) return;
    const rect     = btnRef.current.getBoundingClientRect();
    const popWidth = 240;
    let   left     = rect.left + rect.width / 2 - popWidth / 2;
    // Clamp to viewport with 8px padding
    left = Math.max(8, Math.min(left, window.innerWidth - popWidth - 8));
    setPos({ top: rect.bottom + 6, left });
    setOpen(true);
  }

  // Dismiss on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        popRef.current  && !popRef.current.contains(e.target  as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target  as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Dismiss on Escape
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={open ? () => setOpen(false) : openPopover}
        className={className}
        aria-label={`Help: ${entry.title}`}
        aria-expanded={open}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          width:          14,
          height:         14,
          borderRadius:   '50%',
          border:         '1px solid var(--mist)',
          background:     'transparent',
          color:          'var(--mist)',
          fontSize:       9,
          fontWeight:     600,
          cursor:         'pointer',
          lineHeight:     1,
          padding:        0,
          flexShrink:     0,
          opacity:        open ? 1 : 0.65,
          transition:     'opacity 0.15s',
          marginLeft:     4,
          verticalAlign:  'middle',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = open ? '1' : '0.65')}
      >
        ?
      </button>

      {open && pos && (
        <div
          ref={popRef}
          role="tooltip"
          style={{
            position:     'fixed',
            top:          pos.top,
            left:         pos.left,
            width:        240,
            background:   'var(--elevated)',
            border:       '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8,
            padding:      '10px 12px',
            zIndex:       9999,
            boxShadow:    '0 8px 24px rgba(0, 0, 0, 0.45)',
            pointerEvents:'auto',
          }}
        >
          <div style={{
            fontSize:     11,
            fontWeight:   600,
            color:        'var(--text)',
            marginBottom: 4,
            letterSpacing: '0.02em',
          }}>
            {entry.title}
          </div>
          <div style={{
            fontSize:   11,
            color:      'var(--dim)',
            lineHeight: 1.55,
          }}>
            {entry.body}
          </div>
        </div>
      )}
    </>
  );
}
