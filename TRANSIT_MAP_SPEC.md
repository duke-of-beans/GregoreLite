# TRANSIT MAP — Conversation Topology & Cognitive Telemetry System
# Version: 0.1.0-draft | Status: LIVING SPEC | Created: March 3, 2026
# Owner: David Kirsch
# Purpose: Complete design specification for GregLite's conversation visualization,
#          event taxonomy, and self-improvement telemetry layer.
#
# THIS IS A LIVING DOCUMENT.
# The event taxonomy, marker types, zoom behaviors, and learning signals
# are designed to be extended without breaking changes. New event types
# are registered, not hardcoded. The system discovers what matters
# through usage — it does not assume it knows upfront.
#
# Prior Art: Crisis Capitalism Sankey → Subway Map visualization (D:\Research\FINE PRINT\DASHBOARD)
# Inspiration: DeepSeek scroll landmarks, VS Code minimap, git DAG visualizers

---

## §1 — CORE METAPHOR

The Transit Map is a multi-zoom visualization of conversation flow, events, and
quality signals. It serves three purposes simultaneously:

1. **Navigation** — Find where you are in a long conversation, jump to landmarks
2. **Transparency** — See what happened: branches, interruptions, model switches
3. **Self-improvement** — Provide measurable telemetry for Greg's recursive learning

The metaphor is literal public transit:
- **Lines** are conversation threads (main trunk + branches)
- **Stations** are significant events (topic shifts, decisions, deliverables)
- **Track conditions** are quality signals (green = smooth, amber = friction, red = failure)
- **Passengers** are context elements riding the conversation (injected knowledge, ghost cards)

### §1.1 — Three Zoom Levels

| Level | Name | What You See | When You Use It |
|-------|------|-------------|-----------------|
| Z1 | **Sankey** | Full conversation topology — all branches, flow volume, major events | Understanding the shape of a long session, comparing branches |
| Z2 | **Subway** | Linear route with named stations, markers on the track, transfer points | Navigating to a specific moment, reading the story of a conversation |
| Z3 | **Detail** | Individual messages with full event metadata, inline annotations | Reading/editing messages, inspecting what happened at a specific point |

Zoom transitions are continuous, not discrete. Pinch/scroll zooms smoothly.
Cmd+0 resets to Z2 (default). Cmd+- zooms out toward Z1. Cmd+= zooms in toward Z3.

### §1.2 — Design Principles

- **Registered, not hardcoded** — Every event type, marker, color, and behavior
  is defined in a registry. Adding a new event type is a config addition, not a
  code change. The renderer reads the registry; it doesn't know about specific events.

- **Captured always, visualized optionally** — Every event is written to the
  telemetry layer regardless of whether a visualization exists for it yet.
  The data comes first. The display follows when we understand what matters.

- **Signals, not judgments** — The system captures "user interrupted at token 247"
  not "Greg gave a bad response." Interpretation is the learning layer's job.

- **Composable markers** — A single message can have multiple markers (e.g.,
  a regeneration that also triggered a decision gate at a topic boundary).
  Markers stack, they don't replace each other.

- **Backwards compatible** — Old conversations without event_metadata render
  normally. The Transit Map gracefully degrades to a plain message list.

---

## §2 — EVENT TAXONOMY

Events are the atomic units of the Transit Map. Every significant thing that
happens during a conversation is an event. Events are captured in real-time
and stored in the `event_metadata` JSON column on the messages table.

### §2.1 — Event Registry Schema

```yaml
# Each event type is a registry entry. New types are added here.
# The renderer, learning engine, and visualization all read from this registry.
# NOTHING is hardcoded against specific event type strings in rendering code.

event_registry:
  version: 1
  
  # ── How to add a new event type ──────────────────────────────────────
  # 1. Add an entry below with: id, category, marker, severity, learnable
  # 2. Add capture logic in the appropriate hook (see §4)
  # 3. The renderer will automatically pick it up from the registry
  # 4. If learnable: true, the self-improvement engine processes it
  # 5. No renderer changes needed unless you want a custom Z1/Z2 visual
  
  categories:
    flow:        "Normal conversation progression"
    quality:     "User satisfaction / response quality signals"
    system:      "System-level operational events"
    context:     "Context management events"
    cognitive:   "Greg's internal reasoning events"
```

### §2.2 — Event Types (Initial Registry)

This is the **starting set**. It will grow. The system is designed for growth.

#### FLOW Events (conversation progression)

