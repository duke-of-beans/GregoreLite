/**
 * ReceiptFooter Component
 * 
 * Orchestration details (collapsed/expanded).
 * Part of Phase 5.1 P1 - Ghost System + Phase 5.3 P3 - Orchestration Theater.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 2.3 (Layer 3 - Post-Send Detail)
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 6.1 (Receipt variations by preference)
 */

'use client';

import { useState } from 'react';
import type { ChatResponse } from '@/lib/api/types';
import type { ReceiptLevel } from './ReceiptPreferencePrompt';

export interface ReceiptFooterProps {
  response: ChatResponse;
  level?: ReceiptLevel | undefined; // User preference level
  isAutoAllowed?: boolean | undefined;
  policyName?: string | undefined;
  onReviewPolicy?: (() => void) | undefined;
  onWarnThisTime?: (() => void) | undefined;
}

export function ReceiptFooter({
  response,
  level = 'compact',
  isAutoAllowed = false,
  policyName,
  onReviewPolicy,
  onWarnThisTime,
}: ReceiptFooterProps) {
  const [isExpanded, setIsExpanded] = useState(level === 'full');

  const {
    ghostMetrics,
    metabolismMetrics,
    strategy,
    modelsUsed,
    totalCost,
    totalLatencyMs,
  } = response;

  // Hidden level - return null
  if (level === 'hidden') {
    return null;
  }

  // Minimal level - just status line
  if (level === 'minimal') {
    return (
      <div className="mt-2 flex items-center justify-between rounded-lg bg-[var(--elevated)]/30 px-4 py-2 text-xs text-[var(--mist)]">
        <span>
          ✓ Ghost validated • ${totalCost.toFixed(4)} • {totalLatencyMs}ms
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg bg-[var(--elevated)]/30 px-4 py-2 text-xs">
      {isExpanded ? (
        /* Expanded State */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ice-white)]">
              🤖 Orchestration Details
            </h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-[var(--frost)] transition-colors hover:text-[var(--cyan)]"
              aria-label="Collapse details"
            >
              [Collapse]
            </button>
          </div>

          {/* Ghost Checks */}
          <div>
            <div className="mb-1 font-medium text-[var(--frost)]">Ghost Checks:</div>
            <ul className="space-y-0.5 text-[var(--mist)]">
              <li>
                • Pre-send:{' '}
                {ghostMetrics.preApproval ? (
                  <span className="text-[var(--success)]">✓ Request validated</span>
                ) : (
                  <span className="text-[var(--warning)]">⚠ Issues detected</span>
                )}
              </li>
              <li>
                • Post-send:{' '}
                {ghostMetrics.postApproval ? (
                  <span className="text-[var(--success)]">✓ Response verified</span>
                ) : (
                  <span className="text-[var(--warning)]">⚠ Review needed</span>
                )}
              </li>
              <li>
                • R-score: {ghostMetrics.rMetric.toFixed(2)}{' '}
                {ghostMetrics.rMetric > 0 && (
                  <span className="text-[var(--success)]">(self-aware)</span>
                )}
              </li>
              {ghostMetrics.sacredLawsViolated > 0 && (
                <li className="text-[var(--warning)]">
                  • Sacred Laws: {ghostMetrics.sacredLawsViolated} violation(s)
                </li>
              )}
            </ul>
          </div>

          {/* Model Selection */}
          <div>
            <div className="mb-1 font-medium text-[var(--frost)]">Model Selection:</div>
            <ul className="space-y-0.5 text-[var(--mist)]">
              <li>• {modelsUsed.join(', ')} (${totalCost.toFixed(4)})</li>
              <li>• Strategy: {strategy}</li>
              <li>• Latency: {totalLatencyMs}ms</li>
            </ul>
          </div>

          {/* Budget Metrics */}
          {metabolismMetrics && (
            <div>
              <div className="mb-1 font-medium text-[var(--frost)]">Budget:</div>
              <ul className="space-y-0.5 text-[var(--mist)]">
                <li>
                  • CT used: {metabolismMetrics.cognitiveTokensUsed.toFixed(1)} /{' '}
                  {metabolismMetrics.budgetRemaining.toFixed(1)} remaining
                </li>
                <li>
                  • Efficiency:{' '}
                  {(metabolismMetrics.costAccuracy * 100).toFixed(0)}%
                </li>
                <li>
                  • Status:{' '}
                  <span
                    className={
                      metabolismMetrics.budgetStatus === 'ok'
                        ? 'text-[var(--success)]'
                        : metabolismMetrics.budgetStatus === 'warning'
                          ? 'text-[var(--warning)]'
                          : 'text-[var(--error)]'
                    }
                  >
                    {metabolismMetrics.budgetStatus.toUpperCase()}
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>
      ) : (
        /* Collapsed State */
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--mist)]">
            <span>💡</span>
            <span>
              {ghostMetrics.preApproval && ghostMetrics.postApproval ? (
                '✓ Ghost validated'
              ) : (
                '⚠ Ghost flagged issues'
              )}{' '}
              • ${totalCost.toFixed(4)} • {totalLatencyMs}ms
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-[var(--frost)] transition-colors hover:text-[var(--cyan)]"
            aria-label="Expand details"
          >
            [Expand for details]
          </button>
        </div>
      )}

      {/* Auto-Allowed Note */}
      {isAutoAllowed && policyName && (
        <div className="mt-2 rounded-md border border-[var(--cyan)]/30 bg-[var(--cyan)]/10 p-2">
          <div className="mb-1 flex items-center gap-2">
            <svg className="h-4 w-4 text-[var(--cyan)]" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-[var(--cyan)]">Auto-allowed by override policy</span>
          </div>
          <div className="text-[var(--mist)]">Policy: {policyName}</div>
          {onReviewPolicy && onWarnThisTime && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={onReviewPolicy}
                className="text-[var(--cyan)] hover:underline"
              >
                Review policy
              </button>
              <span className="text-[var(--mist)]">•</span>
              <button
                onClick={onWarnThisTime}
                className="text-[var(--cyan)] hover:underline"
              >
                Warn me this time
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
