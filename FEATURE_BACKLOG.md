# GREGLITE — FEATURE BACKLOG
# Updated: March 4, 2026
# Purpose: Ground-truth gap analysis. What's actually missing vs what's built.
# Source: Codebase audit (March 4, 2026), updated after Sprints 11.0–11.5, 11.7, 12.0
# Sprint Roadmap: SPRINT_ROADMAP.md

---

## STATUS KEY
- ✅ SHIPPED — In codebase, tested, working
- ❌ MISSING — Zero implementation despite being in spec
- 🔜 NEXT — Ready to build, Cowork prompt exists

---

## TRANSIT MAP (Sprints 11.2–11.7)

Full spec: TRANSIT_MAP_SPEC.md (829 lines). ALL PHASES (A–F) SHIPPED. Transit Map COMPLETE.

### ✅ Phase A: Data Foundation (Sprint 11.2) — COMPLETE (commit 37d60af)
- ✅ `conversation_events` table, tree columns on messages
- ✅ 26 event types registered across 5 categories
- ✅ captureEvent() + getEventsForConversation() + getEventsByType()
- ✅ Client-side captureClientEvent() via /api/transit/capture POST
- ✅ Capture hooks: flow.message, quality.interruption, quality.regeneration, quality.edit_resend

### ✅ Phase B: Scrollbar Landmarks (Sprint 11.3) — COMPLETE (commit 7c08d9f)
- ✅ ScrollbarLandmarks component — event-driven colored ticks on scrollbar overlay (§5.1, §5.2)
- ✅ Topic detector — Jaccard similarity, synchronous, threshold 0.4
- ✅ Capture hooks: flow.topic_shift, cognitive.artifact_generated, system.gate_trigger (§4.4)
- ✅ 21 new tests (topic-detector 11, ScrollbarLandmarks 10)

### ✅ Phase C: Z3 Detail Annotations (Sprint 11.4) — COMPLETE (commit dc188fd)
- ✅ MessageMetadata: model badge pill, token counts, cost (4dp), latency (§3.7)
- ✅ EventMarkers: SVG shapes from registry (circle/diamond/square/triangle/hexagon) (§3.2)
- ✅ EventDetailPanel: slide-in drawer, full payload, annotations, learning status
- ✅ User annotation support via PATCH /api/transit/events/[id]
- ✅ Cmd+Shift+M toggle (default off), Settings panel entry
- ✅ 36 new tests

### ✅ Phase D: Z2 Subway View (Sprint 11.5) — COMPLETE (commit dc188fd)
- ✅ Station auto-generation from registry config — `generateStations()` + `resolveTemplate()` (§3.3)
- ✅ SubwayMap SVG renderer with `indexToX()` + `extractBranchSegments()` exported pure fns (§3.6)
- ✅ SubwayStationNode, SubwayMarkerDot, SubwayBranch components
- ✅ Branch rendering — fork/merge visualization, bezier curves (§3.1)
- ✅ Click-to-scroll navigation from stations to messages
- ✅ Manual station creation (⭐ Landmark hover button → inline form → `transit.manual_station` event)
- ✅ Transit tab in ChatInterface (split view: subway 25%, messages 75%)
- ✅ 13 new tests

### ✅ Phase E: Z1 Sankey View (Sprint 11.6) — COMPLETE
- ✅ Sankey flow graph renderer — `buildSankeyGraph()` pure function, `SankeyView.tsx` SVG renderer (§3.5)
- ✅ Token volume → edge width mapping — `scaleLinkWidth()` linear 2–40px, `SankeyLink.tsx` bezier paths
- ✅ Quality color coding on segments — `getQualityColor()` from registry, worst-wins aggregation per segment
- ✅ Zoom transition animations (Z1 ↔ Z2 ↔ Z3) — `ZoomController.tsx` render-prop, 300ms crossfade
- ✅ 42 new tests (sankey 18, SankeyView 12, ZoomController 12)

### ✅ Phase F: Learning Engine (Sprint 11.7) — COMPLETE (commit 4b2382d)
- ✅ Batch processor: `runLearningPipeline()` + 6h scheduler with `.unref()` (§6.1)
- ✅ Pattern detectors: verbosity (token buckets), regeneration (task types), model routing (§6.2)
- ✅ Insight generator: confidence scoring (base+recency+consistency, 95% cap), dedup, conflict detection (§6.3)
- ✅ Human approval gate: proposed → approved → applied flow, no auto-apply
- ✅ Insight registry: full rollback (before_state captured), 90-day decay
- ✅ InsightReviewPanel in InspectorDrawer (6th tab 🔮) + API route
- ✅ 148 new tests

---

## COMPLETED — Sprint 11.0+11.1 (commit 5cb2420)

- ✅ Dead route consolidation — /api/conversations deleted, /api/jobs deleted, lib/database/ removed (16 files)
- ✅ Decision gate dead stubs removed
- ✅ Stale Sprint 7G/4B comments cleaned
- ✅ test_runner, shim_readonly_audit, markdown_linter, kernl_search_readonly — all implemented
- ✅ detectShimLoop() — 3-call pattern detection, BLOCKED state transition

## COMPLETED — Sprint 12.0 (commit 3ae1f0d)

- ✅ Prompt caching — cache_control: ephemeral on stable system prompt blocks
- ✅ Batch API — batch-executor.ts, 50% cost + Haiku routing
- ✅ Smart Haiku routing — summaries and auto-title default to Haiku
- ✅ Cache cost tracking in CostBreakdown UI

## COMPLETED — Phase 8 (commits 8e25a72 → 728d175, git tag v1.0.0)

- ✅ Security hardening, leak fixes, EoS 0→100, NSIS installer, onboarding wizard, README

## COMPLETED — Phase 9 (22 sprints, commit ac634bd, v1.1.0)

- ✅ Full cockpit: all keyboard shortcuts, command palette, notifications, multi-thread tabs, etc.

## COMPLETED — Sprint 10.x (Sprints 10.5–10.9)

- ✅ SSE streaming, flat messages, density toggle, theme, settings, thread CRUD, polish