| ID | Name | Trigger | What It Captures | Learnable |
|----|------|---------|-----------------|-----------|
| `flow.message` | Message Exchange | Every user→assistant turn | role, token_count, latency_ms, model | No (baseline) |
| `flow.topic_shift` | Topic Boundary | Embedding similarity < threshold between consecutive user messages | old_topic_embedding, new_topic_embedding, similarity_score, inferred_topic_label | Yes |
| `flow.branch_fork` | Conversation Fork | User regenerates or edits-and-resends | fork_point_message_id, branch_type (regen\|edit), original_content_hash | Yes |
| `flow.branch_merge` | Branch Accepted | User continues from a branched response | winning_branch_id, abandoned_branch_ids | Yes |
| `flow.session_boundary` | Session Start/End | App open, idle timeout, explicit close | session_duration_ms, message_count, total_tokens, total_cost_usd | No (bookkeeping) |

#### QUALITY Events (user satisfaction signals)

| ID | Name | Trigger | What It Captures | Learnable |
|----|------|---------|-----------------|-----------|
| `quality.interruption` | User Interrupted Generation | Stop button pressed mid-stream | partial_content, tokens_generated_before_stop, estimated_total_tokens, time_to_interrupt_ms | Yes |
| `quality.regeneration` | Response Regenerated | Cmd+R or regenerate button | original_response_hash, original_token_count, was_second_accepted | Yes |
| `quality.edit_resend` | Prompt Edited & Resent | Cmd+E then send | original_prompt, edited_prompt, diff_summary | Yes |
| `quality.long_pause` | User Paused Before Responding | >60s between assistant response and next user message | pause_duration_ms, assistant_message_length | Experimental |
| `quality.immediate_followup` | Rapid Correction | User sends again within 10s without waiting for full read | followup_content, likely_correction (bool) | Experimental |
| `quality.copy_event` | User Copied Content | Copy button on code block or text selection + Cmd+C | copied_content_type (code\|text), content_length, block_language | No (engagement signal) |

#### SYSTEM Events (operational)

| ID | Name | Trigger | What It Captures | Learnable |
|----|------|---------|-----------------|-----------|
| `system.model_route` | Model Routing Decision | Auto-router selects model for a message | selected_model, routing_reason, alternatives_considered | Yes |
| `system.gate_trigger` | Decision Gate Fired | Gate analysis detects trigger condition | gate_type, trigger_reason, severity | Yes |
| `system.gate_resolution` | Decision Gate Resolved | User approves/dismisses/overrides gate | resolution (approve\|dismiss\|override), time_to_resolve_ms | Yes |
| `system.rate_limit` | Rate Limit Hit | 429 from Anthropic API or internal limiter | limit_type, retry_after_ms | No |
| `system.error` | API or System Error | Any 5xx, timeout, or exception | error_type, error_message, recoverable (bool) | No |
| `system.latency_spike` | Abnormal Latency | Response time > 2σ from rolling average | actual_ms, expected_ms, sigma_deviation, probable_cause | Experimental |

#### CONTEXT Events (knowledge management)

| ID | Name | Trigger | What It Captures | Learnable |
|----|------|---------|-----------------|-----------|
| `context.retrieval` | KERNL Context Retrieved | Cross-context or decision history injected | source_type, chunk_count, relevance_scores[], total_injected_tokens | Yes |
| `context.ghost_surface` | Ghost Surfaced Suggestion | Proactive engine pushed a card | suggestion_id, source, relevance_score | Yes |
| `context.ghost_engaged` | Ghost Card Engaged | User clicked "Tell me more" or similar | suggestion_id, engagement_type (expand\|dismiss\|teach) | Yes |
| `context.window_pressure` | Context Window Threshold | Token usage crosses 50%, 75%, 90% of max | threshold_pct, current_tokens, max_tokens, message_count_at_threshold | Yes |
| `context.window_exceeded` | Context Window Overflow | Truncation or summarization required | truncated_message_count, tokens_reclaimed | Yes |

#### COGNITIVE Events (Greg's reasoning — future expansion)

| ID | Name | Trigger | What It Captures | Learnable |
|----|------|---------|-----------------|-----------|
| `cognitive.thinking_block` | Extended Thinking | Model uses thinking/reasoning tokens | thinking_tokens, thinking_duration_ms, was_thinking_shown_to_user | Experimental |
| `cognitive.tool_invocation` | Tool Used | Model calls a tool (code exec, search, etc.) | tool_name, tool_input_summary, tool_success (bool), tool_duration_ms | Yes |
| `cognitive.artifact_generated` | Artifact Produced | Code block, document, or other artifact detected | artifact_type, language, line_count, was_opened_in_panel | Yes |
| `cognitive.artifact_engagement` | Artifact Used | User copies, edits, or opens artifact | artifact_id, engagement_type (copy\|open\|edit\|dismiss) | Yes |

