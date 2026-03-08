═══════════════════════════════════════════════════════════════
SPRINT 24.0 — Portfolio Dashboard: Scanner + Read-Only UI
Run FIRST. No dependencies. Delivers the multi-project command center.
═══════════════════════════════════════════════════════════════

Execute Sprint 24.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Dev\TECHNICAL_STANDARDS.md
  Filesystem:read_file D:\Projects\GregLite\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\docs\PORTFOLIO_SPEC.md (CRITICAL — full feature spec)
  Filesystem:read_file D:\Dev\WORKSPACES.yaml (existing project registry — scanner reads this)
  Filesystem:read_file D:\Projects\GregLite\app\components\chat\ChatInterface.tsx (tab integration)
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\database.ts (SQLite migration pattern)
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts (voice guide — all new UI copy goes here)
  Filesystem:read_file D:\Projects\GregLite\app\app\globals.css (responsive breakpoints from Sprint 23)

Summary: Build the Portfolio Dashboard — a new "Projects" tab in GregLite that scans all registered workspaces, reads their PROJECT_DNA.yaml and STATUS.md files, and presents a single-screen overview of every project the user manages. Cards show name, type, phase, last activity, health signal, and what's next. Clicking a card opens a detail panel. 30-second background refresh with instant render from SQLite cache. This sprint delivers read-only visibility. Sprint 25 adds the "Add Existing Project" onboarding flow, Sprint 26 adds "Create New Project" scaffolding and attention intelligence.

Tasks:

1. **SQLite schema** — `lib/kernl/database.ts`:
   - Add three new tables to the migration block (same try/catch pattern as Sprint 22):
     * `portfolio_projects` (id TEXT PK, name, path UNIQUE, type, type_label, status, registered_at, last_scanned_at, scan_data TEXT)
     * `portfolio_telemetry` (id INTEGER PK AUTOINCREMENT, project_type, custom_type_label, questions_asked, metrics_configured, template_used, migration_vs_new, onboarding_duration_seconds, created_at)
     * `portfolio_archives` (id TEXT PK, project_id FK, original_path, archive_path, archived_at, verified_by_user DEFAULT 0, deleted_at)
   - Use CREATE TABLE IF NOT EXISTS (not ALTER TABLE) — these are new tables.

2. **Type definitions** — `lib/portfolio/types.ts`:
   - `ProjectType = 'code' | 'research' | 'business' | 'creative' | 'custom'`
   - `ProjectHealth = 'green' | 'amber' | 'red'`
   - `ProjectCard` interface: id, name, path, type, typeLabel, status, version, phase, lastActivity (ISO string), health, healthReason, nextAction, testCount?, testPassing?, tscErrors?, customMetrics (Record<string, string | number>)
   - `ScanResult` interface: raw data from scanning a single project's files
   - `PortfolioProject` interface matching the SQLite row shape

3. **Scanner** — `lib/portfolio/scanner.ts`:
   - `scanAllProjects()`: reads D:\Dev\WORKSPACES.yaml, iterates all workspaces with status !== 'archived', for each:
     * Reads `PROJECT_DNA.yaml` from the workspace path (if exists)
     * Reads first 20 lines of `STATUS.md` (if exists) to extract version, phase, test count, next sprint
     * Extracts `type` from DNA (default 'code' if has package.json, 'custom' otherwise)
     * Runs `git log -1 --format=%cI` async to get last commit date (non-blocking, fills in later)
     * Calculates health: green (<7 days active), amber (7-14 days), red (>14 days or blockers)
     * Returns array of `ProjectCard` objects
   - `scanSingleProject(path: string)`: same logic for one project
   - All file reads wrapped in try/catch — missing files degrade gracefully (show "No status file" not crash)
   - Total scan time budget: <200ms for 20 projects (file I/O only, no heavy computation)
   - IMPORTANT: Use `fs.readFileSync` for the scan (server-side only, runs in API route context). Do NOT use Tauri filesystem commands — this is Node.js.

