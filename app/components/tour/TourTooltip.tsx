'use client';
/**
 * TourTooltip — Sprint 38.0
 *
 * Renders a spotlight overlay + anchored tooltip card for a single tour step.
 * - Spotlight: rgba(0,0,0,0.6) full-page overlay; target element "cut out" via box-shadow inset.
 * - Tooltip card: dark bg, 1px cyan border, anchored to target via getBoundingClientRect.
 * - If target not found in DOM → calls onSkip silently (no crash, no empty card).
 * - Keyboard: Escape → skip, ArrowRight/Enter → advance.
 */


import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import type { TourStep } from '@/lib/tour/steps';
import { TOUR } from '@/lib/voice/copy-templates';

const TOOLTIP_WIDTH = 300;
const TOOLTIP_MAX_HEIGHT = 200;
const GAP = 12; // px between target edge and tooltip

interface TooltipRect {
  top: number;
  left: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right';
}

function computePosition(
  targetRect: DOMRect,
  position: TourStep['position'],
): TooltipRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = 0;
  let left = 0;
  let arrowSide: TooltipRect['arrowSide'] = 'bottom';

  switch (position) {
    case 'bottom':
      top  = targetRect.bottom + GAP;
      left = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2;
      arrowSide = 'top';
      break;
    case 'top':
      top  = targetRect.top - TOOLTIP_MAX_HEIGHT - GAP;
      left = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2;
      arrowSide = 'bottom';
      break;
    case 'right':
      top  = targetRect.top + targetRect.height / 2 - TOOLTIP_MAX_HEIGHT / 2;
      left = targetRect.right + GAP;
      arrowSide = 'left';
      break;
    case 'left':
      top  = targetRect.top + targetRect.height / 2 - TOOLTIP_MAX_HEIGHT / 2;
      left = targetRect.left - TOOLTIP_WIDTH - GAP;
      arrowSide = 'right';
      break;
  }

  // Clamp within viewport
  left = Math.max(8, Math.min(left, vw - TOOLTIP_WIDTH - 8));
  top  = Math.max(8, Math.min(top,  vh - TOOLTIP_MAX_HEIGHT - 8));

  return { top, left, arrowSide };
}

const popoverVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1,    transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

interface TourTooltipProps {
  step: TourStep;
  stepIndex: number;      // 0-based
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

export function TourTooltip({ step, stepIndex, totalSteps, onNext, onSkip }: TourTooltipProps) {
  const [pos, setPos]         = useState<TooltipRect | null>(null);
  const [spotRect, setSpot]   = useState<DOMRect | null>(null);
  const isLastStep            = stepIndex === totalSteps - 1;
  const rafRef                = useRef<number | null>(null);

  // Resolve target and compute position
  const resolve = useCallback(() => {
    const el = document.querySelector<HTMLElement>(step.target);
    if (!el) {
      // Target not in DOM — skip silently
      onSkip();
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      onSkip();
      return;
    }
    setSpot(rect);
    setPos(computePosition(rect, step.position));
  }, [step, onSkip]);

  useEffect(() => {
    resolve();
    // Re-resolve on resize
    window.addEventListener('resize', resolve);
    return () => window.removeEventListener('resize', resolve);
  }, [resolve]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')                     { e.preventDefault(); onSkip(); }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); onNext(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNext, onSkip]);

  // Cleanup RAF on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  if (!pos || !spotRect) return null;

  const pad = step.spotlightPadding ?? 4;

  // Arrow styles
  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  };
  if (pos.arrowSide === 'bottom') {
    Object.assign(arrowStyle, {
      bottom: -8, left: '50%', transform: 'translateX(-50%)',
      borderWidth: '8px 8px 0 8px',
      borderColor: 'var(--cyan) transparent transparent transparent',
    });
  } else if (pos.arrowSide === 'top') {
    Object.assign(arrowStyle, {
      top: -8, left: '50%', transform: 'translateX(-50%)',
      borderWidth: '0 8px 8px 8px',
      borderColor: 'transparent transparent var(--cyan) transparent',
    });
  } else if (pos.arrowSide === 'left') {
    Object.assign(arrowStyle, {
      left: -8, top: '50%', transform: 'translateY(-50%)',
      borderWidth: '8px 8px 8px 0',
      borderColor: 'transparent var(--cyan) transparent transparent',
    });
  } else {
    Object.assign(arrowStyle, {
      right: -8, top: '50%', transform: 'translateY(-50%)',
      borderWidth: '8px 0 8px 8px',
      borderColor: 'transparent transparent transparent var(--cyan)',
    });
  }

  return (
    <>
      {/* Spotlight overlay — full page with inset box-shadow cutout around target */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9000,
          pointerEvents: 'none',
          boxShadow: `0 0 0 9999px rgba(0,0,0,0.6), inset 0 0 0 ${pad}px rgba(0,212,232,0.15)`,
          borderRadius: 0,
          top:    spotRect.top    - pad,
          left:   spotRect.left   - pad,
          width:  spotRect.width  + pad * 2,
          height: spotRect.height + pad * 2,
        }}
      />


      {/* Tooltip card */}
      <AnimatePresence>
        <motion.div
          key={step.id}
          variants={popoverVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            position:  'fixed',
            top:       pos.top,
            left:      pos.left,
            width:     TOOLTIP_WIDTH,
            zIndex:    9001,
            background: 'var(--bg-elevated, #0d1117)',
            border:    '1px solid var(--cyan)',
            borderRadius: 8,
            padding:   16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
        >
          {/* Arrow */}
          <div style={arrowStyle} aria-hidden="true" />

          {/* Step counter */}
          <p style={{ fontSize: 10, color: 'var(--mist)', margin: '0 0 6px', letterSpacing: '0.05em' }}>
            {TOUR.step_counter(stepIndex + 1, totalSteps)}
          </p>

          {/* Progress dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '0 0 10px' }}>
            {Array.from({ length: totalSteps }).map((_, i) => {
              const isCompleted = i < stepIndex;
              const isCurrent   = i === stepIndex;
              return (
                <span
                  key={i}
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width:  isCurrent ? 8 : 6,
                    height: isCurrent ? 8 : 6,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: isCompleted
                      ? 'var(--mist)'
                      : isCurrent
                        ? 'var(--cyan)'
                        : 'transparent',
                    border: isCompleted
                      ? 'none'
                      : isCurrent
                        ? '1.5px solid var(--cyan)'
                        : '1.5px solid var(--mist)',
                    boxShadow: isCurrent ? '0 0 6px var(--cyan)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                />
              );
            })}
          </div>

          {/* Title */}
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', margin: '0 0 8px' }}>
            {step.title}
          </p>

          {/* Body */}
          <p style={{ fontSize: 12, color: 'var(--frost)', lineHeight: 1.6, margin: '0 0 16px' }}>
            {step.body}
          </p>

          {/* Action row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={onSkip}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--mist)', padding: '4px 0',
              }}
            >
              {TOUR.skip_button}
            </button>
            <button
              onClick={onNext}
              style={{
                background: 'var(--cyan)', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: '#000',
                padding: '6px 14px', borderRadius: 4,
              }}
            >
              {isLastStep ? TOUR.finish_button : TOUR.next_button}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
