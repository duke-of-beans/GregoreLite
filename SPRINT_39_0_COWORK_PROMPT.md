═══════════════════════════════════════════════════════════════
SPRINT 39.0 — UX Overhaul: Onboarding, Tour, Navigation & Discoverability
Run FIRST. Independent of all other active sprints.
Fixes 8 UX issues: transparent drawer, missing DB table, cramped settings, broken tour, hidden status bar, no inline help, no import wizard, technical copy.
═══════════════════════════════════════════════════════════════

Execute Sprint 39.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Projects\GregLite\SPRINT_39_0_BRIEF.md
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\tour\steps.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\cross-context\ContextLibrary.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\settings\SettingsPanel.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\StatusBar.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\tour\TourOrchestrator.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\tour\TourTooltip.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\tour\WelcomeModal.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\onboarding\OnboardingFlow.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\HelpGuide.tsx
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\database.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\chat\InputField.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\Header.tsx

Summary: GregLite launches correctly but is not approachable for new users. This sprint fixes 8 concrete UX issues: a transparent drawer bug, a missing database table that crashes the Projects panel, a cramped 400px settings drawer converted to a full-window modal, a broken tour with non-existent CSS selectors, a nearly invisible status bar collapse affordance, no inline contextual help throughout the app, no import wizard in onboarding, and technical jargon throughout the copy that non-technical users won't understand. After this sprint GregLite is discoverable, navigable, and guiding users through what it does and why it matters.

Tasks:

1. **Fix ContextLibrary transparent drawer** — app/components/cross-context/ContextLibrary.tsx:
   - Replace `background: 'var(--bg)'` with `background: 'var(--deep-space)'` in drawerStyle
   - Replace header background (if any) with `'var(--elevated)'`
   - Add a subtitle line under "CONTEXT LIBRARY" heading: "Suggestions you've dismissed. Restore any item to bring it back into your active suggestion feed."
   - Rename the header label from "CONTEXT LIBRARY" to "SUGGESTION ARCHIVE" (aligns with Task 8 copy audit)
   - Rename "suppressed suggestions" → "archived suggestions" in the item count subtitle
   - Rename the "Un-suppress" button to "Restore"

2. **Fix portfolio_projects missing table** — app/lib/kernl/database.ts:
   - Add a CREATE TABLE IF NOT EXISTS block for `portfolio_projects` in the runMigrations() function (or wherever the schema is initialized — read the file to find the pattern)
   - Schema: id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, path TEXT, status TEXT DEFAULT 'active', created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch())
   - This is purely additive — existing databases just gain the table on next startup
   - Also check app/app/api/portfolio/route.ts — if it references a separate db connection or a table named differently, align it to use KERNL's getDatabase() and the new table name
   - After adding, also check app/components/context/ProjectSection.tsx — it calls /api/projects not /api/portfolio. The /api/projects route calls listProjects() from KERNL. Verify that listProjects() reads from the `projects` table (not portfolio_projects). If the Projects panel error is coming from portfolio components (PortfolioDashboard, ProjectDetail etc.) then the fix is in their API routes. If it's from the context panel's /api/projects → listProjects() path, it's a different table. Read database.ts carefully to find which table is missing.

3. **Settings: convert to full-window modal** — app/components/settings/SettingsPanel.tsx:
   - Replace the 400px right drawer with a centered overlay modal: width 80vw, max-width 1000px, height 85vh, max-height 700px, centered with top: 50% / left: 50% / transform translate(-50%, -50%)
   - Layout: two-column — 180px left sidebar with tab nav + flex-1 right content area
   - Left sidebar: vertical list of tab buttons, one per tab, with icons (use lucide-react)
     - 🎨 Appearance
     - 🧠 Memory & Background  (was memory_ghost)
     - 💰 Budget & Quality
     - 🚀 Startup & Sync
     - ⚙ Advanced
   - Active tab: left border accent in cyan + light cyan background tint
   - Right content: scrollable, same sections as before — no changes to section components themselves
   - Header: "Settings" title top-left, × close button top-right, thin bottom border
   - Backdrop: same rgba(0,0,0,0.5) click-to-close
   - Framer Motion: scale 0.96 → 1.0, opacity 0 → 1, duration 0.2s (same pattern as WelcomeModal)
   - Escape key still closes
   - Tab state still persisted via UIStore

4. **Status bar collapsed state: visible re-expand** — app/components/ui/StatusBar.tsx:
   - When statusBarCollapsed is true, render a 20px tall full-width bar (not 6px h-1.5 strip)
   - Contents: centered text "▲  System Status" in 10px mist color
   - Left side: thin top border in `var(--cyan)` at 40% opacity
   - Full-width cursor-pointer, hover brightens the text and border
   - Title/aria-label: "Click to expand system status bar"
   - This replaces the current nearly-invisible h-1.5 strip

5. **Fix tour broken selectors + expand tour** — app/lib/tour/steps.ts + affected components:
   - Read InputField.tsx to find the actual class on the textarea/input — add data-tour="chat-input" to that element
   - Read Header.tsx to find the Workers and War Room tab buttons — add data-tour="workers-tab" and data-tour="war-room-tab" to those elements
   - Find where the ShimmerOverlay or memory shimmer indicator renders — add data-tour="memory-shimmer" to that element
   - Verify data-tour="context-panel", data-tour="inspector-drawer", data-tour="status-bar", data-tour="settings-gear" are present on their targets — add if missing
   - Update TOUR_STEPS in steps.ts with corrected selectors
   - Expand to 10 steps total (add: Context Panel collapse button, New Conversation button, Capture Pad)
   - All step copy must use zero technical jargon: no "KERNL", no "AEGIS", no "EoS", no "Sprint"
   - Example copy style: "Your conversation starts here. Type anything — a question, a task, a thought. GregLite remembers everything you discuss." (not "Chat input field for sending messages to the LLM")

