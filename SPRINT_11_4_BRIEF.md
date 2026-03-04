GREGLITE SPRINT 11.4 - Transit Map Phase C: Z3 Detail Annotations
Per-message metadata overlay | March 2026

YOUR ROLE: Build the Z3 detail annotation layer — per-message metadata (model, tokens, cost, latency) and event markers that show what happened at each message. This reads from conversation_events (Sprint 11.2) and renders inline on messages. Also adds a toggle to show/hide the metadata layer and an event detail panel for clicking markers. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\TRANSIT_MAP_SPEC.md — READ §3.7 (Z3 Detail), §3.2 (Markers), §2.3 (EventMetadata schema)
4. D:\Projects\GregLite\app\lib\transit\registry.ts — event type marker configs (shape, color)
5. D:\Projects\GregLite\app\lib\transit\types.ts — MarkerShape, EventTypeDefinition
6. D:\Projects\GregLite\app\components\chat\Message.tsx — the message component you'll extend
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- Message.tsx may have a complex prop interface — read the full component and understand what data is available before adding metadata display. Token count, cost, model, and latency may already be in the message props or SSE event data.
- The event detail panel (click on marker → slide-out) should use existing drawer/panel patterns from the codebase (Inspector drawer, context panel) — don't invent a new pattern.
- If per-message event queries are too expensive (N+1 query per message), batch them: fetch all events for the conversation once, then filter by message_id client-side.
- Sonnet has failed on the same problem twice → spawn Opus subagent

FILE LOCATIONS (read before modifying):
  app/components/chat/Message.tsx          — the message component to extend
  app/components/chat/MessageList.tsx      — parent that renders messages
  app/lib/transit/registry.ts              — marker shape/color configs
  app/app/api/transit/events/route.ts      — may already exist from Sprint 11.3, otherwise create

NEW FILES:
  app/components/transit/MessageMetadata.tsx    — model/token/cost/latency display
  app/components/transit/EventMarkers.tsx       — marker icons per event on a message
  app/components/transit/EventDetailPanel.tsx   — slide-out panel on marker click
  app/components/transit/__tests__/MessageMetadata.test.tsx
  app/components/transit/__tests__/EventMarkers.test.tsx

---

TASK 1: MessageMetadata component

New file: app/components/transit/MessageMetadata.tsx

Renders subtle inline metadata below each assistant message:
- Model badge: small pill with "sonnet" / "haiku" / "opus" (derive from model string)
- Token count: "247 in · 1,842 out" or similar compact format
- Cost: "$0.0142" (4 decimal places)
- Latency: "1.2s"

Props:
- model: string
- inputTokens: number
- outputTokens: number
- cost: number
- latencyMs: number

Style: text-xs, text-gray-500, flex row with gaps. Model badge gets a subtle background color (blue for sonnet, green for haiku, purple for opus).

Where does this data come from? Check:
1. SSE events may include usage data (input_tokens, output_tokens) — check route.ts
2. Cost may already be tracked per-message in the cost tracker
3. Model is set in the chat route
4. Latency = time between request start and first/last token

If per-message metadata isn't currently stored, capture it in the flow.message event payload (Sprint 11.2 already captures { role, token_count, model, latency_ms }). Read from conversation_events.

TASK 2: EventMarkers component

New file: app/components/transit/EventMarkers.tsx

Renders small marker icons for events attached to a specific message.

Props:
- events: Array<{ event_type: string; id: string; timestamp: string; payload: Record<string, unknown> }>
- onMarkerClick: (eventId: string) => void

For each event:
1. Look up the event type in the registry to get marker config (shape, color)
2. Render an SVG icon: circle (●), diamond (◆), square (■), triangle (▲), hexagon (⬡)
3. Color from registry marker.color
4. Size: 12px for small, 16px for medium, 20px for large
5. Stacked vertically if multiple events on same message
6. onClick fires onMarkerClick with the event ID

TASK 3: Wire into Message component

File: app/components/chat/Message.tsx

1. For assistant messages, render MessageMetadata below the content (if metadata toggle is on)
2. For all messages, render EventMarkers in the left margin or right edge
3. The metadata and markers need data — two approaches:
   a) PREFERRED: Fetch all events for the conversation once at the MessageList level, pass filtered events to each Message as a prop
   b) ALTERNATIVE: Each message fetches its own events (N+1 — avoid this)

In MessageList.tsx:
- Fetch events for the active conversation (use /api/transit/events?conversationId=xxx)
- Create a Map<string, Event[]> keyed by message_id
- Pass messageEvents={eventsMap.get(message.id) ?? []} to each Message

In Message.tsx:
- Accept messageEvents prop
- Render EventMarkers with those events
- Render MessageMetadata for assistant messages (extract model/tokens/cost/latency from flow.message event payload or from message props if available)

TASK 4: Event detail panel

New file: app/components/transit/EventDetailPanel.tsx

When a marker is clicked, show event details. Use a popover or slide-out panel:
- Event type name (from registry)
- Timestamp (formatted)
- Category badge
- Full payload (formatted JSON or key-value pairs)
- Learning status indicator (pending/processed/skipped)
- Related message link (click to scroll to message)

Use Popover pattern if the codebase has one, or a simple absolute-positioned card anchored to the marker.

TASK 5: Metadata visibility toggle

Add a toggle to show/hide the message metadata layer:
- Keyboard shortcut: Cmd+Shift+M (check KeyboardShortcuts.tsx for conflicts)
- Setting in ui-store (or existing settings store): showMessageMetadata: boolean, default false
- When false: MessageMetadata and EventMarkers are not rendered (clean view)
- When true: both are visible
- Add to Settings panel → Appearance section if it exists

TASK 6: User annotation support

In EventDetailPanel, add an "Add Note" action:
- Opens a small text input
- On submit, appends to the annotations array on the conversation_events row
- POST to /api/transit/capture with an action to update annotations (or create a /api/transit/events/[id]/annotate route)

TASK 7: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing
3. New tests:
   - MessageMetadata renders model badge, token counts, cost, latency
   - EventMarkers renders correct shapes and colors from registry
   - EventMarkers onClick fires with event ID
   - Toggle hides/shows metadata
4. Update STATUS.md
5. Write SPRINT_11_4_COMPLETE.md
6. Commit: "feat: Sprint 11.4 — Transit Map Z3 detail annotations (message metadata, event markers, detail panel)"
7. Push

QUALITY GATES:
1. MessageMetadata displays on assistant messages when toggle is on
2. EventMarkers show correct shapes/colors per category
3. Clicking a marker opens EventDetailPanel with full event data
4. User can add annotations to events
5. Toggle (Cmd+Shift+M) hides/shows all Transit Map UI
6. Events fetched once per conversation (not N+1 per message)
7. No interference with existing message layout or density settings
8. tsc clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. Fetch events ONCE at MessageList level, not per-message
3. Metadata is hidden by default (opt-in via toggle)
4. Do NOT change existing message layout when metadata is hidden
5. Use cmd shell (not PowerShell)
6. Respect existing density settings (compact/comfortable/spacious)
7. Read Message.tsx and MessageList.tsx FULLY before modifying
