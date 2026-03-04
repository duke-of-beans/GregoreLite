# GREGLITE — FEATURE BACKLOG
# Created: March 2, 2026
# Purpose: Features confirmed missing or stub-only. Sourced from UI audit, blueprint gap analysis, and David's priorities.
# Priority tiers: P1 = daily friction, P2 = significant value, P3 = nice-to-have

---

## BUCKET A — BUILT BUT NOT WIRED (dead code or stub-only)
These components or stores exist but have no functional UI surface. Lowest build cost — infrastructure already done.

### A1 — Command Palette (Cmd+K) [P1]
**Status:** Button in Header fires console.log. Full state shape in ui-store (openCommandPalette, closeCommandPalette, recentCommands). Zero actual component.
**What's needed:** CommandPalette.tsx — fuzzy search input, command registry, keyboard navigation, recent commands list, context-aware filtering (e.g. "spawn job" only available when on strategic thread).
**Scope:** ~1 sprint. ui-store wiring already done. Needs the visual component and a command registry that maps to existing actions.
**Commands to wire on day 1:** New thread, Switch tab (Strategic/Workers/War Room), Open War Room, Toggle context panel, Open settings, Open ghost privacy, Kill job [id], Spawn job, Search KERNL.

### A2 — Notification Display (toast / bell) [P1]
**Status:** addNotification/dismissNotification/clearNotifications fully modeled in ui-store with typed severities and durations. Nothing renders them. Every background event (job completed, CI passed, Ghost surfaced something, budget warning) fires into a void.
**What's needed:** ToastStack.tsx — fixed-position bottom-right stack, auto-dismiss, severity colors. NotificationBell.tsx in Header — badge count for unread persistent notifications.
**Scope:** ~0.5 sprint. Pure UI, all the data is there.

### A3 — Status Bar [P2]
**Blueprint §10:** `│ COUNCIL: 0 pending │ COST TODAY: $0.42 │ COWORK: 2 active │`
**Status:** ChatInterface.tsx ends with no bottom bar. Cost ticker lives in JobQueue but not in a global status bar. Council count and active job count aren't surfaced anywhere globally.
**What's needed:** StatusBar.tsx — fixed bottom strip showing: cost today (from session_costs), active jobs count (from job-store), AEGIS current profile, KERNL index status.
**Scope:** ~0.5 sprint. Data already available from existing stores.

### A4 — Settings Panel (Cmd+,) [P2]
**Status:** ThemeMode (light/dark/system) exists in ui-store. AEGIS port, Ghost scan cadence, budget caps, Ghost exclusion shortcuts — all configurable in code but nowhere in the UI.
**What's needed:** SettingsPanel.tsx — slide-in drawer or modal. Sections: Appearance (theme toggle), Budget (soft/hard caps), Ghost (cadence, exclusion quick-add), AEGIS (port, status), API (key status, model selection). Links to Privacy Dashboard for deep Ghost config.
**Scope:** ~1.5 sprints.

### A5 — Inspector Drawer (Cmd+I) [P2]
**Status:** Listed in KeyboardShortcuts as Cmd+I. No component. In Gregore it's designed as a debugging/inspection surface.
**What's needed:** InspectorDrawer.tsx — right-side slide-out. Tabs: Active Thread (token count, message count, checkpoint status), KERNL (last write, index size, recent decisions), Job Inspector (selected job detail beyond JobCard), EoS (full issue list, not just top 5).
**Scope:** ~1.5 sprints.

### A6 — Chat History Panel (Cmd+[) [P2]
**Status:** conversation-store.ts has full CRUD with pagination. listThreads() in session-manager returns all threads. No UI to browse or switch past conversations.
**What's needed:** ChatHistoryPanel.tsx — left drawer or separate panel. List of past threads, searchable, click to load. Wires to existing conversation-store.
**Note:** This is adjacent to the multi-thread tabs feature (B1) but simpler — history panel is read-only browse and reload, not simultaneous parallel threads.
**Scope:** ~1 sprint.

