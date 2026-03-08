# Sprint 39.0 — UX Overhaul: Onboarding, Tour, Navigation & Discoverability
**Status:** Ready to execute
**Date:** March 8, 2026
**Scope:** All UX issues identified in bug/feedback session — 9 concrete tasks

## Background

GregLite is now launching correctly (isTauri() fix, Sprint 38 use-client fixes). The
app works but is not yet approachable for anyone who isn't already deeply familiar
with what it does. This sprint addresses every UX/discoverability/navigation issue
raised in the March 8 feedback session.

## Issues Being Fixed

1. Context Library drawer is nearly transparent — broken background variable
2. `portfolio_projects` table missing — Projects panel crashes
3. Tour exists but is broken (no selector matches, welcome fires but tour skips all steps)
4. Settings drawer is claustrophobic — needs full-window modal treatment
5. Collapsed status bar has no visible re-expand affordance (too thin, hard to click)
6. No inline contextual help — users can't discover what any panel or control does
7. No import wizard in onboarding flow — new users can't connect their work
8. Global copy is too technical — needs layman-friendly language throughout

## Task Breakdown

### Task 1 — Fix ContextLibrary transparent drawer
File: `app/components/cross-context/ContextLibrary.tsx`
Root cause: `background: 'var(--bg)'` — `--bg` is unset or transparent in the current theme.
Fix: Replace with `background: 'var(--deep-space)'` (same as SettingsPanel uses).
Also replace header background with `'var(--elevated)'` so it's distinct from body.
While here: add a subtitle under "CONTEXT LIBRARY" explaining what this panel is —
"Suggestions you've dismissed. Restore them to the active suggestion pool."

### Task 2 — Fix portfolio_projects table missing
File: `app/lib/kernl/database.ts`
Root cause: The `portfolio_projects` table is referenced by the portfolio components
but was never added to the migration/schema. The KERNL database schema needs to
include this table so the Projects panel doesn't crash on first open.
- Add CREATE TABLE IF NOT EXISTS `portfolio_projects` to the migration function
- Schema: id TEXT PK, name TEXT NOT NULL, description TEXT, path TEXT, status TEXT
  DEFAULT 'active', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
- This is additive — existing DBs just get the new table on next app start
- Also check: `/api/portfolio` route — it probably also references this table,
  make sure it uses KERNL db rather than a separate portfolio_db

### Task 3 — Settings: full-window modal instead of narrow drawer
File: `app/components/settings/SettingsPanel.tsx`
Current: 400px right drawer. The content is dense and cramped.
Fix: Convert to a centered full-window overlay modal (80vw × 85vh, max 1000px × 700px).
- Left sidebar navigation instead of horizontal pill tabs (more space, more readable)
- Each tab label uses friendly layman copy (see copy updates in Task 8)
- Keyboard: Escape still closes
- Backdrop click still closes
- Animation: subtle scale-in (same as WelcomeModal pattern)

### Task 4 — Status bar collapsed state: visible re-expand button
File: `app/components/ui/StatusBar.tsx`
Current: When collapsed, renders as a 1.5px thin strip — nearly invisible, impossible to discover.
Fix: When collapsed, render a 20px bar with:
- Thin gradient top border in cyan
- A small "▲ System Status" label in the center in mist color
- Full-width click target
- Tooltip "Click to expand status bar"
This makes the expand affordance obvious without being obtrusive.

### Task 5 — Tour steps: fix all broken selectors + extend tour
File: `app/lib/tour/steps.ts` + `app/components/tour/TourOrchestrator.tsx`
Current issues:
- `.chat-input-area` — this selector doesn't exist in InputField.tsx (check actual class)
- `[data-tour='memory-shimmer']` — not present in any rendered element
- `[data-tour='workers-tab']` and `[data-tour='war-room-tab']` — not present in Header tabs
Fix:
- Audit every selector against the actual DOM. Find the real class/data-attr or add
  data-tour attributes to the correct elements.
- Add `data-tour="chat-input"` to the textarea/input in InputField.tsx
- Add `data-tour="memory-shimmer"` to the ShimmerOverlay or trigger element
- Add `data-tour="workers-tab"` and `data-tour="war-room-tab"` to the correct tab buttons in Header
- Expand tour to 12 steps covering: Chat Input, Context Panel, New Conversation, Projects,
  Memory/Shimmer, Workers, War Room, Transit Map, Settings, Status Bar, Capture Pad, Help Guide
- Update step copy to be layman-friendly (no internal system names — see Task 8)

### Task 6 — Contextual help: HelpGuide per-section tooltips
File: `app/components/ui/HelpGuide.tsx` (currently exists — extend it)
Current: One `?` button in the header opens a generic "what's this" card.
Fix: Replace with a distributed help system:
- Add a small `?` icon button next to every major section label in the ContextPanel
  (Projects, Decisions, Quality, Memory, Background)
- Add `?` icons to every settings section header
- Add `?` to each tab in the new Settings modal sidebar
- Each `?` opens a small popover anchored to the element with 2-3 sentences of
  plain-language explanation of what the section does and why it matters
- Style: same cyan border + dark bg as TourTooltip, but smaller (240px wide)
- Implement as a single `<HelpPopover>` component with a `content` prop
  so the same component handles all instances

### Task 7 — Onboarding: add import step to OnboardingFlow
File: `app/components/onboarding/OnboardingFlow.tsx` + new `OnboardingStep5Import.tsx`
Current: 4 steps (API Key, KERNL, AEGIS, Ready). There's no step to connect projects
or import existing conversations.
Fix: Add Step 5 between AEGIS and Ready:
- Title: "Connect your work"
- Body: Explains that GregLite can learn from your existing conversations and projects
- Two options (both optional / skippable):
  a) "Add a project folder" — opens a folder picker (Tauri dialog or manual path input)
     and calls the existing KERNL `createProject` to register it
  b) "Import past conversations" — links to the Import section in Settings with a
     brief explanation of supported formats (Claude.ai JSON export, etc.)
- "Skip for now" button is prominent — this step is never blocking
- If a project path is entered and the folder exists, show a green checkmark + project name
- The step feeds into the existing onboarding completion flow unchanged

### Task 8 — Global copy audit: layman-friendly language
Files: `app/lib/voice/copy-templates.ts` — update all labels visible in the UI
Current technical terms that need plain-English equivalents:
  - "AEGIS" → "System Monitor" (already done in sprint 23 — verify it's consistent)
  - "KERNL" → "Memory" (already done — verify)
  - "EoS" / "Code Quality" → "Code Quality" everywhere
  - "Ghost Thread" / "Background Assistant" → "Background Assistant" (already done)
  - "Transit Map" → "Conversation Map" or keep as "Transit Map" with a subtitle
  - "War Room" → keep (it's evocative) but add subtitle "Multi-Agent Workspace"
  - "Context Library" → rename to "Suggestion Archive" with subtitle
  - "Suppressed suggestions" → "Archived suggestions"
  - Settings tab labels — replace current tab keys with friendly names:
    "Appearance" stays, "Memory & Background" (was memory_ghost),
    "Budget & Quality" stays, "Startup & Sync" stays, "Advanced" stays
  - Status bar labels: "BACKGROUND: Off" → users don't know what "background" is.
    Add a tooltip that explains each metric in plain English (most already have title attrs — verify/improve)
  - Tour step copy: avoid any mention of "sprint", "KERNL", "AEGIS", "EoS" in user-facing strings

### Task 9 — TypeScript gate
Run `cd /d D:\Projects\GregLite\app && npx tsc --noEmit`
Zero new TypeScript errors before commit.
