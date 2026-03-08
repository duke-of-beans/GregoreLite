# GREGLITE — SPRINTS 36 / 37 / 38 COWORK PROMPTS
# Generated: March 8, 2026
# Execution order:
#   Sprint 36 → FIRST (critical blocker, runs alone)
#   Sprint 37 + Sprint 38 → IN PARALLEL after Sprint 36 ships
#
# Why 37 cannot parallel with 36: both modify tauri.conf.json — file conflict.
# Why 38 can parallel with 37: zero file overlap (new tour components + ui-store only).

═══════════════════════════════════════════════════════════════
SPRINT 36.0 — Production API Layer (Node.js Sidecar)
Run FIRST. Everything else is blocked until this ships.
Restores all API functionality in the installed Tauri build.
═══════════════════════════════════════════════════════════════

Execute Sprint 36.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\GregLite\app\src-tauri\tauri.conf.json
  Filesystem:read_file D:\Projects\GregLite\app\scripts\tauri-prebuild.bat
  Filesystem:read_file D:\Projects\GregLite\app\next.config.ts
  Filesystem:read_file D:\Projects\GregLite\app\src-tauri\src\main.rs
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\FEATURE_BACKLOG.md

Summary: The installed GregLite v1.1.0 build is a static shell — all Next.js API routes
are stripped by tauri-prebuild.bat before the Tauri build, so every fetch to /api/* returns
an HTML 404 page. This sprint implements the Tauri-blessed solution: a Node.js/Express
sidecar compiled to a self-contained .exe via pkg, spawned by Tauri on startup, serving all
existing API route handlers on localhost:3717. Dev mode is completely unchanged — Next.js
dev server continues to handle /api/* calls normally. After this sprint, the installed app
is fully functional.

Tasks:

1. **Sidecar package setup** — D:\Projects\GregLite\sidecar\package.json:
   - Standalone Node.js package (separate from app/package.json)
   - Dependencies: express, cors, better-sqlite3, keytar, sqlite-vec (copy exact versions from app/package.json)
   - devDependencies: @vercel/pkg, tsx, @types/express, @types/cors, @types/node
   - Scripts: "build": "tsx build.ts", "pkg": "pkg dist/server.js --target node18-win-x64 --output server.exe"
   - pkg config block: targets ["node18-win-x64"], assets ["**/*.node", "**/*.sql"], outputPath "dist"
   - tsconfig.json: module commonjs, target es2020, outDir dist, rootDir src, strict true

2. **Express server entry** — D:\Projects\GregLite\sidecar\src\server.ts:
   - Express app on port 3717 (env PORT overridable)
   - CORS: origin "tauri://localhost" and "http://localhost:3000", credentials true
   - Body parser: json() with 50mb limit (for import/upload route)
   - Mount all route namespaces (see Task 3)
   - Health check: GET /api/health returns { ok: true, version: "1.1.0" }
   - Graceful shutdown on SIGTERM/SIGINT: close server, then process.exit(0)
   - Console.log on startup: "GregLite API sidecar running on port 3717"

3. **Route namespace files** — D:\Projects\GregLite\sidecar\src\routes\:
   Create one file per API namespace. Each file is a thin Express Router that imports the
   existing handler functions from D:\Projects\GregLite\app\lib\ and D:\Projects\GregLite\app\app\api\.
   
   IMPORTANT: The sidecar imports lib/ modules directly (shared code). It does NOT re-implement
   any logic. Route files are 3-10 line wrappers only.

   Pattern for each route file:
   ```typescript
   import { Router, Request, Response } from 'express';
   import { handleGet, handlePost } from '../../../app/app/api/threads/route';
   const router = Router();
   router.get('/', async (req: Request, res: Response) => {
     // adapt NextRequest → Express req, NextResponse → Express res
     // call the existing handler, pipe the result
   });
   export default router;
   ```

   NextRequest/NextResponse adapter utility — D:\Projects\GregLite\sidecar\src\adapter.ts:
   - toNextRequest(req: express.Request): NextRequest — wraps Express req as NextRequest
   - fromNextResponse(nextRes: NextResponse, res: express.Response): void — pipes status/headers/body
   - For SSE routes (/api/chat): pipe ReadableStream chunks directly to res via res.write() + res.flush()
   - SSE route must set headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive

   Namespaces to implement (one Router file each):
   - threads.ts → /api/threads and /api/threads/:id and /api/threads/:id/search and /api/threads/:id/truncate-after/:messageId
   - chat.ts → /api/chat (SSE streaming — special handling, see adapter notes above)
   - bootstrap.ts → /api/bootstrap
   - context.ts → /api/context
   - costs.ts → /api/costs/today and /api/costs/breakdown
   - agent-sdk.ts → /api/agent-sdk/jobs, /api/agent-sdk/jobs/:id and all sub-routes (kill/merge/output/restart/supersede/unblock), /api/agent-sdk/status, /api/agent-sdk/budget, /api/agent-sdk/budget-status, /api/agent-sdk/actions
   - kernl.ts → /api/kernl/artifact, /api/kernl/manifests, /api/kernl/stats
   - transit.ts → /api/transit/capture, /api/transit/events, /api/transit/events/:id, /api/transit/insights
   - decisions.ts → /api/decisions, /api/decisions/export
   - decision-gate.ts → /api/decision-gate/approve, /api/decision-gate/dismiss, /api/decision-gate/override, /api/decision-gate/policies, /api/decision-gate/policy
   - portfolio.ts → /api/portfolio, /api/portfolio/scan, /api/portfolio/:id
   - projects.ts → /api/projects, /api/projects/switch
   - ghost.ts → all /api/ghost/* routes (start/stop/status/settings/items/chunks/exclusions/exclusion-log/ingest-file/inject/preferences/purge/suggestions/watch-paths)
   - eos.ts → /api/eos/fp, /api/eos/history
   - recall.ts → /api/recall/active, /api/recall/action, /api/recall/history, /api/recall/run, /api/recall/settings
   - shimmer.ts → /api/shimmer-matches
   - cross-context.ts → /api/cross-context/inject, /api/cross-context/feedback, /api/cross-context/suppressed
   - artifacts.ts → /api/artifacts
   - auto-title.ts → /api/auto-title
   - morning-briefing.ts → /api/morning-briefing
   - onboarding.ts → /api/onboarding
   - restore.ts → /api/restore
   - settings.ts → /api/settings, /api/settings/thread-tabs
   - templates.ts → /api/templates, /api/templates/:id
   - aegis.ts → /api/aegis/health, /api/aegis/override
   - capture.ts → /api/capture, /api/capture/inbox, /api/capture/stats, /api/capture/:id/dismiss, /api/capture/:id/promote
   - health.ts → /api/health

4. **Sidecar build script** — D:\Projects\GregLite\sidecar\build.bat:
   - cd /d D:\Projects\GregLite\sidecar
   - npx tsx build.ts (transpile to dist/)
   - npx pkg dist/server.js --target node18-win-x64 --output dist/server.exe
   - rustc --print host-tuple > triple.tmp (read into variable)
   - copy dist\server.exe D:\Projects\GregLite\app\src-tauri\binaries\greglite-server-{triple}.exe
   - echo "Sidecar built and placed."
   Build script must also be callable from the Tauri beforeBuildCommand.

5. **Frontend API URL helper** — D:\Projects\GregLite\app\lib\api-client.ts:
   - apiUrl(path: string): string
   - If window.__TAURI_INTERNALS__ exists (production Tauri): return "http://localhost:3717" + path
   - Otherwise (dev): return path (relative, handled by Next.js dev server)
   - Export as named export
   - Also export: apiFetch(path, init?) — wrapper around fetch(apiUrl(path), init)

6. **Codemod all fetch call sites** — across entire app/:
   - Find every fetch('/api/...) and fetch(`/api/...`) in app/components/, app/app/ (non-API), app/lib/ (client-side hooks only)
   - Replace with fetch(apiUrl('/...')) or apiFetch('/...')
   - Import apiUrl or apiFetch from '@/lib/api-client'
   - SERVER-SIDE code (Next.js API route handlers, lib/ server modules) does NOT use apiUrl — only client-side components and hooks
   - Estimated ~50 call sites — do a systematic grep first: grep -r "fetch('/api" app/components app/app --include="*.tsx" --include="*.ts" | grep -v "app/api"

7. **Tauri sidecar integration** — D:\Projects\GregLite\app\src-tauri\src\main.rs:
   - Add tauri-plugin-shell to Cargo.toml (already present from Sprint 32.0 — verify)
   - In main() builder: register sidecar spawn after app is built
   - On AppEvent::Ready: spawn sidecar "greglite-server" via shell().sidecar("greglite-server")
   - Store child process handle in Mutex<Option<Child>>
   - On WindowEvent::Destroyed (all windows): kill the sidecar child process
   - Log startup: eprintln!("Sidecar spawned")
   - If sidecar fails to spawn: log error but do NOT panic — app continues (degraded mode)

8. **Tauri config + capabilities** — D:\Projects\GregLite\app\src-tauri\tauri.conf.json:
   - Add to bundle: "externalBin": ["binaries/greglite-server"]
   - D:\Projects\GregLite\app\src-tauri\capabilities\default.json: add shell:allow-execute permission for greglite-server sidecar

9. **Update tauri-prebuild.bat** — D:\Projects\GregLite\app\scripts\tauri-prebuild.bat:
   - REMOVE the "move app\api to _api_backup" and "move app\middleware to _middleware_backup" blocks entirely
   - API routes no longer need to be stripped — they're dead code in the static export but harmless
   - ADD: call D:\Projects\GregLite\sidecar\build.bat before the pnpm build step
   - Keep TAURI_BUILD=1 and .next cache clean step

10. **TypeScript gate + smoke test** — zero new tsc errors:
    - Run npx tsc --noEmit from D:\Projects\GregLite\app — must show 0 new errors
    - Run pnpm test:run from D:\Projects\GregLite\app — all 1753 tests must pass
    - Manual smoke test checklist (document results in commit message):
      * Run sidecar manually: node sidecar/dist/server.js — verify GET http://localhost:3717/api/health returns { ok: true }
      * Build Tauri app: npx @tauri-apps/cli build --bundles nsis (from signing-enabled PS session)
      * Install built .exe, launch app
      * Verify Workers tab loads without "<!DOCTYPE" error
      * Verify War Room loads without "Poll error"
      * Verify Projects overlay loads without JSON error
      * Verify chat sends a message successfully

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero new errors before commit.
- The sidecar SHARES app/lib/ modules — do NOT duplicate any logic. Routes are thin wrappers only.
- SSE streaming for /api/chat MUST work — this is the core chat functionality. Test it explicitly.
- Dev mode (pnpm dev) must be completely unchanged — apiUrl() returns relative paths in dev.
- Sidecar binary must be placed at src-tauri/binaries/greglite-server-x86_64-pc-windows-msvc.exe
- The sidecar package.json is SEPARATE from app/package.json — never merge them.
- better-sqlite3, keytar, sqlite-vec are native modules — pkg's --assets flag must include **/*.node
- Port 3717 is canonical. Do not use 3001 or any other port.
- "Sync, commit, and push" means: update STATUS.md first (close sprint items), then git.
- Commit message pattern: "feat: Sprint 36.0 — production API layer (Node.js sidecar)"

