'use client';

/**
 * OnboardingStep5Import — Sprint 39.0
 *
 * "Import previous conversations" step in the onboarding wizard.
 * Sits between the System Monitor step (Aegis) and the Ready step.
 *
 * This is a shell — it surfaces the IMPORT copy and drop-zone styling
 * so users understand the feature. Actual file processing is handled
 * by the full ImportFlow in Settings → Memory & Background.
 *
 * Props:
 *   onNext  — advance to the Ready step (user imported or will later)
 *   onSkip  — same destination; shown as a lower-emphasis link
 */

import { useState, useRef } from 'react';
import { IMPORT } from '@/lib/voice/copy-templates';

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

export function OnboardingStep5Import({ onNext, onSkip }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop visual feedback only — no processing wired at onboarding stage
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }
  function handleDragLeave() {
    setDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    // Treat any drop as "done for now" and advance — full import happens in Settings
    onNext();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Heading */}
      <div>
        <h2 style={{
          fontSize:     16,
          fontWeight:   600,
          color:        'var(--text)',
          marginBottom: 6,
        }}>
          {IMPORT.section_title}
        </h2>
        <p style={{
          fontSize:   13,
          color:      'var(--dim)',
          lineHeight: 1.55,
          margin:     0,
        }}>
          {IMPORT.section_description}
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border:        `1.5px dashed ${dragging ? 'var(--cyan)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius:  10,
          padding:       '28px 20px',
          textAlign:     'center',
          cursor:        'pointer',
          background:    dragging ? 'rgba(0, 212, 255, 0.04)' : 'rgba(255,255,255,0.02)',
          transition:    'border-color 0.15s, background 0.15s',
        }}
      >
        <p style={{
          fontSize:     13,
          color:        dragging ? 'var(--cyan)' : 'var(--mist)',
          margin:       '0 0 4px',
          fontWeight:   500,
        }}>
          {dragging ? IMPORT.dropzone_dragging : IMPORT.dropzone_idle}
        </p>
        <p style={{ fontSize: 11, color: 'var(--dim)', margin: 0 }}>
          {IMPORT.dropzone_hint}
        </p>
        {/* Hidden file input for click-to-browse */}
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.json"
          style={{ display: 'none' }}
          onChange={() => onNext()}
        />
      </div>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={onNext}
        style={{
          width:        '100%',
          padding:      '10px 0',
          borderRadius: 8,
          background:   'var(--cyan)',
          color:        'var(--deep-space)',
          fontSize:     13,
          fontWeight:   600,
          border:       'none',
          cursor:       'pointer',
          letterSpacing:'0.02em',
        }}
      >
        {IMPORT.done_for_now}
      </button>

      {/* Skip link */}
      <button
        type="button"
        onClick={onSkip}
        style={{
          background: 'transparent',
          border:     'none',
          color:      'var(--dim)',
          fontSize:   12,
          cursor:     'pointer',
          textAlign:  'center',
          padding:    0,
          textDecoration: 'underline',
          textUnderlineOffset: 2,
        }}
      >
        Skip for now
      </button>

    </div>
  );
}
