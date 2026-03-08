# GREGLITE — FEATURE BACKLOG
# Updated: March 6, 2026
# Purpose: Ground-truth status of all features. Reconciled after Sprint 19-29 blitz.
# Source: Codebase audit (March 4), Gregore Audit (Sprint 15.1), Sprint 19-29 shipments

---

## STATUS KEY
- ✅ SHIPPED — In codebase, tested, working
- ❌ MISSING — Zero implementation
- 🔜 NEXT — Ready to build, brief exists

---

## CURRENT STATE

No active sprint briefs pending. Sprint 29.0 was the last queued sprint.
Next work comes from real usage feedback via the Quick Capture Pad.
Test count: 1624/1624. tsc: 0 errors.

---

## GREGORE PORT — Patterns & Features

### P0 — Must Have for Daily Driver

#### Receipt Footer ✅ SHIPPED (Sprint 17.0)
Collapsed per-message footer: cost, latency, model. Click to expand full details.
User preference: full/compact/minimal/hidden. Receipt-expand animation.

#### Orchestration Theater ✅ SHIPPED (Sprint 17.0)
First 5 messages auto-expand receipts. Preference prompt on message 5.

#### Voice System / Copy Templates ✅ SHIPPED (Sprint 17.0 + 23.0)
`lib/voice/copy-templates.ts` — centralized copy for all system-facing text.
Sprint 23.0 did full terminology audit: Ghost->Background Assistant, AEGIS->System Monitor, etc.

### P1 — Should Have

#### Ghost Pulse (input border animation) ✅ SHIPPED (Sprint 17.0)
`.ghost-analyzing` wired to input when decision gate is analyzing.

#### Memory Shimmer ✅ SHIPPED (Sprint 18.0)
Real-time keystroke -> KERNL FTS5 query -> highlighted memory matches in input.
ShimmerOverlay, MemoryCard click-to-expand, useShimmerMatches hook.

#### Adaptive Override System ✅ SHIPPED (Sprint 18.0)
Three-choice decision gate: "Just this once" / "Always allow" / "Never warn."
Override policies stored in SQLite. Full CRUD UI in Settings.

#### Send Button State System ✅ SHIPPED (Sprint 17.0)
5 visual states: normal, checking, approved, warning, veto. ARIA labels.
buttonPress micro-interaction on normal/approved only (Sprint 21.0).

#### Inspector Drawer Reorganization ✅ SHIPPED (Sprint 17.0 + 22.0 + 27.0)
Tabs: Memory / Quality / Cost / Jobs / Learning / Recall.
ATTN budget moved from StatusBar to Quality tab (Sprint 22.0).
Recall tab added (Sprint 27.0).

### P2 — Nice to Have

#### Glassmorphic Inspector Drawer ✅ SHIPPED (Sprint 17.0)
`rgba(0.95)` + `backdrop-filter: blur(12px)` + cyan border.

#### Message Fade-In Animation ✅ SHIPPED (Sprint 17.0)
200ms ease-out fade-in via `message-enter` class.

#### Spring Animations (Framer Motion) ✅ SHIPPED (Sprint 21.0)
All interactive surfaces: InspectorDrawer, EventDetailPanel, GatePanel, MemoryCard,
ReceiptFooter, SendButton, GhostCard. Central config in `lib/design/animations.ts`.
`useAnimationConfig()` hook respects `prefers-reduced-motion`.

---

## SACRED LAWS STATUS

### Fully Enforced
- ✅ Law 1: Append-Only Events
- ✅ Law 3: Reversibility — Sprint 19.0 action journal with undo (WAL-mode SQLite)
- ✅ Law 4: Quality Gates (decision gate + EoS)
- ✅ Law 5: Protect Deep Work — Sprint 19.0 focus tracker + interrupt gate
- ✅ Law 6: Transparency — Receipt Footer (Sprint 17.0)
- ✅ Law 7: Small Context Windows (multi-tab threading)
- ✅ Law 9: Outcomes Win (Option B Perfection)
- ✅ Law 10: Attention is Scarce — Sprint 19.0 attention budget (100 CT/day)
- ✅ Law 11: Evidence Required
- ✅ Law 12: Ghost Veto — expanded to 11 triggers (Sprint 19.0)

### Not Implemented (low priority for GregLite scope)
- ❌ Law 2: Earned Autonomy — no progressive trust infrastructure
- ❌ Law 8: Claims Age — no claim extraction or confidence decay

---

## DESIGN TOKENS

#### Background + Status + Spacing Tokens ✅ SHIPPED (Sprint 17.0)
`bg-tertiary`, `bg-elevated`, `status-*`, `cyan-ghost`, semantic spacing, dense typography.
All added to `globals.css` as CSS custom properties.

