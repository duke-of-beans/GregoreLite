# SPRINT 2B — Context Panel + KERNL UI
## GregLite Phase 2 | Parallel Workstream B
**Status:** READY TO QUEUE (after Phase 1 complete)  
**Depends on:** Phase 1 complete (Sprint 1E gates passed)  
**Parallel with:** 2A, 2C, 2D, 2E  
**Estimated sessions:** 3–4

---

## OBJECTIVE

Build the left context panel — the live dashboard showing KERNL state, active projects, recent decisions, and suggestions. This is what makes GregLite feel like an intelligent cockpit rather than a chat window.

**Success criteria:**
- Context panel renders at 20% width left of strategic thread
- Active project name and path displayed
- Session number displayed
- Last 3–5 decisions listed with timestamps
- KERNL index status shown (● indexed / ○ indexing)
- AEGIS current profile shown
- Suggestions slot (placeholder for Phase 3 Cross-Context engine)
- Panel is collapsible (keyboard shortcut: Cmd+B)

---

## NEW FILES TO CREATE

```
app/components/context/
  ContextPanel.tsx       — main panel container
  ProjectSection.tsx     — active project display
  SessionSection.tsx     — session number, duration
  DecisionList.tsx       — recent decisions from KERNL
  KERNLStatus.tsx        — index status indicator
  AEGISStatus.tsx        — current workload profile
  SuggestionSlot.tsx     — placeholder, Phase 3 activates
  index.ts               — exports

app/lib/context/
  context-provider.ts    — polls KERNL every 30s, exposes React context
  types.ts               — ContextPanelState interface
```

---

## LAYOUT

```
┌─────────────────────┐
│  CONTEXT PANEL      │
│  (20% width)        │
│                     │
│  ● GHM Dashboard    │  ← active project name
│    D:\Work\...      │  ← path (truncated)
│                     │
│  Session #47        │  ← from KERNL thread count
│  2h 14m active      │  ← session duration
│                     │
│  Recent Decisions   │
│  ─────────────────  │
│  • Use Sonnet 4.5   │  ← from KERNL decisions table
│    2 hours ago      │
│  • Split sprint 2A  │
│    yesterday        │
│  • Keep cascade.ts  │
│    2 days ago       │
│                     │
│  KERNL  ● indexed   │  ← green dot = ready
│  AEGIS  DEEP_FOCUS  │  ← from aegis_signals table
│                     │
│  Suggestions: [1]   │  ← placeholder, Phase 3
└─────────────────────┘
```

---

## DATA SOURCES

All data comes from KERNL module (built in Sprint 1B). Context panel polls KERNL via a React context provider on a 30-second interval. No direct DB access from components — always through the KERNL module API.

```typescript
interface ContextPanelState {
  activeProject: KERNLProject | null;
  sessionNumber: number;
  sessionDurationMs: number;
  recentDecisions: KERNLDecision[];
  kernlStatus: 'indexed' | 'indexing' | 'error';
  aegisProfile: string;
  pendingSuggestions: number; // always 0 until Phase 3
}
```

---

## AEGIS STATUS

Read from KERNL `aegis_signals` table — last signal sent. Display the profile name. If no signal yet, display 'IDLE'. This is read-only display; the actual AEGIS signal sender is built in Sprint 2C.

---

## COLLAPSIBLE BEHAVIOR

- Default: expanded
- Toggle: Cmd+B (add to KeyboardShortcuts.tsx)
- Collapsed state: 40px wide strip with icons only
- Preference persisted in localStorage

---

## BOOTSTRAP DISPLAY

On first render, show skeleton shimmer while KERNL hydrates. Once bootstrap context arrives (<10s target from 1D), animate content in. Never show empty panel — always show loading state if data not ready.

---

## GATES

- [ ] Panel renders with real KERNL data
- [ ] Active project displayed (set GregLite itself as active project in KERNL for testing)
- [ ] Recent decisions listed (create 3 test decisions in KERNL)
- [ ] Session number increments across restarts
- [ ] Cmd+B collapses/expands panel
- [ ] Loading shimmer shows during bootstrap
- [ ] Panel polls every 30s (verify via network or logs)
- [ ] pnpm type-check clean
- [ ] Commit: `sprint-2b: context panel, KERNL UI`
