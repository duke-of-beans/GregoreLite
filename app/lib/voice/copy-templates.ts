/**
 * Voice Templates — Sprint 17.0
 *
 * Centralized copy for all system-facing text in GregLite.
 * Every component that needs user-facing strings imports from here.
 * No hardcoded strings in components — all copy lives here.
 *
 * Voice: Deadpan professional. Data-forward. Sardonic edge in empty states.
 * No exclamation marks. No "I'm sorry." No emoji in system messages.
 * Lead with numbers. See GREGORE_AUDIT.md §1 for full voice guide.
 *
 * Source: GREGORE_AUDIT.md §1, SPRINT_17_0_BRIEF.md Task 1
 */

export const VOICE = {
  // ── Receipt footer ────────────────────────────────────────────────────────
  receipt: {
    collapsed: (model: string, cost: string, latency: string) =>
      `✓ ${cost} · ${latency} · ${model}`,
    expand: 'Details',
    collapse: 'Less',
    cached: 'cached',
    tokens: (input: number, output: number) =>
      `${input.toLocaleString()} in · ${output.toLocaleString()} out`,
    tokensTotal: (total: number) => `${total.toLocaleString()} tokens`,
    cacheHit: 'Cache: hit',
    cacheMiss: 'Cache: miss',
    model: (fullModel: string) => fullModel,
  },

  // ── Decision gate ─────────────────────────────────────────────────────────
  gate: {
    repeated_question: "You've circled back to this topic. Want a deeper look?",
    sacred_principle_risk: 'This looks like a shortcut. Proceed anyway?',
    irreversible_action: "This can't be undone. Confirm?",
    low_confidence: 'Confidence is low on this one. Want verification?',
    contradicts_prior: 'This contradicts a previous decision. Review?',
    high_tradeoff_count: 'Multiple trade-offs detected. Worth a pause.',
    multi_project_touch: 'This spans multiple projects. Tread carefully.',
    large_build_estimate: 'This is a large build. Break it down first?',
    dismiss: 'Proceed',
    address: 'Reconsider',
  },

  // ── Orchestration theater ─────────────────────────────────────────────────
  theater: {
    preferencePrompt: 'How much detail going forward?',
    preferenceOptions: {
      full: 'Full — always expanded',
      compact: 'Compact — collapsed, click to expand',
      minimal: 'Minimal — checkmark and cost only',
      hidden: 'Hidden — no receipts',
    },
  },

  // ── Status bar ────────────────────────────────────────────────────────────
  status: {
    system_idle: 'Idle',
    system_active: 'Active',
    memory_ready: 'Ready',
    memory_indexing: 'Indexing',
    memory_error: 'Error',
  },

  // ── Empty states (sardonic edge permitted here) ───────────────────────────
  empty: {
    war_room: 'Nothing running. Workers are on break.',
    jobs: 'No active jobs. Quiet shift.',
    insights: 'No insights yet. Run the pipeline to find patterns.',
    transit_no_data: 'No conversation data. Start talking.',
    search_no_results: 'Nothing matched. Try different terms.',
  },

  // ── Errors (direct, actionable) ───────────────────────────────────────────
  error: {
    api_key_invalid: 'API key rejected. Check Settings.',
    api_unreachable: "Can't reach the API. Network issue or key problem.",
    db_corrupted: 'Database integrity check failed. Recovery options available.',
    generic: (detail: string) => `Something broke: ${detail}`,
  },
} as const;

// ── Formatters ────────────────────────────────────────────────────────────────

/** Format cost for receipt footer — 4 decimal places, always shows $ */
export function formatReceiptCost(costUsd: number | undefined): string {
  if (costUsd === undefined || costUsd <= 0) return '$0.0000';
  return `$${costUsd.toFixed(4)}`;
}

/** Format latency for receipt footer — ms or seconds */
export function formatReceiptLatency(latencyMs: number | undefined): string {
  if (latencyMs === undefined || latencyMs <= 0) return '—';
  if (latencyMs < 1000) return `${Math.round(latencyMs)}ms`;
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

/** Shorten model name for receipt footer display */
export function formatReceiptModel(model: string | undefined): string {
  if (!model) return '—';
  // claude-sonnet-4-5-20250929 → sonnet-4
  return model
    .replace(/^claude-?/i, '')
    .replace(/-\d{8}$/, '')       // strip date suffix
    .replace(/-\d+$/, '')          // strip trailing version digit if still present
    .split('-')
    .slice(0, 2)
    .join('-');
}