### §2.3 — Event Metadata Schema

Every event is stored as a JSON object with a common envelope + type-specific payload.

```typescript
interface EventMetadata {
  // ── Common envelope (every event has these) ─────────────────────
  event_id: string;           // nanoid, globally unique
  event_type: string;         // Registry ID, e.g. "quality.interruption"
  timestamp: string;          // ISO 8601
  message_id: string;         // FK to the message this event is attached to
  conversation_id: string;    // FK to the conversation/thread
  
  // ── Type-specific payload ───────────────────────────────────────
  payload: Record<string, unknown>;  // Shape depends on event_type
  
  // ── Extension fields (added over time, always optional) ─────────
  tags?: string[];            // User or system applied tags
  annotations?: string[];     // Human notes added after the fact
  learning_status?: 'pending' | 'processed' | 'skipped';  // Self-improvement pipeline status
  
  // ── Schema versioning ───────────────────────────────────────────
  schema_version: number;     // Increments when payload shape changes for this event_type
}
```

### §2.4 — Extension Protocol

To add a new event type to the Transit Map system:

1. **Define** — Add an entry to the event registry (§2.2) with: id, name, trigger,
   captures, and learnable flag.
2. **Capture** — Add a capture hook at the appropriate point in the codebase (§4).
   The hook creates an EventMetadata object and writes it to the events table.
3. **Register** — Add the event type to the runtime registry so the renderer knows
   about it. This is a config file addition, not a code change to the renderer.
4. **Marker** — Optionally assign a marker type (§3.2) for Z2 subway display.
   If no marker is assigned, the event is captured but not visually displayed
   (telemetry-only). This is fine and expected for experimental events.
5. **Learn** — If learnable: true, add a learning handler to the self-improvement
   pipeline (§6). The handler receives batches of events and produces insights.

No step requires modifying the Transit Map renderer itself. The renderer reads
the registry and displays whatever it finds. This is the key architectural
constraint that keeps the system extensible.

---

## §3 — VISUAL LANGUAGE

### §3.1 — Lines (Conversation Flow)

Lines represent the flow of conversation. At Z1 (Sankey), line width encodes
volume (token count or message count). At Z2 (Subway), all lines are uniform
width with markers on them.

| Line Type | Z1 Appearance | Z2 Appearance | Meaning |
|-----------|---------------|---------------|---------|
| Main trunk | Thickest flow | Solid primary color | Primary conversation thread |
| Branch (regen) | Thinner fork | Dashed line, branch color | Regenerated response path |
| Branch (edit) | Thinner fork, different hue | Dotted line, branch color | Edited-prompt path |
| Abandoned branch | Faded/gray flow | Gray dashed, no stations | Branch user didn't continue |
| Active branch | Bright flow | Bright solid, active marker | Currently selected path |

**Color coding for lines** is NOT hardcoded. Colors are assigned from a palette
based on branch depth and quality signals. The palette is defined in the design
system config:

```yaml
line_palette:
  trunk: "var(--cyan)"           # Primary conversation
  branch_1: "var(--teal-400)"    # First branch
  branch_2: "var(--amber-400)"   # Second branch
  branch_n: "auto"               # Subsequent branches cycle through palette
  abandoned: "var(--mist)"       # Unused branches
  error: "var(--red-400)"        # Error state
```

### §3.2 — Markers (Event Indicators)

Markers are visual indicators placed on the subway line at Z2, and shown as
annotations at Z3 detail level. Each marker has a shape, color, and size that
encode its category and severity.

**Marker shapes by category:**

| Category | Shape | Rationale |
|----------|-------|-----------|
| flow | ● Circle | Natural progression, default |
| quality | ◆ Diamond | Stands out, demands attention |
| system | ■ Square | Mechanical, system-level |
| context | ▲ Triangle | Directional, context flowing in |
| cognitive | ⬡ Hexagon | Complex, multi-faceted reasoning |

**Marker colors by severity/valence:**

| Signal | Color | Variable | Usage |
|--------|-------|----------|-------|
| Positive | Green | `var(--green-400)` | Accepted first-try, successful retrieval, artifact engaged |
| Neutral | Frost | `var(--frost)` | Normal events, session boundaries, bookkeeping |
| Attention | Amber | `var(--amber-400)` | Regeneration, gate trigger, latency spike, context pressure |
| Negative | Red | `var(--red-400)` | Interruption, error, context overflow, abandoned branch |
| Informational | Cyan | `var(--cyan)` | Model route, tool invocation, ghost surface |