---

## PLATFORM FEATURES (Sprints 19-29)

### Sprint 19.0 — Sacred Laws Enforcement ✅
Reversibility journal, focus protection, attention budget, 11 decision gate triggers.

### Sprint 20.0 — Ghost Thread Activation ✅
Full lifecycle wired: bootstrap startup, dual-path shutdown (TypeScript + Rust),
AEGIS pause/resume, filesystem watcher bridge, privacy engine, StatusBar status, Settings panel.

### Sprint 21.0 — Framer Motion Spring Animations ✅
All CSS transition hacks replaced with physics-based springs. Central animations module.

### Sprint 22.0 — First Launch Polish ✅
Cold boot fresh conversation, +New Conversation button, Chat History opacity fix,
clickable scrollbar landmarks, ATTN moved to Inspector, @xenova/transformers installed,
SQLite schema gaps patched.

### Sprint 23.0 — Voice Audit + Responsiveness ✅
Full terminology rename (Ghost->Background Assistant, etc.), lucide SVG tab icons,
HelpGuide modal, Workers 404 fix, scroll-wheel Transit zoom,
responsive breakpoints at 1024/768/640px across all panels.

### Sprint 24.0 — Portfolio Dashboard ✅
Project scanner, 30s refresh, SQLite cache, ProjectCard grid, ProjectDetail slide-in,
Projects tab (leftmost), WORKSPACES.yaml auto-seed. 33 new tests.

### Sprint 25.0 — Add Existing Project + Onboarding ✅
Directory scanner (13 build markers), type inference, OnboardingChat Q&A,
parallel-copy migration + archive rename, verified deletion guard. 34 new tests.

### Sprint 26.0 — Create New Project + Attention Intelligence ✅
Scaffold templates (code/research/business/creative/custom), type-targeted questions,
"Needs Attention" analyzer with type-aware staleness thresholds, attention queue,
priority override muting.

### Sprint 27.0 — Ambient Memory Recall ✅
5-strategy detector (file revisit, conversation callback, project milestone, pattern insight,
personal moment), scorer with frequency calibration (auto-reduces at 60% dismissal rate),
RecallCard (amber, hover actions), ContextPanel integration, Settings + Inspector tabs. 24 new tests.

### Sprint 28.0 — Ceremonial Onboarding Synthesis ✅
Indexing source registry, per-source synthesis (Claude API, typewriter animation),
combination synthesis (capabilities unlocked), master synthesis ceremony
("I see you now." full-screen reveal), re-engagement nudges (1/week, 2x dismiss = silence).

### Sprint 29.0 — Quick Capture Pad ✅
Global hotkey (Ctrl+Shift+Space) floating input, project prefix parser with fuzzy matching,
cosine-similarity dedup (0.85 threshold), mention-count priority signal,
bug/feature/question/idea classification, CaptureInbox with promote/dismiss/re-route,
backlog promotion pipeline, Settings section. 61 new tests.

### Sprint 30.0 — UX Reality Check: Daily Driver Polish ✅
Projects removed from tabs → full-screen overlay (Cmd+P + Header button + greglite:open-portfolio event).
ContextPanel "CONTEXT" label removed. Header: Projects + Quick Capture buttons added, all buttons
unified to rounded-lg border elevated style. Smart textarea: numbered/bullet list continuation,
break-out on empty item, triple-backtick code-block shortcut, 40vh max height, auto-reset on send.
MorningBriefing: X dismiss icon replaces "Start Day" button, "Don't show again today" text link added.
StatusBar: collapse/expand chevron toggle, persisted via ui-store, 2px strip when collapsed.
Tauri window icon set. Web favicon standardised to favicon.ico.

### Sprint 31.0 — Start at Boot ✅
Windows/macOS autolaunch toggle in Settings > Startup. Tauri plugin-autostart integration.
System-tray icon with show/hide and quit actions. Minimise-to-tray on close option.
StartupSection settings panel. 42 new tests.

### Sprint 32.0 — Headless Browser Mode ✅
Embedded Chromium WebView (Tauri webview2) for authenticated web sessions.
Session persistence across app restarts, cookie jar isolation per project,
greglite:web-navigate event bus, WebSessionSection settings panel,
web-session/browser.ts session manager. 1667 total tests across 87 files.

---

## POST-LAUNCH v1.1.0 — Bug Report & Sprint Matrix (March 8, 2026)

Issues discovered during first installed-build testing session.

---

