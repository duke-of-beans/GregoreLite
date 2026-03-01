/**
 * OverrideModal Component
 * 
 * Three-choice pattern for Ghost warnings.
 * Part of Phase 5.1 P1 - Ghost System.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 3.1 (Three-Choice Pattern)
 */

'use client';

import { useState } from 'react';
import type { OverrideCategory, OverridePolicyAction } from '@/lib/override-policies';

export interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (action: OverridePolicyAction) => void;
  ghostMessage: string;
  category: OverrideCategory;
  isVeto?: boolean; // Absolute safety boundary
}

export function OverrideModal({
  isOpen,
  onClose,
  onChoose,
  ghostMessage,
  category,
  isVeto = false,
}: OverrideModalProps) {
  const [selectedAction, setSelectedAction] = useState<OverridePolicyAction>('once');

  if (!isOpen) return null;

  // Format category for display
  const formatCategory = (cat: string) => {
    return cat
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleProceed = () => {
    onChoose(selectedAction);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--shadow)] bg-[var(--elevated)] p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="override-title"
      >
        {/* Header */}
        <div className="mb-4 flex items-start gap-3">
          {isVeto ? (
            <svg
              className="h-6 w-6 flex-shrink-0 text-[var(--error)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6 flex-shrink-0 text-[var(--warning)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
          <div className="flex-1">
            <h2
              id="override-title"
              className="text-lg font-semibold text-[var(--ice-white)]"
            >
              {isVeto ? '⛔ Cannot Override' : '⚠ Ghost Detected Risk'}
            </h2>
            <p className="mt-1 text-sm text-[var(--frost)]">
              Risk Category: {formatCategory(category)}
            </p>
          </div>
        </div>

        {/* Message */}
        <div className="mb-6 rounded-lg bg-[var(--deep-space)]/50 p-4">
          <p className="text-sm leading-relaxed text-[var(--ice-white)]">
            {ghostMessage}
          </p>
        </div>

        {isVeto ? (
          /* Absolute Safety Boundary - No Override */
          <>
            <div className="mb-6 rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 p-4">
              <p className="text-sm text-[var(--ice-white)]">
                This request violates absolute safety boundaries (Sacred Law 12).
                These protections cannot be disabled through override policies.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg bg-[var(--frost)] px-4 py-2 text-sm font-medium text-[var(--deep-space)] transition-colors hover:bg-[var(--ice-white)]"
              >
                Understood
              </button>
            </div>
          </>
        ) : (
          /* Three-Choice Pattern */
          <>
            <div className="mb-6 space-y-3">
              <p className="text-sm font-medium text-[var(--frost)]">
                How should I handle this?
              </p>

              {/* Choice 1: Just This Once */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--shadow)] bg-[var(--deep-space)]/30 p-3 transition-colors hover:border-[var(--cyan)] hover:bg-[var(--deep-space)]/50">
                <input
                  type="radio"
                  name="override-action"
                  value="once"
                  checked={selectedAction === 'once'}
                  onChange={(e) => setSelectedAction(e.target.value as OverridePolicyAction)}
                  className="mt-0.5 h-4 w-4 text-[var(--cyan)] focus:ring-[var(--cyan)]"
                />
                <div className="flex-1">
                  <div className="font-medium text-[var(--ice-white)]">Just this once</div>
                  <div className="mt-1 text-xs text-[var(--mist)]">
                    Allow this specific request. Ghost will warn again next time.
                  </div>
                </div>
              </label>

              {/* Choice 2: Always Allow Category */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--shadow)] bg-[var(--deep-space)]/30 p-3 transition-colors hover:border-[var(--cyan)] hover:bg-[var(--deep-space)]/50">
                <input
                  type="radio"
                  name="override-action"
                  value="always"
                  checked={selectedAction === 'always'}
                  onChange={(e) => setSelectedAction(e.target.value as OverridePolicyAction)}
                  className="mt-0.5 h-4 w-4 text-[var(--cyan)] focus:ring-[var(--cyan)]"
                />
                <div className="flex-1">
                  <div className="font-medium text-[var(--ice-white)]">
                    Always allow ({formatCategory(category)})
                  </div>
                  <div className="mt-1 text-xs text-[var(--mist)]">
                    Create policy for this category. Future similar requests auto-allowed.
                  </div>
                </div>
              </label>

              {/* Choice 3: Never Warn */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--shadow)] bg-[var(--deep-space)]/30 p-3 transition-colors hover:border-[var(--cyan)] hover:bg-[var(--deep-space)]/50">
                <input
                  type="radio"
                  name="override-action"
                  value="never"
                  checked={selectedAction === 'never'}
                  onChange={(e) => setSelectedAction(e.target.value as OverridePolicyAction)}
                  className="mt-0.5 h-4 w-4 text-[var(--cyan)] focus:ring-[var(--cyan)]"
                />
                <div className="flex-1">
                  <div className="font-medium text-[var(--ice-white)]">
                    Never warn about this again
                  </div>
                  <div className="mt-1 text-xs text-[var(--mist)]">
                    Ghost stops warning for this entire category. Manage in settings.
                  </div>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-[var(--shadow)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--frost)] transition-colors hover:border-[var(--cyan)] hover:text-[var(--ice-white)]"
              >
                Cancel
              </button>
              <button
                onClick={handleProceed}
                className="flex-1 rounded-lg bg-[var(--cyan)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--cyan-dark)]"
              >
                Proceed
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