Project: D:\Projects\GregLite
Shell: Use cmd (not PowerShell) with cd /d D:\Projects\GregLite\app for app work,
       cd /d D:\Projects\GregLite\sidecar for sidecar work
Git: Full path D:\Program Files\Git\cmd\git.exe. Write commit message to COMMIT_MSG_TEMP.txt,
     then git commit -F COMMIT_MSG_TEMP.txt



═══════════════════════════════════════════════════════════════
SPRINT 37.0 — UX Polish (Post-Sidecar)
Run after Sprint 36.0. Can run IN PARALLEL with Sprint 38.0.
Fixes 6 UX issues found in first installed-build testing session.
═══════════════════════════════════════════════════════════════

Execute Sprint 37.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\FEATURE_BACKLOG.md
  Filesystem:read_file D:\Projects\GregLite\app\src-tauri\tauri.conf.json
  Filesystem:read_file D:\Projects\GregLite\app\components\chat\InputField.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\settings\SettingsPanel.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\Header.tsx
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts

Summary: Six UX issues found during first installed-build testing. This sprint fixes them all:
favicon/window icon showing placeholder, Shift+Enter not triggering list continuation (only Enter
does), settings panel remaining a flat scroll list instead of tab groups, icon-only buttons that
are ambiguous (Quick Capture looks like New Chat), Projects overlay missing clear labeling, and
all header button labels to be confirmed. After this sprint the app looks and feels intentional.

