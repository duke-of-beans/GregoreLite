/**
 * CaptureToast — Sprint 29.0
 *
 * Ultra-brief confirmation toast after a capture.
 * Appears bottom-center, auto-dismisses after 2 seconds.
 * Slide-up + fade-in on appear. Slide-down + fade-out on dismiss.
 *
 * Voice: Greg's voice throughout. "Captured." not "Note saved successfully!"
 */

'use client';

import { useState, useEffect } from 'react';
import { CAPTURE } from '@/lib/voice/copy-templates';

export interface CaptureToastData {
  variant: 'captured' | 'merged' | 'routed' | 'unrouted';
  mentionCount?: number;
  projectName?: string;
}

interface CaptureToastProps {
  data: CaptureToastData | null;
  onDismiss: () => void;
}

function getMessage(data: CaptureToastData): string {
  switch (data.variant) {
    case 'merged':
      return CAPTURE.toast.merged(data.mentionCount ?? 2);
    case 'routed':
      return data.projectName
        ? CAPTURE.toast.routed(data.projectName)
        : CAPTURE.toast.captured;
    case 'unrouted':
      return CAPTURE.toast.unrouted;
    case 'captured':
    default:
      return CAPTURE.toast.captured;
  }
}

export function CaptureToast({ data, onDismiss }: CaptureToastProps) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!data) return;

    setVisible(true);
    setLeaving(false);

    const leaveTimer = setTimeout(() => {
      setLeaving(true);
    }, 1600);

    const dismissTimer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 2000);

    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(dismissTimer);
    };
  }, [data, onDismiss]);

  if (!data || !visible) return null;

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          background: 'var(--elevated)',
          border: '1px solid var(--shadow)',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
          color: 'var(--ice-white)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          whiteSpace: 'nowrap',
          animation: leaving
            ? 'captureToastOut 400ms ease-in forwards'
            : 'captureToastIn 200ms ease-out forwards',
        }}
      >
        {getMessage(data)}
      </div>
      <style>{`
        @keyframes captureToastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes captureToastOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to   { opacity: 0; transform: translateX(-50%) translateY(12px); }
        }
      `}</style>
    </>
  );
}