### 🔴 SPRINT 36.0 — Production API Layer (Node.js Sidecar) — CRITICAL BLOCKER
**Priority:** P0 — App non-functional in production without this
**Root cause:** `tauri-prebuild.bat` strips all Next.js API routes before the static build.
Every `/api/*` call returns HTML 404 (Next.js error page) — "Unexpected token '<', <!DOCTYPE..." errors.
Affects: Workers tab, War Room, Projects, chat, costs, Ghost, KERNL — everything.

**The proper fix:** Node.js sidecar pattern (the Tauri-blessed solution for exactly this problem).

**Architecture:**
- Create `sidecar/` directory at project root — a standalone Node.js/Express server
- Sidecar imports and re-exports all existing `app/lib/` logic (no code duplication)
- All existing `app/app/api/` route handlers move to Express routes (thin wrappers only)
- `pkg` compiles the sidecar to a self-contained `.exe` — no Node.js required on end user machine
- Tauri spawns sidecar on startup via `main.rs`, kills it on shutdown
- Frontend detects Tauri (`window.__TAURI_INTERNALS__`) and prefixes all fetch calls with `http://localhost:3717`
- Dev mode: Next.js dev server handles API routes normally (zero change to dev workflow)
- `tauri-prebuild.bat` no longer needs to strip API routes — static export can coexist with sidecar

**Scope:**
1. `sidecar/server.ts` — Express server on port 3717, all routes mounted
2. `sidecar/routes/` — thin Express wrappers for each API namespace (~25 files)
3. `sidecar/package.json` — standalone package, `pkg` config
4. `sidecar/build.bat` — compiles + renames to `src-tauri/binaries/greglite-server-x86_64-pc-windows-msvc.exe`
5. `app/lib/api-client.ts` — `apiUrl(path)` helper: returns `/api${path}` in dev, `http://localhost:3717/api${path}` in Tauri
6. All `fetch('/api/...')` calls in frontend → `fetch(apiUrl('/...'))`  (~50 call sites, codemod-able)
7. `app/src-tauri/src/main.rs` — sidecar spawn on app start, kill on window destroy
8. `app/src-tauri/tauri.conf.json` — `externalBin` + `capabilities/default.json` sidecar permission
9. `tauri-prebuild.bat` — remove API route strip (no longer needed)
10. Build pipeline: sidecar build runs before Tauri build

**Key decisions:**
- Port: 3717 (unique, unlikely conflict — "GregLite")
- Sidecar shares all `app/lib/` modules — SQLite, KERNL, Ghost, Agent SDK all work identically
- SSE streaming (`/api/chat`) works in Express via `res.write()` — no architectural change needed
- `better-sqlite3`, `keytar`, `sqlite-vec` all work in the sidecar (native Node.js context)
- No code is duplicated — sidecar routes are 3-5 line wrappers calling existing handler functions

**Test strategy:** All existing tests remain unchanged. Add sidecar integration smoke tests.

---

### 🟡 SPRINT 37.0 — UX Polish Sprint (Post-Sidecar)
**Priority:** P1 — Quality of life, all cosmetic/functional issues found in v1.1.0 testing

**Items:**

#### 37-A: Favicon + Window Icon Fix
Window titlebar, taskbar, and Start Menu still show placeholder icon.
Fix: Ensure `app/src-tauri/icons/icon.ico` is the correct Gregore Lite icon,
and `tauri.conf.json` `app.windows[0]` has `"icon": "icons/icon.ico"` (not .png).

#### 37-B: Shift+Enter List Continuation (Smart Textarea)
Sprint 30.0 shipped list continuation but only on Enter, not Shift+Enter.
The input textarea uses Shift+Enter for newline — the list continuation logic fires on Enter only.
Fix: Detect `e.shiftKey` in the keydown handler and apply list continuation on Shift+Enter as well.
Also fix: Numbered list should auto-increment the number (1. → 2. → 3.), not repeat "1.".

#### 37-C: Settings Panel Tab Groups
Settings panel is a flat scrollable list. Should be broken into tab groups:
Appearance / Memory / Budget / Quality / Ghost / Advanced (or similar grouping).
Tab navigation at top of settings panel, content filtered per tab.

#### 37-D: UI Label Clarity — Icons + Text
Current state: icon-only buttons in several places (Quick Capture, header icons).
Quick Capture pad icon is ambiguous — mistaken for New Chat.
Decision: Add text labels to all header action buttons, or replace icon-only with icon+label.
Also: Quick Capture pad needs a visible title/header when opened so user knows what it is.

#### 37-E: Projects — Tab vs Header Button Decision
Currently a header button opening a full-screen overlay (Sprint 30.0).
Question: Should it be a tab alongside Chat/Workers/War Room?
Recommendation: Keep as header button (meta-navigation, not session-scoped).
Fix needed: Make the Projects overlay header clearly say "Projects" with a close button that's obvious.

