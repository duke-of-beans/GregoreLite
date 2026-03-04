# SPRINT 10.9 — UX Audit & Functional Wiring

**Goal**: Fix all UX issues from manual testing, wire dead buttons/routes, clean up console errors.
**Branch**: Continue on `master` (commit on top of cd1c123).
**Estimated tasks**: 15 across 3 waves.

---

## CONTEXT

Manual testing after Sprint 10.8 revealed cosmetic/functional issues: dead routes (404s), a tab that never loads, redundant UI elements, missing CRUD on context panel items, light mode broken, truncated text unreadable, and console noise. This sprint addresses all of them.

---

## WAVE 1 — Context Panel Fixes (Tasks 1-7)

### Task 1: Add delete/rename actions to Recent Chats items
**File**: `app/components/context/RecentChats.tsx`
**Problem**: Recent chat threads in the left panel cannot be deleted or renamed. No hover actions.
**Fix**: Add hover state with a rename (pencil) icon and delete (×) icon on each thread item.
- Rename: inline editable text field, PATCH to `/api/threads/[id]` (or call KERNL `updateThread()` directly)
- Delete: confirmation, then DELETE to KERNL `deleteThread()`. Remove from list on success.
- Check what KERNL functions exist for thread CRUD: look at `lib/kernl/session-manager.ts` for `updateThread`, `deleteThread`, or equivalent.
- If API routes don't exist for thread rename/delete, create them: `app/api/threads/[id]/route.ts` with PATCH (rename) and DELETE.

### Task 2: Add delete action to Recent Decisions items
**File**: `app/components/context/DecisionList.tsx`
**Problem**: The "Memory Modal deprecated in fa..." decision (and others) cannot be dismissed or deleted.
**Fix**: Add a dismiss (×) button on each decision item. On click, either:
- Delete from KERNL decisions table, OR
- Add a `dismissed` flag and filter dismissed decisions from the query
- Check `lib/kernl/database.ts` or `lib/kernl/session-manager.ts` for decision CRUD functions.
- If no delete function exists, add one.

### Task 3: Fix "No active project" / "Session #7" hierarchy
**Files**: `app/components/context/ProjectSection.tsx`, `app/components/context/SessionSection.tsx`
**Problem**: "No active project" heading with "Session #7 / 55m active" below it is confusing — looks like Session #7 is a project. These are two separate concepts (project vs session) that need visual separation.
**Fix**:
- Make "No active project" show as a dimmed/italic placeholder, not a heading
- Add a visual separator between project info and session info
- Session should show as its own labeled section: "SESSION" header with "#7 · 55m active" below
- Add rename capability to session name (click to edit)

### Task 4: Remove duplicate KERNL status from Context Panel footer
**Files**: `app/components/context/KERNLStatus.tsx`, `app/components/context/ContextPanel.tsx`
**Problem**: KERNL shows "indexed" with a green dot in both the Context Panel footer AND the main StatusBar. Redundant.
**Fix**: Remove `<KERNLStatus />` from the Context Panel footer section. Keep it in StatusBar only. The Context Panel footer should only show AEGIS status and suggestion slot (things that are panel-specific).

### Task 5: Truncated text must be readable — tooltip on all overflow text
**Files**: ALL Context Panel sub-components: `RecentChats.tsx`, `DecisionList.tsx`, `ProjectSection.tsx`, `SessionSection.tsx`, `EoSIssueRow.tsx`, `GhostCardList.tsx` (and any Ghost card components)
**Problem**: Text that bleeds off the panel edge (e.g., "Memory Modal deprecated in fa...") is unreadable. Panel width is fixed and content gets clipped with no way to read the full text.
**Fix**: For ALL text items in the Context Panel that could overflow:
- Apply `text-overflow: ellipsis; overflow: hidden; white-space: nowrap` as baseline truncation
- Add `title={fullText}` attribute to every truncated element so the full text shows on hover as a native tooltip
- Check EVERY sub-component in the Context Panel for potential overflow and apply consistently
- This includes: recent chat names, decision text, project names, session info, EoS issue descriptions, Ghost card titles/summaries

