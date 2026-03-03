GREGLITE PHASE 9 — SEQUENTIAL EXECUTION PROMPT
"The Full Cockpit" — 22 sprints, 4 waves
Run after Phase 8 (v1.0.0) ships. March 2026.

---

YOUR ROLE: You are the Phase 9 execution agent for GregLite. Your job is to work through all 22 sprints in the order listed below, one at a time. Each sprint has a clear scope, quality gates, and a commit checkpoint before you move to the next. You do not skip sprints. You do not move forward if quality gates fail. You stop and notify David if an authority protocol condition is hit.

This is a long-running session. Use KERNL checkpoints aggressively. If context is running out mid-sprint, write SPRINT_9X_IN_PROGRESS.md with current state before stopping.

---

BOOTSTRAP (DO THIS ONCE AT SESSION START — BEFORE ANY SPRINT)

1. Read D:\Dev\CLAUDE_INSTRUCTIONS.md
2. Read D:\Dev\TECHNICAL_STANDARDS.md
3. Read D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. Read D:\Projects\GregLite\DEV_PROTOCOLS.md
5. Read D:\Projects\GregLite\STATUS.md
6. Read D:\Projects\GregLite\PHASE9_BLUEPRINT.md — this is your master spec. Every sprint below references it. Read it fully before starting Sprint S9-00.
7. Run baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run
   Record baseline test count and EoS score. These are your floor — you cannot finish Phase 9 below them.

GIT PROTOCOL (EVERY COMMIT):
Write commit message to .git\COMMIT_MSG_TEMP first.
Then: cd /d D:\Projects\GregLite && git add -A && git commit -F .git\COMMIT_MSG_TEMP && git push
Use shell: cmd (not PowerShell — git lives at d:\Program Files\Git\cmd\git.exe)

BETWEEN EACH SPRINT:
- Run: npx tsc --noEmit (zero errors required before proceeding)
- Run: pnpm test:run (zero new failures required)
- Commit everything with message: sprint-9X: [sprint name] complete
- Push to remote
- Write a one-paragraph entry to SPRINT_9X_COMPLETE.md: what was built, files created/modified, gate results
- Only then start the next sprint

---

AUTHORITY PROTOCOL — STOP AND NOTIFY DAVID WHEN:

- Thread state isolation (S9-01) requires changing the chat route's message persistence model in a way not described in the blueprint
- Any sprint needs to modify tauri.conf.json — coordinate with S9-15 (the only sprint that should touch it)
- Any new schema table is needed that is not listed in the blueprint — stop, get approval, then add to S9-00's migration
- EoS score drops below 80 at any sprint checkpoint — run SHIM before continuing, document the drop
- The same TypeScript error appears in 3+ files you didn't write — you may have a type definition problem upstream; stop and diagnose before continuing
- S9-15 Rust build fails after two attempts — stop, document the error precisely, notify David
- Any sprint's scope expands to touch files from a different sprint's domain — stop, confirm scope before proceeding
- Test count drops (regression) — do not proceed until the regression is fixed and explained

---

SPRINT EXECUTION ORDER

Work through sprints in this exact sequence. Do not reorder.

════════════════════════════════════════════════════════════
WAVE 0 — SCHEMA FOUNDATION
════════════════════════════════════════════════════════════

SPRINT S9-00 — Schema Migrations
Reference: PHASE9_BLUEPRINT.md § "S9-00 — Schema Migrations"

What to build:
Add two new tables to app/lib/kernl/schema.sql (at end of file):

  manifest_templates table — stores saved ManifestBuilder templates
  ghost_preferences table — stores Ghost positive reinforcement preferences

Add both to database.ts runMigrations() using the same IF NOT EXISTS pattern as Phase 6-7 additions.

Files to modify:
  app/lib/kernl/schema.sql           — add both tables + indexes
  app/lib/kernl/database.ts          — add to runMigrations()

Quality gates:
  □ Both tables created in greglite.db (verify with: sqlite3 .kernl/greglite.db ".tables")
  □ All indexes present
  □ npx tsc --noEmit clean
  □ pnpm test:run zero failures

Commit: sprint-9-00: schema migrations -- manifest_templates, ghost_preferences
────────────────────────────────────────────────────────────


════════════════════════════════════════════════════════════
WAVE 1 — INDEPENDENT FEATURES
(Run these in the order listed. Each is self-contained.)
════════════════════════════════════════════════════════════

SPRINT S9-01 — Multi-Thread Tabs (LARGEST — READ BLUEPRINT SECTION FULLY FIRST)
Reference: PHASE9_BLUEPRINT.md § "S9-01 — Multi-Thread Tabs"

