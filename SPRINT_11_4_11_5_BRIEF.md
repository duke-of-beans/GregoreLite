GREGLITE SPRINT 11.4+11.5 — Transit Map: Z3 Detail Annotations + Z2 Subway View
Mega-sprint: per-message metadata → event markers → subway map → click-to-navigate | March 2026

YOUR ROLE: Build the Z3 detail annotation layer AND the Z2 subway map visualization in a single sprint. Z3 adds per-message metadata (model badge, tokens, cost, latency) and event markers with a detail panel. Z2 adds the subway map with auto-generated stations, branch rendering, and click-to-scroll navigation between the subway and message list. These build on each other — Z2 uses the event markers and metadata from Z3 to generate stations and render markers on the track. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\TRANSIT_MAP_SPEC.md — READ FULLY: §3.2 (Markers), §3.3 (Stations), §3.4 (Scrollbar), §3.6 (Z2 Subway), §3.7 (Z3 Detail), §4.3 (Registry schema)
4. D:\Projects\GregLite\app\lib\transit\registry.ts — event type definitions (marker shape/color/size, scrollbar config)
5. D:\Projects\GregLite\app\lib\transit\types.ts — MarkerShape, MarkerSize, EventTypeDefinition, EventMetadata, CaptureEventInput
6. D:\Projects\GregLite\app\lib\transit\capture.ts — captureEvent(), getEventsForConversation(), getEventsByType()
7. D:\Projects\GregLite\app\app\api\transit\events\route.ts — existing GET endpoint returning enriched events with message_index, total_messages, config
8. D:\Projects\GregLite\app\components\chat\Message.tsx — READ FULLY before modifying. Understand props, layout, density settings.
9. D:\Projects\GregLite\app\components\chat\MessageList.tsx — READ FULLY. Has conversationId prop, renders ScrollbarLandmarks already.
10. D:\Projects\GregLite\app\components\chat\ChatInterface.tsx — READ FULLY. Layout structure, tab bar, keyboard shortcuts.
11. D:\Projects\GregLite\app\components\transit\ScrollbarLandmarks.tsx — existing scrollbar landmark component (Sprint 11.3)
12. D:\Projects\GregLite\SPRINT_11_3_COMPLETE.md — what was built, implementation notes, key discoveries
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- Message.tsx has a complex prop interface — read the FULL component before adding. Token/cost/model/latency may already be in props or SSE data.
- Event detail panel should reuse existing drawer/panel patterns (Inspector, ContextPanel) — do NOT invent a new panel paradigm.
- If per-message event queries are N+1, stop. Fetch ALL events once at MessageList level, build a Map<message_id, Event[]>, pass filtered arrays down.
- The subway map SVG rendering is complex — if the SVG layout is fighting you after 3 attempts, consider using a <canvas> approach or dagre for node positioning (dagre is already a dependency from Sprint 2E War Room).
- Manual station creation (right-click context menu) may require a custom context menu component — check if one exists before building. If not, a simpler "click message → action bar" pattern is acceptable.
- Sonnet has failed on the same problem twice → spawn Opus subagent

EXISTING INFRASTRUCTURE (from Sprint 11.2 + 11.3):
- conversation_events table with 26 event types registered
- captureEvent() fire-and-forget writer
- getEventsForConversation(conversationId) returns EventMetadata[]
- GET /api/transit/events?conversationId=xxx returns enriched events with message_index, total_messages, config
- ScrollbarLandmarks component (coexists — do not break)
- Topic detector (Jaccard similarity, synchronous)
- Registry with marker config: shape (circle/diamond/square/triangle/hexagon), color (CSS var), size (small/medium/large/landmark)
- dagre layout library already in dependencies (from Sprint 2E War Room)

FILE LOCATIONS (read before modifying):
  app/components/chat/Message.tsx              — message component to extend with metadata + markers
  app/components/chat/MessageList.tsx          — parent, already has conversationId prop
  app/components/chat/ChatInterface.tsx        — layout, tab bar, keyboard shortcuts
  app/lib/transit/registry.ts                  — marker configs, station triggers
  app/lib/transit/types.ts                     — type definitions
  app/lib/transit/capture.ts                   — event read/write
  app/app/api/transit/events/route.ts          — existing GET endpoint
  app/components/transit/ScrollbarLandmarks.tsx — existing, do not break

