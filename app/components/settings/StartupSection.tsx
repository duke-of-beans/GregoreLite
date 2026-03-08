'use client';
/**
 * StartupSection — Sprint 31.0
 *
 * Settings panel section: "Launch Behavior".
 * Single toggle: "Launch GregLite when you start your computer".
 *
 * Reads actual OS state on mount (registry / plist) via Tauri IPC.
 * On toggle: calls register / unregister and shows a confirmation toast.
 * On IPC failure (permissions, dev mode): shows a muted warning inline.
 *
 * All copy from lib/voice/copy-templates.ts — no hardcoded strings.
 * Follows the inline-style pattern established by CaptureSection.tsx.
 */


import { useState, useEffect, useCallback } from 'react';
import { STARTUP } from '@/lib/voice/copy-templates';
import {
  isStartupRegistered,
  registerStartup,
  unregisterStartup,
} from '@/lib/startup/client';

type ToastState =
  | { kind: 'idle' }
  | { kind: 'registered' }
  | { kind: 'unregistered' }
  | { kind: 'error'; message: string };

export function StartupSection() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>({ kind: 'idle' });

  // Read actual OS state on mount — never trust a cached preference.
  useEffect(() => {
    let cancelled = false;
    isStartupRegistered().then((registered) => {
      if (!cancelled) {
        setEnabled(registered);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
    if (next.kind !== 'idle') {
      setTimeout(() => setToast({ kind: 'idle' }), 4000);
    }
  }, []);

  const handleToggle = useCallback(async () => {
    const next = !enabled;
    setEnabled(next); // optimistic

    try {
      if (next) {
        await registerStartup();
        showToast({ kind: 'registered' });
      } else {
        await unregisterStartup();
        showToast({ kind: 'unregistered' });
      }
    } catch (err) {
      // Roll back optimistic update.
      setEnabled(!next);
      const detail =
        err instanceof Error ? err.message : String(err);
      showToast({ kind: 'error', message: detail });
    }
  }, [enabled, showToast]);

  const toastText =
    toast.kind === 'registered'
      ? STARTUP.toast_registered
      : toast.kind === 'unregistered'
        ? STARTUP.toast_unregistered
        : toast.kind === 'error'
          ? STARTUP.toast_error
          : null;

  const isError = toast.kind === 'error';

  return (
    <section>
      <h3 style={headingStyle}>{STARTUP.settings_title}</h3>
      <p style={descriptionStyle}>{STARTUP.settings_description}</p>

      {/* Toggle row */}
      <div style={rowStyle}>
        <span style={loading ? mutedLabelStyle : labelStyle}>
          {STARTUP.toggle_label}
        </span>
        <button
          onClick={() => { void handleToggle(); }}
          disabled={loading}
          style={toggleStyle(enabled, loading)}
          aria-pressed={enabled}
          aria-label={STARTUP.toggle_label}
        >
          {loading ? '…' : enabled ? 'On' : 'Off'}
        </button>
      </div>

      {/* Toast */}
      {toastText && (
        <p
          style={{
            fontSize: 11,
            color: isError ? 'var(--mist)' : '#6ee7b7',
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          {toastText}
        </p>
      )}
    </section>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ice-white)',
  marginBottom: 4,
};

const descriptionStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--mist)',
  marginBottom: 16,
  lineHeight: 1.5,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--frost)',
};

const mutedLabelStyle: React.CSSProperties = {
  ...labelStyle,
  color: 'var(--mist)',
};

function toggleStyle(
  active: boolean,
  disabled: boolean,
): React.CSSProperties {
  return {
    fontSize: 11,
    padding: '3px 10px',
    borderRadius: 4,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: active ? '#3b82f620' : 'transparent',
    border: `1px solid ${active ? '#3b82f6' : 'var(--shadow)'}`,
    color: active ? '#3b82f6' : 'var(--mist)',
    fontFamily: 'inherit',
  };
}
