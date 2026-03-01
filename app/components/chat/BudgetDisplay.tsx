/**
 * BudgetDisplay Component
 * 
 * Shows budget/efficiency metrics based on user preference.
 * Part of Phase 5.4 P4 - Settings & Polish.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 6.1 (Receipt variations by preference)
 */

'use client';

import type { BudgetDisplayLevel } from './BudgetPreferencePrompt';

export interface BudgetMetrics {
  tokensUsed: number;
  tokensTotal: number;
  savedToday: number;
  efficiency: number; // 0-1
}

export interface BudgetDisplayProps {
  metrics: BudgetMetrics;
  level: BudgetDisplayLevel;
}

export function BudgetDisplay({ metrics, level }: BudgetDisplayProps) {
  const { tokensUsed, tokensTotal, savedToday, efficiency } = metrics;
  const tokensRemaining = tokensTotal - tokensUsed;
  const isLow = tokensRemaining < 20;

  // Hidden level - only show when low
  if (level === 'hidden') {
    if (!isLow) return null;
    
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
        <svg
          className="h-4 w-4 flex-shrink-0"
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
        <span>
          <strong>Low budget:</strong> {tokensRemaining.toFixed(1)} CT remaining
        </span>
      </div>
    );
  }

  // Simple efficiency
  if (level === 'simple') {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--mist)]">
        <span className="text-[var(--cyan)]">⚡</span>
        <span>{Math.round(efficiency * 100)}% efficiency</span>
        {isLow && (
          <span className="text-[var(--warning)]">
            • {tokensRemaining.toFixed(1)} CT left
          </span>
        )}
      </div>
    );
  }

  // Full metrics
  return (
    <div className="flex items-center gap-3 text-xs text-[var(--mist)]">
      <span className="text-[var(--cyan)]">💰</span>
      <span>
        {tokensUsed.toFixed(1)}/{tokensTotal} CT
      </span>
      <span>•</span>
      <span>Saved ${savedToday.toFixed(2)} today</span>
      <span>•</span>
      <span className={isLow ? 'text-[var(--warning)]' : ''}>
        {Math.round(efficiency * 100)}% efficiency
      </span>
    </div>
  );
}
