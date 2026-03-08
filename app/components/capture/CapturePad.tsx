import { apiFetch } from '@/lib/api-client';
﻿/**
 * CapturePad — Sprint 29.0
 *
 * Global floating micro-input overlay. Appears on Ctrl+Shift+Space / Cmd+Shift+C.
 * Self-registering keyboard handler. Works from any tab, any state.
 * z-index 9999 — above everything including the command palette (z-50).
 *
 * Design: centered card, ~500px, glassmorphic backdrop.
 * Spring animation: scale 0.95→1, opacity 0→1, 100ms. Fast.
 * Input focused immediately on open — no delay, no spinners.
 *
 * Dedup runs AFTER submit. The input is never blocked waiting on API.
 * Captures in <3 seconds total UX time: open → type → Enter → toast → gone.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { classifyNote, parseCaptureInput } from '@/lib/capture/parser';
import type { CaptureClassification } from '@/lib/capture/types';
import { CAPTURE } from '@/lib/voice/copy-templates';

// ── Classification badge colors ───────────────────────────────────────────────

const CLASS_COLORS: Record<CaptureClassification, string> = {
  bug:      '#ef4444',
  feature:  '#3b82f6',
  question: '#f59e0b',
  idea:     '#8b5cf6',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ClassificationBadge({ cls }: { cls: CaptureClassification }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: CLASS_COLORS[cls],
        border: `1px solid ${CLASS_COLORS[cls]}33`,
        borderRadius: 4,
        padding: '1px 5px',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      {CAPTURE.classification[cls]}
    </span>
  );
}

function ProjectPill({ name }: { name: string | null }) {
  const isUnrouted = !name;
  return (
    <span
      style={{
        fontSize: 11,
        color: isUnrouted ? 'var(--mist)' : 'var(--frost)',
        fontStyle: isUnrouted ? 'italic' : 'normal',
      }}
    >
      {isUnrouted ? CAPTURE.pad.project_unrouted : name}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CaptureResult {
  wasDuplicate: boolean;
  mergedWith?: string;
  mentionCount?: number;
  projectName?: string | null;
}

interface CapturePadProps {
  onCaptured?: (result: CaptureResult) => void;
}

export function CapturePad({ onCaptured }: CapturePadProps) {
  const { capturePadOpen, closeCapturePad, toggleCapturePad } = useUIStore();

  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [projectNames, setProjectNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Live-derived state (no API needed — fast)
  const { projectName, body } = parseCaptureInput(text, projectNames);
  const classification = body.length > 0 ? classifyNote(body) : 'idea';

  // ── Keyboard shortcut registration ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+Space (Windows primary)
      if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        toggleCapturePad();
        return;
      }
      // Cmd+Shift+C (Mac / alternative)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        // Don't intercept if user is in a text field (could be copy)
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        toggleCapturePad();
        return;
      }
    };
    // Also open from command palette dispatch
    const handleOpenEvent = () => useUIStore.getState().openCapturePad();
    window.addEventListener('keydown', handler);
    document.addEventListener('greglite:open-capture-pad', handleOpenEvent);
    return () => {
      window.removeEventListener('keydown', handler);
      document.removeEventListener('greglite:open-capture-pad', handleOpenEvent);
    };
  }, [toggleCapturePad]);

  // ── Focus input immediately on open ──────────────────────────────────────

  useEffect(() => {
    if (capturePadOpen) {
      // Immediate focus — no delay
      requestAnimationFrame(() => inputRef.current?.focus());
      // Fetch project names for live prefix matching (fire-and-forget)
      apiFetch('/api/capture/inbox?_projects=1')
        .catch(() => null);
      // Fetch registered projects for parser
      apiFetch('/api/portfolio/projects?status=active')
        .then((r) => r.json())
        .then((data: { projects?: { name: string }[] }) => {
          if (Array.isArray(data?.projects)) {
            setProjectNames(data.projects.map((p: { name: string }) => p.name));
          }
        })
        .catch(() => null);
    } else {
      setText('');
    }
  }, [capturePadOpen]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    closeCapturePad();

    try {
      const res = await apiFetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();

      onCaptured?.({
        wasDuplicate: data.wasDuplicate ?? false,
        mergedWith: data.mergedWith,
        mentionCount: data.note?.mention_count,
        projectName: data.note?.parsed_project ?? null,
      });
    } catch {
      // Capture attempted — toast will still fire via onCaptured fallback
      onCaptured?.({ wasDuplicate: false });
    } finally {
      setSubmitting(false);
      setText('');
    }
  }, [text, submitting, closeCapturePad, onCaptured]);

  // ── Key handling inside the pad ───────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCapturePad();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
      // Shift+Enter → newline (default textarea behavior, no override needed)
    },
    [closeCapturePad, handleSubmit]
  );

  if (!capturePadOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={closeCapturePad}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
          zIndex: 9998,
        }}
      />

      {/* Floating pad */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick Capture"
        style={{
          position: 'fixed',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 520,
          zIndex: 9999,
          background: 'var(--elevated)',
          border: '1px solid var(--shadow)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(12px)',
          animation: 'capturePadIn 100ms cubic-bezier(0.34,1.56,0.64,1) forwards',
          padding: '16px',
        }}
      >
        {/* Pad header — Sprint 37.0 */}
        <div style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ice-white)', margin: 0 }}>
            {CAPTURE.pad.header}
          </h3>
          <p style={{ fontSize: 11, color: 'var(--mist)', margin: '2px 0 0' }}>
            {CAPTURE.pad.subtitle}
          </p>
        </div>

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={CAPTURE.pad.placeholder}
          rows={2}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--ice-white)',
            fontSize: 14,
            lineHeight: 1.6,
            resize: 'none',
            fontFamily: 'inherit',
          }}
          spellCheck={false}
          autoComplete="off"
        />

        {/* Meta row: project pill + classification badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--shadow)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProjectPill name={projectName} />
            {body.length > 0 && <ClassificationBadge cls={classification} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <kbd
              style={{
                fontSize: 10,
                color: 'var(--mist)',
                border: '1px solid var(--shadow)',
                borderRadius: 3,
                padding: '1px 5px',
                background: 'var(--deep-space)',
              }}
            >
              ↵ capture
            </kbd>
            <kbd
              style={{
                fontSize: 10,
                color: 'var(--mist)',
                border: '1px solid var(--shadow)',
                borderRadius: 3,
                padding: '1px 5px',
                background: 'var(--deep-space)',
              }}
            >
              esc
            </kbd>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes capturePadIn {
          from { opacity: 0; transform: translateX(-50%) scale(0.95); }
          to   { opacity: 1; transform: translateX(-50%) scale(1); }
        }
      `}</style>
    </>
  );
}
