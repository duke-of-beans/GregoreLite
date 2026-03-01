# SPRINT 2B COMPLETE — Context Panel + KERNL UI
**Completed:** March 1, 2026  
**Session count:** 1 (context window exhausted mid-session, resumed)  
**Commit:** `sprint-2b: context panel, KERNL UI`

---

## What Was Built

Sprint 2B delivered the left context panel — a 20%-width collapsible sidebar that polls KERNL every 30 seconds and surfaces active project, session counter, recent decisions, KERNL status, and AEGIS profile. The panel is wired into the main layout and togglable via Cmd+B.

### New Files

| File | Purpose |
|------|---------|
| `app/app/api/context/route.ts` | GET /api/context — server-side KERNL aggregator |
| `app/lib/context/types.ts` | ContextPanelState, KERNLProject, KERNLDecision interfaces |
| `app/lib/context/context-provider.ts` | React context, 30s polling, localStorage collapsed state |
| `app/components/context/ContextPanel.tsx` | Main panel container, Cmd+B listener |
| `app/components/context/ProjectSection.tsx` | Active project display |
| `app/components/context/SessionSection.tsx` | Session number + duration |
| `app/components/context/DecisionList.tsx` | Last 5 decisions with relative timestamps |
| `app/components/context/KERNLStatus.tsx` | indexed / indexing / error indicator |
| `app/components/context/AEGISStatus.tsx` | AEGIS profile display |
| `app/components/context/SuggestionSlot.tsx` | Phase 3 placeholder (pendingSuggestions) |
| `app/components/context/index.ts` | Barrel exports |
| `app/lib/kernl/project-store.ts` | createProject, getProject, listProjects, getActiveProject, upsertProject, touchProject |
| `app/lib/kernl/aegis-store.ts` | logAegisSignal, getLatestAegisSignal |
| `app/scripts/seed-kernl.ts` | Dev seed script (project + thread + 3 decisions) |
| `app/lib/__tests__/unit/context-provider.test.ts` | 12 tests — ContextPanelState type conformance |
| `app/lib/__tests__/unit/kernl-project-store.test.ts` | 13 tests — project-store + aegis-store via vi.mock |

### Modified Files

| File | Change |
|------|--------|
| `app/lib/kernl/schema.sql` | Added `aegis_signals` table + index (was in BLUEPRINT, missing from schema) |
| `app/lib/kernl/index.ts` | Exported project-store and aegis-store functions |
| `app/app/page.tsx` | Flex-row layout: ContextPanel (20%) + ChatInterface (flex-1) |
| `app/components/chat/ChatInterface.tsx` | `h-screen` → `h-full` to fill flex parent |
| `app/components/ui/KeyboardShortcuts.tsx` | Added Cmd+B entry to Global shortcuts display |

---

## Architectural Decisions

**Context panel polls `/api/context` every 30s (not direct KERNL access from client).** better-sqlite3 is server-side only. The API route is the boundary — client components only ever see JSON. This was the only valid approach given Next.js + Tauri architecture.

**`ContextPanel` owns the context, `PanelContent` consumes it.** `useContextPanelProvider()` creates state (used once in `ContextPanel`). `useContextPanel()` reads state (used in all child components). A bug where `PanelContent` called the wrong hook (creating a second isolated provider instance) was caught and fixed before commit.

**Cmd+B registered as a `useEffect` in `PanelContent`, not in `KeyboardShortcuts.tsx`.** `KeyboardShortcuts.tsx` is a display modal, not a global listener. The shortcut lives alongside the state it controls.

**`aegisOnline` made optional in `ContextPanelState`.** Sprint 2C will implement `@/lib/aegis`. Making the field optional (`aegisOnline?: boolean`) keeps the type honest without blocking Sprint 2B completion. The route stubs `false` until Sprint 2C wires `getAEGISStatus()`.

**Vitest mocks `@/lib/kernl/database` for all KERNL unit tests.** `better-sqlite3` native binary cannot load inside Vitest's child process in this pnpm + Tauri environment. The established pattern: `vi.mock('@/lib/kernl/database')` with an in-memory Map-based simulator. All future KERNL tests should follow this pattern.

---

## Deviations from Spec

**Pre-existing TypeScript errors from parallel sprint work.** Sprint 2A introduced errors in `agent-sdk/`, `bootstrap/`, and `Message.tsx`. Sprint 2C introduced errors in `aegis/` routes and `aegis.test.ts`. None of these are Sprint 2B's responsibility. Sprint 2B introduced zero new tsc errors.

**`aegis_signals` was missing from `schema.sql`.** The BLUEPRINT_FINAL.md §3 specified the table. Phase 1 never added it. Sprint 2B added it with `CREATE TABLE IF NOT EXISTS` — safe for existing databases.

**`aegis.test.ts` failure is Sprint 2C's incomplete module.** The failing test file was written by Sprint 2C but `@/lib/aegis` doesn't exist yet. All 67 passing tests include Sprint 2B's 25 new tests.

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `context-provider.test.ts` (Sprint 2B) | 12 | ✅ Pass |
| `kernl-project-store.test.ts` (Sprint 2B) | 13 | ✅ Pass |
| `artifacts/detector.test.ts` | 11 | ✅ Pass |
| `artifacts/store.test.ts` | 7 | ✅ Pass |
| `ui-store.test.ts` | 24 | ✅ Pass |
| `aegis.test.ts` (Sprint 2C, incomplete) | 0 loaded | ❌ Module missing — Sprint 2C |
| **Total passing** | **67** | ✅ |

---

## Handoff to Sprint 2C

Sprint 2C should implement `@/lib/aegis` with at minimum:
- `initAEGIS()`, `shutdownAEGIS()`, `getAEGISStatus()` exports
- `getAEGISStatus()` returns `{ online: boolean }`
- Wire `getAEGISStatus()` into `GET /api/context` (line already stubbed: `const aegisOnline = false; // TODO Sprint-2C`)
- Remove the `// wired in Sprint 2C` comment from `ContextPanelState.aegisOnline` in `lib/context/types.ts` and make it required

The `aegis_signals` table is live in schema.sql. `logAegisSignal()` and `getLatestAegisSignal()` are live in `lib/kernl/aegis-store.ts`.
