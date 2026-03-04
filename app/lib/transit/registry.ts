/**
 * Transit Map — Event Registry
 * Source of truth: TRANSIT_MAP_SPEC.md §2.2, §3.2, §3.4
 *
 * Static config. No DB reads, no file system reads.
 * O(1) lookup via Map. Adding a new event type = adding one entry below.
 * The renderer reads this registry — it never hardcodes event type knowledge.
 *
 * Marker shapes by category: flow=circle, quality=diamond, system=square,
 *   context=triangle, cognitive=hexagon (§3.2)
 * Marker colors by valence: positive=green-400, neutral=frost, attention=amber-400,
 *   negative=red-400, informational=cyan (§3.2)
 * Marker sizes: small=6px (bookkeeping), medium=10px (quality signals),
 *   large=14px (high-impact), landmark=18px (topic shifts, milestones)
 */

import type { EventTypeDefinition } from './types';

// ── Registry data ─────────────────────────────────────────────────────────────

const REGISTRY_DATA: EventTypeDefinition[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // FLOW — Conversation progression
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'flow.message',
    category: 'flow',
    name: 'Message Exchange',
    description: 'Every user→assistant turn. Baseline telemetry.',
    learnable: false,
    marker: { shape: 'circle', color: 'var(--frost)', size: 'small' },
    scrollbar: {
      color: 'var(--frost)',
      height: 1,
      opacity: 0.2,
      filter: "payload.role === 'user'",
    },
  },

  {
    id: 'flow.topic_shift',
    category: 'flow',
    name: 'Topic Boundary',
    description: 'Embedding similarity below threshold between consecutive user messages.',
    learnable: true,
    experimental: true,
    marker: { shape: 'circle', color: 'var(--cyan)', size: 'landmark' },
    scrollbar: { color: 'var(--cyan)', height: 3, opacity: 0.7 },
    station: {
      enabled: true,
      nameTemplate: '{payload.inferred_topic_label}',
      icon: '📍',
    },
  },

  {
    id: 'flow.branch_fork',
    category: 'flow',
    name: 'Conversation Fork',
    description: 'User regenerated or edited-and-resent a message.',
    learnable: true,
    marker: { shape: 'circle', color: 'var(--amber-400)', size: 'large' },
    scrollbar: { color: 'var(--amber-400)', height: 2, opacity: 0.6 },
    station: {
      enabled: true,
      nameTemplate: 'Fork: {payload.branch_type}',
      icon: '🔀',
    },
  },

  {
    id: 'flow.branch_merge',
    category: 'flow',
    name: 'Branch Accepted',
    description: 'User continued from a branched response.',
    learnable: true,
    marker: { shape: 'circle', color: 'var(--green-400)', size: 'medium' },
  },

  {
    id: 'flow.session_boundary',
    category: 'flow',
    name: 'Session Start/End',
    description: 'App open, idle timeout, or explicit close.',
    learnable: false,
    marker: { shape: 'circle', color: 'var(--frost)', size: 'small' },
    station: {
      enabled: true,
      nameTemplate: 'Session Start/End',
      icon: '🚉',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // QUALITY — User satisfaction signals
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'quality.interruption',
    category: 'quality',
    name: 'User Interrupted Generation',
    description: 'Stop button pressed mid-stream.',
    learnable: true,
    marker: { shape: 'diamond', color: 'var(--red-400)', size: 'large' },
    scrollbar: { color: 'var(--red-400)', height: 3, opacity: 0.8 },
  },

  {
    id: 'quality.regeneration',
    category: 'quality',
    name: 'Response Regenerated',
    description: 'Cmd+R or regenerate button — user wanted a different answer.',
    learnable: true,
    marker: { shape: 'diamond', color: 'var(--amber-400)', size: 'medium' },
  },

  {
    id: 'quality.edit_resend',
    category: 'quality',
    name: 'Prompt Edited & Resent',
    description: 'User edited their message and resent it.',
    learnable: true,
    marker: { shape: 'diamond', color: 'var(--amber-400)', size: 'medium' },
  },

  {
    id: 'quality.long_pause',
    category: 'quality',
    name: 'User Paused Before Responding',
    description: 'More than 60s between assistant response and next user message.',
    learnable: true,
    experimental: true,
    marker: { shape: 'diamond', color: 'var(--frost)', size: 'small' },
  },

  {
    id: 'quality.immediate_followup',
    category: 'quality',
    name: 'Rapid Correction',
    description: 'User sends again within 10s — likely a correction.',
    learnable: true,
    experimental: true,
    marker: { shape: 'diamond', color: 'var(--frost)', size: 'small' },
  },

  {
    id: 'quality.copy_event',
    category: 'quality',
    name: 'User Copied Content',
    description: 'Copy button on code block or Cmd+C on text selection.',
    learnable: false,
    marker: { shape: 'diamond', color: 'var(--green-400)', size: 'small' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SYSTEM — Operational events
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'system.model_route',
    category: 'system',
    name: 'Model Routing Decision',
    description: 'Auto-router selected a model for a message.',
    learnable: true,
    marker: { shape: 'square', color: 'var(--cyan)', size: 'medium' },
  },

  {
    id: 'system.gate_trigger',
    category: 'system',
    name: 'Decision Gate Fired',
    description: 'Gate analysis detected a trigger condition.',
    learnable: true,
    marker: { shape: 'square', color: 'var(--amber-400)', size: 'large' },
    scrollbar: { color: 'var(--amber-400)', height: 3, opacity: 0.8 },
    station: {
      enabled: true,
      nameTemplate: 'Gate: {payload.gate_type}',
      icon: '🛑',
    },
  },

  {
    id: 'system.gate_resolution',
    category: 'system',
    name: 'Decision Gate Resolved',
    description: 'User approved, dismissed, or overrode the gate.',
    learnable: true,
    marker: { shape: 'square', color: 'var(--green-400)', size: 'medium' },
  },

  {
    id: 'system.rate_limit',
    category: 'system',
    name: 'Rate Limit Hit',
    description: '429 from Anthropic API or internal rate limiter.',
    learnable: false,
    marker: { shape: 'square', color: 'var(--red-400)', size: 'small' },
  },

  {
    id: 'system.error',
    category: 'system',
    name: 'API or System Error',
    description: 'Any 5xx, timeout, or unhandled exception.',
    learnable: false,
    marker: { shape: 'square', color: 'var(--red-400)', size: 'large' },
  },

  {
    id: 'system.latency_spike',
    category: 'system',
    name: 'Abnormal Latency',
    description: 'Response time > 2 standard deviations from rolling average.',
    learnable: true,
    experimental: true,
    marker: { shape: 'square', color: 'var(--amber-400)', size: 'medium' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONTEXT — Knowledge management
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'context.retrieval',
    category: 'context',
    name: 'KERNL Context Retrieved',
    description: 'Cross-context or decision history injected into prompt.',
    learnable: true,
    marker: { shape: 'triangle', color: 'var(--cyan)', size: 'medium' },
  },

  {
    id: 'context.ghost_surface',
    category: 'context',
    name: 'Ghost Surfaced Suggestion',
    description: 'Proactive engine pushed a ghost card.',
    learnable: true,
    marker: { shape: 'triangle', color: 'var(--cyan)', size: 'small' },
  },

  {
    id: 'context.ghost_engaged',
    category: 'context',
    name: 'Ghost Card Engaged',
    description: 'User clicked "Tell me more" or similar on a ghost card.',
    learnable: true,
    marker: { shape: 'triangle', color: 'var(--green-400)', size: 'medium' },
  },

  {
    id: 'context.window_pressure',
    category: 'context',
    name: 'Context Window Threshold',
    description: 'Token usage crossed 50%, 75%, or 90% of context window.',
    learnable: true,
    marker: { shape: 'triangle', color: 'var(--amber-400)', size: 'large' },
  },

  {
    id: 'context.window_exceeded',
    category: 'context',
    name: 'Context Window Overflow',
    description: 'Truncation or summarization was required.',
    learnable: true,
    marker: { shape: 'triangle', color: 'var(--red-400)', size: 'large' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // COGNITIVE — Greg's reasoning (future expansion)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'cognitive.thinking_block',
    category: 'cognitive',
    name: 'Extended Thinking',
    description: 'Model used thinking/reasoning tokens.',
    learnable: true,
    experimental: true,
    marker: { shape: 'hexagon', color: 'var(--frost)', size: 'small' },
  },

  {
    id: 'cognitive.tool_invocation',
    category: 'cognitive',
    name: 'Tool Used',
    description: 'Model called a tool (code exec, search, etc.).',
    learnable: true,
    marker: { shape: 'hexagon', color: 'var(--cyan)', size: 'medium' },
  },

  {
    id: 'cognitive.artifact_generated',
    category: 'cognitive',
    name: 'Artifact Produced',
    description: 'Code block, document, or other artifact detected in response.',
    learnable: true,
    marker: { shape: 'hexagon', color: 'var(--teal-400)', size: 'large' },
    scrollbar: { color: 'var(--teal-400)', height: 2, opacity: 0.5 },
    station: {
      enabled: true,
      nameTemplate: 'Artifact: {payload.artifact_type}',
      icon: '📦',
    },
  },

  {
    id: 'cognitive.artifact_engagement',
    category: 'cognitive',
    name: 'Artifact Used',
    description: 'User copied, edited, or opened an artifact.',
    learnable: true,
    marker: { shape: 'hexagon', color: 'var(--green-400)', size: 'medium' },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRANSIT — User-created manual stations (§3.3 manual source)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'transit.manual_station',
    category: 'cognitive',
    name: 'Manual Landmark',
    description: 'User-created station marking this message as a navigation landmark.',
    learnable: false,
    marker: { shape: 'hexagon', color: 'var(--cyan)', size: 'landmark' },
    scrollbar: { color: 'var(--cyan)', height: 3, opacity: 0.9 },
    station: {
      enabled: true,
      nameTemplate: '{payload.name}',
      icon: '{payload.icon}',
    },
  },

];

// ── Map-based registry (O(1) lookup) ─────────────────────────────────────────

const REGISTRY = new Map<string, EventTypeDefinition>(
  REGISTRY_DATA.map((def) => [def.id, def]),
);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up an event type by its registry ID (e.g. "quality.interruption").
 * Returns undefined for unknown event types — callers must handle this.
 */
export function getEventType(id: string): EventTypeDefinition | undefined {
  return REGISTRY.get(id);
}

/**
 * All registered event type definitions, in insertion order.
 * Use for rendering legend, settings UI, or learning pipeline iteration.
 */
export function getAllEventTypes(): EventTypeDefinition[] {
  return REGISTRY_DATA;
}

/**
 * All event types belonging to a specific category.
 * Returns empty array for unknown categories (safe for callers).
 */
export function getEventTypesByCategory(
  category: EventTypeDefinition['category'],
): EventTypeDefinition[] {
  return REGISTRY_DATA.filter((def) => def.category === category);
}

// Named export for direct iteration if needed (treat as readonly)
export { REGISTRY_DATA as EVENT_REGISTRY };