#### 37-F: Import Section in Settings (Sprint 33-35 work)
Verify import/watchfolder section is visible and functional in production build post-sidecar fix.

---

### 🔵 SPRINT 38.0 — Onboarding Tour + First-Run Experience
**Priority:** P2 — Important for external users, not blocking internal use
**No brief yet.** Scope when Sprint 37 ships.

Tour tips needed on:
- Chat tab (what the input does, memory shimmer explanation)
- Workers tab (what Agent SDK jobs are)
- War Room (what the dependency graph shows)
- Inspector drawer (what each tab contains)
- Context panel (Ghost / KERNL / Project sections)
- Settings key toggles (Memory Highlights, Ghost on/off)

Approach: step-by-step tooltip overlay on first launch, skippable, re-triggerable from Settings > Help.

---

## SKIP LIST — Do NOT Port from Gregore

- ❌ Multi-Model Consensus / Council Synthesis (GregLite is Claude-only)
- ❌ Triptych Layout / Cognitive Cockpit (killed Jan 2, 2026)
- ❌ Biological Metaphors ("membrane," "organs," "seam")
- ❌ GLACIER Long-Term Memory System (KERNL is sufficient)
- ❌ Homeostasis / Self-Model / World-Model Systems (Phase 3+ territory)
- ❌ ENGINE-E Anti-Gravity / Novelty Injection
- ❌ ENGINE-I Cognitive Metabolism (irrelevant for single-model)
- ❌ Gamification of Any Kind ("This isn't Duolingo")

---

## FUTURE / UNSCHEDULED

No sprint briefs pending. Future work sourced from:
- Quick Capture Pad inbox (real usage bugs and ideas)
- David's testing and daily driving
- User feedback once shipped externally

**Gregore backlog cross-references:**
- EPIC-78: Ambient Memory deep personalization (beyond Sprint 27 — the "Google Photos but for everything" vision)
- EPIC-79: Same-Provider Multi-Instance Council (Gregore-only, not GregLite)
- EPIC-80: Ceremonial Onboarding extensions (beyond Sprint 28 — deeper synthesis, more source types)

---

## EPIC-81: Cross-Platform Conversation Memory Import ✅ SHIPPED (Sprints 33.0–35.0)
**Spec:** `docs/CONVERSATION_IMPORT_SPEC.md`
**Cert:** `EPIC81_COMPLETE.md`
**Commits:** 4ea4b67 (Sprint 33.0) · 3fb2e96 (Sprint 34.0) · ba24b1e (Sprint 35.0)

GregLite's memory was blind to all prior AI conversation history. EPIC-81 closes
that gap with a full import pipeline, continuous sync daemon, and multi-format
adapter layer covering claude.ai, ChatGPT, Gemini Takeout, and Markdown exports.

### Sprint 33.0 — Import Pipeline + Historical Corpus ✅ SHIPPED (commit 4ea4b67)
- `imported_sources` + `imported_conversations` tables with deduplication by `external_id`
- `content_chunks` extended with `imported_source_id` for Shimmer provenance
- Import pipeline: format detection → chunk (600 tokens, 50 overlap) → embed → sqlite-vec
- Format adapters: `claude_ai_export` (ZIP/JSON), `chatgpt_export` (BFS tree walk), `generic_json`
- Import UI: drag-and-drop panel, progress ring, Memory Sources list in Settings
- Shimmer provenance: `source_platform` field on `ShimmerMatch` — platform badge on matches
- API: POST /api/import/upload, GET /api/import/sources, GET /api/import/progress/:id

### Sprint 34.0 — Watchfolder + Reminder (Ongoing Sync) ✅ SHIPPED (commit 3fb2e96)
- `AutoIngestDaemon` with chokidar FSWatcher (chosen over Tauri fs.watch — works in both dev and Tauri runtime, no IPC boundary needed), 500ms debounce, wired into bootstrap
- `moveToProcessed()` — collision-safe timestamp suffix, prevents re-processing on restart
- Sync reminder: `shouldShowReminder()` triggers StatusBar MEM chip after 14 days without sync
- API: GET/POST/DELETE /api/import/watchfolder
- ImportSection watchfolder config panel (path input, reset, extension list)

### Sprint 35.0 — Additional Adapters + Inspector ✅ SHIPPED (commit ba24b1e)
- `gemini.ts` adapter — Gemini Takeout JSON, `author: 'model'` → `'assistant'`, seconds-epoch normalisation
- `markdown.ts` adapter — role-structured, markdown headers, raw text fallback; SHA-256 dedup
- Adapter registry hardened: Gemini detection, markdown/text cases wired, `gemini_export` added to `ImportFormat`
- MemoryTab Import Sources section: per-source rows with conv count, chunk count, last synced
