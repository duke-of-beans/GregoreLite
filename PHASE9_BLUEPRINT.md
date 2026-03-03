GREGLITE PHASE 9 BLUEPRINT — The Full Cockpit
21 features across 4 execution waves | Parallel where possible, sequential where not
Source: FEATURE_BACKLOG.md | March 2026

---

## OVERVIEW

Phase 9 ships everything that was designed but not built, stubbed but not wired, or identified as missing-but-obvious. At the end of Phase 9, GregLite is no longer "a strategic thread with scaffolding" — it is a complete single-user cognitive cockpit. Every keyboard shortcut fires. Every background event surfaces. Notifications reach you whether you're looking or not. You can run parallel strategic threads, browse your decision history, search past conversations, and tell Ghost what you want more of.

This is not an incremental improvement. This is closing the gap between what §10 drew on paper and what you actually experience when you open the app.

Total items: 21
New schema tables: 2 (manifest_templates, ghost_preferences)
New components: ~25
Modified components: ~12
Estimated total sprints: 22 (most parallelizable — see wave structure)

---

## DEPENDENCY DAG

```
WAVE 0 — Schema
  S9-00: DB migrations (manifest_templates, ghost_preferences)
    └─ unblocks: S9-06 (Ghost Teach Me), S9-07 (Manifest Templates)

WAVE 1 — Independent Parallel (start all simultaneously after Wave 0)
  S9-01: Multi-thread Tabs          [no Wave 1 deps]
  S9-02: Command Palette            [no Wave 1 deps — command registry self-contained]
  S9-03: Notification Display       [no Wave 1 deps]
  S9-04: Status Bar                 [no Wave 1 deps]
  S9-05: Morning Briefing           [no Wave 1 deps]
  S9-06: Ghost Teach Me             [needs S9-00]
  S9-07: Manifest Templates         [needs S9-00]
  S9-08: In-Thread Search           [no Wave 1 deps — messages_fts exists]
  S9-09: EoS History Sparkline      [no Wave 1 deps — eos_reports exists]
  S9-10: Cost Breakdown by Project  [no Wave 1 deps — session_costs.project_id exists]
  S9-11: Job Retry / Edit           [no Wave 1 deps]
  S9-12: Chat History Panel         [no Wave 1 deps — conversation-store exists]

WAVE 2 — Depends on Wave 1 (start after Wave 1 sprints complete)
  S9-13: Settings Panel             [consumes S9-03 notification patterns, S9-09 EoS data]
  S9-14: Inspector Drawer           [consumes S9-03 notifications, S9-09 EoS history, S9-10 costs]
  S9-15: Push Notifications / Tray  [needs S9-03 notification router established]
  S9-16: Decision Browser           [benefits from S9-12 history panel patterns]
  S9-17: Artifact Library           [independent but lower priority — fits Wave 2 timing]
  S9-18: KERNL Health Panel         [goes into Inspector from S9-14]
  S9-19: Project Quick-Switcher     [wires into S9-02 command palette]
  S9-20: Edit Last Message / Regen  [polish, independent but low priority]

WAVE 3 — Design-first
  S9-21: Memory Modal               [requires design decision before any code]
```

---

## COWORK ROUTING

Sprints that are pure UI + one data source → single Cowork session.
Sprints that touch schema + backend + frontend + tests → multi-step with checkpoints.

SINGLE COWORK SESSION (contained scope):
  S9-00, S9-03, S9-04, S9-08, S9-09, S9-10, S9-11, S9-18, S9-19, S9-20

MULTI-STEP (checkpoint mid-session):
  S9-01 (thread state isolation is complex), S9-02 (command registry + palette UI),
  S9-05 (generator service + UI), S9-06 (scorer integration + UI), S9-07 (template CRUD + ManifestBuilder),
  S9-12 (conversation-store + panel UI), S9-13 (settings form + persistence),
  S9-14 (inspector drawer + tab system), S9-15 (Rust Tauri plugin + notification routing),
  S9-16 (decision browser with search/filter)

SPAWN ORDER FOR MAXIMUM PARALLELISM:
  1. Spawn S9-00 alone (schema must land before S9-06 and S9-07)
  2. Once S9-00 commits: spawn S9-01, S9-02, S9-03, S9-04, S9-05, S9-06, S9-07, S9-08, S9-09, S9-10, S9-11, S9-12 all simultaneously
  3. Once each Wave 1 sprint completes, spawn its Wave 2 dependents immediately

---

## WAVE 0

---

### S9-00 — Schema Migrations
**Scope:** Two new tables + one view alias. No existing tables modified.
**Estimated size:** ~60 lines SQL + migration runner entry

**New: manifest_templates table**
```sql
CREATE TABLE IF NOT EXISTS manifest_templates (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT,
  task_type    TEXT NOT NULL,
  title        TEXT NOT NULL,
  template_description TEXT NOT NULL,
  success_criteria TEXT NOT NULL,  -- JSON array of strings
  project_path TEXT NOT NULL,
  use_count    INTEGER DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_manifest_templates_task ON manifest_templates(task_type);
```

**New: ghost_preferences table**
```sql
CREATE TABLE IF NOT EXISTS ghost_preferences (
  id           TEXT PRIMARY KEY,
  source_type  TEXT,              -- 'file' | 'email' | NULL (any)
  topic_hint   TEXT NOT NULL,     -- e.g. "GHM competitor intelligence"
  boost_factor REAL DEFAULT 1.5,  -- multiplier applied to ghost scorer
  created_at   INTEGER NOT NULL,
  use_count    INTEGER DEFAULT 0  -- incremented when preference fires
);
CREATE INDEX IF NOT EXISTS idx_ghost_preferences_source ON ghost_preferences(source_type);
```

**What to add to schema.sql:** Both tables above, at end of file.
**Migration runner:** Add to database.ts runMigrations() — same pattern as Phase 6-7 additions.

**Quality gates:**
- Both tables created in greglite.db with correct columns
- indexes present
- pnpm test:run still passes
- tsc clean

---

## WAVE 1 — ALL PARALLEL AFTER S9-00 COMMITS

---

### S9-01 — Multi-Thread Tabs (B1) [LARGEST — START FIRST]
**What exists:** KERNL listThreads(), createThread(), getThread() all built. ChatInterface has tab bar with Strategic/Workers/War Room. Single thread hard-wired via bootSequence restoring one conversationId.
**What's needed:** Thread switcher — multiple simultaneous strategic threads, each fully KERNL-persisted, independent state, tab bar renders them dynamically.

