/**
 * BudgetPreferencePrompt Component
 * 
 * Onboarding prompt for budget display preferences (after first response).
 * Part of Phase 5.4 P4 - Settings & Polish.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 6.1 (Budget & Metrics Display)
 */

'use client';

import { useState } from 'react';

export type BudgetDisplayLevel = 'full' | 'simple' | 'hidden';

export interface BudgetPreference {
  level: BudgetDisplayLevel;
  showFullMetrics: boolean;
  showEfficiency: boolean;
  alertWhenLow: boolean;
  lowThreshold: number; // CT remaining to trigger alert
}

export interface BudgetPreferencePromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preference: BudgetPreference) => void;
}

export function BudgetPreferencePrompt({
  isOpen,
  onClose,
  onSave,
}: BudgetPreferencePromptProps) {
  const [selectedLevel, setSelectedLevel] = useState<BudgetDisplayLevel>('simple');
  const [showExplanation, setShowExplanation] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    const preference: BudgetPreference = {
      level: selectedLevel,
      showFullMetrics: selectedLevel === 'full',
      showEfficiency: selectedLevel === 'simple' || selectedLevel === 'full',
      alertWhenLow: true,
      lowThreshold: 20,
    };

    onSave(preference);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close prompt"
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-title"
      >
        {/* Header */}
        <div className="mb-4 flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <h2
              id="budget-title"
              className="text-lg font-semibold text-[var(--ice-white)]"
            >
              Budget & Efficiency Settings
            </h2>
            <p className="mt-1 text-sm text-[var(--frost)]">
              GREGORE optimizes your AI usage. Would you like to see:
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="mb-4 space-y-3">
          {/* Full Metrics */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--shadow)] bg-[var(--deep-space)]/30 p-3 transition-colors hover:border-[var(--cyan)]">
            <input
              type="radio"
              name="budget-level"
              value="full"
              checked={selectedLevel === 'full'}
              onChange={(e) => setSelectedLevel(e.target.value as BudgetDisplayLevel)}
              className="mt-0.5 h-4 w-4 text-[var(--cyan)] focus:ring-[var(--cyan)]"
            />
            <div className="flex-1">
              <div className="font-medium text-[var(--ice-white)]">
                Full metrics (budget, savings)
              </div>
              <div className="mt-1 text-xs text-[var(--mist)]">
                See detailed budget, cost tracking, and savings calculations.
              </div>
              <div className="mt-2 rounded bg-[var(--deep-space)]/50 px-2 py-1 font-mono text-xs text-[var(--cyan)]">
                💰 23/100 CT • Saved $0.14 today • 86% efficiency
              </div>
            </div>
          </label>

          {/* Simple Efficiency (Recommended) */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-[var(--cyan)] bg-[var(--deep-space)]/50 p-3 transition-colors hover:bg-[var(--deep-space)]/70">
            <input
              type="radio"
              name="budget-level"
              value="simple"
              checked={selectedLevel === 'simple'}
              onChange={(e) => setSelectedLevel(e.target.value as BudgetDisplayLevel)}
              className="mt-0.5 h-4 w-4 text-[var(--cyan)] focus:ring-[var(--cyan)]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--ice-white)]">
                  Simple efficiency
                </span>
                <span className="rounded bg-[var(--cyan)]/20 px-2 py-0.5 text-xs font-medium text-[var(--cyan)]">
                  Recommended
                </span>
              </div>
              <div className="mt-1 text-xs text-[var(--mist)]">
                Just the efficiency score - clean and focused.
              </div>
              <div className="mt-2 rounded bg-[var(--deep-space)]/50 px-2 py-1 font-mono text-xs text-[var(--cyan)]">
                ⚡ 86% efficiency
              </div>
            </div>
          </label>

          {/* Hidden */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--shadow)] bg-[var(--deep-space)]/30 p-3 transition-colors hover:border-[var(--cyan)]">
            <input
              type="radio"
              name="budget-level"
              value="hidden"
              checked={selectedLevel === 'hidden'}
              onChange={(e) => setSelectedLevel(e.target.value as BudgetDisplayLevel)}
              className="mt-0.5 h-4 w-4 text-[var(--cyan)] focus:ring-[var(--cyan)]"
            />
            <div className="flex-1">
              <div className="font-medium text-[var(--ice-white)]">
                Hidden (only alert when low)
              </div>
              <div className="mt-1 text-xs text-[var(--mist)]">
                No budget display unless you're running low (&lt;20 CT).
              </div>
            </div>
          </label>
        </div>

        {/* Explanation Toggle */}
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="mb-4 text-sm text-[var(--cyan)] transition-colors hover:text-[var(--cyan-light)]"
        >
          {showExplanation ? '▼' : '▶'} What are cognitive tokens (CT)?
        </button>

        {showExplanation && (
          <div className="mb-4 rounded-md bg-[var(--deep-space)]/50 p-3 text-xs text-[var(--mist)]">
            Your daily budget of <strong className="text-[var(--ice-white)]">100 CT</strong>{' '}
            helps GREGORE optimize which AI model to use based on your query complexity.
            Simple questions use cheaper models, complex ones use powerful models. This
            keeps costs low while ensuring quality responses.
          </div>
        )}

        {/* Footer Note */}
        <div className="mb-4 rounded-md bg-[var(--deep-space)]/50 p-3 text-xs text-[var(--mist)]">
          You can change this anytime in <strong>Settings → Display → Budget</strong>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--shadow)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--frost)] transition-colors hover:border-[var(--cyan)] hover:text-[var(--ice-white)]"
          >
            Skip for Now
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-[var(--cyan)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--cyan-dark)]"
          >
            Save Preference
          </button>
        </div>
      </div>
    </>
  );
}
