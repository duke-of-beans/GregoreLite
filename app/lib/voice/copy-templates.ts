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

// ── What's This? guide content ────────────────────────────────────────────────
// Accessed via the ? button in the Header. Plain-language panel glossary.
// No jargon. Passes the Grandma Test.

export const GUIDE_ITEMS = [
  { label: 'Strategic', description: 'Your main conversation thread with Greg' },
  { label: 'Workers', description: 'Automated background tasks — code generation, testing, research' },
  { label: 'Task Board', description: 'Visual status of all running and queued worker tasks' },
  { label: 'Conversation Map', description: 'Visual timeline of your conversation\'s key moments' },
  { label: 'Background Assistant', description: 'Watches your files and email for relevant context' },
  { label: 'System Monitor', description: 'Tracks CPU/memory to manage workload intensity' },
  { label: 'Review Prompts', description: 'Greg pauses to double-check before risky actions' },
  { label: 'Memory', description: 'Greg\'s persistent knowledge from past conversations' },
  { label: 'Code Quality', description: 'Automated code health scoring' },
  { label: 'Inspector', description: 'Detailed diagnostics panel — cost, quality, learning insights' },
] as const;

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
    append_only_violation: 'Audit log or journal table is append-only. Modification not allowed.',
    reversibility_missing: 'No reversibility mechanism in scope. Add undo before proceeding.',
    deep_work_interruption: 'Deep work in progress. This update can wait until a break.',
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
    // Background Assistant labels (replaces "Ghost Thread" in UI)
    background_active: 'Active',
    background_partial: 'Partial',
    background_paused: 'Paused',
    background_starting: 'Starting',
    background_off: 'Off',
  },

  // ── Background Assistant (replaces "Ghost" in all user-facing copy) ────────
  background: {
    label: 'BACKGROUND',
    tooltip_off: 'Background Assistant not running',
    tooltip_active: 'Monitoring filesystem and email for relevant context',
    tooltip_degraded: (failed: string) =>
      `Partial: ${failed || 'some components'} failed — email + scoring still active`,
    tooltip_paused: 'Paused due to high system load',
    tooltip_starting: 'Background Assistant starting up…',
    settings_label: 'Background Assistant',
    settings_description: 'Watches your files and email for context to surface in conversations',
  },

  // ── Tabs & navigation ─────────────────────────────────────────────────────
  tabs: {
    strategic_tooltip: 'Your main conversation thread with Greg',
    workers_tooltip: 'Automated background tasks — code generation, testing, research',
    workers_heading_tooltip: 'Background task runners for automated code, testing, and research jobs',
    taskboard_tooltip: 'Visual status of all running and queued worker tasks',
    map_tooltip: 'Visual timeline of your conversation\'s key moments',
  },

  // ── Safety / Decision Gate (replaces "Sacred Laws" / "Decision Gate" jargon) ─
  safety: {
    review_prompt_heading: 'Safety Check',
    review_prompt_description: 'Greg paused before this action. Review and decide.',
    guardrails_label: 'Safety Rules',
    guardrails_description: 'Boundaries Greg enforces to keep actions reversible and safe',
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