Tasks:

1. **Favicon + Window Icon** — D:\Projects\GregLite\app\src-tauri\tauri.conf.json + icons/:
   - Verify D:\Projects\GregLite\app\src-tauri\icons\icon.ico exists and is the correct Gregore Lite icon
   - If icon.ico is missing or wrong: generate it from icons\128x128.png using a Node.js script
     (use sharp or jimp: npm install jimp --no-save && node -e "require('jimp')...")
   - In tauri.conf.json app.windows[0]: set "icon": "icons/icon.ico" (not .png — .ico for Windows titlebar)
   - Verify bundle.icon array already includes "icons/icon.ico" — add if missing
   - Result: taskbar, Alt+Tab, titlebar, and Start Menu all show Gregore Lite icon

2. **Smart Textarea: Shift+Enter List Continuation + Number Increment**
   — D:\Projects\GregLite\app\components\chat\InputField.tsx:
   - Current bug: list continuation fires on Enter but NOT Shift+Enter
   - Fix: In the keydown handler, trigger list continuation on BOTH Enter AND Shift+Enter
     (textarea uses Shift+Enter for newline, so the continuation should append to the new line)
   - Fix number increment: "1. text" + Enter/Shift+Enter should produce "2. " not "1. " again
     Parse the current line number with parseInt, increment, use that for the next bullet
   - Bullet lists (- and * and •) already don't need incrementing — verify they still work
   - Break-out behavior (empty item + Enter removes the bullet): must still work for both Enter and Shift+Enter
   - Test matrix: numbered list Enter, numbered list Shift+Enter, bullet Enter, bullet Shift+Enter,
     break-out Enter, break-out Shift+Enter, triple-backtick fence

