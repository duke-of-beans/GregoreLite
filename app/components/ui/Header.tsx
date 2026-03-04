/**
 * Header Component — Sprint 10.8 Tasks 7 & 10
 *
 * Added: settings gear icon (opens SettingsPanel), tooltip hints on all buttons.
 */

'use client';

import { useDecisionGateStore } from '@/lib/stores/decision-gate-store';
import { TriggerBadge } from '@/components/decision-gate';
import { useUIStore } from '@/lib/stores/ui-store';
import { NotificationBell } from './NotificationBell';

export function Header() {
  const { trigger: gateTrigger } = useDecisionGateStore();
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const toggleSettings = useUIStore((s) => s.toggleSettings);

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-[var(--shadow)] bg-[var(--deep-space)] px-6">
      {/* Logo Section */}
      <div className="flex items-center gap-3">
        <img
          src="/gregore-logo.png"
          alt="GregLite"
          className="h-8 w-8 rounded-lg"
          width={32}
          height={32}
        />
        <span className="text-lg font-semibold tracking-tight text-[var(--ice-white)]">
          GregLite
        </span>
      </div>

      {/* Right section: gate badge + notifications + settings + command palette */}
      <div className="flex items-center gap-3">
        {gateTrigger && <TriggerBadge />}

        <NotificationBell />

        {/* Settings gear — Sprint 10.8 Task 10 */}
        <button
          onClick={toggleSettings}
          className="flex items-center justify-center rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] p-2 text-[var(--frost)] transition-colors hover:border-[var(--cyan)] hover:bg-[var(--surface)] hover:text-[var(--ice-white)]"
          aria-label="Open settings"
          title="Settings (Cmd+,)"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>

        {/* Command palette button */}
        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-2 rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] px-3 py-2 text-sm text-[var(--frost)] transition-colors hover:border-[var(--cyan)] hover:bg-[var(--surface)] hover:text-[var(--ice-white)]"
          aria-label="Open command palette"
          title="Command Palette (Cmd+K)"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="hidden sm:inline">Cmd+K</span>
        </button>
      </div>
    </header>
  );
}