**Architecture decisions:**
Thread state isolation lives in a new `thread-tabs-store.ts` (Zustand). Each tab entry: `{ id, kernlThreadId, title, messages, conversationId, ghostContextActive, artifact }`. Switching tabs swaps the active entry. ChatInterface reads from the active tab entry, not its own useState. Messages, artifacts, and ghost context all become per-tab.

The existing `conversation-store` and `message-store` are separate database-backed stores for the Conversation/Message repositories (the Next.js-side persistence layer). Thread tabs use the KERNL-side `threads` table — these two persistence layers need to stay aligned. On tab create: create KERNL thread, create Conversation in conversation-store, store both IDs in thread-tabs-store.

**New files:**
```
app/lib/stores/thread-tabs-store.ts    - tab registry, active tab, per-tab message state
app/components/chat/ThreadTabBar.tsx   - horizontal tab strip with [+] and close
app/components/chat/ThreadTab.tsx      - individual tab (title, active indicator, close button)
app/lib/kernl/thread-tabs.ts           - KERNL read/write helpers for tab persistence
```

**Modified files:**
```
app/components/chat/ChatInterface.tsx  - consume thread-tabs-store instead of local useState for messages/conversationId
app/components/context/ContextPanel.tsx - show active tab's project/session context
app/lib/stores/ghost-store.ts          - setActiveThreadId already exists, make it per-tab
```

**Behavior:**
- On first boot: single default tab "Strategic" created
- [+] button: prompt for title → create KERNL thread → create tab
- Click tab: switch active, restore from KERNL (same bootSequence logic per tab)
- Close tab (×): confirm if messages exist, remove from store (KERNL thread persists)
- Tab titles: editable on double-click
- Max 8 tabs enforced with visual warning at 6
- Cmd+N: new tab (currently does nothing)
- Tab badge: cyan dot when Ghost has active context in that tab, amber dot when Decision Gate active

**Quality gates:**
- Two simultaneous strategic threads with different conversations hold independent state
- Switching tabs does not lose messages, artifacts, or ghost context
- Cmd+N creates a new tab
- Each tab recovers independently from KERNL on reload
- Decision Gate on Tab 1 does not block Tab 2
- Ghost context active in Tab 2 does not appear in Tab 1
- pnpm test:run passes, tsc clean

---

### S9-02 — Command Palette (A1)
**What exists:** Header.tsx has a Cmd+K button that fires console.log. ui-store has openCommandPalette / closeCommandPalette / toggleCommandPalette / setCommandQuery / addRecentCommand — all fully implemented.
**What's needed:** The actual component, a command registry, and wiring the Cmd+K handler.

**Command registry pattern:** `lib/command-registry/index.ts` — an array of CommandDef objects registered at module load. Each command: `{ id, label, category, shortcut?, keywords[], icon?, action: () => void, available?: () => boolean }`. The `available` function gates commands contextually — "Spawn job" only when on strategic tab. Registry is a singleton; components register commands on mount.

**Palette behavior:**
- Cmd+K anywhere opens it (or Escape closes it)
- Fuzzy search over label + keywords
- Recent commands shown when query empty
- Arrow keys navigate, Enter executes
- Category headers group results (Navigation, Thread, Jobs, Ghost, Settings, KERNL)
- Result shows: icon + label + category badge + shortcut if defined

**Day-1 commands to register:**
```
Navigation:  Switch to Strategic, Switch to Workers, Switch to War Room
Thread:      New Thread (Cmd+N), Close Current Thread, Rename Thread
Jobs:        Spawn Job (opens ManifestBuilder), View All Jobs (Workers tab)
Ghost:       Open Privacy Dashboard, Open Context Library
Settings:    Open Settings, Toggle Theme, Open Inspector
KERNL:       Browse Decisions, Search KERNL (open, type to search decisions/patterns)
```

**New files:**
```
app/lib/command-registry/index.ts      - CommandDef type, registry singleton, register/unregister
app/lib/command-registry/commands.ts   - all built-in command definitions
app/components/ui/CommandPalette.tsx   - modal overlay, search input, result list
app/components/ui/CommandResult.tsx    - single result row
```

**Modified files:**
```
app/components/ui/Header.tsx           - wire Cmd+K to useUIStore.toggleCommandPalette()
app/components/chat/ChatInterface.tsx  - register Navigation commands, Thread commands on mount
app/components/jobs/JobQueue.tsx       - register "Spawn Job" command on mount
```

**Quality gates:**
- Cmd+K opens palette from any view
- Fuzzy search returns results within 50ms for 20+ commands
- Recent commands persist across app restarts (ui-store is persisted)
- All day-1 commands execute their action
- Available() gates respected — "Spawn Job" absent when in War Room tab
- Escape closes palette without triggering any action
- tsc clean, pnpm test:run passes

---

### S9-03 — Notification Display (A2)
**What exists:** ui-store has addNotification / dismissNotification / clearNotifications fully implemented with typed severities, auto-dismiss via setTimeout, dismissed flag. Zero rendering.
**What's needed:** Two components that read from ui-store.notifications.

**ToastStack:** Fixed position bottom-right. Each toast: severity icon (info/success/warning/error), title, optional message, dismiss button. Auto-dismiss after duration if set. Max 4 visible; older ones pushed off. Slide-in animation from right. Z-index above all panels, below command palette.

**NotificationBell:** In Header.tsx right section, left of Cmd+K button. Bell icon with badge (count of non-dismissed persistent notifications). Click opens NotificationCenter — a small dropdown panel showing all persistent notifications, grouped by severity. Mark-all-read action.

**Wiring existing events:** Several places already call console.log instead of addNotification. Audit and replace:
- Job completed/failed → success/error notification
- Ghost surfaced critical item → info notification
- Budget warning → warning notification
- Bootstrap complete → info (brief, 3s auto-dismiss)
- Decision gate triggered → persistent warning until dismissed

**New files:**
```
app/components/ui/ToastStack.tsx         - fixed-position toast renderer
app/components/ui/Toast.tsx              - individual toast component
app/components/ui/NotificationBell.tsx   - bell icon + badge + dropdown
app/components/ui/NotificationCenter.tsx - notification list dropdown
```