3. **Settings Panel Tab Groups** — D:\Projects\GregLite\app\components\settings\SettingsPanel.tsx
   + D:\Projects\GregLite\app\components\settings\:
   - Replace the flat scrollable section list with tabbed navigation
   - Tab groups (5 tabs):
     * Appearance — ThemeSection, DensitySection, AppearanceSection (transit/tool blocks/memory highlights)
     * Memory & Ghost — GhostSection, RecallSection, ImportSection, WebSessionSection
     * Budget & Quality — BudgetSection, EoSSection, OverridePoliciesSection
     * Startup & Sync — StartupSection, (any other system-level sections)
     * Advanced — all remaining sections (KERNLSection, AEGISSection, etc.)
   - Tab bar: horizontal pill tabs at top of settings panel, active tab highlighted in cyan
   - Each tab renders only its sections (lazy — not all mounted at once)
   - Default tab on open: Appearance
   - Last active tab persisted to ui-store (settingsActiveTab field)
   - Tab labels: text only, no icons (clarity over aesthetics)
   - Add SETTINGS_TABS copy strings to lib/voice/copy-templates.ts

4. **Header Button Clarity: Icons + Text Labels**
   — D:\Projects\GregLite\app\components\ui\Header.tsx:
   - Current: icon-only buttons for Projects, Quick Capture, Settings gear, Cmd+K, notifications bell
   - Fix: Add text labels below or beside icons for at minimum: Quick Capture, Projects
   - Pattern: icon on top, 9px label below, same container width
   - Quick Capture button label: "Capture" (not "Quick Capture" — too long)
   - Projects button label: "Projects"
   - Settings gear: tooltip "Settings" is sufficient, no persistent label needed (universally understood)
   - Notification bell: tooltip sufficient
   - Cmd+K: tooltip sufficient
   - Quick Capture pad: when opened, add a visible header inside the pad reading "Quick Capture"
     with a subtitle "Drop thoughts here — they'll appear in your inbox." This removes ambiguity.
   - Add CAPTURE_PAD_HEADER and CAPTURE_PAD_SUBTITLE strings to copy-templates.ts

