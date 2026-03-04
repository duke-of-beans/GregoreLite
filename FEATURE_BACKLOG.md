# GREGLITE — FEATURE BACKLOG
# Updated: March 4, 2026
# Purpose: Ground-truth gap analysis. What's actually missing vs what's built.
# Source: Codebase audit (March 4, 2026), updated after Sprints 11.0, 11.1, 12.0
# Sprint Roadmap: SPRINT_ROADMAP.md

---

## STATUS KEY
- ✅ SHIPPED — In codebase, tested, working
- ❌ MISSING — Zero implementation despite being in spec
- 🔜 NEXT — Ready to build, Cowork prompt exists

---

## TRANSIT MAP (Sprints 11.2–11.7) — Phase F ✅ SHIPPED

Full spec: TRANSIT_MAP_SPEC.md (829 lines). Zero implementation exists.

### ✅ Phase A: Data Foundation (Sprint 11.2) — COMPLETE (commit 37d60af)
- ✅ `conversation_events` table, tree columns on messages
- ✅ 26 event types registered across 5 categories
- ✅ captureEvent() + getEventsForConversation() + getEventsByType()
- ✅ Client-side captureClientEvent() via /api/transit/capture POST
- ✅ Capture hooks: flow.message, quality.interruption, quality.regeneration, quality.edit_resend

### 🔜 Phase B: Scrollbar Landmarks (Sprint 11.3) ❌ — NEXT (parallel with 11.4)
- CustomScrollbar component reading from conversation_events (§5.1)
- Landmark rendering — colored ticks on scrollbar track (§5.2)
- Capture hooks: flow.topic_shift, cognitive.artifact_generated, system.gate_trigger (§4.4)

### ✅ Phase C: Z3 Detail Annotations (Sprint 11.4) — COMPLETE (March 4, 2026)
- ✅ Per-message inline metadata: model badge, token count, cost, latency (§3.7)
- ✅ Event marker rendering on messages (§3.2)
- ✅ Event detail panel on marker click
- ✅ User annotation support

### ✅ Phase D: Z2 Subway View (Sprint 11.5) — COMPLETE (March 4, 2026)
- ✅ Station auto-generation from events (§3.3) — `generateStations()` + `resolveTemplate()`
- ✅ Subway line renderer (horizontal, with markers) (§3.6) — `SubwayMap.tsx`, `SubwayStationNode.tsx`, `SubwayMarkerDot.tsx`
- ✅ Branch rendering — fork/merge visualization (§3.1) — `SubwayBranch.tsx`, `extractBranchSegments()`
- ✅ Click-to-scroll navigation from stations to messages
- ✅ Manual station creation ("⭐ Landmark" hover button → inline form → `transit.manual_station` event)

### Phase E: Z1 Sankey View (Sprint 11.6) ❌
- Sankey flow graph renderer (§3.5)
- Token volume → edge width mapping
- Quality color coding on segments
- Zoom transition animations (Z1 ↔ Z2 ↔ Z3)

### ✅ Phase F: Learning Engine (Sprint 11.7) — COMPLETE (March 4, 2026)
- Batch processor for learnable events (§6.1) — `runLearningPipeline()` + 6h scheduler
- Pattern detectors: verbosity (token buckets), regeneration (task types), model routing (§6.2)
- Insight generator with confidence scoring, 95% cap, deduplication, conflict detection (§6.3)
- Human approval gate: proposed → approved → applied flow (no auto-apply)
- Insight registry with full rollback support + 90-day decay
- 148 new tests all passing | InsightReviewPanel + InspectorDrawer 6th tab + API route

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