6. **Inline contextual help: HelpPopover component** — app/components/ui/HelpPopover.tsx (new file):
   - Create a reusable HelpPopover component: a small `?` button that opens an anchored popover on click
   - Props: content (string), title (optional string), placement ('top'|'bottom'|'left'|'right', default 'bottom')
   - Style: 240px wide, dark bg var(--elevated), 1px cyan border, 8px border-radius, 12px padding
   - The `?` button: 14px × 14px, circular, border 1px solid var(--shadow), text-[10px], color var(--mist), hover border-cyan hover text-cyan
   - Dismiss: click outside or press Escape
   - Add the HelpPopover to these locations (import and place next to the section label):
     - ContextPanel: next to "Quality" section label
     - ContextPanel: next to "Project" section label  
     - ContextPanel: next to "BACKGROUND" in status bar (if space) OR add to StatusBar itself
     - SettingsPanel: next to each tab label in the new sidebar nav
   - Export from app/components/ui/index.ts

7. **Onboarding: add import/project step** — app/components/onboarding/OnboardingFlow.tsx + new app/components/onboarding/OnboardingStep5Import.tsx:
   - Add Step 5 between the AEGIS step and the Ready step
   - OnboardingStep5Import.tsx:
     - Title: "Connect your work" with subtitle "This step is optional — skip anytime"
     - Section A: "Add a project folder" — a text input for a folder path (or if Tauri dialog is available, a "Browse" button using Tauri's dialog plugin). On submit, calls POST /api/projects with { name, path }. On success shows ✓ green checkmark + project name.
     - Section B: "Import past conversations" — a paragraph explaining: "GregLite can learn from your Claude.ai, Claude Desktop, or ChatGPT conversation history. Export your conversations from those apps and import them here." with a button "Open Import Settings" that fires window.dispatchEvent(new CustomEvent('greglite:open-settings', { detail: { section: 'memory' } })) and calls onNext() to complete the step.
     - "Skip for now →" link button at the bottom — calls onNext() directly
   - Wire step 5 into OnboardingFlow.tsx between step 3 and step 4 (the Ready step), incrementing step numbers accordingly
   - The Ready step should display the project name if one was added in step 5

8. **Copy audit: layman-friendly language** — app/lib/voice/copy-templates.ts:
   - Read the full file first to understand what's in it
   - Update SETTINGS_TABS values (the display labels, not the keys) to use the new friendly names defined in Task 3
   - Add a HELP_CONTENT object with entries for every HelpPopover from Task 6:
     {
       context_panel_project: { title: "Active Project", body: "The folder or codebase you're working on right now. GregLite uses this to focus its memory and suggestions on what's relevant to your current work." },
       context_panel_quality: { title: "Code Quality", body: "GregLite continuously scans your active project for common code issues — unused imports, missing error handling, and more. Click any issue to see details." },
       context_panel_background: { title: "Background Assistant", body: "Runs quietly in the background, watching your filesystem and email for context that might be relevant to your current work. It never sends anything — it only reads." },
       settings_appearance: { title: "Appearance", body: "Theme, font size, and layout preferences for the GregLite interface." },
       settings_memory: { title: "Memory & Background", body: "Control how GregLite remembers your conversations, what it watches in the background, and how to import history from other AI tools." },
       settings_budget: { title: "Budget & Quality", body: "Set daily spending limits on AI usage, configure code quality scanning thresholds, and view cost breakdowns." },
       settings_startup: { title: "Startup & Sync", body: "Configure whether GregLite launches at login and how it syncs your data." },
       settings_advanced: { title: "Advanced", body: "System resource management, API keys, keyboard capture settings, and tools for power users." }
     }
   - Update any remaining user-facing labels that still say "AEGIS", "KERNL", "EoS", "Ghost Thread" — replace with their Sprint 23 equivalents: System Monitor, Memory, Code Quality, Background Assistant

9. **TypeScript gate**:
   - Run: cd /d D:\Projects\GregLite\app && npx tsc --noEmit
   - Zero new TypeScript errors before commit

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- All new UI components go in app/components/ui/ (HelpPopover) or their relevant directory with barrel exports.
- KERNL SQLite database — schema changes are ADDITIVE only (CREATE TABLE IF NOT EXISTS). Never DROP or ALTER existing tables.
- Never modify the KERNL project-store.ts listProjects() function signature — only add the table to the migration.
- Ghost Thread must NEVER block the UI. Dev mode works WITHOUT Tauri watcher.
- Git operations require full path: D:\Program Files\Git\cmd\git.exe
- Commit messages via temp file (em-dashes break cmd).
- Do NOT touch any existing API routes or lib functions unless required to fix the portfolio_projects bug. All other tasks are UI/component layer only.
- The Settings modal conversion (Task 3) must not break the existing UIStore settingsActiveTab state — keep the same tab keys, only change display labels.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell) with cd /d D:\Projects\GregLite\app
Git: Full path D:\Program Files\Git\cmd\git.exe. Write commit message to D:\Projects\GregLite\app\temp_commit_msg.txt then git commit -F temp_commit_msg.txt