5. **Projects Overlay Header Clarity**
   — D:\Projects\GregLite\app\components\chat\ChatInterface.tsx (overlay section):
   - Current: Projects overlay opens but has no obvious close affordance visible on first glance
   - Fix: Overlay header bar should show "Projects" as h1-level text (not just the FolderKanban icon)
   - Close button (×): make it more visually prominent — larger, positioned top-right, with "Close" label
     visible on hover
   - Keyboard hint: small muted text "Esc to close" near the close button
   - Add PROJECTS_OVERLAY_TITLE and PROJECTS_CLOSE_HINT strings to copy-templates.ts

6. **Import Section verification** (post-Sprint 36):
   - Verify GET /api/import/sources, GET /api/import/watchfolder, POST /api/import/upload
     are all mounted in the sidecar routes (add to sidecar/src/routes/import.ts if Sprint 36
     missed this namespace — it may have since import routes were added in EPIC-81)
   - If missing: add import.ts router to sidecar and mount in server.ts
   - ImportSection.tsx in settings should show sources list and watchfolder config without errors

7. **TypeScript gate** — zero new tsc errors:
   - Run npx tsc --noEmit from D:\Projects\GregLite\app — must show 0 new errors
   - Run pnpm test:run — all 1753 tests must pass (UI component tests should not break)

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero new errors before commit.
- All user-facing copy goes through copy-templates.ts — no hardcoded strings in components.
- Settings tab groups are purely structural — do NOT move, rename, or modify any existing
  SettingsSection component internals. Only the container/navigation changes.
- The Quick Capture pad's core capture functionality must remain unchanged.
- Commit message: "feat: Sprint 37.0 — UX polish (icons, settings tabs, textarea, labels)"
- This sprint runs in parallel with Sprint 38.0 — do NOT touch ui-store.ts onboarding fields
  or OnboardingTour component (those belong to Sprint 38.0).

Project: D:\Projects\GregLite
Shell: Use cmd (not PowerShell) with cd /d D:\Projects\GregLite\app
Git: Full path D:\Program Files\Git\cmd\git.exe. Write commit message to COMMIT_MSG_TEMP.txt,
     then git commit -F COMMIT_MSG_TEMP.txt


═══════════════════════════════════════════════════════════════
SPRINT 38.0 — Onboarding Tour + First-Run Experience
Run after Sprint 36.0. Can run IN PARALLEL with Sprint 37.0.
First-time users understand what GregLite is and how to use it.
═══════════════════════════════════════════════════════════════

Execute Sprint 38.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\FEATURE_BACKLOG.md
  Filesystem:read_file D:\Projects\GregLite\app\lib\stores\ui-store.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\Header.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\chat\ChatInterface.tsx

Summary: GregLite currently ships with no guidance for new users. Features like the Inspector
drawer, Workers tab, War Room, Memory Shimmer, and Context Panel are invisible without
explanation. This sprint adds a step-by-step tooltip tour that fires on first launch, walks the
user through 8 key surfaces, and can be re-triggered from Settings. After this sprint, a brand
new user can orient themselves in under 2 minutes without reading documentation.

Tasks:

1. **Tour state in ui-store** — D:\Projects\GregLite\app\lib\stores\ui-store.ts:
   - Add to UIState: tourCompleted: boolean (default false), tourStep: number (default 0),
     tourActive: boolean (default false)
   - Add actions: startTour(), advanceTour(), skipTour(), completeTour(), resetTour()
   - startTour(): sets tourActive true, tourStep 0
   - advanceTour(): increments tourStep; if step >= total steps, calls completeTour()
   - completeTour(): sets tourCompleted true, tourActive false, persists to partialize
   - resetTour(): sets tourCompleted false (for Settings "Restart tour" button)
   - tourCompleted persisted in zustand partialize (survives restarts)
   - tourActive + tourStep are session-only (not persisted)