4. **Scanner background loop** — `lib/portfolio/scanner.ts`:
   - `startPortfolioScanner()` / `stopPortfolioScanner()`: 30-second interval that calls `scanAllProjects()` and writes results to SQLite `portfolio_projects` table
   - Idempotent start (multiple calls don't create multiple intervals)
   - Wire into bootstrap sequence (after AEGIS init, non-blocking)
   - On first run, also seed the `portfolio_projects` table from WORKSPACES.yaml entries (INSERT OR IGNORE)

5. **API routes** — `app/api/portfolio/`:
   - `GET /api/portfolio` — returns all projects from SQLite cache (scan_data parsed from JSON). Triggers a rescan if `last_scanned_at` is older than 60 seconds (lazy refresh).
   - `GET /api/portfolio/[id]` — returns single project with full scan_data
   - `POST /api/portfolio/scan` — triggers immediate rescan of all projects, returns updated data
   - `POST /api/portfolio` — register a new project by path (simplified for Sprint 24 — no Q&A, just register + scan DNA if it exists)

6. **Portfolio Dashboard component** — `components/portfolio/PortfolioDashboard.tsx`:
   - Fetches from `/api/portfolio` on mount and every 30 seconds
   - Renders a responsive grid of ProjectCard components
   - Empty state: "No projects here yet." with "Add Project" button (Sprint 24 version: just a path input + register)
   - Loading state: skeleton cards
   - Error state: Greg's voice error message

7. **ProjectCard component** — `components/portfolio/ProjectCard.tsx`:
   - Card shows: name, type badge (colored pill), phase (1 line), last activity (relative time: "2h ago", "3 days ago"), health dot (green/amber/red), what's next (1 line, truncated)
   - Type badge colors: code=cyan, research=purple, business=amber, creative=green, custom=gray
   - Health dot with tooltip explaining why (e.g., "Active — last commit 2 hours ago" or "Stale — no activity in 12 days")
   - Click fires `onSelect(projectId)` — parent handles opening detail panel
   - Hover: subtle lift animation using cardLift from lib/design/animations.ts
   - Responsive: 3-column grid at full width, 2 at <1024px, 1 at <768px

8. **ProjectDetail component** — `components/portfolio/ProjectDetail.tsx`:
   - Slide-in panel from right (same animation pattern as InspectorDrawer)
   - Shows: full project name, path, type, version, phase, all metrics (type-aware), full "next" text, health assessment with explanation
   - "Start Working" button: dispatches `window.dispatchEvent(new CustomEvent('greglite:set-project', { detail: { projectId, path, name } }))` — the Strategic tab can listen for this to set session context
   - "Refresh" button: calls POST /api/portfolio/scan
   - Close button + Escape key to dismiss
   - Scrollable content area for long STATUS.md excerpts

9. **Tab integration** — `components/chat/ChatInterface.tsx`:
   - Add new tab to TABS array: `{ id: 'portfolio', label: 'Projects', icon: /* FolderKanban from lucide-react */ }`
   - Position: FIRST tab (leftmost, before Strategic)
   - When `activeTab === 'portfolio'`, render `<PortfolioDashboard />` instead of the chat interface
   - The Portfolio tab does NOT show the InputField, SendButton, or message list — it's a standalone dashboard view

10. **Voice copy** — `lib/voice/copy-templates.ts`:
    - Add `portfolio` section with all dashboard strings:
      * empty state text
      * health explanations (green/amber/red)
      * type labels
      * loading/error messages
      * "Start Working" button text
      * relative time formatting labels
    - All copy follows Greg's voice: deadpan professional, no exclamation marks, data-forward

11. **Seed from WORKSPACES.yaml** — `lib/portfolio/scanner.ts`:
    - On first scan (portfolio_projects table is empty), auto-seed from D:\Dev\WORKSPACES.yaml
    - Map each workspace entry to a portfolio_projects row:
      * id: workspace key from YAML (e.g., "kernl", "gregore", "greglite")
      * name: from YAML `name` field
      * path: from YAML `path` field
      * type: 'code' for infrastructure/product types, 'custom' for others
      * status: map YAML status to portfolio status (active/shelved/archived -> active/paused/archived)
    - Also register GregLite itself (D:\Projects\GregLite) and COVOS/GHM (D:\Work\SEO-Services\ghm-dashboard) since those are David's active projects but may not be in WORKSPACES.yaml

12. **TypeScript Gate + Test Suite** — zero new errors, all tests green:
    - `npx tsc --noEmit` from `app/` directory: 0 errors
    - `pnpm test:run` from `app/` directory: 1344+ tests passing
    - Add at least: scanner unit tests (mock fs reads, verify ProjectCard output), health calculation tests

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- All new UI copy goes through lib/voice/copy-templates.ts — no hardcoded strings.
- KERNL SQLite database — new tables via CREATE TABLE IF NOT EXISTS in the existing migration block.
- Ghost Thread must NEVER block the UI. Dev mode works WITHOUT Tauri watcher.
- The scanner runs in Node.js (API route context) — use `fs.readFileSync` / `child_process.execSync` for git. Do NOT use Tauri filesystem commands.
- WORKSPACES.yaml path is `D:\Dev\WORKSPACES.yaml` — hardcode as default, make configurable via settings later.
- Git operations for scanner (git log): wrap in try/catch, projects without .git just show "No version control" — never crash.
- The Portfolio tab is read-only in this sprint. No add/create/migrate flows — those are Sprint 25 and 26.
- The simplified "Add Project" in this sprint is just a text input for a path + a register button — no folder picker, no scan, no Q&A. That's Sprint 25.
- Responsive grid: 3 columns at full width, 2 at <1024px, 1 at <768px.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell)
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to temp file, then `git commit -F temp_msg.txt`.