**Marker sizes by importance:**

| Size | Pixel (Z2) | Usage |
|------|-----------|-------|
| Small | 6px | Bookkeeping events (session boundary, normal message) |
| Medium | 10px | Quality signals (regen, edit, copy) |
| Large | 14px | High-impact events (interruption, gate, context overflow) |
| Landmark | 18px | Topic shifts, major deliverables, session milestones |

Markers are **composable**. A message with both a `quality.regeneration` and a
`system.gate_trigger` displays both markers stacked vertically at that position.

### §3.3 — Stations (Named Landmarks)

Stations are the named stops on the subway line. Not every message is a station —
only significant events earn a station name. Stations are auto-generated from
event data but can be manually renamed.

**Auto-station triggers** (configurable, not hardcoded):

```yaml
station_triggers:
  # Each trigger maps an event type to a station naming strategy.
  # New triggers can be added without code changes.
  
  - event: "flow.topic_shift"
    name_source: "payload.inferred_topic_label"
    icon: "📍"
    
  - event: "cognitive.artifact_generated"
    name_source: "'Artifact: ' + payload.artifact_type"
    icon: "📦"
    
  - event: "system.gate_trigger"
    name_source: "'Gate: ' + payload.gate_type"
    icon: "🛑"
    
  - event: "flow.branch_fork"
    name_source: "'Fork: ' + payload.branch_type"
    icon: "🔀"
    
  - event: "flow.session_boundary"
    name_source: "'Session ' + (payload.type === 'start' ? 'Start' : 'End')"
    icon: "🚉"
    
  # ── Custom station types (added as we learn what matters) ──────
  # - event: "custom.milestone"
  #   name_source: "payload.label"
  #   icon: "🏁"
```

Users can also manually mark any message as a station (right-click → "Mark as Landmark").
Manual stations have `source: 'manual'` and user-provided names.

### §3.4 — Scrollbar Landmarks (DeepSeek Pattern)

Independent of the full Transit Map visualization, the scrollbar itself gets
landmark indicators. These are subtle colored ticks on the scrollbar track that
show conversation structure at a glance.

```yaml
scrollbar_landmarks:
  # Maps event types to scrollbar tick appearance.
  # Height, color, and opacity configurable per type.
  
  - event: "flow.topic_shift"
    color: "var(--cyan)"
    height: 3px
    opacity: 0.7
    
  - event: "cognitive.artifact_generated"
    color: "var(--teal-400)"
    height: 2px
    opacity: 0.5
    
  - event: "quality.interruption"
    color: "var(--red-400)"
    height: 3px
    opacity: 0.8
    
  - event: "system.gate_trigger"
    color: "var(--amber-400)"
    height: 3px
    opacity: 0.8
    
  - event: "flow.branch_fork"
    color: "var(--amber-400)"
    height: 2px
    opacity: 0.6
    
  - event: "flow.message"
    filter: "payload.role === 'user'"
    color: "var(--frost)"
    height: 1px
    opacity: 0.2
    
  # User messages get the subtlest ticks — just enough to see
  # conversation density (lots of short exchanges vs few long ones)
```

The scrollbar is rendered as a custom component overlaying the native scrollbar.
It reads from the same event stream as the Transit Map. Adding a new scrollbar
landmark is: add an entry above, done.

### §3.5 — Z1 Sankey Specifics

The Sankey view shows the full conversation as a directed flow graph.

**Nodes** are conversation segments (groups of messages between stations).
**Edges** are flows between segments, with width proportional to token volume.
**Color** of edges reflects dominant quality signal in that segment.

The Sankey is read left-to-right (time flows left to right). Branches fork
downward. Abandoned branches fade to gray. The currently active branch is
highlighted.

Key metrics displayed on the Sankey:
- Total session tokens (header)
- Total session cost (header)
- Per-segment: message count, token count, dominant model, quality color
- Fork points: labeled with fork reason (regen/edit)
- Merge points: labeled with "accepted" or "abandoned"

**Interaction at Z1:**
- Hover segment → tooltip with metrics
- Click segment → zoom to Z2 centered on that segment
- Click fork → highlight both branches for comparison

### §3.6 — Z2 Subway Specifics

The Subway view is the default and primary navigation view. It shows a linear
(or branching) route with named stations and markers.

**Layout:** Horizontal or vertical (user preference). Horizontal default for
wide screens, vertical for narrow/mobile.

