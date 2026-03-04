# SPRINT 11.4+11.5 COMPLETE — Transit Map Z3 Annotations + Z2 Subway View

**Completed:** March 4, 2026
**Status:** ✅ SHIPPED
**Tests:** 1165/1168 (13 new; 3 pre-existing failures unrelated to sprint scope)
**TSC:** 0 errors

---

## Overview

Sprint 11.4 delivered Transit Map Z3 (per-message metadata + event markers) and Sprint 11.5 delivered Transit Map Z2 (the full horizontal subway view with station auto-generation, branch rendering, and manual landmark creation). Both phases were executed as a single mega-sprint due to architectural dependency between the shared event fetch pattern and the subway renderer.

---

## Sprint 11.4 — Phase C: Z3 Detail Annotations

**Spec ref:** TRANSIT_MAP_SPEC.md §3.7, §3.2

### Files Shipped

`components/transit/MessageMetadata.tsx` — Per-message inline metadata bar rendering model badge (pill), token counts (in/out), cost (4dp USD), and latency (ms). All calculation logic exported as pure functions (`parseModelLabel`, `formatTokens`, `formatCost`, `formatLatency`) for unit testing without jsdom.

`components/transit/EventMarkers.tsx` — SVG shape renderers for event markers on messages. Supports circle, diamond, square, triangle, hexagon — driven entirely by registry config, nothing hardcoded. Exported pure functions `markerSizePx` and `renderMarkerShape` for unit testing.

`components/transit/EventDetailPanel.tsx` — Right slide-in drawer (InspectorDrawer pattern, z-index 200). Displays full event payload, existing annotations, and Add Note form. Wires to the `PATCH /api/transit/events/[id]` endpoint.

`components/chat/Message.tsx` — Extended with `id`, `messageEvents`, `showTransitMetadata`, and `onMarkerClick` props. Renders `<MessageMetadata>` and `<EventMarkers>` conditionally.

`components/chat/MessageList.tsx` — Single shared event fetch from `/api/transit/events?conversationId=`. Builds a `Map<message_id, EnrichedEvent[]>` for O(1) per-message lookup. Enforces N+1 rule: one fetch per conversation load, not per message render.

`components/chat/ChatInterface.tsx` — `Cmd+Shift+M` toggle for transit metadata, `Cmd+T` for transit tab. Transit tab split view: SubwayMap (25%) / messages (75%). Wires `showTransitMetadata` from `ui-store`.

`components/settings/AppearanceSection.tsx` — "Transit Map" toggle pill with shortcut hint.

`lib/stores/ui-store.ts` — `showTransitMetadata: boolean` (default false) + `toggleTransitMetadata()`.

`lib/transit/types.ts` — `EnrichedEvent`, `EventsApiResponse`, `Station`, and `station?` field on `EventTypeDefinition`.

`app/api/transit/events/[id]/route.ts` — PATCH endpoint for user annotations (adds to `payload.annotations[]`).

`app/api/transit/events/route.ts` — GET endpoint enriching events with `message_index` from thread messages.

### Tests (Sprint 11.4)
- `__tests__/MessageMetadata.test.tsx` — 22 pure logic tests
- `__tests__/EventMarkers.test.tsx` — 14 pure logic tests
- Total new: 36 tests | Running total at end of 11.4: 1040/1043

---

## Sprint 11.5 — Phase D: Z2 Subway View

**Spec ref:** TRANSIT_MAP_SPEC.md §3.1, §3.3, §3.6

### Files Shipped

`lib/transit/stations.ts` — `resolveTemplate(template, payload)` performs Handlebars-style `{{field}}` substitution from event payload. `generateStations(events, totalMessages)` reads `station` config from the event registry and auto-creates `Station[]` — zero hardcoded entity names, patterns emerge from data. Both functions exported as pure fns for unit testing.

`components/transit/SubwayMap.tsx` — Full SVG horizontal subway renderer. `indexToX(index, total, svgWidth, paddingX?)` maps message index to proportional SVG X coordinate — exported pure function. `extractBranchSegments(events, totalMessages, svgWidth, trackY)` extracts fork events into `BranchSegment[]` for branch rendering — exported for unit testing. Renders track line, station nodes, event marker dots, and branch curves. Receives `events` prop from ChatInterface (no internal fetch — shared event state pattern).