This is the most architecturally significant sprint. Read the full blueprint section including the architecture decisions paragraph before writing any code. The key decision: per-tab state isolation lives in a new thread-tabs-store.ts. ChatInterface reads from the active tab entry, not its own useState.

New files:
  app/lib/stores/thread-tabs-store.ts
  app/lib/kernl/thread-tabs.ts
  app/components/chat/ThreadTabBar.tsx
  app/components/chat/ThreadTab.tsx

Modified files:
  app/components/chat/ChatInterface.tsx      — consume thread-tabs-store
  app/components/context/ContextPanel.tsx   — show active tab's context
  app/lib/stores/ghost-store.ts             — per-tab activeThreadId

Quality gates:
  □ Two simultaneous strategic threads hold independent message state
  □ Switching tabs does not lose messages, artifacts, or ghost context
  □ Cmd+N creates a new tab
  □ Each tab recovers from KERNL on reload
  □ Decision Gate on Tab 1 does not affect Tab 2
  □ npx tsc --noEmit clean
  □ pnpm test:run zero new failures

Commit: sprint-9-01: multi-thread tabs -- per-tab state isolation, ThreadTabBar, Cmd+N
────────────────────────────────────────────────────────────

SPRINT S9-02 — Command Palette
Reference: PHASE9_BLUEPRINT.md § "S9-02 — Command Palette"

The Header.tsx Cmd+K button currently fires console.log. ui-store has full command palette state. Build the actual component and command registry.

New files:
  app/lib/command-registry/index.ts
  app/lib/command-registry/commands.ts
  app/components/ui/CommandPalette.tsx
  app/components/ui/CommandResult.tsx

Modified files:
  app/components/ui/Header.tsx               — wire Cmd+K to toggleCommandPalette()
  app/components/chat/ChatInterface.tsx      — register Navigation + Thread commands
  app/components/jobs/JobQueue.tsx           — register Spawn Job command

Day-1 commands: Navigation (Strategic/Workers/War Room tabs), Thread (New, Close, Rename), Jobs (Spawn Job), Ghost (Privacy Dashboard, Context Library), Settings (Open Settings, Toggle Theme, Inspector), KERNL (Browse Decisions, Search KERNL)

Quality gates:
  □ Cmd+K opens palette from any view
  □ Fuzzy search returns results within 50ms
  □ All day-1 commands execute their action
  □ available() gates respected (Spawn Job absent in War Room)
  □ Escape closes palette
  □ Recent commands persist across restarts
  □ npx tsc --noEmit clean
  □ pnpm test:run zero new failures

Commit: sprint-9-02: command palette -- fuzzy search, command registry, all day-1 commands wired
────────────────────────────────────────────────────────────

SPRINT S9-03 — Notification Display
Reference: PHASE9_BLUEPRINT.md § "S9-03 — Notification Display"

ui-store has addNotification/dismissNotification fully implemented. Nothing renders. Build ToastStack + NotificationBell and wire existing events.

New files:
  app/components/ui/ToastStack.tsx
  app/components/ui/Toast.tsx
  app/components/ui/NotificationBell.tsx
  app/components/ui/NotificationCenter.tsx

Modified files:
  app/app/layout.tsx                         — mount ToastStack globally
  app/components/ui/Header.tsx               — mount NotificationBell
  app/lib/agent-sdk/job-tracker.ts           — replace console.log with addNotification
  app/lib/ghost/lifecycle.ts                 — addNotification for critical Ghost surfaces
  app/lib/agent-sdk/budget-enforcer.ts       — addNotification for budget warnings

Quality gates:
  □ Job completed → green toast, auto-dismisses 5s
  □ Job failed → red toast, persists until dismissed
  □ Budget warning → amber persistent toast
  □ NotificationBell badge increments for persistent notifications
  □ Max 4 toasts stack without overflow
  □ npx tsc --noEmit clean
  □ pnpm test:run zero new failures

Commit: sprint-9-03: notification display -- ToastStack, NotificationBell, all events wired
────────────────────────────────────────────────────────────

SPRINT S9-04 — Status Bar
Reference: PHASE9_BLUEPRINT.md § "S9-04 — Status Bar"

Blueprint §10 specified a bottom status bar. ChatInterface.tsx ends without one. Build it.

New files:
  app/components/ui/StatusBar.tsx
  app/app/api/costs/today/route.ts           — SUM session_costs.estimated_cost_usd WHERE started_at >= today midnight

