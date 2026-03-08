'use client';
/**
 * Header Component — Sprint 30.0
 *
 * Button order (left→right in right section):
 *   Projects (Cmd+P) | ? Help | Notifications | Settings | Cmd+K
 *
 * All header buttons: rounded-lg, border, elevated bg, frost text, hover cyan.
 * No mixing of styles — visual rhythm is enforced.
 */


import { useState } from 'react';
import { FolderKanban, PenLine } from 'lucide-react';
import { useDecisionGateStore } from '@/lib/stores/decision-gate-store';
import { TriggerBadge } from '@/components/decision-gate';
import { useUIStore } from '@/lib/stores/ui-store';
import { NotificationBell } from './NotificationBell';
import { HelpGuide } from './HelpGuide';
import { NAV } from '@/lib/voice/copy-templates';

export function Header() {
  const { trigger: gateTrigger } = useDecisionGateStore();
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const toggleSettings = useUIStore((s) => s.toggleSettings);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
    <header className="flex h-16 w-full items-center justify-between border-b border-[var(--shadow)] bg-[var(--deep-space)] px-6">
      {/* Logo Section — click switches to Strategic tab (Sprint 23.0: removed new-thread dispatch) */}
      <button
        onClick={() => {
          window.dispatchEvent(new CustomEvent('greglite:switch-tab', { detail: { tab: 'strategic' } }));
        }}
        className="flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--elevated)]"
        title="Go to Strategic view"
        aria-label="GregLite — go to Strategic view"
      >
        <img
          src="/gregore-logo.png"
          alt="GregLite"
          className="h-8 w-8 rounded-lg"
          width={32}
          height={32}
        />
        <span className="hidden sm:inline text-lg font-semibold tracking-tight text-[var(--ice-white)]">
          GregLite
        </span>
      </button>

      {/* Right section — order: Projects | ? | Notifications | Settings | Cmd+K */}
      {/* All buttons: rounded-lg border elevated-bg frost-text hover-cyan — no exceptions */}
      <div className="flex items-center gap-3">
        {gateTrigger && <TriggerBadge />}

        {/* Projects button — Sprint 30.0: meta-navigation, opens portfolio overlay */}
        {/* Sprint 37.0: text label added below icon */}
        <button
          data-tour="projects-button"
          onClick={() => window.dispatchEvent(new CustomEvent('greglite:open-portfolio'))}
          className="flex flex-col items-center gap-0.5 rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] px-2 py-1.5 text-[var(--frost)] transition-colors hover:border-[var(--cyan)] hover:bg-[var(--surface)] hover:text-[var(--ice-white)]"
          aria-label={NAV.projects_button_label}
          title={NAV.projects_button_tooltip}
        >
          <FolderKanban className="h-4 w-4" />
          <span className="text-[10px] leading-none">{NAV.projects_button_label}</span>
        </button>

        {/* What's this? guide button */}
        <button
          onClick={() => setHelpOpen(true)}
          className="flex items-center justify-center rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] p-2 text-[var(--frost)] transition-colors hover:border-[var(--cyan)] hover:bg-[var(--surface)] hover:text-[var(--ice-white)]"
          aria-label="Open panel guide"
          title="What's this? — Panel guide"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        <NotificationBell />

        {/* Settings gear */}
        <button
          data-tour="settings-gear"
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

        {/* Quick Capture button — Sprint 30.0: discoverability for Ctrl+Shift+Space */}
        {/* Sprint 37.0: text label added below icon */}
        <button
          onClick={() => useUIStore.getState().toggleCapturePad()}
          className="flex flex-col items-center gap-0.5 rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] px-2 py-1.5 text-[var(--frost)] transition-colors hover:border-[var(--cyan)] hover:bg-[var(--surface)] hover:text-[var(--ice-white)]"
          aria-label="Open quick capture"
          title={NAV.capture_button_tooltip}
        >
          <PenLine className="h-4 w-4" />
          <span className="text-[10px] leading-none">{NAV.capture_button_label}</span>
        </button>
      </div>
    </header>

    {/* What's This? Guide — Sprint 23.0 */}
    <HelpGuide open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
