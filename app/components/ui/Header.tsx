/**
 * Header Component
 * 
 * Minimal header with logo and command palette trigger.
 * Part of Phase 5.0 P0 Foundation.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 1.1
 */

'use client';

export function Header() {
  const handleCommandPalette = () => {
    // TODO: Implement command palette (Phase 6)
    console.log('[Header] Command palette triggered (Cmd+K)');
  };

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-[var(--shadow)] bg-[var(--deep-space)] px-6">
      {/* Logo Section */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center">
          {/* Breathing glow container */}
          <div className="breathe absolute inset-0 rounded-full bg-gradient-radial from-[var(--cyan)]/40 to-transparent" />
          
          {/* Logo */}
          <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cyan)] text-xl font-bold text-[var(--deep-space)]">
            G
          </div>
        </div>
        
        <span className="text-lg font-semibold tracking-tight text-[var(--ice-white)]">
          GREGORE
        </span>
      </div>

      {/* Command Palette Trigger */}
      <button
        onClick={handleCommandPalette}
        className="flex items-center gap-2 rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] px-3 py-2 text-sm text-[var(--frost)] transition-colors hover:border-[var(--cyan)] hover:bg-[var(--surface)] hover:text-[var(--ice-white)]"
        aria-label="Open command palette"
        title="Command Palette (Cmd+K)"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="hidden sm:inline">Cmd+K</span>
      </button>
    </header>
  );
}
