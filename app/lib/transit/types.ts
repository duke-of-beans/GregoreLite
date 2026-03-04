/**
 * Transit Map — Type Definitions
 * Source of truth: TRANSIT_MAP_SPEC.md §4.3
 *
 * These types describe the event taxonomy, marker system, and stored event shape.
 * The renderer reads the registry (registry.ts) which uses these types — it does NOT
 * hardcode knowledge of specific event types. Adding a new event = adding a registry
 * entry. No renderer changes required.
 */

// ── Category taxonomy ──────────────────────────────────────────────────────────

export type EventCategory =
  | 'flow'       // Conversation progression (messages, topic shifts, branches)
  | 'quality'    // User satisfaction signals (interruptions, regen, edits)
  | 'system'     // Operational events (model routing, gates, errors)
  | 'context'    // Knowledge management (retrieval, ghost, window pressure)
  | 'cognitive'; // Greg's reasoning (thinking, tools, artifacts)

// ── Marker visual system (§3.2) ───────────────────────────────────────────────

/** Shape encodes category — one shape per category, never mixed. */
export type MarkerShape =
  | 'circle'   // flow
  | 'diamond'  // quality
  | 'square'   // system
  | 'triangle' // context
  | 'hexagon'; // cognitive

/**
 * Size encodes importance/impact at Z2 subway zoom level.
 * Pixel sizes: small=6px, medium=10px, large=14px, landmark=18px
 */
export type MarkerSize = 'small' | 'medium' | 'large' | 'landmark';

// ── Event type definition (registry entry shape) ──────────────────────────────

export interface EventTypeDefinition {
  /** Registry ID, e.g. "quality.interruption". Dot-namespaced: category.name */
  id: string;
  /** Which of the 5 categories this event belongs to */
  category: EventCategory;
  /** Human-readable display name */
  name: string;
  /** Optional description for UI tooltips */
  description?: string;
  /** Whether this event feeds the self-improvement pipeline */
  learnable: boolean;
  /** Experimental events are captured but not displayed by default */
  experimental?: boolean;
  /** Visual marker for Z2 subway and Z3 detail view */
  marker: {
    shape: MarkerShape;
    /** CSS variable string, e.g. "var(--cyan)" or "var(--red-400)" */
    color: string;
    size: MarkerSize;
  };
  /**
   * If present, this event gets a scrollbar landmark tick (DeepSeek pattern §3.4).
   * A filter string can restrict the tick to a subset of events of this type.
   */
  scrollbar?: {
    color: string;
    /** Height in pixels of the scrollbar tick */
    height: number;
    /** Opacity 0-1 */
    opacity: number;
    /** Optional JS expression evaluated against payload to filter which events get ticks */
    filter?: string;
  };
}

// ── Stored event record ───────────────────────────────────────────────────────

/**
 * Shape of a row read back from the conversation_events table.
 * Matches the DB columns: id, conversation_id, message_id, event_type,
 * category, payload (parsed), created_at (unix ms).
 */
export interface EventMetadata {
  /** Primary key — crypto.randomUUID() at capture time */
  id: string;
  /** FK to conversations/threads table */
  conversation_id: string;
  /** FK to messages table — undefined for session-level events */
  message_id?: string | null;
  /** Registry ID string, e.g. "flow.message" */
  event_type: string;
  category: EventCategory;
  /** Type-specific payload — shape defined in spec §2.2 per event type */
  payload: Record<string, unknown>;
  /** Unix milliseconds (unixepoch * 1000) */
  created_at: number;
}

// ── Capture input ─────────────────────────────────────────────────────────────

/** Input shape for captureEvent() and the /api/transit/capture POST route */
export interface CaptureEventInput {
  conversation_id: string;
  message_id?: string;
  event_type: string;
  category: EventCategory;
  payload?: Record<string, unknown>;
}
