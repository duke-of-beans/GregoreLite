# Sprint 2E Complete — War Room Dependency Graph UI
**Date:** March 1, 2026  
**Gate:** ✅ TSC 0 errors · 161/161 tests passing

---

## What Was Built

The War Room is a live SVG dependency graph embedded in GregLite's ChatInterface as a third tab alongside Strategic and Workers. It renders KERNL manifest data as a directed acyclic graph, polling every 5 seconds for changes.

**Backend (`app/lib/war-room/`):**

- `types.ts` — `GraphNode`, `GraphEdge`, `WarRoomGraph`, `ManifestRow`, `NodeStatus`, `PositionMap`
- `graph-builder.ts` — fetches `/api/kernl/manifests`, maps KERNL `JobState` to `NodeStatus` (spawning/working/validating → running, completed → complete), builds graph, applies dagre LR layout (ranksep 80, nodesep 40, NODE_WIDTH 180, NODE_HEIGHT 60), computes SVG canvas size
- `poller.ts` — `startWarRoomPolling()` fires immediately, polls every 5s, JSON.stringify diffs to skip no-change ticks, returns cleanup function

**API (`app/app/api/kernl/manifests/route.ts`):**

`GET /api/kernl/manifests` — SELECTs all rows from the manifests table via `getDatabase()`, returns JSON array ordered by `created_at DESC`.

**UI (`app/components/war-room/`):**

- `WarRoomEmpty.tsx` — empty state with 🗺️ icon and CTA
- `JobNode.tsx` — SVG `<foreignObject>` node with left color strip, status badge, and `.war-room-pulse` CSS animation on status change
- `JobEdge.tsx` — cubic bezier `<path>` from right-center to left-center of each node pair, with `<marker>` arrowhead
- `ManifestDetail.tsx` — right sidebar (w-72) on node click, shows status/type/cost/tokens/created, Restart button for failed/interrupted
- `DependencyGraph.tsx` — SVG canvas with `<defs>` arrowhead, edges rendered behind nodes, scrollable overflow wrapper
- `WarRoom.tsx` — main view: polling lifecycle, toolbar (job count, error indicator, "Live · 5s"), loading/empty/graph states, ManifestDetail sidebar

**Navigation:**

- Tab bar added to `ChatInterface.tsx`: Strategic (★) / Workers (⚙) / War Room (🗺 · Cmd+W)
- `Cmd+W` keyboard handler toggles between warroom and strategic tabs
- `KeyboardShortcuts.tsx` updated with the new shortcut

**Tooling:**

- `scripts/seed-manifests.ts` — idempotent seed script creating a diamond pattern (A→B, A→C, B→D, C→D) across completed/running/pending states
- `lib/__tests__/unit/war-room.test.ts` — 21 tests covering buildGraph status mapping, edge extraction, malformed JSON guards, layoutGraph LR ordering, computeCanvasSize padding, and all poller behaviors

---

## Key Decisions

**dagre for layout (LEAN-OUT).** The brief mandated using dagre rather than building custom layout logic. The library handles all rankdir/ranksep/nodesep configuration and outputs center-point `{x, y}` positions per node — no custom tree traversal needed.

**2A types used directly (not stubbed).** Verified Sprint 2A was committed (`b802b68`) and `TaskManifest` in `app/lib/agent-sdk/types.ts` already had `dependencies: string[]`. The War Room reads from the `manifests` SQLite table directly via a new API route — no agent-sdk imports needed in the UI layer.

**Tab bar in ChatInterface (not a page route).** The jobs UI is an API-only route (`/api/jobs`), not a page. The existing ChatInterface has no routing layer. Tab state (`ActiveTab`) lives as local React state in ChatInterface with conditional rendering — zero routing infrastructure added.

---

## Nothing Deferred

All items from the execution brief were implemented: backend lib, API route, 6 UI components, tab navigation, Cmd+W shortcut, seed script, vitest tests. No stubs, no mocks left in production code, no deferred items.

---

## Phase 2 Status

All five parallel sprints (2A–2E) are now complete. Phase 2 gate can be run when ready.