### A7 — Edit Last Message / Regenerate (Cmd+E / Cmd+R) [P3]
**Status:** Listed in shortcuts. InputField is input-only.
**What's needed:** Message.tsx hover state to show Edit / Regenerate actions. Edit mode sets InputField content and removes the message from the list (server-side truncate at that checkpoint). Regenerate re-sends the last user message.
**Scope:** ~0.5 sprint.

### A8 — Memory Modal (Cmd+M) [P3]
**Status:** Listed in shortcuts. Unclear what this should be in GregLite context — likely a quick KERNL search surface.
**What's needed:** Define clearly before building. Probably: search KERNL decisions + patterns from within the strategic thread, without leaving the conversation. Could overlap with command palette search.
**Scope:** Design first, then ~0.5 sprint.

---

## BUCKET B — PARTIALLY BUILT, MISSING LAST PIECE

### B1 — Multi-Thread Tabs (Multiple Strategic Conversations) [P1]
**Status:** KERNL supports multiple threads (listThreads(), createThread()). Tab bar has one Strategic slot. Cmd+N does nothing. Hard-wired to single conversation on mount.
**What's needed:** Thread tabs rendered horizontally across the header (or tab bar). Each tab = independent strategic thread with its own KERNL persistence, Ghost context, artifact panel, decision gate state. [+] button creates a new thread (prompts for name/project). Active tab badge for running Ghost or pending gates. Switch tabs without interrupting anything — each thread is fully KERNL-persisted.
**Scope:** ~2 sprints. Session-manager already handles multiple threads. Biggest work is Zustand thread-per-tab state isolation and the tab UI.

### B2 — Decision Browser [P2]
**Status:** DecisionList.tsx shows last 5 decisions in context panel. KERNL is writing every significant decision to the decisions table but there's no read surface beyond the last 5.
**What's needed:** DecisionBrowser.tsx — full-page or drawer view. Grouped by project, searchable by keyword, filterable by date range. Each decision shows rationale, alternatives considered, thread link. Export to markdown.
**Scope:** ~1 sprint. Data already in DB.

---

## BUCKET C — NOT DESIGNED, SHOULD EXIST

### C1 — Morning Briefing Surface [P1]
**Current state:** MORNING_BRIEFING.md is manually written per session. The data to generate it automatically already exists in KERNL.
**What's needed:** MorningBriefing.tsx — shown on cold start before first message (dismissable). Auto-generated from: jobs completed/failed yesterday, decisions logged yesterday, Ghost items surfaced in last 24h, daily cost summary, EoS score delta, any PRs pending merge.
**Data sources:** session_costs, manifests, decisions, ghost_indexed_items, manifests.ci_passed — all exist.
**Scope:** ~1.5 sprints (generation logic + UI surface).

### C2 — Ghost Teach Me (Positive Reinforcement) [P1]
**Current state:** Ghost surfaces cards with Tell me more / Noted. Privacy Dashboard handles exclusions (what to ignore). No way to tell Ghost what to surface MORE of.
**What's needed:** On GhostCard: "Teach Ghost" action alongside Noted. Opens a micro-form: "Surface more like this" with optional topic label (e.g. "GHM competitor intelligence", "Code quality alerts"). Writes a ghost_preferences row: source_type, topic_hint, boost_factor. Ghost scorer reads ghost_preferences and applies boost when matching content is found.
**Scope:** ~1.5 sprints.

### C3 — Push Notifications / System Tray [P1]
**Current state:** Events fire, notifications queue in ui-store, nothing reaches you when app is in background or minimized.
**What's needed:** Tauri system tray icon (Rust side). Badge count for: CI ready to merge (most important), job failed, budget warning, Ghost surfaced critical interrupt. Clicking tray notification brings window to front and navigates to relevant context. Windows native toast notifications for high-priority events even when app is minimized.
**Scope:** ~2 sprints (Rust Tauri plugin + notification routing layer).

