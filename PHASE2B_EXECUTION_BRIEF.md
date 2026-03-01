# GREGLITE — SPRINT 2B EXECUTION BRIEF
## Context Panel + KERNL UI
**Instance:** Parallel Workstream B (run simultaneously with 2A, 2C, 2D)
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Phase 1 baseline:** TypeScript 0 errors, 24/24 tests, KERNL SQLite live at .kernl/greglite.db

---

## YOUR ROLE

Bounded execution worker. You are building the left context panel — the live KERNL dashboard that makes GregLite feel like an intelligent cockpit rather than a chat window. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order before writing any code:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\PROJECT_DNA.yaml`
5. `D:\Projects\GregLite\STATUS.md`
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — read §3 (KERNL) for data model context
7. `D:\Projects\GregLite\SPRINT_2B_ContextPanel.md` — your complete spec

Then verify baseline:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```
Both must be clean before you touch anything.

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Same fix applied 3+ times
- Operation estimated >8 minutes without a checkpoint
- Critical decision not covered by the sprint blueprint
- You are about to build a polling/caching layer from scratch — check existing KERNL module first
- TypeScript errors increase beyond baseline

Write a BLOCKED report with: what you were doing, what triggered the stop, what decision is needed.

---

## QUALITY GATES (ALL REQUIRED BEFORE COMMIT)

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. No mocks, stubs, or TODOs in production code
4. Every new module has at least one vitest test
5. STATUS.md updated
6. Conventional commit format

---

## WHAT YOU ARE BUILDING

### New files

```
app/components/context/
  ContextPanel.tsx       — main panel container, 20% width, collapsible
  ProjectSection.tsx     — active project name + path (truncated)
  SessionSection.tsx     — session number + duration timer
  DecisionList.tsx       — recent 3–5 decisions with relative timestamps
  KERNLStatus.tsx        — ● indexed / ○ indexing / ✕ error indicator
  AEGISStatus.tsx        — last profile from aegis_signals table (read-only display)
  SuggestionSlot.tsx     — placeholder only, Phase 3 activates this
  index.ts               — exports

app/lib/context/
  context-provider.ts    — polls KERNL module every 30s, React context
  types.ts               — ContextPanelState interface
```

### Data sources

All data flows through the KERNL module built in Phase 1. Read the existing API in `app/lib/kernl/index.ts` before writing anything — you must use what's already there, not raw DB queries from components.

```typescript
interface ContextPanelState {
  activeProject: KERNLProject | null;
  sessionNumber: number;
  sessionDurationMs: number;
  recentDecisions: KERNLDecision[];
  kernlStatus: 'indexed' | 'indexing' | 'error';
  aegisProfile: string;          // 'IDLE' if no aegis_signals rows yet
  pendingSuggestions: number;    // always 0 until Phase 3
}
```

### Layout spec

```
┌─────────────────────┐
│  CONTEXT PANEL      │
│  (20% width)        │
│                     │
│  ● GHM Dashboard    │  ← active project name
│    D:\Work\...      │  ← path truncated to ~30 chars
│                     │
│  Session #47        │  ← count of threads in KERNL
│  2h 14m active      │  ← elapsed since thread created_at
│                     │
│  Recent Decisions   │
│  ─────────────────  │
│  • Use Sonnet 4.5   │  ← from decisions table
│    2 hours ago      │
│  • Split sprint 2A  │
│    yesterday        │
│                     │
│  KERNL  ● indexed   │
│  AEGIS  DEEP_FOCUS  │
│                     │
│  Suggestions: [0]   │  ← stub
└─────────────────────┘
```

### Collapsible behavior

- Default: expanded
- Toggle: Cmd+B — add to `app/components/ui/KeyboardShortcuts.tsx`
- Collapsed: 40px wide strip, icons only (project dot, session icon, KERNL dot)
- Preference persisted in `localStorage` key: `greglite:context-panel-collapsed`

### Bootstrap / loading state

On first render before KERNL data arrives, show skeleton shimmer for each section. Never show empty panel with no state — always loading or loaded. Animate content in when data arrives. The bootstrap module (Phase 1) targets <10s hydration — plan shimmer duration accordingly.

### AEGIS status display

Read from KERNL `aegis_signals` table — most recent row's profile column. If no rows exist yet, display 'IDLE'. This is display only — Sprint 2C handles the actual signal sending. Do not try to send signals here.

### Seeding test data

For local testing, seed KERNL with a project and a few decisions so the panel has real data to display. Write a seed script at `app/scripts/seed-kernl.ts` — do not hardcode test data into production components.

```typescript
// app/scripts/seed-kernl.ts
// Run with: npx tsx scripts/seed-kernl.ts
import { kernl } from '../lib/kernl';
await kernl.init();
await kernl.upsertProject('greglite', 'GregLite', 'D:\\Projects\\GregLite');
await kernl.writeDecision(threadId, 'Use better-sqlite3 for KERNL persistence', 'WAL mode, synchronous, no Redis dependency');
await kernl.writeDecision(threadId, 'Bootstrap loads dev protocols from D:\\Dev\\', 'Resolves D:\\Dev\\ dependency gap');
await kernl.writeDecision(threadId, 'Single-model only (Anthropic/Sonnet)', 'GregLite identity — not a mini-Gregore');
```

---

## INTEGRATION WITH OTHER PARALLEL SPRINTS

- **2C (AEGIS):** 2C will write to `aegis_signals` table. Your `AEGISStatus` component reads from that same table. You just need the read side; 2C handles writes. Coordinate on table schema if 2C hasn't committed yet — check `STATUS.md` for 2C progress.
- **2A (Agent SDK):** If 2A is ahead of you, it may expose active worker count. Wire `pendingSuggestions` or a worker count badge into the panel if the data is available. If not, leave 0 placeholder.

---

## CHECKPOINTING

Every 3 file writes:
1. `npx tsc --noEmit`
2. `git add && git commit -m "sprint-2b(wip): [what you just did]"`

---

## SESSION END

When all gates pass:

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Update `D:\Projects\GregLite\STATUS.md` — mark Sprint 2B complete
4. Final commit: `git commit -m "sprint-2b: context panel, KERNL UI"`
5. `git push`
6. Write `SPRINT_2B_COMPLETE.md` to `D:\Projects\GregLite\` with: what was built, decisions made, deviations, anything deferred

---

## GATES CHECKLIST

- [ ] Panel renders with real KERNL data (not hardcoded)
- [ ] Active project displayed (GregLite project seeded in KERNL)
- [ ] Recent decisions listed with relative timestamps
- [ ] Session number increments across restarts (reads thread count from DB)
- [ ] Cmd+B collapses/expands panel
- [ ] Collapsed state shows icons-only strip
- [ ] Loading shimmer shows during bootstrap hydration
- [ ] Panel polls every 30s (log confirms interval firing)
- [ ] AEGIS profile shows 'IDLE' when no signals exist
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed

---

## ENVIRONMENT

- Project root: `D:\Projects\GregLite\`
- App dir: `D:\Projects\GregLite\app\`
- Package manager: pnpm
- KERNL DB: `D:\Projects\GregLite\app\.kernl\greglite.db`
- API key: already in `app\.env.local`
- Do NOT modify anything in `D:\Projects\Gregore\`
- Do NOT commit `.env.local`