**Track:** Single line with stations spaced proportionally to message count
(not time — a 5-message segment and a 50-message segment get different lengths).

**Stations:** Named stops with icons (from §3.3). Clicking a station scrolls
the message list to that point.

**Between stations:** Marker dots for non-station events (quality signals,
system events). Hovering shows tooltip. Density of dots communicates activity level.

**Branch rendering:** Forks show as the track splitting. The active branch
continues straight; alternatives angle off. Each branch gets its own stations.

**Interaction at Z2:**
- Click station → scroll to messages at that point (Z3)
- Hover marker → event tooltip
- Drag to pan along the route
- Scroll to zoom toward Z1 (out) or Z3 (in)
- Right-click station → rename, add note, pin

### §3.7 — Z3 Detail Specifics

Z3 is the message-level view — this is the actual chat interface with event
annotations overlaid.

**Per-message annotations** (shown inline or on hover):
- Model used (small badge: "sonnet" / "haiku" / "opus")
- Token count (input + output)
- Cost (4 decimal places: "$0.0031")
- Latency (ms)
- Event markers (if any events attached to this message)

**Event detail panel** (click a marker at Z3):
- Full event metadata
- Payload details
- Links to related events (e.g., a regeneration links to the original response)
- Learning status (if learnable: pending/processed/skipped)
- User annotation field (add notes after the fact)

---

## §4 — DATA MODEL

### §4.1 — Database Schema Changes

The Transit Map requires two schema additions to the existing KERNL SQLite database.

**Option A: Dedicated events table (RECOMMENDED)**

```sql
-- New table: conversation_events
-- Stores all Transit Map events separate from messages.
-- Many-to-one: multiple events can attach to one message.
-- Events can also be conversation-level (no specific message).

CREATE TABLE conversation_events (
  id            TEXT PRIMARY KEY,          -- nanoid
  conversation_id TEXT NOT NULL,           -- FK to threads
  message_id    TEXT,                      -- FK to messages (nullable for conversation-level events)
  event_type    TEXT NOT NULL,             -- Registry ID: "quality.interruption"
  category      TEXT NOT NULL,             -- "flow" | "quality" | "system" | "context" | "cognitive"
  timestamp     TEXT NOT NULL DEFAULT (datetime('now')),
  payload       TEXT NOT NULL DEFAULT '{}', -- JSON: type-specific data
  schema_version INTEGER NOT NULL DEFAULT 1,
  tags          TEXT DEFAULT '[]',          -- JSON array of strings
  annotations   TEXT DEFAULT '[]',          -- JSON array of user notes
  learning_status TEXT DEFAULT 'pending',   -- "pending" | "processed" | "skipped"
  
  -- Indexes for common queries
  FOREIGN KEY (conversation_id) REFERENCES threads(id)
);

CREATE INDEX idx_events_conversation ON conversation_events(conversation_id);
CREATE INDEX idx_events_type ON conversation_events(event_type);
CREATE INDEX idx_events_category ON conversation_events(category);
CREATE INDEX idx_events_learning ON conversation_events(learning_status) WHERE learning_status = 'pending';
CREATE INDEX idx_events_message ON conversation_events(message_id) WHERE message_id IS NOT NULL;
```

**Why a separate table (not a JSON column on messages):**
- Events are many-to-one with messages (multiple events per message)
- Some events are conversation-level, not message-level
- Querying events by type across conversations is a primary use case
- The learning engine needs to batch-process events by type efficiently
- Separating concerns: messages store content, events store telemetry

### §4.2 — Tree Data Model for Branching

The current message model is a flat array. Branching requires a tree.

```sql
-- Modified messages table (add parent_id for tree structure)
-- parent_id is NULL for root messages, FK to messages.id for branches.
-- branch_index orders siblings (0 = first response, 1 = first regen, etc.)

ALTER TABLE messages ADD COLUMN parent_id TEXT DEFAULT NULL;
ALTER TABLE messages ADD COLUMN branch_index INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN is_active_branch INTEGER DEFAULT 1;

CREATE INDEX idx_messages_parent ON messages(parent_id) WHERE parent_id IS NOT NULL;
```

**Migration strategy:**
- Existing messages get `parent_id = NULL` (linear = flat tree, which is valid)
- New conversations auto-populate parent_id based on the message being replied to
- Regeneration: new message gets same parent_id as original, branch_index + 1
- Edit-resend: new user message gets parent_id of the message being replaced