**Modified files:**
```
app/app/layout.tsx                       - mount ToastStack globally (renders outside portal)
app/components/ui/Header.tsx             - mount NotificationBell
app/lib/agent-sdk/job-tracker.ts         - replace console.log completions with addNotification
app/lib/ghost/lifecycle.ts               - addNotification for critical Ghost surfaces
app/lib/agent-sdk/budget-enforcer.ts     - addNotification for budget warnings
```

**Quality gates:**
- Job completed → green success toast appears, auto-dismisses after 5s
- Job failed → red error toast appears, persists until dismissed
- Budget warning → amber persistent toast
- NotificationBell badge increments for persistent notifications
- Mark-all-read clears badge
- Max 4 toasts stack without overflow
- ToastStack renders on top of all modals
- tsc clean, pnpm test:run passes

---

### S9-04 — Status Bar (A3)
**What exists:** Blueprint §10 specified the bar. session_costs table has cost data. job-store has active job count. aegis/governor.ts has current profile. Nothing renders in ChatInterface below the tab bar.
**What's needed:** A thin (32px) bottom chrome strip that reads live data from existing stores.

**Layout:**
```
│ COST TODAY: $0.42 │ JOBS: 2 active, 1 pending │ AEGIS: DEEP_FOCUS │ KERNL: ● indexed │
```

Cost today: GET /api/costs/today — sum session_costs.estimated_cost_usd WHERE started_at >= today midnight. Polls every 60s.
Active jobs: reads from job-store (no new API needed).
AEGIS profile: reads from context-panel context-provider (already polls AEGIS).
KERNL status: reads from context-provider KERNLStatus data.

Status bar items are clickable: cost → opens cost breakdown (S9-10), jobs → switches to Workers tab, AEGIS → opens AEGIS status in Inspector, KERNL → opens KERNL health panel (S9-18).

**New files:**
```
app/components/ui/StatusBar.tsx         - bottom chrome strip
app/app/api/costs/today/route.ts        - GET daily cost total from session_costs
```

**Modified files:**
```
app/components/chat/ChatInterface.tsx   - mount StatusBar below the tab/content area
```

**Quality gates:**
- Cost today updates within 60s of a job completing
- Active job count matches Workers tab count
- AEGIS profile matches what AEGIS reports
- All StatusBar items are clickable
- Status bar never wraps or overflows at 1280px width
- tsc clean

---

### S9-05 — Morning Briefing (C1)
**What exists:** MORNING_BRIEFING.md is manually written. All source data is in KERNL: manifests (completed/failed yesterday), decisions (yesterday), ghost_indexed_items (yesterday), session_costs (yesterday), eos_reports (latest score + previous score).
**What's needed:** Auto-generation service + display surface.

**Generator service: `lib/morning-briefing/generator.ts`**
Runs once on app boot (cold start). Checks if briefing_shown_date in settings matches today. If not today: generates + shows. Marks shown.

Briefing sections:
1. Yesterday's jobs — list of completed (title, cost) and failed (title, failure mode)
2. Decisions logged — count + last 3 titles
3. Ghost surfaces — count of new items indexed yesterday
4. Budget summary — yesterday's spend vs daily cap, this week's total
5. EoS delta — "Score: 82 → 85 (+3)" or "unchanged at 82"
6. PRs pending — count of manifests where ci_passed = 1 AND merged_at IS NULL

**Display: `MorningBriefing.tsx`**
Full-width overlay (not modal — slides down from header, pushes content below). Shows on cold start before first message. "Start Day" button dismisses and marks shown for today. Can be re-opened from command palette ("Morning Briefing").

**New files:**
```
app/lib/morning-briefing/generator.ts  - data aggregation + briefing object builder
app/lib/morning-briefing/types.ts      - BriefingData type
app/components/morning-briefing/MorningBriefing.tsx    - display component
app/components/morning-briefing/BriefingSection.tsx    - reusable section
app/app/api/morning-briefing/route.ts  - GET generates briefing data
```

**Modified files:**
```
app/components/chat/ChatInterface.tsx  - check on mount, show MorningBriefing if needed
```

**Quality gates:**
- Briefing shown on first cold start of the day
- Not shown on subsequent opens same day
- All 6 sections populated from real KERNL data
- "Start Day" dismisses and does not re-show until tomorrow
- Re-accessible from command palette
- Graceful if any data source returns empty (section shows "Nothing to report")
- tsc clean

---

### S9-06 — Ghost Teach Me (C2) [NEEDS S9-00]
**What exists:** GhostCard has Tell me more / Noted actions. Privacy Dashboard handles exclusions. ghost_preferences table created in S9-00.
**What's needed:** "Teach Ghost" action on GhostCard + scorer boost integration.