2. **Tour step definitions** — D:\Projects\GregLite\app\lib\tour\steps.ts:
   - TourStep type: { id: string, target: string (CSS selector), title: string, body: string,
     position: 'top' | 'bottom' | 'left' | 'right', spotlightPadding?: number }
   - Export TOUR_STEPS: TourStep[] — 8 steps:
     Step 1: target ".chat-input-area" — "Start a conversation"
       Body: "Type anything here. GregLite connects to Claude and streams a response."
     Step 2: target "[data-tour='memory-shimmer']" — "Memory highlights"
       Body: "As you type, words matching your saved memory glow cyan. Click one to see the source."
     Step 3: target "[data-tour='context-panel']" — "Context panel"
       Body: "Your active project, recent conversations, and background assistant suggestions live here."
     Step 4: target "[data-tour='workers-tab']" — "Workers"
       Body: "Autonomous agent jobs run here. GregLite can execute tasks in the background while you work."
     Step 5: target "[data-tour='war-room-tab']" — "War Room"
       Body: "See all active jobs and their dependencies as a live graph."
     Step 6: target "[data-tour='inspector-drawer']" — "Inspector"
       Body: "Cmd+I opens the inspector. Memory, quality scores, costs, jobs, and learning insights."
     Step 7: target "[data-tour='status-bar']" — "Status bar"
       Body: "Live cost, job count, system health, and background assistant status. Click any chip for details."
     Step 8: target "[data-tour='settings-gear']" — "You're ready"
       Body: "Settings live here. You can restart this tour anytime from Settings → Advanced."
   - All copy strings sourced from TOUR export in copy-templates.ts (add them in Task 3)

3. **Tour copy strings** — D:\Projects\GregLite\app\lib\voice\copy-templates.ts:
   - Add TOUR export with all 8 step titles, bodies, and UI strings:
     TOUR.start_button: "Show me around"
     TOUR.skip_button: "Skip tour"
     TOUR.next_button: "Next"
     TOUR.finish_button: "Got it"
     TOUR.step_counter: (step: number, total: number) => step \${step} of \${total}
     TOUR.restart_label: "Restart tour"
     TOUR.restart_description: "Walk through the onboarding tour again."
     Plus all 8 step titles and bodies (pull from step definitions above)

4. **TourTooltip component** — D:\Projects\GregLite\app\components\tour\TourTooltip.tsx:
   - Renders a floating tooltip anchored to the target element via getBoundingClientRect
   - Spotlight: semi-transparent dark overlay (rgba 0,0,0,0.6) over entire page EXCEPT
     a highlighted cutout around the target element (box-shadow: 0 0 0 9999px rgba(0,0,0,0.6))
   - Tooltip card: positioned above/below/left/right of target per step.position
     Dark background (var(--bg-elevated)), 1px cyan border, 16px padding, 300px max-width
   - Content: small step counter (muted), bold title, body text, action row
   - Action row: "Skip tour" ghost button (left), "Next" / "Got it" primary button (right)
   - Arrow pointer connecting card to target element
   - Framer Motion: popoverVariants (scale 0.95 → 1, opacity 0 → 1, 200ms)
   - If target element not found in DOM: skip to next step automatically (graceful degradation)
   - Keyboard: Escape = skip tour, ArrowRight / Enter = advance

5. **TourOrchestrator component** — D:\Projects\GregLite\app\components\tour\TourOrchestrator.tsx:
   - Client component, rendered at root layout level
   - Reads tourActive, tourStep, tourCompleted from ui-store
   - On mount: if !tourCompleted, wait 1500ms after first render, then show WelcomeModal (Task 6)
   - When tourActive: renders TourTooltip for TOUR_STEPS[tourStep]
   - Handles target element lookup, position calculation, scroll-into-view
   - AnimatePresence wraps TourTooltip for mount/unmount animation
   - When tourCompleted or tourActive false: renders nothing (null)