**Reading the active path:**
```sql
-- Get the active (displayed) message sequence for a conversation
WITH RECURSIVE active_path AS (
  -- Start from the root (first message, no parent)
  SELECT * FROM messages 
  WHERE conversation_id = ? AND parent_id IS NULL
  ORDER BY created_at ASC
  LIMIT 1
  
  UNION ALL
  
  -- Follow active branches
  SELECT m.* FROM messages m
  JOIN active_path ap ON m.parent_id = ap.id
  WHERE m.is_active_branch = 1
  ORDER BY m.created_at ASC
)
SELECT * FROM active_path;
```

### §4.3 — Event Registry Runtime Format

```typescript
// Runtime registry loaded from config file at startup.
// The renderer, scrollbar, and learning engine all read from this.

interface EventTypeDefinition {
  id: string;                    // "quality.interruption"
  category: EventCategory;       // "quality"
  name: string;                  // "User Interrupted Generation"
  description: string;           // Human-readable explanation
  learnable: boolean;            // Self-improvement engine processes this
  experimental: boolean;         // Not yet validated as useful
  
  // Visual configuration (all optional — defaults from category)
  marker?: {
    shape?: MarkerShape;         // Override category default
    color?: string;              // Override severity-based default
    size?: MarkerSize;           // Override importance-based default
  };
  
  // Station configuration (if this event type creates stations)
  station?: {
    enabled: boolean;
    nameTemplate: string;        // Template with payload references
    icon: string;                // Emoji or icon reference
  };
  
  // Scrollbar landmark (if this event type shows on scrollbar)
  scrollbar?: {
    enabled: boolean;
    color: string;
    height: number;
    opacity: number;
    filter?: string;             // Optional payload filter expression
  };
}

type EventCategory = 'flow' | 'quality' | 'system' | 'context' | 'cognitive';
type MarkerShape = 'circle' | 'diamond' | 'square' | 'triangle' | 'hexagon';
type MarkerSize = 'small' | 'medium' | 'large' | 'landmark';
```

### §4.4 — Capture Points

Events are captured at specific points in the codebase. Each capture point is
a hook that creates an EventMetadata object and writes it.

```yaml
capture_points:
  # Maps event types to their capture locations in the codebase.
  # When adding a new event, add a capture point here.
  
  "flow.message":
    location: "app/api/chat/route.ts → POST handler, after addMessage()"
    trigger: "Every message persisted"
    
  "flow.topic_shift":
    location: "app/lib/events/topic-detector.ts (NEW)"
    trigger: "After embedding new user message, compare with previous"
    
  "flow.branch_fork":
    location: "app/components/chat/ChatInterface.tsx → handleRegenerate/handleEditMessage"
    trigger: "User initiates regen or edit"
    
  "quality.interruption":
    location: "app/components/chat/ChatInterface.tsx → handleStopGeneration (NEW)"
    trigger: "User clicks stop during streaming"
    note: "Requires SSE streaming to exist — captures partial content at stop time"
    
  "quality.regeneration":
    location: "app/components/chat/ChatInterface.tsx → handleRegenerate"
    trigger: "Cmd+R or regenerate button"
    
  "quality.edit_resend":
    location: "app/components/chat/ChatInterface.tsx → handleEditMessage"
    trigger: "Cmd+E or edit button"
    
  "system.model_route":
    location: "app/lib/chat/model-router.ts (NEW)"
    trigger: "Auto-router selects model for a request"
    
  "system.gate_trigger":
    location: "app/lib/decision-gate/index.ts → analyze()"
    trigger: "Gate trigger condition met"
    note: "Already fires — add event capture alongside Zustand push"
    
  "context.retrieval":
    location: "app/lib/cross-context/proactive.ts → checkOnInput()"
    trigger: "Context retrieved and injected"
    
  "context.ghost_surface":
    location: "app/lib/cross-context/proactive.ts → after suggestions pushed"
    trigger: "Ghost surfaces a suggestion"
    
  "context.ghost_engaged":
    location: "app/components/ghost/GhostCard.tsx → onClick handlers"
    trigger: "User interacts with ghost card"
    
  "context.window_pressure":
    location: "app/api/chat/route.ts → before API call, after building messages array"
    trigger: "Token count crosses threshold"
    
  "cognitive.tool_invocation":
    location: "app/api/chat/route.ts → during streaming, on tool_use content block"
    trigger: "Model invokes a tool"
    note: "Requires SSE streaming — tool blocks arrive mid-stream"
    
  "cognitive.artifact_generated":
    location: "app/components/chat/ChatInterface.tsx → after detectArtifact()"
    trigger: "Artifact detection succeeds"
    
  "cognitive.artifact_engagement":
    location: "app/components/artifacts/ArtifactPanel.tsx → user actions"
    trigger: "User copies, opens, or edits artifact"
```

