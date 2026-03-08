'use client';

/**
 * OnboardingFlow — 5-step wizard container
 * Sprint 8D: manages step routing and progress indicator.
 * Sprint 39.0: added Import step (index 3) between Aegis and Ready.
 */

import { useState, useCallback } from 'react';
import { OnboardingStep1ApiKey }  from './OnboardingStep1ApiKey';
import { OnboardingStep2Kernl }   from './OnboardingStep2Kernl';
import { OnboardingStep3Aegis }   from './OnboardingStep3Aegis';
import { OnboardingStep5Import }  from './OnboardingStep5Import';
import { OnboardingStep4Ready }   from './OnboardingStep4Ready';

const STEPS = [
  { key: 'api-key', label: 'API Key' },
  { key: 'kernl',   label: 'Memory' },
  { key: 'aegis',   label: 'System Monitor' },
  { key: 'import',  label: 'Import' },
  { key: 'ready',   label: 'Launch' },
] as const;

interface Props {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  const advance = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--deep-space)]">
      <div className="w-full max-w-lg mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Gregore Lite</h1>
          <p className="text-sm text-gray-500">First-run setup</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  i < currentStep
                    ? 'bg-green-600 text-white'
                    : i === currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-500'
                }`}
              >
                {i < currentStep ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${i < currentStep ? 'bg-green-600' : 'bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          {currentStep === 0 && (
            <OnboardingStep1ApiKey onComplete={advance} onSkip={advance} />
          )}
          {currentStep === 1 && <OnboardingStep2Kernl onComplete={advance} />}
          {currentStep === 2 && <OnboardingStep3Aegis onComplete={advance} />}
          {currentStep === 3 && (
            <OnboardingStep5Import onNext={advance} onSkip={advance} />
          )}
          {currentStep === 4 && <OnboardingStep4Ready onComplete={onComplete} />}
        </div>

        {/* Step label */}
        <p className="text-center text-xs text-gray-600 mt-4">
          Step {currentStep + 1} of {STEPS.length} — {STEPS[currentStep]?.label}
        </p>
      </div>
    </div>
  );
}
