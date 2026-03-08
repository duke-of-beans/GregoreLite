/**
 * WelcomeModal — Sprint 38.0
 *
 * First-launch welcome screen. Fires when tourCompleted === false.
 * Two paths: "Show me around" starts the tour, "I'll explore myself" marks it complete.
 * Framer Motion fade + scale animation. Semi-transparent backdrop.
 */

'use client';

import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useUIStore } from '@/lib/stores/ui-store';
import { TOUR } from '@/lib/voice/copy-templates';

const backdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

const modalVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.92, y: 16 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.25, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.95, y: 8,  transition: { duration: 0.15 } },
};

interface WelcomeModalProps {
  open: boolean;
}

export function WelcomeModal({ open }: WelcomeModalProps) {
  const startTour    = useUIStore((s) => s.startTour);
  const completeTour = useUIStore((s) => s.completeTour);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="welcome-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.72)',
              zIndex: 10000,
            }}
            onClick={completeTour}
            aria-hidden="true"
          />

          {/* Modal card */}
          <motion.div
            key="welcome-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              position:  'fixed',
              top:       '50%',
              left:      '50%',
              transform: 'translate(-50%, -50%)',
              zIndex:    10001,
              width:     400,
              background: 'var(--elevated, #0d1117)',
              border:    '1px solid var(--shadow)',
              borderRadius: 12,
              padding:   32,
              boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
              textAlign: 'center',
            }}
            role="dialog"
            aria-modal="true"
            aria-label={TOUR.welcome_title}
          >
            {/* Logo */}
            <img
              src="/gregore-logo.png"
              alt="GregLite"
              width={56}
              height={56}
              style={{ borderRadius: 12, margin: '0 auto 20px' }}
            />

            {/* Title */}
            <h1 style={{
              fontSize: 22, fontWeight: 700,
              color: 'var(--ice-white)', margin: '0 0 10px',
              letterSpacing: '-0.02em',
            }}>
              {TOUR.welcome_title}
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: 13, color: 'var(--mist)',
              lineHeight: 1.6, margin: '0 0 28px',
            }}>
              {TOUR.welcome_subtitle}
            </p>

            {/* CTA buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={startTour}
                style={{
                  width: '100%', padding: '10px 0',
                  background: 'var(--cyan)', border: 'none',
                  borderRadius: 6, cursor: 'pointer',
                  fontSize: 14, fontWeight: 600, color: '#000',
                }}
              >
                {TOUR.welcome_cta_primary}
              </button>
              <button
                onClick={completeTour}
                style={{
                  width: '100%', padding: '10px 0',
                  background: 'none',
                  border: '1px solid var(--shadow)',
                  borderRadius: 6, cursor: 'pointer',
                  fontSize: 13, color: 'var(--frost)',
                }}
              >
                {TOUR.welcome_cta_secondary}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