Modified files:
  app/components/chat/ChatInterface.tsx      — mount StatusBar below content area

Content: Cost today (polls /api/costs/today every 60s), active job count (from job-store), AEGIS profile (from context-provider), KERNL status dot (from context-provider).
Each item clickable: cost → CostBreakdown (S9-10), jobs → Workers tab, AEGIS → Inspector, KERNL → KERNL health.

Quality gates:
  □ All 4 fields show live data (not placeholders)
  □ Cost updates within 60s of job completing
  □ Status bar never wraps at 1280px
  □ All items clickable
  □ npx tsc --noEmit clean

Commit: sprint-9-04: status bar -- cost today, active jobs, AEGIS profile, KERNL status
────────────────────────────────────────────────────────────

SPRINT S9-05 — Morning Briefing
Reference: PHASE9_BLUEPRINT.md § "S9-05 — Morning Briefing"

MORNING_BRIEFING.md is currently written manually. Auto-generate from KERNL data on cold start.

New files:
  app/lib/morning-briefing/generator.ts
  app/lib/morning-briefing/types.ts
  app/components/morning-briefing/MorningBriefing.tsx
  app/components/morning-briefing/BriefingSection.tsx
  app/app/api/morning-briefing/route.ts

Modified files:
  app/components/chat/ChatInterface.tsx      — check on mount, show MorningBriefing if needed

6 sections: yesterday's jobs (completed + failed), decisions logged, Ghost surfaces, budget summary, EoS delta, PRs pending merge. Shown once per day, re-accessible from command palette.

Quality gates:
  □ Shown on cold start (briefing_shown_date != today in settings)
  □ Not shown again same day
  □ All 6 sections populated from real KERNL data
  □ Graceful empty state for each section
  □ Start Day button dismisses
  □ Re-accessible from command palette
  □ npx tsc --noEmit clean

Commit: sprint-9-05: morning briefing -- auto-generated from KERNL, shown once per day
────────────────────────────────────────────────────────────

SPRINT S9-06 — Ghost Teach Me
Reference: PHASE9_BLUEPRINT.md § "S9-06 — Ghost Teach Me"
REQUIRES: S9-00 (ghost_preferences table)

Add positive reinforcement to Ghost — the Privacy Dashboard handles exclusions but there's no path for preferences. This closes the loop.

New files:
  app/components/ghost/TeachGhostDrawer.tsx
  app/lib/ghost/preferences-store.ts
  app/app/api/ghost/preferences/route.ts    — GET/POST/DELETE ghost_preferences

Modified files:
  app/components/ghost/GhostCard.tsx        — add Teach Ghost button
  app/components/ghost/GhostCardActions.tsx
  app/components/ghost/PrivacyDashboard.tsx — add Preferences tab
  app/lib/ghost/scorer/index.ts             — query preferences, apply boost_factor

Boost logic: after computing base score, query ghost_preferences WHERE source_type matches (or IS NULL). Multiply score by boost_factor. Increment use_count.
Exclusion always wins over preference — layer order preserved.

Quality gates:
  □ Teach Ghost button on all GhostCards
  □ Submitting writes ghost_preferences row
  □ Scorer applies boost on matching source_type
  □ Privacy Dashboard Preferences tab lists + deletes preferences
  □ Exclusion beats preference (not reversed)
  □ npx tsc --noEmit clean
  □ pnpm test:run zero new failures

Commit: sprint-9-06: ghost teach me -- preferences table, scorer boost, PrivacyDashboard Preferences tab
────────────────────────────────────────────────────────────

SPRINT S9-07 — Manifest Templates
Reference: PHASE9_BLUEPRINT.md § "S9-07 — Manifest Templates"
REQUIRES: S9-00 (manifest_templates table)

ManifestBuilder starts blank every time. Recurring jobs (weekly GHM scan, etc.) get re-described from scratch. Fix that.

New files:
  app/lib/agent-sdk/template-store.ts
  app/components/jobs/TemplatePickerPanel.tsx
  app/components/jobs/TemplatePicker.tsx
  app/components/jobs/QuickSpawnTemplates.tsx
  app/app/api/templates/route.ts             — GET all, POST save
  app/app/api/templates/[id]/route.ts        — DELETE

Modified files:
  app/components/jobs/ManifestBuilder.tsx    — template picker + save button + accept initialValues prop
  app/components/jobs/JobQueue.tsx           — mount QuickSpawnTemplates above job list