### C4 — Manifest Templates [P2]
**Current state:** ManifestBuilder is blank every time. Recurring jobs (weekly GHM scan, GregLite self-evolution runs, etc.) re-described from scratch.
**What's needed:** Save current ManifestBuilder form as named template. Templates stored in KERNL (new table: manifest_templates). Template picker in ManifestBuilder header — select template to pre-fill all fields. Quick-spawn from Workers tab: list templates with one-click spawn.
**Scope:** ~1 sprint.

### C5 — Artifact Library [P2]
**Current state:** ArtifactPanel shows artifact from the current message only. All artifacts are stored in KERNL artifacts table but inaccessible from any other context.
**What's needed:** ArtifactLibrary.tsx — browsable panel (full-screen tab or drawer). Filter by project, type (code/markdown/output), date. Search by filename or content. Click to open in ArtifactPanel. "Re-attach to current thread" action to pull a past artifact back into context.
**Scope:** ~1.5 sprints.

### C6 — In-Thread Search [P2]
**Current state:** MessageList is scroll-only. No find-in-thread.
**What's needed:** Cmd+F inside a thread opens a search bar above the message list. Highlights matching messages, jumps to them. Client-side search over current messages array. Optionally: server-side KERNL semantic search for "find the message where we discussed X".
**Scope:** ~0.5 sprint (client-side), ~1 sprint (with semantic).

### C7 — EoS Health Score History [P2]
**Current state:** Context panel shows current EoS score as a snapshot (82/100). No trend data.
**What's needed:** EoS scan results written to a history table (eos_scan_history: timestamp, score, file_count, critical_count, warning_count). SparkLine component in context panel shows last 30 days. Click to open full history view with per-sprint breakdown.
**Scope:** ~1 sprint.

### C8 — Cost Breakdown by Project [P2]
**Current state:** session_costs tracks per-session costs. Jobs are tagged with project_path. Daily total visible in status bar (once built). No per-project breakdown.
**What's needed:** Cost view in Inspector or as a section in StatusBar tooltip: cost today by project, cost this week, burn rate by job type. Useful when running GHM + GregLite + research jobs in parallel.
**Scope:** ~0.5 sprint (pure query + display).

### C9 — Job Retry / Edit Manifest [P2]
**Current state:** Failed job shows InterruptedSessionCard with [Restart with Handoff] [Cancel]. Restart uses the original manifest unchanged. If the manifest was wrong, you cancel and rebuild from scratch.
**What's needed:** [Edit & Retry] on failed/interrupted jobs — opens ManifestBuilder pre-filled with the original manifest, editable. On submit, spawns new job with modified manifest (original job marked superseded).
**Scope:** ~0.5 sprint.

### C10 — KERNL Health Panel [P3]
**Current state:** KERNLStatus.tsx in context panel shows indexed/not-indexed dot. DB size, index coverage %, last backup time, last embedding run — invisible.
**What's needed:** Expanded KERNL status section or InspectorDrawer tab: DB file size, total chunks indexed, embedding coverage %, last background indexer run, last backup timestamp, vector index size.
**Scope:** ~0.5 sprint.

### C11 — Project Quick-Switcher [P3]
**Current state:** Active project shown in ProjectSection of context panel. Changing it requires multiple clicks.
**What's needed:** Click the project name in context panel → inline dropdown of recent projects. One click to switch. Also available from command palette (Project: switch to GHM, Project: switch to GregLite).
**Scope:** ~0.5 sprint.

---

## PRIORITY ORDER (David's confirmed + gap analysis ranking)

### Phase 9 candidates (highest value, do next):
1. **B1** — Multi-thread tabs [P1] — changes daily feel most
2. **A1** — Command palette [P1] — keyboard-first was a design principle, currently a stub
3. **C1** — Morning briefing [P1] — ritual, makes cold start meaningful
4. **A2** — Notification display [P1] — events fire into a void right now
5. **C3** — Push notifications / tray [P1] — CI ready to merge should reach you
6. **C2** — Ghost Teach Me [P1] — closes the Ghost feedback loop