---

## §5 — SCROLLBAR LANDMARKS (Sprint 10.6 Scope)

The scrollbar landmark system is the simplest and most immediately useful
piece of the Transit Map. It can ship before the full Sankey/Subway visualization.

### §5.1 — Implementation Architecture

```
MessageList.tsx
  └── CustomScrollbar.tsx (NEW)
       ├── Native scroll behavior (overflow-y: auto on parent)
       ├── Landmark overlay (absolute positioned on scrollbar track)
       └── Reads from: conversation_events WHERE conversation_id = ?
           OR from in-memory event cache during active session

Landmark positions are calculated as:
  landmark_y = (message_index / total_messages) * scrollbar_height
```

### §5.2 — Rendering Strategy

Landmarks render as thin horizontal lines overlaid on the scrollbar track.
They use `position: absolute` within a wrapper that matches the scrollbar's
track area. CSS `pointer-events: none` ensures they don't interfere with
scrolling. On hover (with a thin hit area), a tooltip shows the event type.

### §5.3 — Performance

For conversations with <500 messages, render all landmarks.
For >500 messages, cluster landmarks and show density heat instead of
individual ticks. The clustering threshold is configurable.

---

## §6 — SELF-IMPROVEMENT TELEMETRY

The Transit Map's deepest purpose is feeding Greg's recursive self-improvement.
Events marked `learnable: true` are processed by the learning engine.

### §6.1 — Learning Pipeline

```
conversation_events (learnable, pending)
  → Batch processor (runs on session end or on schedule)
    → Pattern detector (groups events by type, looks for statistical patterns)
      → Insight generator (produces actionable adjustments)
        → Feedback registry (stores insights for system prompt tuning)
          → Marks events as learning_status: 'processed'
```

### §6.2 — Learning Signal Types

| Signal | Source Events | What It Learns | Output |
|--------|-------------|---------------|--------|
| **Verbosity calibration** | `quality.interruption` | "Responses over N tokens on topic X get interrupted 60% of the time" | Adjust max_tokens or system prompt instruction per topic |
| **Prompt clarity** | `quality.edit_resend` | "When user mentions X, they usually mean Y (based on edit diffs)" | Intent disambiguation rules |
| **Response quality** | `quality.regeneration` | "First response on code reviews gets regenerated 40% of the time" | Quality flags for specific task types |
| **Model routing** | `system.model_route` + `quality.*` | "Haiku on code generation → 60% regen rate; Sonnet → 10%" | Auto-router threshold adjustments |
| **Context value** | `context.retrieval` + `quality.*` | "Retrieved context from KERNL improved response acceptance by 30%" | Retrieval relevance threshold tuning |
| **Topic boundaries** | `flow.topic_shift` | "User shifts topics after Greg gives long tangential responses" | Conciseness signals per topic type |
| **Gate calibration** | `system.gate_trigger` + `system.gate_resolution` | "Architecture gate gets dismissed 80% of the time → threshold too sensitive" | Gate trigger threshold adjustment |

### §6.3 — Learning Safeguards

- **Minimum sample size** — No insight generated from fewer than 10 events of the same type.
  Statistical noise at small N produces garbage.
- **Confidence intervals** — Every insight includes a confidence score. Below 70% confidence,
  insights are flagged as experimental and not auto-applied.
- **Human gate** — Insights that would modify system prompts, model routing, or gate thresholds
  surface to David for approval before applying. Greg proposes, David disposes.
- **Reversibility** — Every applied insight is logged with before/after state. One-click rollback.
- **Decay** — Insights older than 90 days without reconfirmation fade to experimental status.
  Patterns change. What was true in March may not be true in June.

### §6.4 — Extension: Adding New Learning Signals

1. Identify a pattern you want to learn (e.g., "when does the user switch to code mode?")
2. Ensure the relevant events are captured (may need a new event type — see §2.4)
3. Add a learning handler function that processes batches of those events
4. Register the handler in the learning pipeline config
5. Define the output format (what adjustment does this insight produce?)
6. Set minimum sample size and confidence threshold
7. Done — the pipeline picks it up on next run

---

## §7 — PHASING & SPRINT MAPPING

The Transit Map is too large for a single sprint. Here's how it decomposes.