Quality gates:
  □ Save as template writes manifest_templates row
  □ Template picker shows all templates grouped by task_type
  □ Pre-filling ManifestBuilder from template populates all fields
  □ Quick-spawn from Workers tab works without opening ManifestBuilder
  □ use_count increments on each spawn
  □ Templates survive app restart
  □ npx tsc --noEmit clean
  □ pnpm test:run zero new failures

Commit: sprint-9-07: manifest templates -- save, picker, quick-spawn from Workers tab
────────────────────────────────────────────────────────────

SPRINT S9-08 — In-Thread Search
Reference: PHASE9_BLUEPRINT.md § "S9-08 — In-Thread Search"

messages_fts (FTS5 virtual table) already exists in schema. MessageList is scroll-only. Add Cmd+F search.

New files:
  app/components/chat/ThreadSearch.tsx
  app/app/api/threads/[id]/search/route.ts  — FTS5 query endpoint

Modified files:
  app/components/chat/ChatInterface.tsx      — mount ThreadSearch, Cmd+F handler
  app/components/chat/Message.tsx            — accept highlightQuery prop, wrap matches in <mark>
  app/components/chat/MessageList.tsx        — accept activeMatchId, scroll to match

Fast path: filter current messages array client-side.
Deep path: when <3 client results, fire server-side FTS5 query.

Quality gates:
  □ Cmd+F opens search in strategic thread (not Workers/War Room)
  □ Highlights appear in real time as user types
  □ Arrow keys navigate matches
  □ Server FTS fires when <3 client matches
  □ Escape closes and removes highlights
  □ npx tsc --noEmit clean

Commit: sprint-9-08: in-thread search -- Cmd+F, client highlight, server-side FTS5 fallback
────────────────────────────────────────────────────────────

SPRINT S9-09 — EoS History Sparkline
Reference: PHASE9_BLUEPRINT.md § "S9-09 — EoS History Sparkline"

eos_reports table already has full history. Context panel shows current score as text. Add trend.

New files:
  app/components/context/EoSSparkLine.tsx    — 80×24 SVG line chart
  app/components/context/EoSHistoryPanel.tsx — full history drawer (last 50 scans)
  app/app/api/eos/history/route.ts           — GET eos_reports for active project

Modified files:
  app/components/context/ContextPanel.tsx    — replace score text with EoSSparkLine

Color thresholds: green above 80, amber 60-80, red below 60.
Score delta: "+3" or "-2" vs previous scan shown inline.
No sparkline if < 2 scans — fall back to score text.

Quality gates:
  □ SparkLine renders from eos_reports (not mocked)
  □ Delta correct
  □ Color thresholds correct
  □ History panel shows last 50 scans
  □ Click row shows full issues_json
  □ Graceful fallback when < 2 scans
  □ npx tsc --noEmit clean

Commit: sprint-9-09: eos sparkline -- history from eos_reports, delta, color thresholds
────────────────────────────────────────────────────────────

SPRINT S9-10 — Cost Breakdown by Project
Reference: PHASE9_BLUEPRINT.md § "S9-10 — Cost Breakdown by Project"

session_costs.project_id exists. No per-project breakdown anywhere. Build it.

New files:
  app/components/agent-sdk/CostBreakdown.tsx
  app/app/api/costs/breakdown/route.ts       — GROUP BY project_id, range=today|week|all

Modified files:
  app/components/ui/StatusBar.tsx            — cost item opens CostBreakdown on click

Three tabs: Today, This Week, All Time. Table: project, session count, input tokens, output tokens, total cost. Total row at bottom.

Quality gates:
  □ Cost by project matches session_costs sums
  □ Today/Week/All toggle works
  □ Empty state renders cleanly
  □ Totals match StatusBar daily cost figure
  □ npx tsc --noEmit clean

Commit: sprint-9-10: cost breakdown -- by project, today/week/all tabs
────────────────────────────────────────────────────────────

SPRINT S9-11 — Job Retry / Edit Manifest
Reference: PHASE9_BLUEPRINT.md § "S9-11 — Job Retry / Edit Manifest"

Failed jobs currently offer Restart (unchanged manifest) or Cancel. Add Edit & Retry.

Modified files:
  app/components/agent-sdk/InterruptedSessionCard.tsx  — add Edit & Retry button
  app/components/jobs/JobCard.tsx                      — add Edit & Retry on failed state
  app/components/jobs/ManifestBuilder.tsx              — accept initialValues prop (S9-07 already adds this)
  app/lib/agent-sdk/job-tracker.ts                     — mark superseded job on new spawn

Flow: Edit & Retry → ManifestBuilder opens in modal pre-filled → submit → spawns new job → original job status = 'superseded' with pointer to new job id in meta.