**GhostCard change:** Add a third action button "Teach Ghost" (📌 icon). Opens a micro-drawer anchored to the card (not full modal). Fields: "Surface more like this" (pre-filled with card's source_type), optional topic label text input (e.g. "GHM competitor filings"). Submit writes a ghost_preferences row. Show confirmation: "Ghost will surface more from [topic_hint]."

**Scorer boost:** In `lib/ghost/scorer/index.ts`, after computing base score: query ghost_preferences for matching source_type (or NULL = any). If match found, multiply score by preference.boost_factor. Increment use_count on the matching row. This means a preference for "GHM competitor intelligence" boosts all Ghost cards tagged with that source type.

**Preference management in Privacy Dashboard:** New "Preferences" tab alongside existing "Exclusions". Lists all ghost_preferences rows. Delete to remove. Edit boost_factor slider (1.0x to 3.0x). Use count shown as signal of how often it's firing.

**New files:**
```
app/components/ghost/TeachGhostDrawer.tsx     - micro-drawer anchored to card
app/lib/ghost/preferences-store.ts            - CRUD for ghost_preferences table
app/app/api/ghost/preferences/route.ts        - GET/POST/DELETE ghost_preferences
```

**Modified files:**
```
app/components/ghost/GhostCard.tsx            - add Teach Ghost button + drawer
app/components/ghost/GhostCardActions.tsx     - add teach action
app/components/ghost/PrivacyDashboard.tsx     - add Preferences tab
app/lib/ghost/scorer/index.ts                 - read preferences, apply boost_factor
```

**Quality gates:**
- "Teach Ghost" button visible on all GhostCards
- Submitting a preference writes ghost_preferences row
- Ghost scorer applies boost on matching source_type
- boost_factor stored correctly, not hardcoded
- Privacy Dashboard Preferences tab lists/deletes preferences
- Excluding AND preferencing the same source_type: exclusion wins (layer order preserved)
- tsc clean, pnpm test:run passes

---

### S9-07 — Manifest Templates (C4) [NEEDS S9-00]
**What exists:** ManifestBuilder.tsx is blank every time. manifest_templates table created in S9-00.
**What's needed:** Save-as-template action + template picker in ManifestBuilder.

**ManifestBuilder header:** Add [📋 Templates] button top-right of the form. Opens TemplatePickerPanel — a 280px right drawer showing all saved templates, grouped by task_type. Click a template to pre-fill all form fields. Forms remain editable after pre-fill.

**Save as template:** At bottom of ManifestBuilder, next to Submit: [Save as Template] button. Prompts for template name (modal or inline). Saves current form values to manifest_templates. Template immediately available in picker.

**Quick-spawn from Workers tab:** Jobs tab header gets a [Templates] section above the job list. Shows last 5 used templates (ordered by use_count DESC). One-click spawns the template manifest directly (bypasses ManifestBuilder form, goes straight to spawnJob()). For less familiar templates: [Open in Builder] link to pre-fill form.

**New files:**
```
app/lib/agent-sdk/template-store.ts              - CRUD for manifest_templates
app/components/jobs/TemplatePickerPanel.tsx       - right drawer for template selection
app/components/jobs/TemplatePicker.tsx            - template list + search
app/components/jobs/QuickSpawnTemplates.tsx       - Workers tab quick-spawn section
app/app/api/templates/route.ts                    - GET all, POST save template
app/app/api/templates/[id]/route.ts               - DELETE template
```

**Modified files:**
```
app/components/jobs/ManifestBuilder.tsx           - add template picker + save button
app/components/jobs/JobQueue.tsx                  - mount QuickSpawnTemplates above job list
```

**Quality gates:**
- Save as template writes manifest_templates row
- Template picker shows all templates, grouped by task_type
- Pre-filling ManifestBuilder from template populates all fields
- Quick-spawn from Workers tab spawns job without opening ManifestBuilder
- use_count increments on each spawn from template
- Templates survive app restart (KERNL persisted)
- tsc clean, pnpm test:run passes

---

### S9-08 — In-Thread Search (C6)
**What exists:** `messages_fts` virtual FTS5 table already created in schema.sql. MessageList is scroll-only.
**What's needed:** Cmd+F within a thread, search bar, highlight and jump.

**Search bar:** Slides in below the tab bar when Cmd+F pressed within strategic thread (not active in Workers or War Room tabs). Search input with result count ("3 of 12"). Arrow down/up navigates between hits. Escape closes.

**Client-side search (fast path):** Filter current `messages` array in ChatInterface for query match. Highlight matching text in Message.tsx. Jump to first result (smooth scroll).

**Server-side search (deep path):** When client returns <3 results, fire GET /api/threads/[id]/search?q=X which queries messages_fts. Returns message IDs. Load any not-in-memory messages. Show "Showing results from full history" indicator.

**New files:**
```
app/components/chat/ThreadSearch.tsx           - search bar component
app/app/api/threads/[id]/search/route.ts       - FTS5 query endpoint
```

**Modified files:**
```
app/components/chat/ChatInterface.tsx          - mount ThreadSearch, pass query state, Cmd+F handler
app/components/chat/Message.tsx                - accept highlightQuery prop, wrap matches in <mark>
app/components/chat/MessageList.tsx            - accept activeMatchId, scroll to active match
```

**Quality gates:**
- Cmd+F opens search bar in strategic thread
- Typing highlights matching messages in real time
- Arrow keys navigate between matches
- Server-side FTS fires when <3 client matches
- Escape closes search bar, removes highlights
- Search bar absent in Workers and War Room tabs
- tsc clean

---

### S9-09 — EoS History Sparkline (C7)
**What exists:** `eos_reports` table (id, project_id, health_score, issues_json, files_scanned, duration_ms, created_at) — this IS the history table already. ContextPanel shows current health score as text only.
**What's needed:** SparkLine in context panel + full history view on click.

**SparkLine component:** 80px wide × 24px tall SVG line chart. Last 30 scan data points from eos_reports WHERE project_id = active. Plotted as percentage of 100. Color: green above 80, amber 60-80, red below 60. Current score + delta vs previous scan shown as text: "85 (+3)".

**Full history view:** Click sparkline → opens EoSHistoryPanel (drawer or modal). Table of last 50 scans: date, score, delta, critical count, warning count, scan mode. Click a row to see the full issues_json for that scan.

**New files:**
```
app/components/context/EoSSparkLine.tsx        - 80×24 SVG sparkline
app/components/context/EoSHistoryPanel.tsx     - full history drawer
app/app/api/eos/history/route.ts               - GET eos_reports for active project, last N rows
```

**Modified files:**
```
app/components/context/ContextPanel.tsx        - replace score text with EoSSparkLine
```

**Quality gates:**
- SparkLine renders from eos_reports data (not mocked)
- Score + delta text correct
- Color thresholds correct (green/amber/red)
- Full history panel shows last 50 scans
- Click row shows issues_json
- No sparkline if < 2 scans (show score text only)
- tsc clean

---

### S9-10 — Cost Breakdown by Project (C8)
**What exists:** `session_costs` table with `project_id` column. StatusBar (S9-04) shows daily total. No per-project breakdown anywhere.
**What's needed:** Cost breakdown view — today by project, this week, burn rate.

**CostBreakdown component:** Panel view (modal or drawer). Triggered from StatusBar cost click. Three tabs: Today, This Week, All Time. Each tab: table of (project_id → friendly name, session count, input tokens, output tokens, total cost USD). Sorted by cost desc. Total row at bottom. "No data" state when session_costs is empty.

**API endpoint:** GET /api/costs/breakdown?range=today|week|all — aggregates session_costs grouped by project_id, joined with manifests for task_type breakdown.

**New files:**
```
app/components/agent-sdk/CostBreakdown.tsx     - breakdown panel
app/app/api/costs/breakdown/route.ts           - aggregation query
```

**Modified files:**
```
app/components/ui/StatusBar.tsx                - cost item opens CostBreakdown on click
```

**Quality gates:**
- Cost by project matches sum of session_costs for that project_id
- Today/Week/All toggle works
- Empty state renders cleanly
- Totals match StatusBar daily cost
- tsc clean

---

### S9-11 — Job Retry / Edit Manifest (C9)
**What exists:** `InterruptedSessionCard.tsx` has [Restart with Handoff] and [Cancel]. Restart uses original manifest. ManifestBuilder can be pre-filled (after S9-07 template work, but independent of it).
**What's needed:** [Edit & Retry] button on failed/interrupted jobs that opens ManifestBuilder pre-filled.

**Flow:** Failed/interrupted job card gets a third action: [✏️ Edit & Retry]. Clicking opens ManifestBuilder in a modal, pre-filled with the job's original manifest fields (title, description, task_type, project_path, success_criteria). User edits and submits. On submit: spawns new job with modified manifest. Original job record updated with status: 'superseded', with pointer to new job id in meta.

**New files:**
```
(none — modifications only)
```

**Modified files:**
```
app/components/agent-sdk/InterruptedSessionCard.tsx  - add Edit & Retry button
app/components/jobs/JobCard.tsx                      - add Edit & Retry button for failed state
app/components/jobs/ManifestBuilder.tsx              - accept initialValues prop for pre-fill
app/lib/agent-sdk/job-tracker.ts                     - mark superseded job on new spawn
```

**Quality gates:**
- Edit & Retry button visible on failed and interrupted job cards
- ManifestBuilder opens pre-filled with original manifest values
- Submit spawns new job
- Original job status set to 'superseded'
- New job appears in job queue with same visual priority
- tsc clean

---

### S9-12 — Chat History Panel (A6)
**What exists:** `conversation-store.ts` has full CRUD with pagination, search, archive, pin. `listThreads()` in KERNL session-manager. No UI to browse or switch conversations.
**What's needed:** A panel that shows past threads and lets you load any one.

**Panel:** Left slide-in drawer (same pattern as ContextLibrary). Triggered by Cmd+[ or from command palette. Two sections: Pinned conversations (if any), Recent (paginated, last 50).

Each row: thread title, project name (if set), relative timestamp ("2 days ago"), message count badge. Click: loads thread into current tab (or new tab — user choice if current tab has messages). Long-press or right-click: rename, archive, pin, delete (delete is prohibited, surfaces "conversation cannot be deleted").

Search input at top: filters by title. On empty query: shows recents.

**New files:**
```
app/components/chat/ChatHistoryPanel.tsx       - drawer component
app/components/chat/HistoryRow.tsx             - individual conversation row
```

**Modified files:**
```
app/components/chat/ChatInterface.tsx          - Cmd+[ handler, mount ChatHistoryPanel
app/lib/command-registry/commands.ts           - register "Browse chat history" command
```

**Quality gates:**
- Cmd+[ opens history panel
- Last 50 conversations listed, most recent first
- Search filters correctly
- Click loads thread into current tab
- Pinned conversations appear in pinned section
- Archive removes from main list (not deleted)
- Panel closes on Escape
- tsc clean

---

## WAVE 2 — START AFTER WAVE 1 SPRINTS COMPLETE

---

### S9-13 — Settings Panel (A4)
**Depends on:** S9-03 (notification patterns for in-settings previews), S9-09 (EoS data to show current score in quality section)
**What exists:** ThemeMode in ui-store. budget_config table exists with 5 rows. ghost exclusions in ghost_exclusions. AEGIS port configurable in env.
**What's needed:** Settings drawer accessible via Cmd+, with sections for all configurable values.

**Sections:**
- Appearance: theme toggle (Light / Dark / System). Live preview.
- Budget: session soft cap, session hard cap, daily hard cap — editable fields reading from / writing to budget_config table. Current daily spend shown inline.
- Quality: EoS soft threshold, EoS hard threshold, SHIM retry ceiling — from budget_config.
- Ghost: scan cadence (currently hardcoded in indexer/scheduler.ts — expose as setting), quick-add exclusion rule (shortcut to Privacy Dashboard exclusion form).
- AEGIS: port number (reads/writes AEGIS_PORT env via Tauri IPC command), test connection button.
- API: shows "API key configured: ✓" (from keychain) or "Not configured" with link to onboarding.

**New files:**
```
app/components/settings/SettingsPanel.tsx      - drawer container
app/components/settings/AppearanceSection.tsx
app/components/settings/BudgetSection.tsx
app/components/settings/QualitySection.tsx
app/components/settings/GhostSection.tsx
app/components/settings/AegisSection.tsx
app/components/settings/ApiSection.tsx
app/app/api/settings/route.ts                  - GET/PATCH budget_config rows
```

**Modified files:**
```
app/components/ui/Header.tsx                   - wire Cmd+, to openSettings
app/lib/command-registry/commands.ts           - register "Open Settings" command
```

**Quality gates:**
- Cmd+, opens settings from anywhere
- Theme toggle changes theme live, persisted
- Budget cap edits write to budget_config and are read by budget-enforcer.ts on next spawn
- AEGIS port test connection fires real ping
- All sections load without errors even when KERNL DB cold
- tsc clean, pnpm test:run passes

---

### S9-14 — Inspector Drawer (A5)
**Depends on:** S9-03 (notification display patterns), S9-09 (EoS history data), S9-10 (cost data)
**What exists:** Cmd+I registered in KeyboardShortcuts modal but no component. Inspector was described in §10 as a debugging/inspection surface.
**What's needed:** Right-side slide drawer with tab system.

**Tabs:**
1. Thread — current thread: token count, message count, last checkpoint timestamp, continuity diff (last checkpoint delta)
2. KERNL — database file size (GET /api/kernl/stats), total threads, total chunks indexed, last indexer run, last backup
3. Quality — full EoS issue list (not just top 5 from context panel), EoS history sparkline (reuse S9-09 component), SHIM session log last 10 entries
4. Jobs — selected job detail (full manifest JSON, all events, cost breakdown for this job, scope violations if any)
5. Costs — cost breakdown (reuse S9-10 component embedded here)

**New files:**
```
app/components/inspector/InspectorDrawer.tsx   - drawer container + tab system
app/components/inspector/ThreadTab.tsx         - thread stats
app/components/inspector/KernlTab.tsx          - KERNL DB stats
app/components/inspector/QualityTab.tsx        - full EoS list + history
app/components/inspector/JobsTab.tsx           - selected job detail
app/app/api/kernl/stats/route.ts               - DB size, chunk count, last indexer run
```

**Modified files:**
```
app/components/chat/ChatInterface.tsx          - Cmd+I handler, mount InspectorDrawer
app/lib/command-registry/commands.ts           - register "Open Inspector" command
```

**Quality gates:**
- Cmd+I opens inspector from anywhere
- All 5 tabs render without error
- KERNL stats reflect actual DB file on disk
- Quality tab shows full issue list beyond the context panel's top 5
- Jobs tab shows manifest JSON for selected job
- Drawer closes on Escape, does not affect active thread state
- tsc clean

---

### S9-15 — Push Notifications / System Tray (C3)
**Depends on:** S9-03 (notification routing layer and event types established)
**What exists:** Tauri app. No tray icon. Notifications queue in ui-store but never reach OS.
**What's needed:** Rust-side Tauri system tray + Windows native toast notifications for critical events.

**Tauri side (src-tauri/):**
- Add `tauri-plugin-notification` to Cargo.toml
- Register system tray icon with tray.rs: Gregore G icon, tooltip "Gregore Lite"
- Tray menu: Show / Hide window, separator, Exit
- IPC command `send_notification(title: String, body: String, urgency: String)` — calls OS notification API
- IPC command `set_tray_badge(count: u32)` — Windows doesn't support true badges natively; update tray icon to include badge variant (pre-rendered icon set: 0, 1-9, 9+)

**TypeScript notification router:** `lib/notifications/tray-bridge.ts` — listens to ui-store notification events. Filters for `escalate: true` flag on notification. Calls Tauri IPC `send_notification` for escalated events. Escalated events: job CI passed (PR ready to merge), job failed permanently, budget hard cap reached, Ghost critical interrupt.

**Add `escalate` flag to Notification type in ui-store:** `escalate?: boolean` — when true, tray-bridge fires native toast.

**New files:**
```
src-tauri/src/tray.rs                          - tray icon registration, menu, badge
src-tauri/src/notifications.rs                 - IPC command send_notification
app/lib/notifications/tray-bridge.ts           - ui-store listener → Tauri IPC
```

**Modified files:**
```
src-tauri/src/main.rs                          - register tray, notification plugin
src-tauri/Cargo.toml                           - add tauri-plugin-notification
app/lib/stores/ui-store.ts                     - add escalate field to Notification type
app/lib/agent-sdk/job-tracker.ts               - set escalate: true on CI pass + permanent fail
app/lib/agent-sdk/budget-enforcer.ts           - set escalate: true on hard cap hit
```

**Quality gates:**
- Tray icon appears in Windows system tray on app launch
- Tray menu shows Show/Hide and Exit
- CI pass notification fires Windows native toast
- Job permanent failure fires Windows native toast
- Tray badge updates when unread escalated notifications exist
- Notification fires even when app is minimized
- Clicking toast brings app window to front and navigates to the relevant job
- tsc clean, Cargo build clean

---

### S9-16 — Decision Browser (B2)
**Depends on:** S9-12 (history panel UI patterns to reuse)
**What exists:** `decisions` table (id, thread_id, category, title, rationale, alternatives JSON, impact, created_at). DecisionList.tsx shows last 5 in context panel.
**What's needed:** Full browse + search surface.

**DecisionBrowser component:** Full-page overlay (same z-level as War Room tab, could be a fourth tab "📋 Decisions" or a dedicated route). View:
- Left: filter sidebar — project (dropdown), category (multi-select), impact (high/medium/low checkboxes), date range picker
- Center: decision list — grouped by week, each row: impact badge, category, title, date
- Right: decision detail panel — full rationale, alternatives[], thread link (click jumps to the conversation in chat history)

Search: full-text search over title + rationale via decisions_fts (add FTS virtual table in schema migration — add to S9-00 or as S9-16-specific migration).

Export: "Export to Markdown" button — generates a formatted markdown doc of filtered decisions, writes to KERNL artifacts table.

**New files:**
```
app/components/decisions/DecisionBrowser.tsx   - full-page overlay
app/components/decisions/DecisionFilter.tsx    - left filter sidebar
app/components/decisions/DecisionRow.tsx       - list row
app/components/decisions/DecisionDetail.tsx    - right detail panel
app/app/api/decisions/route.ts                 - GET with filters, pagination
app/app/api/decisions/export/route.ts          - markdown export
```

**Modified files:**
```
app/lib/kernl/schema.sql                       - add decisions_fts virtual table
app/lib/command-registry/commands.ts           - register "Browse Decisions" command
app/components/chat/ChatInterface.tsx          - add Decisions as optional 4th tab, or command palette only
```

**Quality gates:**
- All decisions in KERNL are browseable
- Filters work correctly (project, category, impact, date)
- Full-text search returns correct results
- Thread link opens the conversation in Chat History
- Export generates valid markdown
- Paginated (50 per page)
- tsc clean

---

### S9-17 — Artifact Library (C5)
**Depends on:** S9-12 (history panel drawer patterns)
**What exists:** `artifacts` table (id, thread_id, project_id, type, title, content, language, file_path, created_at). ArtifactPanel shows current message's artifact only.
**What's needed:** Cross-session artifact browser.

**ArtifactLibrary drawer:** Same right-drawer pattern as ContextLibrary. Triggered from command palette or from ArtifactPanel header "Browse Library" link. Filters: project, type (code/markdown/diagram/plan), language (for code), date range. Search by title. Click artifact to open in ArtifactPanel in current thread. "Re-attach to thread" adds a system message pointing to the artifact.

**New files:**
```
app/components/artifacts/ArtifactLibrary.tsx   - library drawer
app/components/artifacts/ArtifactLibraryRow.tsx - list row
app/app/api/artifacts/route.ts                 - GET with filters
```

**Modified files:**
```
app/components/artifacts/ArtifactPanel.tsx     - add "Browse Library" link
app/lib/command-registry/commands.ts           - register "Open Artifact Library" command
```

**Quality gates:**
- All past artifacts browseable across sessions
- Filters work
- Click opens artifact in current ArtifactPanel
- tsc clean

---

### S9-18 — KERNL Health Panel (C10)
**Depends on:** S9-14 (goes into Inspector KERNL tab)
**What exists:** KERNLStatus.tsx shows a dot (indexed / not indexed). DB path and file size are accessible.
**What's needed:** Expanded stats, goes inside Inspector's KERNL tab.

**Stats to show:** DB file size (fs.statSync on db path), total tables (SQLITE_MASTER count), total messages, total chunks indexed, total decisions, vector index chunk count, last indexer run (from settings table key `last_indexer_run`), last backup timestamp (from settings key `last_backup_at`).

GET /api/kernl/stats already specified in S9-14. This sprint implements the full query and populates the Inspector KERNL tab properly.

**New files:** None beyond S9-14's route. Implementation of the KernlTab.tsx stats.

**Modified files:**
```
app/components/inspector/KernlTab.tsx          - implement full stats display
app/app/api/kernl/stats/route.ts               - extend to return all stats
```

**Quality gates:**
- All stats reflect actual DB state
- DB file size formatted (KB/MB)
- Chunk count matches content_chunks table count
- tsc clean

---

### S9-19 — Project Quick-Switcher (C11)
**Depends on:** S9-02 (command palette to register switch commands)
**What exists:** ProjectSection.tsx shows active project. projects table has all projects.
**What's needed:** One-click project switch from context panel + command palette.

**Context panel:** Active project name becomes clickable. Click opens a small popover (not full modal) showing all active projects from the projects table. Click to switch. Sets active_project in KERNL settings.

**Command palette integration:** Register "Project: switch to [name]" for each project (registered dynamically when command palette opens by querying projects). Switching project reloads bootstrap context.

**New files:**
```
app/components/context/ProjectSwitcher.tsx     - popover with project list
```

**Modified files:**
```
app/components/context/ProjectSection.tsx      - trigger ProjectSwitcher on click
app/lib/command-registry/commands.ts           - dynamic project switch commands
```

**Quality gates:**
- Click project name → popover appears
- Click a project → active project changes, context panel updates
- Command palette project switch commands work
- Bootstrap context reload fires after switch
- tsc clean

---

### S9-20 — Edit Last Message / Regenerate (A7)
**Depends on:** Nothing in Wave 2 — could be moved to Wave 1, but low priority keeps it here.
**What exists:** Message.tsx is display-only.
**What's needed:** Hover state on messages showing Edit and Regenerate.

**Behavior:**
Edit (Cmd+E or hover action on last user message): sets InputField content to that message's text, removes the message and all subsequent messages from display and KERNL checkpoint (truncate via POST /api/threads/[id]/truncate-after/[messageId]). User edits and re-sends.

Regenerate (Cmd+R or hover action on last assistant message): re-sends the last user message. Removes last assistant message from display, sends the user message again.

**New files:**
```
app/app/api/threads/[id]/truncate-after/[messageId]/route.ts  - DELETE messages after given ID
```

**Modified files:**
```
app/components/chat/Message.tsx            - hover state with Edit/Regen buttons
app/components/chat/ChatInterface.tsx      - Cmd+E and Cmd+R handlers, truncate logic
```

**Quality gates:**
- Edit restores user message to InputField and removes message from view
- Truncation removes messages from KERNL thread
- Regenerate resends last user message
- Both only available on the most recent user/assistant message respectively
- tsc clean

---

## WAVE 3

---

### S9-21 — Memory Modal (A8) [DESIGN FIRST]
**Status:** Do not build yet. Define what this means before writing a line.

**Design questions to answer before starting:**
1. Is this a KERNL semantic search surface (search past decisions + patterns) — or something else?
2. How does it differ from command palette search?
3. Is it Cmd+M specifically, or does command palette ("Search KERNL") replace it entirely?

**Recommendation:** This may be redundant once command palette has KERNL search built in (S9-02). Revisit after Phase 9 Wave 2 ships and see if there's still a gap. If command palette covers it, deprecate the shortcut and document the decision.

---

## SPRINT SEQUENCE CHART

```
DAY 1
  S9-00  ████████░░░░░░░░░░░░░░░░░░░░░░░░  (schema, short, must complete first)

DAY 2 — ALL WAVE 1 PARALLEL (spawn all 12 simultaneously in Cowork)
  S9-01  ██████████████████░░░░░░░░░░░░░░  (largest, start first)
  S9-02  ██████████████░░░░░░░░░░░░░░░░░░
  S9-03  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░
  S9-04  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  S9-05  ████████░░░░░░░░░░░░░░░░░░░░░░░░
  S9-06  ████████░░░░░░░░░░░░░░░░░░░░░░░░
  S9-07  ██████████░░░░░░░░░░░░░░░░░░░░░░
  S9-08  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  S9-09  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  S9-10  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  S9-11  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  S9-12  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░

DAY 3 — WAVE 2 PARALLEL (spawn as Wave 1 completes)
  S9-13  ██████████░░░░░░░░░░░░░░░░░░░░░░  (after S9-03, S9-09 done)
  S9-14  ████████████░░░░░░░░░░░░░░░░░░░░  (after S9-03, S9-09, S9-10 done)
  S9-15  ████████████████░░░░░░░░░░░░░░░░  (after S9-03 done — Rust work takes longest)
  S9-16  ████████████░░░░░░░░░░░░░░░░░░░░  (after S9-12 done)
  S9-17  ████████░░░░░░░░░░░░░░░░░░░░░░░░  (after S9-12 done)
  S9-18  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  (after S9-14 done)
  S9-19  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  (after S9-02 done)
  S9-20  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  (independent, low priority)

DAY 4 — WAVE 3
  S9-21  DESIGN SESSION (not a build sprint)
```

---

## NEW FILES SUMMARY

```
Schema / KERNL:
  app/lib/kernl/schema.sql                       - 2 new tables (S9-00)
  app/lib/kernl/thread-tabs.ts                   - (S9-01)
  app/lib/kernl/preferences-store.ts             - (S9-06)
  app/lib/agent-sdk/template-store.ts            - (S9-07)

Stores:
  app/lib/stores/thread-tabs-store.ts            - (S9-01)

Command registry:
  app/lib/command-registry/index.ts              - (S9-02)
  app/lib/command-registry/commands.ts           - (S9-02)

Notification bridge:
  app/lib/notifications/tray-bridge.ts           - (S9-15)

Morning briefing service:
  app/lib/morning-briefing/generator.ts          - (S9-05)
  app/lib/morning-briefing/types.ts              - (S9-05)

Components — UI layer:
  app/components/ui/CommandPalette.tsx           - (S9-02)
  app/components/ui/CommandResult.tsx            - (S9-02)
  app/components/ui/ToastStack.tsx               - (S9-03)
  app/components/ui/Toast.tsx                    - (S9-03)
  app/components/ui/NotificationBell.tsx         - (S9-03)
  app/components/ui/NotificationCenter.tsx       - (S9-03)
  app/components/ui/StatusBar.tsx                - (S9-04)

Components — Thread tabs:
  app/components/chat/ThreadTabBar.tsx           - (S9-01)
  app/components/chat/ThreadTab.tsx              - (S9-01)
  app/components/chat/ThreadSearch.tsx           - (S9-08)
  app/components/chat/ChatHistoryPanel.tsx       - (S9-12)
  app/components/chat/HistoryRow.tsx             - (S9-12)

Components — Context / Inspector:
  app/components/context/EoSSparkLine.tsx        - (S9-09)
  app/components/context/EoSHistoryPanel.tsx     - (S9-09)
  app/components/context/ProjectSwitcher.tsx     - (S9-19)
  app/components/inspector/InspectorDrawer.tsx   - (S9-14)
  app/components/inspector/ThreadTab.tsx         - (S9-14)
  app/components/inspector/KernlTab.tsx          - (S9-14, S9-18)
  app/components/inspector/QualityTab.tsx        - (S9-14)
  app/components/inspector/JobsTab.tsx           - (S9-14)

Components — Ghost:
  app/components/ghost/TeachGhostDrawer.tsx      - (S9-06)

Components — Jobs:
  app/components/jobs/TemplatePickerPanel.tsx    - (S9-07)
  app/components/jobs/TemplatePicker.tsx         - (S9-07)
  app/components/jobs/QuickSpawnTemplates.tsx    - (S9-07)
  app/components/agent-sdk/CostBreakdown.tsx     - (S9-10)

Components — Morning briefing:
  app/components/morning-briefing/MorningBriefing.tsx    - (S9-05)
  app/components/morning-briefing/BriefingSection.tsx    - (S9-05)

Components — Settings:
  app/components/settings/SettingsPanel.tsx      - (S9-13)
  app/components/settings/AppearanceSection.tsx  - (S9-13)
  app/components/settings/BudgetSection.tsx      - (S9-13)
  app/components/settings/QualitySection.tsx     - (S9-13)
  app/components/settings/GhostSection.tsx       - (S9-13)
  app/components/settings/AegisSection.tsx       - (S9-13)
  app/components/settings/ApiSection.tsx         - (S9-13)

Components — Decisions / Artifacts:
  app/components/decisions/DecisionBrowser.tsx   - (S9-16)
  app/components/decisions/DecisionFilter.tsx    - (S9-16)
  app/components/decisions/DecisionRow.tsx       - (S9-16)
  app/components/decisions/DecisionDetail.tsx    - (S9-16)
  app/components/artifacts/ArtifactLibrary.tsx   - (S9-17)
  app/components/artifacts/ArtifactLibraryRow.tsx - (S9-17)

API routes (new):
  app/app/api/costs/today/route.ts               - (S9-04)
  app/app/api/costs/breakdown/route.ts           - (S9-10)
  app/app/api/morning-briefing/route.ts          - (S9-05)
  app/app/api/ghost/preferences/route.ts         - (S9-06)
  app/app/api/templates/route.ts                 - (S9-07)
  app/app/api/templates/[id]/route.ts            - (S9-07)
  app/app/api/eos/history/route.ts               - (S9-09)
  app/app/api/threads/[id]/search/route.ts       - (S9-08)
  app/app/api/threads/[id]/truncate-after/[messageId]/route.ts  - (S9-20)
  app/app/api/kernl/stats/route.ts               - (S9-14)
  app/app/api/decisions/route.ts                 - (S9-16)
  app/app/api/decisions/export/route.ts          - (S9-16)
  app/app/api/artifacts/route.ts                 - (S9-17)
  app/app/api/settings/route.ts                  - (S9-13)

Tauri / Rust (new):
  src-tauri/src/tray.rs                          - (S9-15)
  src-tauri/src/notifications.rs                 - (S9-15)
```

---

## PHASE 9 CERTIFICATION GATES

Before Phase 9 is considered complete:

- [ ] All 21 items completed or explicitly deferred with written rationale (S9-21 design decision documented)
- [ ] Every keyboard shortcut in KeyboardShortcuts.tsx fires a real action (no console.log)
- [ ] Notification system: events fire toasts, escalated events fire tray/OS notifications
- [ ] Multi-thread: 2+ simultaneous strategic threads with independent state confirmed in test
- [ ] Morning briefing shown on cold start, dismissed, not shown again same day
- [ ] Ghost Teach Me: preference written, scorer applies boost, Privacy Dashboard lists preference
- [ ] Manifest templates: save, load, quick-spawn all functional
- [ ] Command palette: all registered day-1 commands execute
- [ ] Status bar: all 4 fields show live data
- [ ] EoS sparkline: renders from eos_reports, correct color thresholds
- [ ] Chat history: Cmd+[ opens panel, click loads thread
- [ ] Decision browser: all decisions browseable with filter + search
- [ ] Settings panel: theme, budget caps, AEGIS port all persisted and read by consuming systems
- [ ] pnpm test:run: zero failures across all 22 sprint completions
- [ ] tsc --noEmit: zero errors
- [ ] BLUEPRINT_FINAL.md §13 Phase 9 entry written
- [ ] STATUS.md updated
- [ ] git tag v1.1.0

---

## AUTHORITY STOPS — PHASE 9 WIDE

Stop and require David confirmation if:
- Thread state isolation requires changing the chat route's message persistence model — that touches every sprint in Phase 9 downstream
- Tauri tray plugin (S9-15) requires tauri.conf.json allowlist changes that would affect the Phase 8 installer — coordinate with S9-15 agent before touching tauri.conf.json
- Any sprint changes schema.sql in a way not listed above — run it through David first
- S9-21 design session concludes memory modal = redundant with command palette — document and close the Cmd+M shortcut before proceeding
- EoS score drops below 80 at any checkpoint during Phase 9 build — stop and run SHIM before continuing