### Task 6: Fix collapsed panel caret position relative to indicator lights
**File**: `app/components/context/ContextPanel.tsx` — `CollapsedStrip` component
**Problem**: When collapsed, the expand caret should sit ABOVE the green indicator dots and clock icon, not below or among them. Currently the caret is at position 4 in the icon strip (after project dot, clock, KERNL dot).
**Fix**: Move the expand `<button>` to be the FIRST element in the CollapsedStrip, before the project dot, clock icon, and KERNL dot. The visual order from top should be: expand caret → project dot → clock → KERNL dot.

### Task 7: GregLite logo in Header should navigate to home / new conversation
**File**: `app/components/ui/Header.tsx`
**Problem**: Clicking the GregLite logo/name in the header does nothing.
**Fix**: Wrap the logo/brand area in a clickable element. On click:
- Create a new thread tab (reuse the `createTab()` action from thread-tabs-store)
- Switch to the Strategic tab
- Dispatch `greglite:load-thread` custom event or use the store directly
- This gives the "start fresh" / "home" behavior users expect from clicking a logo

---

## WAVE 2 — Functional Wiring (Tasks 8-12)

### Task 8: Fix light mode
**Files**: `app/lib/stores/ui-store.ts`, `app/globals.css` or `app/app/layout.tsx`
**Problem**: Selecting "Light" in settings theme toggle doesn't change anything. The theme state updates in Zustand but the CSS variables don't update.
**Fix**: 
- Check if `useUIStore.setTheme()` actually applies a class or data attribute to `<html>` or `<body>`
- The CSS should have both `:root` (dark default) and `[data-theme="light"]` or `.light` variable overrides
- If light mode CSS variables don't exist, create them. Light mode needs inverted values for: `--deep-space`, `--elevated`, `--surface`, `--ice-white`, `--frost`, `--mist`, `--shadow`, `--cyan`, `--success`, `--warning`, `--error`
- If the Zustand store updates but nothing applies the class/attribute to the DOM, add a `useEffect` in the root layout that syncs `theme` from the store to `document.documentElement.dataset.theme`

### Task 9: Fix 404 routes — /api/agent-sdk/costs/daily and /api/agent-sdk/status
**Problem**: Console shows 404 for these two routes. Something is polling them but the route files don't exist.
**Fix**:
- Find what component is fetching these URLs (search for `agent-sdk/costs/daily` and `agent-sdk/status` in the codebase)
- Either create the route files with appropriate responses, OR fix the fetch URL to point to the correct existing route (e.g., `/api/costs/today` instead of `/api/agent-sdk/costs/daily`, `/api/agent-sdk/budget-status` instead of `/api/agent-sdk/status`)

### Task 10: Fix War Room loading state
**Files**: `app/components/war-room/WarRoom.tsx` or `app/components/war-room/index.tsx`
**Problem**: Clicking the "War Room" tab shows a loading screen that never resolves.
**Fix**: 
- Check what the WarRoom component does on mount — likely fetches `/api/kernl/manifests` or similar
- If the API route returns empty data, the component should show an empty state ("No active jobs"), not infinite loading
- If the API route 404s or 500s, the component should catch the error and show the empty state
- The WarRoom should show `WarRoomEmpty` component (which already exists from Sprint 2E) when there are no jobs

### Task 11: Audit all header/tab buttons and AEGIS for dead clicks / broken state
**Files**: Various — `Header.tsx`, `ChatInterface.tsx`, tab bar components, `AEGISStatus.tsx`, `AegisSection.tsx`
**Action**: 
**Part A — Buttons:** Search the codebase for `console.log` calls that indicate stub/placeholder behavior (e.g., `console.log('[artifact-library] Selected artifact:', id)`). For each:
- If the feature exists but isn't wired, wire it
- If the feature is a future item, add a toast notification: "Coming soon" or remove the button entirely
- Specific known stubs to check:
  - Notification bell in Header — does it open anything?
  - Cmd+K command palette — does it open?
  - Workers tab — does it show real data or stub?

**Part B — AEGIS audit:** Check the AEGIS status display in the Context Panel footer and Settings panel:
- `AEGISStatus.tsx` — does it show accurate status? Does "AEGIS offline" show correctly when AEGIS isn't running?
- `AegisSection.tsx` in settings — does the AEGIS port field work? Does the override modal work?
- If AEGIS is offline (which it is in dev mode), the UI should show a clean "offline" state, not errors or broken indicators
- Make sure the "AEGIS offline — KERNL will log but signal won't reach AEGIS" message is user-friendly and not alarming