`components/transit/SubwayStationNode.tsx` — Station label + icon rendering. Tooltip on hover. Click fires `onStationClick(messageIndex)` to trigger scroll-to-message.

`components/transit/SubwayMarkerDot.tsx` — Event marker dots positioned on subway track. Colored by event category from registry config. Click fires `onMarkerClick(event)` to open EventDetailPanel.

`components/transit/SubwayBranch.tsx` — Fork/merge visualization using bezier curves between Y track positions. Renders active and inactive branches in distinct styles.

`components/chat/Message.tsx` (Task 12) — Added `onMarkAsLandmark?: (messageId: string, name: string, icon: string) => void` prop. Hover actions row gains "⭐ Landmark" button. Clicking opens an inline form with emoji input (max 4 chars) and name input. Save fires `onMarkAsLandmark`; Enter key submits; Escape cancels. Form state is local (`useState` — no store pollution).

`components/chat/MessageList.tsx` (Task 12 + shared events) — `handleMarkAsLandmark` async callback calls `captureClientEvent({ event_type: 'transit.manual_station', ... })` then re-fetches events to update the subway map. `propEvents` bypass: when ChatInterface provides events via prop, MessageList skips its own internal fetch (single source of truth). Fixed TS7030 scroll-to-index useEffect to return `undefined` on all non-cleanup paths. Fixed `setTransitEvents` → `setFetchedEvents` typo.

`components/chat/ChatInterface.tsx` (hoisting fix) — Transit useEffect moved to after `const messages = activeMessages` declaration to resolve TS2448 (variables used before declaration in effect closure). Single `transitEvents` state passed as `events` prop to both `<SubwayMap>` and `<MessageList>`.

### Tests (Sprint 11.5)
- `components/transit/__tests__/SubwayMap.test.tsx` — 13 pure logic tests:
  - `indexToX` (6 tests): maps index 0 to paddingX, last index to width−paddingX, midpoint to center, single-message centers, strictly monotone increasing, default paddingX applies
  - `extractBranchSegments` (7 tests): empty events → empty array, one segment per fork event, isActive true when branch is current, isActive false for resolved, forkX < endX always, trunkY matches trackY, label matches branch_type from payload
- `lib/transit/__tests__/stations.test.ts` — 13 tests (verified passing, written prior session)
- Total new this session: 13 tests | Running total: 1165/1168

---

## TypeScript Error Fixes

Six TSC errors resolved during sprint execution:

1. **TS2448 (×2) + TS2454 (×2) — ChatInterface.tsx line 112**: Transit `useEffect` referenced `activeConversationId` and `messages` before their `const` declarations in the same function scope. Fixed by moving the effect to after `const messages = activeMessages`.

2. **TS7030 — MessageList.tsx line 109**: Scroll-to-index `useEffect` returned a cleanup function only inside `if (el)`, leaving other code paths with no return. Fixed by inverting to `if (!el) return undefined` guard pattern so the cleanup return is always reached in the success path.

3. **TS2552 — MessageList.tsx line 158**: `setTransitEvents` called but state setter was named `setFetchedEvents`. Fixed with targeted edit.

---

## Architecture Decisions

**Shared event fetch (no per-component fetching):** Events lifted to ChatInterface and passed as a prop. SubwayMap and MessageList both receive the same `events[]` reference. This prevents N×2 fetches when both components are mounted and ensures the subway map and message annotations stay in sync.

**Pure function exports for testability:** `indexToX`, `extractBranchSegments`, `resolveTemplate`, `generateStations`, `parseModelLabel`, `formatTokens`, `formatCost`, `formatLatency`, `markerSizePx`, `renderMarkerShape` are all exported pure functions with no React dependencies. This allows the Vitest node environment (no jsdom) to test all critical logic without mounting components.

**Zero hardcoded entities in infrastructure:** Station generation reads from the event registry. Landmark creation uses a registered `transit.manual_station` event type. No subway station names, branch labels, or landmark icons are hardcoded — all emerge from conversation data.

---

## What's Next

- **Sprint 11.6 — Phase E: Z1 Sankey View** (FEATURE_BACKLOG.md) — Sankey flow graph, token volume edge widths, quality color coding, zoom transition animations between Z1/Z2/Z3.
- **Sprint 11.3 Phase B** (Scrollbar Landmarks) is already shipped — the scrollbar ticks and subway map now work in concert.
- Consider: `stations.test.ts` tests for `resolveTemplate` edge cases (missing field, nested field, empty template).
