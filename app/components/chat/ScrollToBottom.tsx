/**
 * ScrollToBottom — Sprint 10.6
 *
 * Floating button that appears when user scrolls up from bottom.
 * Pulses when new content arrives while scrolled up.
 */

'use client';

interface ScrollToBottomProps {
  visible: boolean;
  hasNewContent: boolean;
  onClick: () => void;
}

export function ScrollToBottom({ visible, hasNewContent, onClick }: ScrollToBottomProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className={[
        'absolute bottom-4 left-1/2 -translate-x-1/2 z-10',
        'flex items-center justify-center',
        'h-8 w-8 rounded-full',
        'bg-[var(--elevated)] border border-[var(--shadow)]',
        'text-[var(--frost)] hover:text-[var(--ice-white)]',
        'shadow-lg transition-all duration-200',
        hasNewContent ? 'animate-bounce' : '',
      ].join(' ')}
      title="Scroll to bottom"
      aria-label="Scroll to bottom"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {hasNewContent && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--cyan)]" />
      )}
    </button>
  );
}