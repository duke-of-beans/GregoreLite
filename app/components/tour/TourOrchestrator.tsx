/**
 * TourOrchestrator — Sprint 38.0
 *
 * Root-level client component. Placed after all providers in app/layout.tsx.
 * Responsibilities:
 *   1. On mount: if tourCompleted is false, show WelcomeModal after 1500ms.
 *   2. When tourActive: render TourTooltip for the current step.
 *   3. AnimatePresence handles all mount/unmount animations.
 *   4. When completed or inactive → renders nothing.
 *
 * Does NOT block the app. Missing target elements are skipped silently by TourTooltip.
 */

'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/lib/stores/ui-store';
import { TOUR_STEPS } from '@/lib/tour/steps';
import { TourTooltip } from './TourTooltip';
import { WelcomeModal } from './WelcomeModal';

export function TourOrchestrator() {
  const tourCompleted = useUIStore((s) => s.tourCompleted);
  const tourActive    = useUIStore((s) => s.tourActive);
  const tourStep      = useUIStore((s) => s.tourStep);
  const advanceTour   = useUIStore((s) => s.advanceTour);
  const skipTour      = useUIStore((s) => s.skipTour);

  // Show WelcomeModal 1500ms after first mount if tour not yet completed
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (tourCompleted) return;
    const timer = setTimeout(() => setShowWelcome(true), 1500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally runs only on mount

  // Hide welcome modal once tour starts or is explicitly completed
  useEffect(() => {
    if (tourCompleted || tourActive) setShowWelcome(false);
  }, [tourCompleted, tourActive]);

  const currentStep = TOUR_STEPS[tourStep];

  return (
    <>
      {/* Welcome modal — first launch only */}
      <WelcomeModal open={showWelcome && !tourCompleted && !tourActive} />

      {/* Tour tooltips — active while tourActive */}
      <AnimatePresence mode="wait">
        {tourActive && currentStep && (
          <TourTooltip
            key={currentStep.id}
            step={currentStep}
            stepIndex={tourStep}
            totalSteps={TOUR_STEPS.length}
            onNext={advanceTour}
            onSkip={skipTour}
          />
        )}
      </AnimatePresence>
    </>
  );
}