6. **WelcomeModal component** — D:\Projects\GregLite\app\components\tour\WelcomeModal.tsx:
   - Modal shown on very first launch (tourCompleted === false)
   - Content: Gregore Lite logo, "Welcome to GregLite", one-line tagline
     Tagline: "Your cognitive operating system. Powered by Claude."
   - Two buttons: "Show me around" (primary → calls startTour()) and "I'll explore myself" (ghost → calls completeTour())
   - Framer Motion: modalVariants (scale 0.95 → 1, opacity 0 → 1)
   - Backdrop: semi-transparent overlay, click to dismiss (calls completeTour())
   - All copy sourced from TOUR strings in copy-templates.ts

7. **Wire tour into root layout** — D:\Projects\GregLite\app\app\layout.tsx:
   - Import and render <TourOrchestrator /> inside the client layout
   - TourOrchestrator must be after all other providers (reads zustand store)

8. **Add data-tour attributes** to target elements:
   - app/components/ui/StatusBar.tsx: add data-tour="status-bar" to the root div
   - app/components/chat/ChatInterface.tsx: add data-tour="workers-tab" to Workers tab button,
     data-tour="war-room-tab" to War Room tab button
   - app/components/inspector/InspectorDrawer.tsx: add data-tour="inspector-drawer" to trigger button
   - app/components/context/ContextPanel.tsx: add data-tour="context-panel" to root div
   - app/components/chat/InputField.tsx: verify chat-input-area class exists on wrapper
   - Note: memory shimmer target [data-tour='memory-shimmer'] — add to ShimmerOverlay.tsx wrapper

9. **Settings: Restart Tour button** — D:\Projects\GregLite\app\components\settings\SettingsPanel.tsx
   or whichever Advanced tab section is created in Sprint 37.0:
   - Add a "Restart tour" row with the TOUR.restart_label and TOUR.restart_description copy
   - Button calls resetTour() from ui-store then startTour() with a 300ms delay
   - Place in Advanced tab (from Sprint 37.0 settings restructure) or bottom of any tab if 37.0 not complete

10. **TypeScript gate** — zero new tsc errors:
    - Run npx tsc --noEmit from D:\Projects\GregLite\app — must show 0 new errors
    - Run pnpm test:run — all 1753 tests must pass
    - Add tests: D:\Projects\GregLite\app\lib\__tests__\unit\tour\tour-steps.test.ts
      * TOUR_STEPS has exactly 8 steps
      * Each step has id, target, title, body, position
      * All positions are valid ('top'|'bottom'|'left'|'right')
      * No two steps share the same target selector
      * All copy strings reference TOUR export (not hardcoded)

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero new errors before commit.
- ALL user-facing strings in TOUR copy-templates export — nothing hardcoded in components.
- The tour must NEVER block app functionality. If any step target is missing, skip it silently.
- tourCompleted persists — once dismissed it never re-fires without user explicitly resetting.
- This sprint runs IN PARALLEL with Sprint 37.0. Do NOT touch:
  * SettingsPanel.tsx tab structure (Sprint 37.0 owns that)
  * Header.tsx button labels (Sprint 37.0 owns that)
  * InputField.tsx list continuation logic (Sprint 37.0 owns that)
  * tauri.conf.json (Sprint 37.0 owns that)
  The ONLY shared file is copy-templates.ts — add the TOUR export at the END of the file
  to minimize merge conflict surface. If Sprint 37.0 has already added copy strings,
  append the TOUR export after them.
- Commit message: "feat: Sprint 38.0 — onboarding tour + first-run welcome modal"

Project: D:\Projects\GregLite
Shell: Use cmd (not PowerShell) with cd /d D:\Projects\GregLite\app
Git: Full path D:\Program Files\Git\cmd\git.exe. Write commit message to COMMIT_MSG_TEMP.txt,
     then git commit -F COMMIT_MSG_TEMP.txt

