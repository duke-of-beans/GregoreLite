/**
 * ReceiptFooter — Sprint 17.0
 *
 * Collapsed receipt under every assistant message showing cost, latency,
 * and model. Click to expand for token breakdown and cache status.
 *
 * SEPARATE from Transit Map MessageMetadata (Z3 annotations).
 * Receipt = per-message cost/performance. Always visible (unless hidden).
 * MessageMetadata = conversation telemetry events. Only on Cmd+Shift+M.
 *
 * Display preferences (from ui-store.receiptDetail):
 *   full    — always expanded
 *   compact — collapsed, click to expand (DEFAULT)
 *   minimal — checkmark + cost only, no expand
 *   hidden  — not rendered
 *
 * Source: SPRINT_17_0_BRIEF.md Task 3, GREGORE_AUDIT.md §2 Pattern 1
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VOICE, formatReceiptCost, formatReceiptLatency, formatReceiptModel } from '@/lib/voice';
import { WEB_SESSION } from '@/lib/voice/copy-templates';
import type { ReceiptDetail } from '@/lib/stores/ui-store';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ReceiptFooterProps {
  model?: string | undefined;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  /** Total tokens when input/output split is unavailable */
  tokens?: number | undefined;
  cost?: number | undefined;
  latencyMs?: number | undefined;
  cacheHit?: boolean | undefined;
  /** Display preference from ui-store — controls collapsed/expanded/minimal/hidden */
  displayMode?: ReceiptDetail;
  /** Orchestration Theater: force expanded (overrides displayMode during first 5 msgs) */
  forceExpanded?: boolean | undefined;
  /** Sprint 32.0: which path routed this message — shown in collapsed label + expanded detail */
  routedVia?: 'api' | 'web_session' | undefined;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReceiptFooter({
  model,
  inputTokens,
  outputTokens,
  tokens,
  cost,
  latencyMs,
  cacheHit,
  displayMode = 'compact',
  forceExpanded = false,
  routedVia,
}: ReceiptFooterProps) {
  const [manualExpanded, setManualExpanded] = useState(false);

  // hidden → render nothing
  if (displayMode === 'hidden') return null;

  // Sprint 32.0: web session shows 'web' in place of cost (no API spend)
  const costStr = routedVia === 'web_session'
    ? WEB_SESSION.receipt_web
    : formatReceiptCost(cost);
  const latencyStr = formatReceiptLatency(latencyMs);
  const modelStr = formatReceiptModel(model);
  const collapsedLabel = VOICE.receipt.collapsed(modelStr, costStr, latencyStr);

  // minimal → checkmark + cost only, no expand affordance
  if (displayMode === 'minimal') {
    return (
      <div
        style={{
          marginTop: 4,
          fontSize: 'var(--text-xs, 11px)',
          color: 'var(--mist)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          userSelect: 'none',
        }}
        aria-label="Message receipt"
      >
        <span style={{ color: 'var(--frost)' }}>✓</span>
        <span>{costStr}</span>
      </div>
    );
  }

  // full → always expanded; compact → user-toggleable; forceExpanded overrides compact
  const isExpanded =
    displayMode === 'full' || forceExpanded || manualExpanded;

  const canToggle = displayMode === 'compact' && !forceExpanded;

  // Token display
  const tokenStr =
    inputTokens !== undefined && outputTokens !== undefined
      ? VOICE.receipt.tokens(inputTokens, outputTokens)
      : tokens !== undefined && tokens > 0
      ? VOICE.receipt.tokensTotal(tokens)
      : null;

  return (
    <div
      style={{ marginTop: 4 }}
      aria-label="Message receipt"
    >
      {/* Collapsed row — always visible */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 'var(--text-xs, 11px)',
          color: 'var(--mist)',
          cursor: canToggle ? 'pointer' : 'default',
          userSelect: 'none',
          height: 20,
        }}
        onClick={canToggle ? () => setManualExpanded((p) => !p) : undefined}
        role={canToggle ? 'button' : undefined}
        aria-expanded={canToggle ? isExpanded : undefined}
        tabIndex={canToggle ? 0 : undefined}
        onKeyDown={canToggle ? (e) => { if (e.key === 'Enter' || e.key === ' ') setManualExpanded((p) => !p); } : undefined}
      >
        <span style={{ color: 'var(--frost)', fontSize: 10 }}>✓</span>
        <span>{collapsedLabel}</span>
        {canToggle && (
          <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 9 }}>
            {isExpanded ? VOICE.receipt.collapse : VOICE.receipt.expand}
          </span>
        )}
      </div>

      {/* Expanded detail — Framer Motion height animation replaces CSS max-height hack */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="receipt-expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginTop: 4,
                padding: '6px 8px',
                borderLeft: '2px solid var(--cyan-ghost, rgba(0,212,232,0.08))',
                background: 'var(--bg-elevated, var(--elevated))',
                borderRadius: '0 4px 4px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              {tokenStr && (
                <div style={{ fontSize: 'var(--text-xs, 11px)', color: 'var(--mist)' }}>
                  Tokens: {tokenStr}
                  {cacheHit !== undefined && (
                    <span style={{ marginLeft: 8, color: 'var(--frost)', opacity: 0.7 }}>
                      {cacheHit ? VOICE.receipt.cacheHit : VOICE.receipt.cacheMiss}
                    </span>
                  )}
                </div>
              )}
              {model && (
                <div style={{ fontSize: 'var(--text-xs, 11px)', color: 'var(--mist)' }}>
                  Model: {model}
                </div>
              )}
              {routedVia && (
                <div style={{ fontSize: 'var(--text-xs, 11px)', color: 'var(--mist)', opacity: 0.8 }}>
                  {routedVia === 'web_session'
                    ? WEB_SESSION.receipt_routed_via_web
                    : WEB_SESSION.receipt_routed_via_api}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