NEW FILES (Z3 — Tasks 1–6):
  app/components/transit/MessageMetadata.tsx                    — model/token/cost/latency inline display
  app/components/transit/EventMarkers.tsx                       — marker icons per event on a message
  app/components/transit/EventDetailPanel.tsx                   — popover/panel on marker click
  app/components/transit/__tests__/MessageMetadata.test.tsx
  app/components/transit/__tests__/EventMarkers.test.tsx

NEW FILES (Z2 — Tasks 7–13):
  app/lib/transit/stations.ts                                  — station auto-generation from events
  app/components/transit/SubwayMap.tsx                          — the subway map renderer
  app/components/transit/SubwayStationNode.tsx                  — individual station component
  app/components/transit/SubwayMarkerDot.tsx                    — between-station event dot
  app/components/transit/SubwayBranch.tsx                       — branch fork/merge rendering
  app/lib/transit/__tests__/stations.test.ts
  app/components/transit/__tests__/SubwayMap.test.tsx

---

═══════════════════════════════════════════════════════════════════════════════
PHASE 1: Z3 DETAIL ANNOTATIONS (Tasks 1–6)
═══════════════════════════════════════════════════════════════════════════════

TASK 1: MessageMetadata component

New file: app/components/transit/MessageMetadata.tsx

Renders subtle inline metadata below each assistant message:
- Model badge: small pill — "sonnet" in blue, "haiku" in green, "opus" in purple (derive model name from full model string like "claude-sonnet-4-5-20250929")
- Token count: compact format like "247 in · 1,842 out"
- Cost: "$0.0142" (4 decimal places)
- Latency: "1.2s" or "842ms" (auto-format based on magnitude)

Props interface:
```typescript
interface MessageMetadataProps {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  latencyMs?: number;
}
```

Style: text-xs, muted foreground color, flex row with gap-3. Model badge gets a subtle pill background. All fields optional — render only what's available.

Data source: The flow.message event payload from Sprint 11.2 captures { role, token_count, model, latency_ms }. Fetch events once at MessageList level (Task 3), extract flow.message event for each assistant message.

Tests (MessageMetadata.test.tsx):
- Renders model badge with correct label from full model string
- Renders token counts formatted with commas
- Renders cost with 4 decimal places
- Renders latency in seconds or milliseconds
- Omits missing fields gracefully (partial props)

TASK 2: EventMarkers component

New file: app/components/transit/EventMarkers.tsx

Renders small marker icons for events attached to a specific message.

Props interface:
```typescript
interface EventMarkersProps {
  events: Array<{
    id: string;
    event_type: string;
    created_at: number;
    payload: Record<string, unknown>;
    config: EventTypeDefinition | null;
  }>;
  onMarkerClick: (eventId: string) => void;
}
```

For each event with a non-null config:
1. Read marker config: config.marker.shape, .color, .size
2. Render SVG icon for the shape:
   - circle → <circle>
   - diamond → rotated <rect>
   - square → <rect>
   - triangle → <polygon>
   - hexagon → <polygon>
3. Size mapping: small=8px, medium=12px, large=16px, landmark=20px (slightly larger than spec's Z2 sizes since we're at Z3)
4. Color from config.marker.color (CSS variable string)
5. Multiple events on same message stack horizontally with gap-1
6. onClick fires onMarkerClick with the event ID
7. Hover shows a brief tooltip with event name (from config.name)

Tests (EventMarkers.test.tsx):
- Renders correct SVG shape per category (test one of each)
- Renders nothing for events with null config
- onClick fires with correct event ID
- Multiple events render in a row
- Size mapping produces correct pixel values

TASK 3: Wire metadata + markers into Message and MessageList

File: app/components/chat/MessageList.tsx
1. Fetch events for the active conversation using /api/transit/events?conversationId=xxx
2. Use a useMemo to build eventsMap: Map<string, EnrichedEvent[]> keyed by message_id
3. Pass messageEvents={eventsMap.get(message.id) ?? []} to each Message
4. Fetch once on mount and when conversationId or message count changes
5. The events fetch is the SAME endpoint ScrollbarLandmarks uses — consider sharing the data via a common state or fetching once for both consumers

