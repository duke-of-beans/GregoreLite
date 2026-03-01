/**
 * ReceiptPreferencePrompt Component
 * 
 * Asks user for orchestration display preference after 5th message.
 * Part of Phase 5.3 P3 - Orchestration Theater.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 5.2 (Message 5: Preference Prompt)
 */

'use client';

import { useState } from 'react';

export type ReceiptLevel = 'full' | 'compact' | 'minimal' | 'hidden';

export interface ReceiptPreference {
  level: ReceiptLevel;
  showCost: boolean;
  showModel: boolean;
  showGhost: boolean;
  showConfidence: boolean;
  expandable: boolean;
}

export interface ReceiptPreferencePromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preference: ReceiptPreference) => void;
}

export function ReceiptPreferencePrompt({
  isOpen,
  onClose,
  onSave,
}: ReceiptPreferencePromptProps) {
  const [selectedLevel, setSelectedLevel] = useState<ReceiptLevel>('compact');

  if (!isOpen) return null;

  const handleSave = () => {
    // Build preference object based on selected level
    const preference: ReceiptPreference = {
      level: selectedLevel,
      showCost: selectedLevel === 'full' || selectedLevel === 'compact',
      showModel: selectedLevel === 'full' || selectedLevel === 'compact',
      showGhost: selectedLevel !== 'hidden',
      showConfidence: selectedLevel === 'full',
      expandable: selectedLevel !== 'hidden',
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
        aria-labelledby="preference-title"
      >
        {/* Header */}
        <div className="mb-4 flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <h2
              id="preference-title"
              className="text-lg font-semibold text-[var(--ice-white)]"
            >
              Orchestration Display Settings
            </h2>
            <p className="mt-1 text-sm text-[var(--frost)]">
              You've seen how GREGORE works behind the scenes. How much detail would you
              like going forward?
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="mb-6 space-y-3">
          {/* Full Details */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--shadow)] bg-[var(--deep-space)]/30 p-3 transition-colors hover:border-[var(--cyan)]">
            <input
              type="radio"
              name="receipt-level"
              value="full"
              checked={selectedLevel === 'full'}
              onChange={(e) => setSelectedLevel(e.target.value as ReceiptLevel)}
              className="mt-0.5 h-4 w-4 text-[var(--cyan)] focus:ring-[var(--cyan)]"
            />
            <div className="flex-1">
              <div className="font-medium text-[var(--ice-white)]">
                Full details (always expanded)
              </div>
              <div className="mt-1 text-xs text-[var(--mist)]">
                See all orchestration details by default. Best for learning how GREGORE
                works.
              </div>
            </div>
          </label>

          {/* Compact (Recommended) */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-[var(--cyan)] bg-[var(--deep-space)]/50 p-3 transition-colors hover:bg-[var(--deep-space)]/70">
            <input
              type="radio"
              name="receipt-level"
              value="compact"
              checked={selectedLevel === 'compact'}
              onChange={(e) => setSelectedLevel(e.target.value as ReceiptLevel)}
              className="mt-0.5 h-4 w-4 text-[var(--cyan)] focus:ring-[var(--cyan)]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--ice-white)]">
                  Compact (expandable)
                </span>
                <span className="rounded bg-[var(--cyan)]/20 px-2 py-0.5 text-xs font-medium text-[var(--cyan)]">
                  Recommended
                </span>
              </div>
              <div className="mt-1 text-xs text-[var(--mist)]">
                Show summary with option to expand. Balanced between detail and focus.
              </div>
            </div>
          </label>

          {/* Minimal */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--shadow)] bg-[var(--deep-space)]/30 p-3 transition-colors hover:border-[var(--cyan)]">
            <input
              type="radio"
              name="receipt-level"
              value="minimal"
              checked={selectedLevel === 'minimal'}
              onChange={(e) => setSelectedLevel(e.target.value as ReceiptLevel)}
              className="mt-0.5 h-4 w-4 text-[var(--cyan)] focus:ring-[var(--cyan)]"
            />
            <div className="flex-1">
              <div className="font-medium text-[var(--ice-white)]">
                Minimal (essentials only)
              </div>
              <div className="mt-1 text-xs text-[var(--mist)]">
                Just the basics - status and cost. Clean and distraction-free.
              </div>
            </div>
          </label>

          {/* Hidden */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--shadow)] bg-[var(--deep-space)]/30 p-3 transition-colors hover:border-[var(--cyan)]">
            <input
              type="radio"
              name="receipt-level"
              value="hidden"
              checked={selectedLevel === 'hidden'}
              onChange={(e) => setSelectedLevel(e.target.value as ReceiptLevel)}
              className="mt-0.5 h-4 w-4 text-[var(--cyan)] focus:ring-[var(--cyan)]"
            />
            <div className="flex-1">
              <div className="font-medium text-[var(--ice-white)]">
                Hidden (on demand only)
              </div>
              <div className="mt-1 text-xs text-[var(--mist)]">
                Hide all receipts. Access via Cmd+I when needed.
              </div>
            </div>
          </label>
        </div>

        {/* Footer Note */}
        <div className="mb-4 rounded-md bg-[var(--deep-space)]/50 p-3 text-xs text-[var(--mist)]">
          You can change this anytime in <strong>Settings → Display → Receipts</strong>
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
