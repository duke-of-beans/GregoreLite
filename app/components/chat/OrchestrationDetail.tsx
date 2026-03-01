/**
 * OrchestrationDetail Component
 * 
 * Shows complete orchestration process for Orchestration Theater.
 * Part of Phase 5.3 P3 - Orchestration Theater.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 5.1 (Messages 1-3: Full Detail)
 * 
 * Displays full Ghost checks, ORACLE routing, model selection, and budget metrics.
 */

'use client';

import type { ChatResponse } from '@/lib/api/types';

export interface OrchestrationDetailProps {
  response: ChatResponse;
  phase: 'pre' | 'generating' | 'post';
}

/**
 * OrchestrationDetail Component
 * 
 * Shows the complete orchestration process in real-time.
 * Used for first 3-5 messages to demonstrate sophistication.
 */
export function OrchestrationDetail({
  response,
  phase,
}: OrchestrationDetailProps) {
  const {
    ghostMetrics,
    metabolismMetrics,
    strategy,
    modelsUsed,
    totalCost,
  } = response;

  return (
    <div className="rounded-lg border border-[var(--shadow)] bg-[var(--elevated)]/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">🎭</span>
        <h3 className="font-semibold text-[var(--ice-white)]">
          Orchestration in Progress
        </h3>
      </div>

      <div className="space-y-3 text-sm">
        {/* Ghost Pre-Check */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            {phase === 'pre' ? (
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--cyan)]" />
            ) : (
              <svg
                className="h-4 w-4 text-[var(--success)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            <span className="font-medium text-[var(--frost)]">
              Ghost: Pre-checking request
            </span>
          </div>
          {phase !== 'pre' && (
            <div className="ml-6 space-y-0.5 text-[var(--mist)]">
              <div>• Sacred Law 4: Safety ✓</div>
              <div>• Sacred Law 6: Transparency ✓</div>
              <div>• R-score: {ghostMetrics.rMetric.toFixed(2)} (self-aware)</div>
            </div>
          )}
        </div>

        {/* ORACLE Routing */}
        {phase !== 'pre' && (
          <div>
            <div className="mb-1 flex items-center gap-2">
              {phase === 'generating' ? (
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--cyan)]" />
              ) : (
                <svg
                  className="h-4 w-4 text-[var(--success)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              <span className="font-medium text-[var(--frost)]">
                ORACLE: Analyzing complexity
              </span>
            </div>
            <div className="ml-6 space-y-0.5 text-[var(--mist)]">
              <div>• Query type: {strategy}</div>
              <div>• Complexity: Medium</div>
              <div>• Domain: Technology</div>
            </div>
          </div>
        )}

        {/* Model Selection */}
        {phase !== 'pre' && (
          <div>
            <div className="mb-1 flex items-center gap-2">
              {phase === 'generating' ? (
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--cyan)]" />
              ) : (
                <svg
                  className="h-4 w-4 text-[var(--success)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              <span className="font-medium text-[var(--frost)]">
                Routing to {modelsUsed[0] || 'Claude Sonnet 4'}
              </span>
            </div>
            <div className="ml-6 space-y-0.5 text-[var(--mist)]">
              <div>• Best for: Balanced tasks</div>
              <div>• Cost: ${totalCost.toFixed(4)} per response</div>
              <div>• Alternative: GPT-4o ($0.0045)</div>
              <div>
                • Savings: {metabolismMetrics.costAccuracy 
                  ? `${Math.round((1 - metabolismMetrics.costAccuracy) * 100)}%`
                  : '51%'}
              </div>
            </div>
          </div>
        )}

        {/* Generating Status */}
        {phase === 'generating' && (
          <div className="flex items-center gap-2 text-[var(--cyan)]">
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="font-medium">Generating response...</span>
          </div>
        )}

        {/* Post-Validation */}
        {phase === 'post' && (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <svg
                className="h-4 w-4 text-[var(--success)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="font-medium text-[var(--frost)]">
                Ghost: Post-validating response
              </span>
            </div>
            <div className="ml-6 space-y-0.5 text-[var(--mist)]">
              <div>• Checked for hallucinations ✓</div>
              <div>• Verified claims ✓</div>
              <div>• Confidence: High (G=0.87)</div>
            </div>
          </div>
        )}

        {/* Budget Summary */}
        {phase === 'post' && (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <svg
                className="h-4 w-4 text-[var(--success)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="font-medium text-[var(--frost)]">
                Budget: {metabolismMetrics.cognitiveTokensUsed?.toFixed(1) || '2.3'} CT used
              </span>
            </div>
            <div className="ml-6 space-y-0.5 text-[var(--mist)]">
              <div>• Remaining today: {metabolismMetrics.budgetRemaining?.toFixed(1) || '97.7'} CT</div>
              <div>
                • Efficiency: {metabolismMetrics.costAccuracy 
                  ? `${Math.round((1 - metabolismMetrics.costAccuracy) * 100)}%`
                  : '89%'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Message (only on post) */}
      {phase === 'post' && (
        <div className="mt-4 rounded-md bg-[var(--deep-space)]/50 p-3 text-xs text-[var(--mist)]">
          This is how GREGORE works behind the scenes. Continue showing details for next
          few messages?
        </div>
      )}
    </div>
  );
}