File: app/components/chat/Message.tsx
1. Accept new optional prop: messageEvents (array of enriched events)
2. Accept new optional prop: showTransitMetadata (boolean, from settings)
3. For assistant messages when showTransitMetadata is true:
   a. Extract the flow.message event from messageEvents, pull model/tokens/cost/latency from its payload
   b. Render <MessageMetadata> below the message content
4. For all messages when showTransitMetadata is true:
   a. Render <EventMarkers> in the left gutter or trailing edge (decide based on existing layout)
   b. Pass an onMarkerClick handler that opens the EventDetailPanel

IMPORTANT: Do NOT create a separate fetch per message. All event data comes from the MessageList-level fetch.

TASK 4: EventDetailPanel

New file: app/components/transit/EventDetailPanel.tsx

When a marker is clicked, show event details. Check the codebase for an existing popover or drawer pattern — prefer reuse.

Props interface:
```typescript
interface EventDetailPanelProps {
  event: EnrichedEvent | null;  // null = closed
  onClose: () => void;
  onAnnotationAdd: (eventId: string, note: string) => void;
}
```

Content when event is set:
- Event type name (from config.name) + category badge
- Timestamp (formatted with date-fns if available, otherwise Intl.DateTimeFormat)
- Full payload rendered as key-value pairs (not raw JSON — iterate entries)
- Learning status pill: "pending" (amber) / "processed" (green) / "skipped" (gray)
- "Add Note" button that opens an inline text input (Task 6)
- Close button

Position: Popover anchored near the clicked marker, or a slide-out panel from the right edge (match existing patterns in the codebase — check Inspector drawer, ContextPanel).

State management: The selected event ID lives in MessageList or ChatInterface state. Clicking a marker sets it. Clicking close or clicking outside clears it.

TASK 5: Metadata visibility toggle