Note: S9-07 adds the initialValues prop to ManifestBuilder. If S9-07 is complete, reuse that. If not, add it here.

Quality gates:
  □ Edit & Retry visible on failed and interrupted job cards
  □ ManifestBuilder opens pre-filled
  □ Submit spawns new job
  □ Original job marked 'superseded'
  □ New job appears in queue
  □ npx tsc --noEmit clean

Commit: sprint-9-11: job retry -- edit and retry on failed jobs, superseded status
────────────────────────────────────────────────────────────

SPRINT S9-12 — Chat History Panel
Reference: PHASE9_BLUEPRINT.md § "S9-12 — Chat History Panel"

conversation-store has full CRUD with pagination. listThreads() works. No UI to browse past conversations.

New files:
  app/components/chat/ChatHistoryPanel.tsx
  app/components/chat/HistoryRow.tsx

Modified files:
  app/components/chat/ChatInterface.tsx      — Cmd+[ handler, mount panel
  app/lib/command-registry/commands.ts       — register "Browse chat history" command

Panel: left slide-in drawer, Cmd+[ trigger. Two sections: Pinned, Recent (last 50, paginated). Search by title at top. Click: loads thread into current tab (prompt if current tab has messages). Long-press: rename, archive, pin. No delete (surface "conversation cannot be deleted" message).

Quality gates:
  □ Cmd+[ opens panel
  □ Last 50 conversations listed, most recent first
  □ Search filters correctly
  □ Click loads thread into current tab
  □ Pinned section shows pinned conversations
  □ Archive removes from main list
  □ Escape closes
  □ npx tsc --noEmit clean

Commit: sprint-9-12: chat history panel -- Cmd+[, search, load thread, pin/archive
────────────────────────────────────────────────────────────


════════════════════════════════════════════════════════════
WAVE 2 — DEPENDENT FEATURES
(Each sprint notes what it needs from Wave 1)
════════════════════════════════════════════════════════════

SPRINT S9-13 — Settings Panel
Reference: PHASE9_BLUEPRINT.md § "S9-13 — Settings Panel"
NEEDS: S9-03 done (notification patterns), S9-09 done (EoS data available)

Cmd+, currently does nothing. ThemeMode is in ui-store. budget_config exists. Build the settings drawer.

New files:
  app/components/settings/SettingsPanel.tsx
  app/components/settings/AppearanceSection.tsx
  app/components/settings/BudgetSection.tsx
  app/components/settings/QualitySection.tsx
  app/components/settings/GhostSection.tsx
  app/components/settings/AegisSection.tsx
  app/components/settings/ApiSection.tsx
  app/app/api/settings/route.ts              — GET/PATCH budget_config rows

Modified files:
  app/components/ui/Header.tsx               — wire Cmd+, to openSettings
  app/lib/command-registry/commands.ts       — register "Open Settings"

Sections: Appearance (theme toggle, live preview), Budget (soft/hard session caps, daily cap — reads/writes budget_config), Quality (EoS thresholds, SHIM retry ceiling), Ghost (scan cadence, quick-add exclusion), AEGIS (port, test connection button), API (key status from keychain — shows configured/not).

Quality gates:
  □ Cmd+, opens settings from anywhere
  □ Theme toggle changes theme live, persists
  □ Budget cap edits write to budget_config and are read by budget-enforcer.ts
  □ AEGIS port test connection fires real ping
  □ All sections load without error on cold DB
  □ npx tsc --noEmit clean
  □ pnpm test:run zero new failures

Commit: sprint-9-13: settings panel -- theme, budget caps, AEGIS port, all sections wired
────────────────────────────────────────────────────────────

SPRINT S9-14 — Inspector Drawer
Reference: PHASE9_BLUEPRINT.md § "S9-14 — Inspector Drawer"
NEEDS: S9-03 done, S9-09 done, S9-10 done

Cmd+I currently does nothing. Build the right-side inspection surface.

New files:
  app/components/inspector/InspectorDrawer.tsx
  app/components/inspector/ThreadTab.tsx
  app/components/inspector/KernlTab.tsx
  app/components/inspector/QualityTab.tsx
  app/components/inspector/JobsTab.tsx
  app/app/api/kernl/stats/route.ts           — DB size, chunk count, last indexer run

Modified files:
  app/components/chat/ChatInterface.tsx      — Cmd+I handler, mount InspectorDrawer
  app/lib/command-registry/commands.ts       — register "Open Inspector"

5 tabs: Thread (token count, message count, last checkpoint), KERNL (DB size, total chunks, last indexer run, last backup), Quality (full EoS issue list beyond context panel's top 5, EoS sparkline from S9-09), Jobs (selected job manifest JSON, events, cost), Costs (embed CostBreakdown from S9-10).

Quality gates:
  □ Cmd+I opens drawer from anywhere
  □ All 5 tabs render without error
  □ KERNL stats reflect actual DB on disk
  □ Quality tab shows full issue list (not just top 5)
  □ Jobs tab shows selected job manifest JSON
  □ Drawer closes on Escape
  □ npx tsc --noEmit clean

Commit: sprint-9-14: inspector drawer -- 5 tabs, Cmd+I, KERNL stats, full EoS list
────────────────────────────────────────────────────────────

SPRINT S9-15 — Push Notifications / System Tray
Reference: PHASE9_BLUEPRINT.md § "S9-15 — Push Notifications / System Tray"
NEEDS: S9-03 done (notification router and event types established)

⚠ AUTHORITY STOP CONDITIONS FOR THIS SPRINT:
- Do not modify tauri.conf.json in any way that changes the allowlist beyond what's needed for tauri-plugin-notification
- If Rust build fails twice on the same error, stop and write the exact error to SPRINT_9-15_BLOCKED.md and notify David
- If tauri-plugin-notification is incompatible with the current tauri version, document the version conflict and the resolution options — do not force an upgrade

New files:
  src-tauri/src/tray.rs
  src-tauri/src/notifications.rs
  app/lib/notifications/tray-bridge.ts

Modified files:
  src-tauri/src/main.rs                      — register tray, notification plugin
  src-tauri/Cargo.toml                       — add tauri-plugin-notification
  app/lib/stores/ui-store.ts                 — add escalate?: boolean to Notification type
  app/lib/agent-sdk/job-tracker.ts           — escalate: true on CI pass + permanent fail
  app/lib/agent-sdk/budget-enforcer.ts       — escalate: true on hard cap hit

Tray menu: Show/Hide window, Exit.
Escalated notifications (escalate: true) call Tauri IPC send_notification → Windows native toast.
Clicking toast: bring app to front, navigate to relevant context.

Quality gates:
  □ Tray icon appears in Windows system tray on launch
  □ Tray menu works (Show/Hide, Exit)
  □ CI pass notification fires Windows native toast
  □ Job permanent failure fires Windows native toast
  □ Tray badge updates when unread escalated notifications exist
  □ Toast fires when app is minimized
  □ Clicking toast brings window to front
  □ npx tsc --noEmit clean
  □ Cargo build clean

Commit: sprint-9-15: tray + push notifications -- Windows native toasts, tray icon, escalated events
────────────────────────────────────────────────────────────

SPRINT S9-16 — Decision Browser
Reference: PHASE9_BLUEPRINT.md § "S9-16 — Decision Browser"
NEEDS: S9-12 done (history panel patterns to reuse)

KERNL decisions table has all decisions logged since Phase 1. DecisionList shows last 5. No way to browse the rest.

Note: This sprint needs a decisions_fts virtual table. Add this migration to database.ts runMigrations() at the start of this sprint (not a new S9-00 task — add it inline here):

  CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
    title, rationale,
    content='decisions', content_rowid='rowid'
  );

New files:
  app/components/decisions/DecisionBrowser.tsx
  app/components/decisions/DecisionFilter.tsx
  app/components/decisions/DecisionRow.tsx
  app/components/decisions/DecisionDetail.tsx
  app/app/api/decisions/route.ts             — GET with project/category/impact/date filters, pagination
  app/app/api/decisions/export/route.ts      — markdown export, writes to artifacts table

Modified files:
  app/lib/kernl/schema.sql                   — add decisions_fts virtual table
  app/lib/command-registry/commands.ts       — register "Browse Decisions"
  app/components/chat/ChatInterface.tsx      — add Decisions as 4th tab OR command palette only (your call — document the decision)

Layout: left filter sidebar (project, category, impact, date range), center list (grouped by week, impact badge, title, date), right detail (full rationale, alternatives, thread link).

Quality gates:
  □ All decisions in KERNL are browseable
  □ Filters work correctly
  □ Full-text search returns correct results
  □ Thread link opens conversation in Chat History
  □ Export generates valid markdown artifact
  □ Paginated (50 per page)
  □ npx tsc --noEmit clean

Commit: sprint-9-16: decision browser -- filter, full-text search, markdown export, thread links
────────────────────────────────────────────────────────────

SPRINT S9-17 — Artifact Library
Reference: PHASE9_BLUEPRINT.md § "S9-17 — Artifact Library"
NEEDS: S9-12 done (drawer patterns)

artifacts table has everything Claude has ever produced. ArtifactPanel only shows the current message's artifact.

New files:
  app/components/artifacts/ArtifactLibrary.tsx
  app/components/artifacts/ArtifactLibraryRow.tsx
  app/app/api/artifacts/route.ts             — GET with project/type/language/date filters

Modified files:
  app/components/artifacts/ArtifactPanel.tsx  — add "Browse Library" link
  app/lib/command-registry/commands.ts        — register "Open Artifact Library"

Right-drawer. Filters: project, type, language, date range. Search by title. Click opens in current ArtifactPanel. Re-attach adds a system message pointing to the artifact.

Quality gates:
  □ All past artifacts browseable across sessions
  □ Filters work
  □ Click opens artifact in ArtifactPanel
  □ npx tsc --noEmit clean

Commit: sprint-9-17: artifact library -- cross-session browse, filter, re-attach to thread
────────────────────────────────────────────────────────────

SPRINT S9-18 — KERNL Health Panel
Reference: PHASE9_BLUEPRINT.md § "S9-18 — KERNL Health Panel"
NEEDS: S9-14 done (InspectorDrawer exists — this sprint populates the KERNL tab)

KERNLStatus.tsx shows a dot. The Inspector's KERNL tab (from S9-14) is the home for real stats. This sprint implements the full stats query and display.

S9-14 created app/app/api/kernl/stats/route.ts as a stub or basic version. Extend it to return:
  DB file size (fs.statSync on db path, formatted KB/MB)
  Total tables (SQLITE_MASTER count)
  Total messages, total chunks indexed, total decisions (COUNT queries)
  Vector index chunk count
  Last indexer run (settings key: last_indexer_run)
  Last backup timestamp (settings key: last_backup_at)

Modified files:
  app/components/inspector/KernlTab.tsx      — implement full stats display using extended route
  app/app/api/kernl/stats/route.ts           — extend to return all stats

Quality gates:
  □ All stats reflect actual DB state
  □ DB file size formatted correctly (e.g. "4.2 MB")
  □ Chunk count matches content_chunks COUNT(*)
  □ No mock data
  □ npx tsc --noEmit clean

Commit: sprint-9-18: kernl health panel -- full DB stats in Inspector KERNL tab
────────────────────────────────────────────────────────────

SPRINT S9-19 — Project Quick-Switcher
Reference: PHASE9_BLUEPRINT.md § "S9-19 — Project Quick-Switcher"
NEEDS: S9-02 done (command palette to register switch commands)

Active project in context panel is static text. Build one-click switching.

New files:
  app/components/context/ProjectSwitcher.tsx  — popover with project list

Modified files:
  app/components/context/ProjectSection.tsx   — trigger ProjectSwitcher on click
  app/lib/command-registry/commands.ts        — dynamic "Project: switch to [name]" commands (registered at palette open time by querying projects table)

Clicking project name: popover of all active projects. Click switches active project, updates settings (active_project key), triggers bootstrap context reload.

Quality gates:
  □ Click project name → popover appears
  □ Click a project → active project changes, context panel updates
  □ Command palette shows project switch commands
  □ Bootstrap context reload fires after switch
  □ npx tsc --noEmit clean

Commit: sprint-9-19: project quick-switcher -- context panel popover, command palette commands
────────────────────────────────────────────────────────────

SPRINT S9-20 — Edit Last Message / Regenerate
Reference: PHASE9_BLUEPRINT.md § "S9-20 — Edit Last Message / Regenerate"

Message.tsx is display-only. Cmd+E and Cmd+R in shortcuts modal do nothing.

New files:
  app/app/api/threads/[id]/truncate-after/[messageId]/route.ts  — DELETE messages after given ID from KERNL + conversation store

Modified files:
  app/components/chat/Message.tsx            — hover state with Edit/Regenerate buttons (last user/assistant message only)
  app/components/chat/ChatInterface.tsx      — Cmd+E and Cmd+R handlers, truncate logic

Edit: restore message to InputField, truncate thread from that message forward (KERNL + conversation store), user re-sends.
Regenerate: remove last assistant message, resend last user message.
Both actions only active on the most recent user/assistant message respectively.

Quality gates:
  □ Edit restores message to InputField and removes from view
  □ Truncation removes messages from KERNL thread
  □ Regenerate resends last user message
  □ Only available on most recent messages
  □ npx tsc --noEmit clean

Commit: sprint-9-20: edit last message and regenerate -- hover actions, truncate API, Cmd+E Cmd+R
────────────────────────────────────────────────────────────


════════════════════════════════════════════════════════════
WAVE 3 — DESIGN SESSION
════════════════════════════════════════════════════════════

SPRINT S9-21 — Memory Modal Design Decision
Reference: PHASE9_BLUEPRINT.md § "S9-21 — Memory Modal"

DO NOT BUILD ANYTHING. This is a design session only.

Cmd+M is listed in KeyboardShortcuts. The original intent is unclear. Now that command palette has KERNL search (S9-02) and Decision Browser exists (S9-16), the question is: does Cmd+M still need to exist as a separate surface?

Work to do:
1. Review what command palette KERNL search actually covers after S9-02 is built
2. Review Decision Browser after S9-16 is built
3. Answer: is there a remaining gap that Cmd+M should fill that neither of those covers?

If yes: write MEMORY_MODAL_BRIEF.md with a clear spec and recommended scope. Do not build yet.
If no: write a one-paragraph decision record to KERNL (decisions table, category: 'ui', title: 'Memory Modal deprecated in favor of command palette KERNL search', rationale: [your reasoning]). Remove Cmd+M from KeyboardShortcuts.tsx shortcuts list. Commit.

Quality gate:
  □ Either MEMORY_MODAL_BRIEF.md exists with clear spec, OR
  □ Decision logged to KERNL and Cmd+M removed from shortcuts list
  □ npx tsc --noEmit clean

Commit: sprint-9-21: memory modal design -- [deprecated OR brief written]
────────────────────────────────────────────────────────────


════════════════════════════════════════════════════════════
PHASE 9 CERTIFICATION (FINAL STEP — AFTER ALL 22 SPRINTS)
════════════════════════════════════════════════════════════

Before tagging Phase 9 complete, verify ALL of the following:

KEYBOARD SHORTCUTS — every entry in KeyboardShortcuts.tsx fires a real action:
  □ Cmd+K — command palette opens
  □ Cmd+N — new thread tab
  □ Cmd+B — toggle context panel (already worked, verify still works)
  □ Cmd+W — toggle War Room (already worked, verify still works)
  □ Cmd+I — inspector drawer opens
  □ Cmd+[ — chat history panel opens
  □ Cmd+, — settings panel opens
  □ Cmd+F — thread search opens (in strategic thread)
  □ Cmd+E — edit last message
  □ Cmd+R — regenerate
  □ Cmd+M — either opens memory modal OR is removed from list

FEATURES:
  □ Multi-thread: open 2 strategic threads simultaneously, confirm independent state
  □ Notifications: job completion fires toast; escalated events fire Windows native toast
  □ Status bar: all 4 fields live
  □ Morning briefing: shown on fresh cold start, not shown again same day
  □ Ghost Teach Me: preference written → scorer boost confirmed in Ghost card surfacing
  □ Manifest templates: save + quick-spawn confirmed working
  □ In-thread search: Cmd+F finds message in current thread
  □ EoS sparkline: renders trend from eos_reports, delta correct
  □ Cost breakdown: project-level breakdown matches session_costs sums
  □ Job retry: Edit & Retry opens pre-filled ManifestBuilder
  □ Chat history: Cmd+[ shows past threads, click loads thread
  □ Settings: theme toggle persists across restart; budget cap change read by budget-enforcer
  □ Inspector: all 5 tabs render real data
  □ Tray: icon in Windows system tray, notifications fire when app minimized
  □ Decision browser: all decisions browseable with filter + FTS
  □ Artifact library: cross-session artifacts browseable
  □ KERNL health: real DB stats in Inspector
  □ Project switcher: click project name in context panel → switch works
  □ Edit/regen: hover on last message shows actions

QUALITY:
  □ pnpm test:run — zero failures, test count >= Phase 8 baseline
  □ npx tsc --noEmit — zero errors
  □ EoS score >= 82 (Phase 8 baseline) — run a full EoS scan

DOCUMENTATION:
  □ BLUEPRINT_FINAL.md §13 Phase 9 entry written
  □ STATUS.md updated to "Phase 9 — The Full Cockpit: COMPLETE"
  □ All SPRINT_9X_COMPLETE.md files written (S9-00 through S9-21)

FINAL COMMIT:
  Message: phase-9: The Full Cockpit -- 22 sprints, all keyboard shortcuts wired, complete cockpit
  Tag: git tag v1.1.0
  Push tag: git push --tags

---

END OF PHASE 9 EXECUTION PROMPT
