/**
 * HelpGuide — Sprint 23.0
 *
 * Plain-language guide to every panel in GregLite.
 * Opened via the ? button in the Header.
 * Copy lives in lib/voice/copy-templates.ts (GUIDE_ITEMS).
 * No jargon. Passes the Grandma Test.
 */

'use client';

import { useEffect } from 'react';
import { GUIDE_ITEMS } from '@/lib/voice/copy-templates';

export interface HelpGuideProps {
  open: boolean;
  onClose: () => void;
}

export function HelpGuide({ open, onClose }: HelpGuideProps) {
  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="What's this? — Panel guide"
        className="fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--shadow)] bg-[var(--elevated)] p-6 shadow-2xl"
      >
        {/* Header row */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--mist)]">
            What's this?
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--mist)] transition-colors hover:text-[var(--ice-white)]"
            aria-label="Close guide"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Guide items */}
        <div className="flex flex-col gap-3">
          {GUIDE_ITEMS.map((item) => (
            <div key={item.label} className="flex gap-4">
              <span
                className="w-36 shrink-0 text-xs font-medium text-[var(--ice-white)]"
              >
                {item.label}
              </span>
              <span className="text-xs leading-relaxed text-[var(--mist)]">
                {item.description}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[10px] text-[var(--shadow)]">
          Press Esc or click outside to close
        </p>
      </div>
    </>
  );
}
