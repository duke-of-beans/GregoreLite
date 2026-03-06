'use client';

/**
 * AEGISStatus — Sprint 2C
 *
 * Status bar widget showing current AEGIS workload profile.
 * Click opens override modal: all available profiles listed,
 * selecting one POSTs to /api/aegis/override (bypasses anti-flap,
 * logs is_override=1 in KERNL).
 *
 * Online/offline state sourced from ContextPanelState.aegisOnline
 * which is populated by getAEGISStatus() in the /api/context route.
 */

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useContextPanel } from '@/lib/context/context-provider';
import { type WorkloadProfile } from '@/lib/aegis/types';

// ─── Override profile list ────────────────────────────────────────────────────
// Excludes STARTUP and SUSPEND — those are lifecycle-only signals

const OVERRIDE_PROFILES: { value: WorkloadProfile; label: string; description: string }[] = [
  { value: 'IDLE',           label: 'IDLE',           description: 'No active work' },
  { value: 'DEEP_FOCUS',     label: 'DEEP_FOCUS',     description: 'Strategic thread, no workers' },
  { value: 'CODE_GEN',       label: 'CODE_GEN',       description: 'Code generation in progress' },
  { value: 'COWORK_BATCH',   label: 'COWORK_BATCH',   description: '1–2 workers running' },
  { value: 'RESEARCH',       label: 'RESEARCH',       description: 'Research session active' },
  { value: 'BUILD',          label: 'BUILD',          description: 'Build / compile operation' },
  { value: 'PARALLEL_BUILD', label: 'PARALLEL_BUILD', description: '3+ workers running' },
  { value: 'COUNCIL',        label: 'COUNCIL',        description: 'Decision gate active' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AEGISStatus() {
  const { state, loading } = useContextPanel();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleOverride(profile: WorkloadProfile): Promise<void> {
    setSending(true);
    try {
      await fetch('/api/aegis/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
    } finally {
      setSending(false);
      setOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-1">
        <div className="h-2.5 w-24 animate-pulse rounded bg-[var(--shadow)]" />
      </div>
    );
  }

  const isOnline = state.aegisOnline;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* ── Trigger: status bar chip ── */}
      <Dialog.Trigger asChild>
        <button
          className="flex items-center gap-1 px-4 py-1 hover:bg-[var(--shadow)] rounded transition-colors cursor-pointer"
          title="Click to override system profile"
        >
          <span className="text-[11px] text-[var(--mist)]">
            <span className="font-medium text-[var(--frost)]">System</span>
            {'  '}
            {isOnline ? (
              <span className="font-mono text-[var(--cyan-light)]">{state.aegisProfile}</span>
            ) : (
              <span className="font-mono text-[var(--amber,#f59e0b)]">offline ⚠</span>
            )}
          </span>
          <span className="text-[9px] text-[var(--mist)] opacity-60">▾</span>
        </button>
      </Dialog.Trigger>

      {/* ── Override modal ── */}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xl p-4">

          <Dialog.Title className="text-sm font-medium text-[var(--frost)] mb-1">
            Override System Profile
          </Dialog.Title>

          <Dialog.Description className="text-[11px] text-[var(--mist)] mb-4">
            Manually set the workload profile. Logged as a manual override.
            {!isOnline && (
              <span className="block mt-1 text-[var(--amber,#f59e0b)]">
                ⚠ System Monitor offline — override will be logged but won&apos;t take effect until reconnected.
              </span>
            )}
          </Dialog.Description>

          <div className="flex flex-col gap-1">
            {OVERRIDE_PROFILES.map(({ value, label, description }) => (
              <button
                key={value}
                disabled={sending}
                onClick={() => void handleOverride(value)}
                className={[
                  'flex items-center justify-between px-3 py-2 rounded text-left',
                  'hover:bg-[var(--shadow)] transition-colors',
                  state.aegisProfile === value
                    ? 'border border-[var(--cyan-light)] text-[var(--cyan-light)]'
                    : 'text-[var(--frost)]',
                  sending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                <span className="font-mono text-[11px]">{label}</span>
                <span className="text-[10px] text-[var(--mist)]">{description}</span>
              </button>
            ))}
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute top-3 right-3 text-[var(--mist)] hover:text-[var(--frost)] text-sm leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </Dialog.Close>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