### Task 12: Audit StatusBar for accuracy
**File**: `app/components/ui/StatusBar.tsx`
**Action**: Check every item in the StatusBar:
- Cost today — is the number accurate or always $0.00?
- KERNL status — does "indexed" reflect real state?
- AEGIS status — clean offline state
- Job count — accurate or hardcoded?
- Remove or fix any items that show stale/wrong data

---

## WAVE 3 — Console Cleanup (Tasks 13-15)

### Task 13: Reduce context-provider poll frequency and noise
**File**: `app/lib/context/context-provider.tsx`
**Problem**: `[context-provider] poll fired` logs every few seconds in console, creating noise.
**Fix**: 
- Change from `console.log` to `console.debug` (only visible when verbose logging enabled)
- Consider increasing poll interval from current cadence (likely 5-10s) to 30s — context data doesn't change that fast

### Task 14: Suppress React DevTools message
**Problem**: `Download the React DevTools for a better development experience` shows on every load.
**Fix**: This is a React default message — can't be suppressed easily without modifying React internals. Leave it. Low priority. Just note it as "known, not actionable." Skip this task.

### Task 15: Final console audit
**Action**: Load the app, perform these actions, and verify console is clean:
1. Load page — should see only: `[boot] Bootstrap complete Xms`, maybe 1-2 HMR messages
2. Send a message — should see no errors
3. Switch to Workers tab — should see no errors
4. Switch to War Room tab — should see no errors, should show empty state
5. Open settings (gear icon) — should work
6. Toggle light mode — should apply
7. Toggle back to dark mode — should apply
8. Open/close context panel — should work
9. Click GregLite logo — should create new thread

Any remaining errors found during this audit should be fixed inline.

---

## EXECUTION INSTRUCTIONS

Use Desktop Commander tools for ALL file reads, writes, edits, and shell commands.
Do NOT use KERNL pm_read_file. Do NOT use Filesystem MCP tools.

Read these files for context before starting:
- `D:\Projects\GregLite\SPRINT_10_6_BLUEPRINT.md` — architecture context
- `D:\Projects\GregLite\SPRINT_10_8_BRIEF.md` — what was just fixed

Execute waves in order: Wave 1 (Tasks 1-7), Wave 2 (Tasks 8-12), Wave 3 (Tasks 13-15).

For each task, READ THE TARGET FILE FIRST before making changes. Understand current state.

After ALL tasks:
1. Run `cd /d D:\Projects\GregLite\app && npx tsc --noEmit` — must be ZERO errors
2. Delete `.next`, run `pnpm dev`, load the page, check console
3. Stage and commit: `git add -A && git commit -m "fix: Sprint 10.9 — UX audit + functional wiring"`

---

## FILES LIKELY TOUCHED

| # | File | Change |
|---|------|--------|
| 1 | `app/components/context/RecentChats.tsx` | Delete/rename + tooltips |
| 2 | `app/api/threads/[id]/route.ts` | NEW — PATCH/DELETE for thread CRUD |
| 3 | `app/components/context/DecisionList.tsx` | Dismiss button + tooltips |
| 4 | `app/components/context/ProjectSection.tsx` | Visual hierarchy + tooltips |
| 5 | `app/components/context/SessionSection.tsx` | Visual hierarchy + tooltips |
| 6 | `app/components/context/ContextPanel.tsx` | Remove KERNLStatus, fix caret order |
| 7 | `app/components/context/EoSIssueRow.tsx` | Tooltips |
| 8 | `app/components/ui/Header.tsx` | Logo → home click |
| 9 | `app/lib/stores/ui-store.ts` | Theme application to DOM |
| 10 | `app/globals.css` | Light mode CSS variables |
| 11 | `app/app/layout.tsx` | Theme sync useEffect |
| 12 | `app/components/war-room/*.tsx` | Fix loading/empty state |
| 13 | `app/components/context/AEGISStatus.tsx` | Clean offline state |
| 14 | `app/components/settings/AegisSection.tsx` | Audit functionality |
| 15 | `app/components/ui/StatusBar.tsx` | Audit accuracy |
| 16 | `app/lib/context/context-provider.tsx` | Reduce poll noise |
| 17 | Various agent-sdk components | Fix 404 fetch URLs |