### Phase 10 candidates:
7. **A3** — Status bar [P2] — completes the §10 blueprint layout
8. **A4** — Settings panel [P2] — theme, budget, AEGIS config all need a home
9. **A6** — Chat history panel [P2] — browse and reload past threads
10. **B2** — Decision browser [P2] — KERNL decisions have no read surface
11. **C4** — Manifest templates [P2] — recurring jobs friction
12. **C5** — Artifact library [P2] — all artifacts inaccessible
13. **C9** — Job retry/edit [P2] — obvious daily use

### Phase 10.5 — New Items (March 3, 2026)
22. **API Cost Optimization** [P2] — Implement prompt caching (90% savings on repeated context) and batch API (50% discount) in GregLite's API layer. Smart Haiku routing for classification/simple tasks. Contact Anthropic sales (sales@anthropic.com) for volume discount once spend exceeds ~$200/month. Goal: run GregLite at $50-80/month with caching instead of $300+ raw.
23. **Use actual Gregore logo** [P1] — Replace placeholder/text logo with the real Gregore logo asset throughout the app (Header, favicon, tray icon).
24. **Left panel collapse/expand carets both at top** [P1] — When collapsing the left panel via the caret at the top, the expand caret appears at the bottom of the panel. Both collapse and expand carets should be at the top for consistent UX.
25. **Chat history not visible in left pane** [P1] — Past conversations are not showing in the left panel. Last chat should be visible and browsable. Verify conversation-store → API route → list endpoint pipeline is wired to the sidebar.
26. **Auto-name chat instances** [P1] — Conversations should auto-generate a title from the first user message (or first exchange). Use Haiku to summarize the first message into a short title. Currently threads appear unnamed.

### Sprint 10.6 — Professional Cognitive Interface (COMPLETE):
27. **SSE streaming** [P1] — Progressive token rendering via Server-Sent Events. ✅ COMPLETE
28. **Flat borderless messages** [P1] — Kill bubble layout, centered column, density-aware CSS variables. ✅ COMPLETE
29. **3-tier density toggle** [P1] — Compact/comfortable/spacious presets with Cmd+Shift shortcuts. ✅ COMPLETE
30. **Auto-scroll + floating button** [P1] — IntersectionObserver sentinel, smart scroll pause on read-back. ✅ COMPLETE
31. **Thinking indicator** [P1] — Animated dots before first token, processing status for tool/thinking events. ✅ COMPLETE
32. **Collapsible blocks** [P2] — Accordion UI for thinking and tool_use events within messages. ✅ COMPLETE
33. **Stop/interrupt button** [P1] — AbortController pattern, partial content preservation. ✅ COMPLETE
34. **Scrollbar landmarks** [P2] — DeepSeek-inspired colored tick marks for code blocks, user messages, errors. ✅ COMPLETE
35. **Sidebar consolidation** [P2] — Recent Chats moved to Context Panel, ChatSidebar removed from layout. ✅ COMPLETE
36. **Cost display 4dp** [P2] — StatusBar and per-message metadata with 4 decimal places. ✅ COMPLETE
37. **Branding consistency** [P2] — All UI strings say "GregLite". ✅ COMPLETE
38. **Anti-bootstrap prompt** [P2] — System prompt tuned to respond conversationally to casual messages. ✅ COMPLETE
39. **Transit Map data foundation** [P2] — conversation_events table, tree columns, capture helper, event registry. ✅ COMPLETE
40. **Fix: ChatSidebar hydration error** [P1] — Deferred localStorage to useEffect. ✅ COMPLETE
41. **Fix: API 500s in dev mode** [P1] — Empty defaults instead of 500 on 4 routes. ✅ COMPLETE

### Phase 11 / polish:
14. **A5** — Inspector drawer [P2]
15. **C6** — In-thread search [P2]
16. **C7** — EoS history [P2]
17. **C8** — Cost breakdown by project [P2]
18. **A7** — Edit last message / regenerate [P3]
19. **C10** — KERNL health panel [P3]
20. **C11** — Project quick-switcher [P3]
21. **A8** — Memory modal [P3] — define before building
