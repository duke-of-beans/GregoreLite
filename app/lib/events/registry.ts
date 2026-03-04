/**
 * Event Registry — Transit Map §4.3
 *
 * Defines known event types. The renderer reads this registry;
 * it does not hardcode knowledge of specific event types.
 * Adding a new event type = adding an entry here.
 */

export interface EventTypeDefinition {
  id: string;
  category: 'flow' | 'quality' | 'system' | 'context' | 'cognitive';
  name: string;
  learnable: boolean;
  experimental: boolean;
}

export const EVENT_REGISTRY: EventTypeDefinition[] = [
  // Flow events
  { id: 'flow.message', category: 'flow', name: 'Message Exchange', learnable: false, experimental: false },
  { id: 'flow.topic_shift', category: 'flow', name: 'Topic Boundary', learnable: true, experimental: true },
  { id: 'flow.branch_fork', category: 'flow', name: 'Conversation Fork', learnable: true, experimental: false },
  { id: 'flow.session_boundary', category: 'flow', name: 'Session Start/End', learnable: false, experimental: false },

  // Quality events
  { id: 'quality.interruption', category: 'quality', name: 'User Interrupted', learnable: true, experimental: false },
  { id: 'quality.regeneration', category: 'quality', name: 'Response Regenerated', learnable: true, experimental: false },
  { id: 'quality.edit_resend', category: 'quality', name: 'Prompt Edited & Resent', learnable: true, experimental: false },

  // System events
  { id: 'system.model_route', category: 'system', name: 'Model Routing Decision', learnable: true, experimental: true },
  { id: 'system.gate_trigger', category: 'system', name: 'Decision Gate Fired', learnable: true, experimental: false },
  { id: 'system.error', category: 'system', name: 'API or System Error', learnable: false, experimental: false },

  // Context events
  { id: 'context.retrieval', category: 'context', name: 'Context Retrieved', learnable: true, experimental: false },
  { id: 'context.ghost_surface', category: 'context', name: 'Ghost Surfaced', learnable: true, experimental: false },
  { id: 'context.window_pressure', category: 'context', name: 'Context Window Threshold', learnable: true, experimental: true },

  // Cognitive events
  { id: 'cognitive.tool_invocation', category: 'cognitive', name: 'Tool Used', learnable: true, experimental: false },
  { id: 'cognitive.artifact_generated', category: 'cognitive', name: 'Artifact Produced', learnable: true, experimental: false },
];

export function getEventType(id: string): EventTypeDefinition | undefined {
  return EVENT_REGISTRY.find((e) => e.id === id);
}