Add a toggle to show/hide the Transit Map metadata layer:
1. Add to UI store (Zustand): showTransitMetadata: boolean, default false
2. Keyboard shortcut: Cmd+Shift+M — check KeyboardShortcuts.tsx for conflicts first. If conflict, use Cmd+Shift+T.
3. Wire into Settings panel → Appearance section (if it exists): "Show Transit Map annotations"
4. MessageList reads this setting and passes it down to Message components
5. When false: MessageMetadata and EventMarkers not rendered, EventDetailPanel cannot open
6. ScrollbarLandmarks remain visible regardless (they're a separate system)

TASK 6: User annotation support

In EventDetailPanel:
1. "Add Note" button → reveals a textarea with a "Save" button
2. On save: POST to a new route or PATCH to existing events endpoint
3. Backend: append the note (with timestamp) to the annotations JSON array on the conversation_events row
4. After save, refetch events to update the panel

New API route (if needed): app/app/api/transit/events/[id]/route.ts
```typescript
// PATCH /api/transit/events/[id]
// Body: { annotations: string[] }  OR  { addAnnotation: string }
// Updates the annotations column on the conversation_events row
```

═══════════════════════════════════════════════════════════════════════════════
CHECKPOINT: After Task 6, verify:
  npx tsc --noEmit — 0 errors
  pnpm test:run — all passing
  Commit: "feat: Sprint 11.4 — Transit Map Z3 detail annotations"
  Push, then continue to Phase 2.
═══════════════════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════════════════
PHASE 2: Z2 SUBWAY VIEW (Tasks 7–14)
═══════════════════════════════════════════════════════════════════════════════

TASK 7: Station auto-generation

New file: app/lib/transit/stations.ts

Reads conversation_events for a thread and produces an ordered list of stations.

```typescript
interface Station {
  id: string;                    // nanoid
  eventId: string;               // FK to the triggering conversation_event
  messageId: string | null;      // FK to messages (null for session-level)
  messageIndex: number;          // Position in conversation (for layout)
  name: string;                  // Display label
  icon: string;                  // Emoji
  source: 'auto' | 'manual';    // How it was created
}

/**
 * Generate stations from conversation events.
 * Only events whose registry entry has station config produce stations.
 */
function generateStations(
  events: EnrichedEvent[],        // from /api/transit/events
): Station[]
```

Station triggers (from TRANSIT_MAP_SPEC.md §3.3):
- flow.topic_shift → name from payload.inferred_topic_label, icon "📍"
- cognitive.artifact_generated → name "Artifact: " + payload.artifact_type, icon "📦"
- system.gate_trigger → name "Gate: " + payload.gate_type, icon "🛑"
- flow.branch_fork → name "Fork: " + payload.branch_type, icon "🔀"
- flow.session_boundary → name "Session Start/End", icon "🚉"

IMPORTANT: Do NOT hardcode these triggers in the generation function. Read from the registry — add a `station` config field to EventTypeDefinition if not already present (check types.ts). The function should iterate events, check if their event type has station config in the registry, and generate accordingly.

Add station config to registry.ts entries that should produce stations. Add station field to EventTypeDefinition in types.ts:
```typescript
station?: {
  enabled: boolean;
  nameTemplate: string;    // Template: "Artifact: {payload.artifact_type}"
  icon: string;
};
```

Tests (stations.test.ts):
- Generates station from topic_shift event
- Generates station from artifact_generated event
- Skips events without station config
- Returns stations ordered by messageIndex
- Manual stations preserved alongside auto stations

TASK 8: Extend registry with station config

File: app/lib/transit/types.ts — add station field to EventTypeDefinition
File: app/lib/transit/registry.ts — add station config to the 5 station-producing event types

Template resolution: implement a simple template resolver that replaces {payload.field} with the value from the event payload. Example: "Artifact: {payload.artifact_type}" with payload { artifact_type: "code" } → "Artifact: code". Fall back to the event type name if template resolution fails.

TASK 9: SubwayMap renderer

New file: app/components/transit/SubwayMap.tsx

SVG-based horizontal subway map. Renders inside a container that can be placed as a tab or drawer.

Layout algorithm:
1. Stations are positioned left-to-right proportional to messageIndex / totalMessages
2. Between-station segments are lines connecting station nodes
3. Non-station events appear as small dots on the track between stations
4. dagre is available (Sprint 2E) but may be overkill for a linear layout — only use dagre if branch rendering (Task 11) needs it. For the main trunk, simple proportional positioning suffices.

Components:
- SubwayMap.tsx — outer SVG container, viewBox, pan/zoom state
- Station nodes: circle + label below, sized per station importance
- Track: SVG <path> or <line> connecting stations
- Between-station markers: small colored dots from EventMarkers (reuse shape/color logic)

Props:
```typescript
interface SubwayMapProps {
  stations: Station[];
  events: EnrichedEvent[];       // all events for between-station markers
  totalMessages: number;
  onStationClick: (station: Station) => void;
  onMarkerClick: (eventId: string) => void;
}
```

SVG dimensions: Calculate based on station count. Minimum width 600px, expand as needed. Height ~120px for single track, more for branches.

TASK 10: Click-to-scroll navigation

Wire station clicks to message scrolling:
1. SubwayMap fires onStationClick with the Station object
2. The handler in ChatInterface (or MessageList) scrolls to the message at station.messageIndex
3. Briefly highlight the target message (flash animation — CSS transition on background color, 1s fade)
4. Reverse direction: scrolling in MessageList should update the "active station" indicator in SubwayMap (the station nearest to the currently visible message range gets highlighted)

For scroll sync (subway → messages):
- Use scrollIntoView({ behavior: 'smooth', block: 'center' }) on the target message element
- Messages need stable DOM IDs: id={`message-${message.id}`} or similar (check if already present)

For scroll sync (messages → subway):
- Use an IntersectionObserver or scroll position to determine which message is centered
- Map that message's index to the nearest station
- Pass activeStationId to SubwayMap for highlight rendering

TASK 11: Branch rendering

File: app/components/transit/SubwayMap.tsx (or new SubwayBranch.tsx)

When flow.branch_fork events exist:
1. At the fork point, the track splits — main track continues straight, branch angles off at ~30°
2. Active branch (is_active_branch = 1) renders solid in trunk color
3. Abandoned branches render in gray dashed
4. Each branch gets its own stations (filter by message ancestry if tree data available)
5. Branch labels at fork point showing fork reason (regen/edit)

If tree data (parent_id, branch_index, is_active_branch from messages table) is not easily accessible via the events API:
- Add branch context to the /api/transit/events response, OR
- Create a lightweight /api/transit/branches?conversationId=xxx endpoint that returns the branch structure

If no fork events exist in the conversation, render a single straight track (degrade gracefully).

NOTE: Branch rendering is the most complex visual task. If getting stuck on SVG path calculations for angled branches, simplify to parallel horizontal lines with a vertical offset at the fork point. Polish can come later — get the structure right first.

TASK 12: Manual station creation

Add a way for the user to manually mark a message as a station:
1. In the message action bar or context (right-click) menu: "Mark as Landmark"
2. Opens a small inline form: station name (text input) + optional icon (emoji picker or text input)
3. On submit: POST to /api/transit/capture with a custom event type (add "transit.manual_station" to registry if needed) containing the user's name and icon
4. The station appears in the subway map immediately (re-fetch events)

If the codebase doesn't have a right-click context menu on messages, implement as a hover action button instead (simpler, consistent with existing edit/regenerate hover actions).

TASK 13: SubwayMap placement and toggle

Decide where the subway map lives:
1. CHECK the tab bar in ChatInterface.tsx — there's already "Strategic / Workers / War Room"
2. PREFERRED: Add a "Transit" tab alongside the existing tabs. When active, SubwayMap renders above the message list (split view: top 25% subway, bottom 75% messages)
3. ALTERNATIVE: Drawer/panel that slides in from the top or bottom
4. Keyboard shortcut: Cmd+T or Cmd+Shift+T (check for conflicts). If Cmd+Shift+T is taken by the metadata toggle (Task 5), use a different binding.

Wire into ChatInterface.tsx layout. The subway map and message list should be visible simultaneously for click-to-scroll to work.

TASK 14: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing
3. New tests summary:
   - MessageMetadata: 5+ tests (model badge, tokens, cost, latency, partial props)
   - EventMarkers: 5+ tests (shapes, colors, click, multiple events, null config)
   - stations.ts: 5+ tests (auto-generation, ordering, skip non-station, manual, template)
   - SubwayMap: 3+ tests (renders stations, handles empty, click fires callback) — pure logic where possible
4. Update STATUS.md — close Sprint 11.4+11.5, note combined mega-sprint
5. Write SPRINT_11_4_11_5_COMPLETE.md
6. Update FEATURE_BACKLOG.md — mark Phase C and Phase D as ✅ SHIPPED
7. Update SPRINT_ROADMAP.md execution summary
8. Commit: "feat: Sprint 11.4+11.5 — Transit Map Z3 annotations + Z2 subway view"
9. Push

---

QUALITY GATES:
 1. MessageMetadata displays on assistant messages when toggle is on
 2. EventMarkers show correct shapes/colors per category from registry
 3. Clicking a marker opens EventDetailPanel with full event data
 4. User can add annotations to events
 5. Toggle (Cmd+Shift+M or assigned shortcut) hides/shows all Z3 metadata UI
 6. Events fetched ONCE per conversation at MessageList level (not N+1)
 7. No interference with existing message layout or density settings
 8. Station auto-generation produces stations from registry config (not hardcoded triggers)
 9. Subway map renders stations proportionally positioned left-to-right
10. Click station → smooth scroll to that message
11. Scroll in messages → active station updates in subway
12. Branch forks render visually distinct from main trunk
13. Manual station creation works (hover action or context menu)
14. Subway map coexists with existing tabs (Strategic/Workers/War Room)
15. tsc clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. Fetch events ONCE at MessageList level — no N+1
3. Metadata hidden by default (opt-in toggle)
4. Do NOT change existing message layout when metadata is hidden
5. Station generation reads from registry config — NO hardcoded event type checks in renderer
6. Use cmd shell (not PowerShell)
7. Respect existing density settings (compact/comfortable/spacious)
8. Read Message.tsx, MessageList.tsx, ChatInterface.tsx FULLY before modifying
9. Mid-sprint checkpoint commit after Phase 1 (Z3) before starting Phase 2 (Z2)
10. dagre is available but only use it if branch layout needs it — simple linear layout first
