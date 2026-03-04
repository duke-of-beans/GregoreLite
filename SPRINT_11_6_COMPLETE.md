# SPRINT 11.6 — TRANSIT MAP PHASE E: Z1 SANKEY VIEW — COMPLETE

**Date:** March 4, 2026
**Duration:** Single session
**TSC:** 0 errors
**Tests:** 42 new (18 sankey + 12 SankeyView + 12 ZoomController), all passing
**Total:** 1207/1210 (3 pre-existing failures unchanged)
**Spec:** TRANSIT_MAP_SPEC.md §3.5

---

## WHAT SHIPPED

### New Files (6)

1. **`lib/transit/sankey.ts`** — Pure data model
   - `buildSankeyGraph()`: transforms EnrichedEvent[] + Station[] → SankeyGraph
   - Segment boundaries from sorted station messageIndex positions
   - Branch fork detection from `flow.branch_fork` events
   - Quality signal aggregation: worst-wins per segment (negative > attention > neutral > positive)
   - Token/cost summation per segment and total
   - Types: `QualitySignal`, `SankeyNode`, `SankeyLink`, `SankeyGraph`
   - `getQualityColor()`: maps signals to CSS variables from registry palette

2. **`components/transit/SankeyLink.tsx`** — SVG bezier flow paths
   - `scaleLinkWidth()`: linear interpolation, MIN=2px, MAX=40px
   - Cubic bezier curves (midpoint control points for natural flow)
   - Abandoned branch styling: dashed stroke, gray color, 25% opacity

3. **`components/transit/SankeySegment.tsx`** — Rounded rect nodes
   - Quality color fill at 20% opacity with 80% border
   - Hover tooltip: message count, token count, dominant model
   - Abandoned branches: gray fill, dashed border, 50% opacity

4. **`components/transit/SankeyView.tsx`** — Main SVG renderer
   - `indexToX()` proportional positioning (matches SubwayMap logic exactly)
   - Node height proportional to tokenCount (30–80px range)
   - Header bar: total messages, tokens, cost
   - Click segment → parent handles zoom to Z2
   - Horizontally scrollable for wide conversations

5. **`components/transit/ZoomController.tsx`** — Zoom state machine
   - Render-prop pattern: `ZoomLevel = 'Z1' | 'Z2' | 'Z3'`
   - 300ms crossfade transitions with previousZoom tracking
   - `zoomToSegment(messageIndex)` → Z2 with focus
   - `zoomToMessage(messageId)` → Z3 with focus
   - `ZoomIndicator` inline component (Z1/Z2/Z3 buttons)
   - Keyboard shortcuts noted as conflicting with density controls — left as no-op stubs

6. **Test files (3)**
   - `lib/transit/__tests__/sankey.test.ts`: 18 tests (getQualityColor, scaleLinkWidth, buildSankeyGraph)
   - `components/transit/__tests__/SankeyView.test.tsx`: 12 tests (indexToX layout, node height, link width boundaries)
   - `components/transit/__tests__/ZoomController.test.tsx`: 12 tests (initial state, transitions, focus preservation, constants)

### Modified Files (1)

- **`components/chat/ChatInterface.tsx`**: Transit tab now wrapped in ZoomController. Z1 renders SankeyView, Z2 renders SubwayMap + MessageList (existing), Z3 renders MessageList only. Crossfade opacity transitions between levels.

---

## ARCHITECTURE DECISIONS

1. **Pure data model**: `buildSankeyGraph()` is a pure function — no side effects, deterministic, easy to test. All layout happens in SankeyView.
2. **Registry-driven colors**: Quality colors come from CSS variables matching the event registry palette. Zero hardcoded color values.
3. **Shared transitEvents**: SankeyView receives the same `transitEvents` state from ChatInterface — no duplicate API calls.
4. **Render-prop ZoomController**: Keeps zoom state management separate from layout. ChatInterface controls what renders at each level.
5. **Crossfade first**: 300ms opacity transitions between zoom levels. Continuous pinch-zoom is a stretch goal, not blocking ship.

---

## TRANSIT MAP — COMPLETE

With Sprint 11.6, all six phases of the Transit Map are shipped:

- Phase A: Data Foundation (Sprint 11.2) — event capture, 26 types, registry
- Phase B: Scrollbar Landmarks (Sprint 11.3) — colored ticks, topic detection
- Phase C: Z3 Detail Annotations (Sprint 11.4) — metadata, markers, panels
- Phase D: Z2 Subway View (Sprint 11.5) — stations, branches, click-to-scroll
- Phase E: Z1 Sankey View (Sprint 11.6) — topology graph, zoom transitions ← THIS SPRINT
- Phase F: Learning Engine (Sprint 11.7) — pattern detection, insight pipeline

The three-zoom-level visualization is operational: Z1 (Sankey topology) ↔ Z2 (Subway route) ↔ Z3 (Detail messages).