### Phase A — Data Foundation (Sprint 10.6 scope)
- [ ] Create `conversation_events` table (§4.1)
- [ ] Add `parent_id`, `branch_index`, `is_active_branch` to messages (§4.2)
- [ ] Implement EventMetadata schema and write helper (§2.3)
- [ ] Capture initial events: `flow.message`, `quality.interruption` (requires SSE), `quality.regeneration`, `quality.edit_resend`
- [ ] Event registry config file with initial types (§4.3)

### Phase B — Scrollbar Landmarks (Sprint 10.7)
- [ ] CustomScrollbar component (§5.1)
- [ ] Scrollbar landmark rendering from events (§5.2)
- [ ] Capture: `flow.topic_shift`, `cognitive.artifact_generated`, `system.gate_trigger`
- [ ] Scrollbar landmark config (§3.4)

### Phase C — Z3 Detail Annotations (Sprint 10.8)
- [ ] Per-message inline metadata (model, tokens, cost, latency)
- [ ] Event marker rendering on messages
- [ ] Event detail panel on marker click
- [ ] User annotation support

### Phase D — Z2 Subway View (Sprint 11.x)
- [ ] Station auto-generation from events (§3.3)
- [ ] Subway line renderer (horizontal, with markers)
- [ ] Branch rendering (fork/merge visualization)
- [ ] Click-to-scroll navigation from stations to messages
- [ ] Manual station creation (right-click → "Mark as Landmark")

### Phase E — Z1 Sankey View (Sprint 12.x)
- [ ] Sankey flow graph renderer
- [ ] Token volume → edge width mapping
- [ ] Quality color coding on segments
- [ ] Zoom transition animations (Z1 ↔ Z2 ↔ Z3)

### Phase F — Learning Engine (Sprint 12.x+)
- [ ] Batch processor for learnable events (§6.1)
- [ ] Pattern detector (initial: verbosity, regeneration rate)
- [ ] Insight generator with confidence scoring
- [ ] Human approval gate for system prompt modifications
- [ ] Insight registry with rollback support

---

## §8 — OPEN QUESTIONS

These are things we don't know yet. They'll be answered through usage and iteration.

1. **What's the right topic shift threshold?** Embedding similarity < 0.6? 0.5? 0.7?
   Needs tuning on real conversation data.

2. **Should the Transit Map be a separate panel or overlay?** The full Sankey/Subway
   could be a dedicated tab, a drawer, or an overlay on the chat. TBD.

3. **How do we handle very long conversations (1000+ messages)?** Clustering,
   summarization, or pagination of the subway route? Performance implications of
   rendering 1000+ markers.

4. **What's the right "long pause" threshold?** Currently set at 60s (§2.2).
   May be too short for users who read carefully, too long for rapid-fire sessions.
   Should this be adaptive?

5. **Should the learning engine run locally or need cloud compute?** Pattern detection
   on thousands of events with embedding comparisons may be compute-intensive.
   Local for MVP, evaluate cloud for scale.

6. **What events are we NOT capturing that we should be?** This list is the starting
   set. Real usage will reveal gaps. The extension protocol (§2.4) exists for this.

7. **How does this interact with Eye of Sauron (Phase 5)?** EoS does code-level quality
   scanning. Transit Map does conversation-level telemetry. They should share a common
   insight format so both feed into Greg's self-improvement. Define the shared schema.

8. **Privacy implications?** Event metadata captures conversation patterns. For a
   single-user desktop app this is fine. For any future multi-user scenario, events
   must be per-user-isolated and optionally purgeable.

---

## §9 — CHANGELOG

All changes to this spec are logged here. The spec evolves with the system.

| Date | Version | Change | Rationale |
|------|---------|--------|-----------|
| 2026-03-03 | 0.1.0 | Initial draft | Pre-sprint design spec |

---

## §10 — GLOSSARY

| Term | Definition |
|------|-----------|
| **Transit Map** | The full conversation topology visualization system |
| **Sankey (Z1)** | Zoomed-out flow graph showing conversation structure and volume |
| **Subway (Z2)** | Mid-zoom route map with named stations and event markers |
| **Detail (Z3)** | Message-level view with inline event annotations |
| **Station** | A named landmark on the subway route (topic shift, artifact, gate) |
| **Marker** | A visual indicator of an event on the subway track or message |
| **Event** | An atomic occurrence captured by the telemetry system |
| **Learnable** | An event type that feeds the self-improvement pipeline |
| **Branch** | A conversation fork created by regeneration or edit-resend |
| **Trunk** | The primary (active) conversation path |
| **Landmark** | A colored tick on the scrollbar indicating a significant event |
