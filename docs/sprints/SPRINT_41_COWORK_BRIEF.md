═══════════════════════════════════════════════════════════════
SPRINT 41.0 — Projects & UX Polish
Run FIRST. No dependencies. All tasks independent within sprint.
Fixes 5 confirmed bugs + 3 best-practice additions from first real-world testing.
═══════════════════════════════════════════════════════════════

Execute Sprint 41.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\GregLite\app\components\tour\TourTooltip.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\tour\TourOrchestrator.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\portfolio\PortfolioDashboard.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\portfolio\ProjectCard.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\settings\SettingsPanel.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\StatusBar.tsx
  Filesystem:read_file D:\Projects\GregLite\app\app\api\portfolio\route.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\database.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\portfolio\types.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts

Summary: Eight targeted fixes and improvements discovered during first real-world dev session.
Five are confirmed bugs (tour closes on Next click, duplicate projects, no project management
surface, Settings modal off-screen in small/split windows, StatusBar expand/collapse misaligned).
Three are best-practice additions (project search/filter, richer card snapshot detail, tour
progress dots). No new infrastructure — all fixes are in existing components and DB migrations.

Tasks:

1. **Tour click-shield fix** — app/components/tour/TourTooltip.tsx:
   - ROOT CAUSE: The full-page click-shield div (zIndex 8999, onClick={onSkip}) sits behind
     the tooltip card but in front of everything else. Any click — including the "Next" button —
     triggers a bubbling mouseup event that the shield intercepts, calling onSkip instead of onNext.
   - FIX: Remove the full-page click-shield div entirely. It serves no valid UX purpose — the
     tour is not dismissable by backdrop click (it requires an explicit Skip or Next action).
     The Escape key handler already covers keyboard dismissal.
   - Verify the spotlight overlay div retains pointerEvents: none — it should never intercept clicks.
   - After fix: clicking "Next" advances the tour. Clicking outside the tooltip card does nothing.
     Escape still skips. Behavior is deterministic and non-hostile.
   - Add tour progress dots below the step counter: a row of 10 small circles (filled = completed,
     current = cyan filled + glow, future = mist outline). Replaces the plain "STEP X OF 10" text
     which is too easy to miss. Keep the text counter too — dots are supplemental.

2. **Project deduplication — DB migration + API hardening** — app/lib/kernl/database.ts + app/app/api/portfolio/route.ts:
   - ROOT CAUSE: The Sprint 39.0 early-init block creates portfolio_projects WITHOUT a UNIQUE
     constraint on path. The Sprint 24.0 block (which has UNIQUE) never runs on existing DBs
     because CREATE TABLE IF NOT EXISTS is a no-op once the table exists. Result: the UNIQUE
     constraint is absent on any DB initialized since Sprint 39.0. Confirmed by schema inspection.
   - FIX part A — database.ts: Add a new migration block that attempts to add the UNIQUE
     constraint retroactively via index:
       CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_projects_path_unique
         ON portfolio_projects(path);
     If this fails because of existing duplicate paths, run a dedup pass first:
       DELETE FROM portfolio_projects WHERE rowid NOT IN (
         SELECT MIN(rowid) FROM portfolio_projects GROUP BY path
       );
     Then create the index. Wrap in try/catch, log on success.
   - FIX part B — route.ts POST handler: Before INSERT, normalise the incoming path
     (strip trailing slashes). Check for existing row by normalised path first:
       SELECT id FROM portfolio_projects WHERE lower(path) = lower(?)
     If found, return the existing record instead of attempting insert. This catches
     path-casing duplicates that the UNIQUE index (case-sensitive) won't prevent.
   - FIX part C — scanner: When seedFromWorkspaces() and scanAllProjects() register projects,
     apply the same path-normalisation + existence check before each INSERT.
     Read the scanner file first: Filesystem:read_file D:\Projects\GregLite\app\lib\portfolio\scanner.ts

3. **Project exclusions** — app/lib/kernl/database.ts + app/app/api/portfolio/[id]/route.ts + app/components/portfolio/PortfolioDashboard.tsx:
   - Add new table in database.ts migrations:
       CREATE TABLE IF NOT EXISTS portfolio_exclusions (
         path         TEXT PRIMARY KEY,
         excluded_at  INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000),
         reason       TEXT
       );
   - Add DELETE endpoint to app/app/api/portfolio/[id]/route.ts:
       DELETE /api/portfolio/:id
       Body: { exclude: boolean }
       If exclude=true: INSERT OR IGNORE INTO portfolio_exclusions (path, reason) VALUES (?, 'user_removed')
       Always: DELETE FROM portfolio_projects WHERE id = ?
       Returns: { success: true }
   - In scanner.ts: before registering any project, check
       SELECT 1 FROM portfolio_exclusions WHERE lower(path) = lower(?)
     Skip if found.
   - In PortfolioDashboard.tsx: add remove action to ProjectDetail panel (see Task 4).
     Show confirmation: "Remove [Project Name]?" with two buttons:
       [Remove] — deletes from registry, will be re-added on next scan
       [Remove & Don't rescan] — deletes + adds to exclusions, never re-added
     After either action: refetch projects list, close ProjectDetail.

4. **Project management: rename, type override, sort, search/filter** — app/components/portfolio/PortfolioDashboard.tsx + app/app/api/portfolio/[id]/route.ts:
   - Add PATCH /api/portfolio/:id:
       Body: { name?: string, type?: ProjectType, status?: ProjectStatus }
       UPDATE portfolio_projects SET name=COALESCE(?,name), type=COALESCE(?,type),
         status=COALESCE(?,status), updated_at=? WHERE id=?
       Returns: { success: true }
   - In PortfolioDashboard.tsx, add a toolbar row below the existing header bar:
       Left: Search input (placeholder "Filter projects...") — text filter over name + path.
         Applied client-side on projects array. Debounced 150ms. Clear (×) button when active.
       Right: Sort dropdown — options: Last Activity (default), Name A–Z, Health, Type, Attention.
         Sort state in local component state (resets on unmount — no persistence needed).
   - Sort implementations:
       Last Activity: descending on project.lastActivity (null = sorted last)
       Name: case-insensitive alphabetical on project.name
       Health: red → amber → green
       Type: code → business → research → creative → custom
       Attention: high → medium → low → none (uses attentionMap from existing attention queue)
   - In ProjectDetail slide-in: add Edit section with:
       Name: text input, pre-filled with project.name. Save on blur or Enter.
       Type: dropdown using ProjectType values with colored pills matching TypeBadge colors.
       Save button: calls PATCH endpoint. On success: update local state, show "Saved ✓" for 2s.
       Remove button (destructive, red): triggers confirmation dialog from Task 3.

5. **ProjectCard snapshot detail enhancement** — app/components/portfolio/ProjectCard.tsx:
   - scan_data already maps to ProjectCard fields: testCount, testPassing, tscErrors, version.
     These exist in types.ts but are not rendered on the card. Surface them.
   - Add metrics strip (Row 5) when any metric is non-null. Show up to 3 chips:
       version: mist pill "v{version}"
       tests: green "✓ {testPassing}/{testCount}" or red "✗ {failed} failing"
       tsc: green "TSC ✓" or red "TSC {tscErrors} err"
     Chip style: 10px text, rounded-sm, inline-flex, gap-6. Max 3 chips, truncate if more.
   - If scan_data is null (never scanned): show single "Not yet scanned" row + small inline
     "Scan now" text link that POSTs to /api/portfolio/scan with { projectId: id }.
     On click: show "Scanning…" text, refetch projects after 3s.
   - Staleness indicator: if last_scanned_at is older than 24h and scan_data exists, show
     a subtle amber dot beside the health dot. Tooltip: "Last scanned X hours ago — click to refresh".
     Clicking the amber dot triggers single-project rescan (same as "Scan now" above).

6. **Settings modal: draggable + small-window safe** — app/components/settings/SettingsPanel.tsx:
   - ROOT CAUSE: position:fixed + 50%/50% + translate(-50%,-50%) positions relative to viewport
     center. In a split-screen Tauri window narrower than ~800px, the 80vw modal clips against
     the viewport edge with no user recourse — no drag, no scroll, no resize.
   - FIX A — Safe sizing: add floor constraints to prevent unusable small states:
       minWidth: 560, minHeight: 400 (in addition to existing 80vw/1000px and 85vh/700px)
   - FIX B — Draggable: add Framer Motion drag to the modal div.
       dragConstraints: use a ref on the backdrop div to constrain within viewport bounds.
       dragMomentum: false (no sliding inertia after release).
       dragElastic: 0 (hard constraint, no rubber-band past edges).
       cursor: 'grab' on the modal header bar only (not the whole modal).
       cursor: 'grabbing' applied via onDragStart/onDragEnd handlers.
       Drag position resets on close (modal unmounts, state clears via AnimatePresence).
   - FIX C — Position guard: before initial render, check window.innerWidth. If viewport
     is narrower than the modal's minWidth + 40px margin, render modal at left:20px instead
     of 50% centering. Prevents off-screen initial position entirely.
   - Escape key and ✕ button unchanged.

7. **StatusBar expand/collapse alignment fix** — app/components/ui/StatusBar.tsx:
   - ROOT CAUSE: Collapsed state = full-width centered "▲  System Status" button.
     Expanded state = right-justified ChevronDown button. Cursor must travel far between them.
   - FIX: Both states must have their primary control in the same right-side position.
   - Collapsed state redesign:
       Keep the 20px strip height.
       Left side: faint "SYSTEM STATUS" text label (mist color, non-interactive, pointer-events none).
       Right side: small ChevronUp icon button, identical size/position to the expanded ChevronDown.
       Entire strip remains clickable as fallback (onClick={toggleStatusBar} on the strip wrapper).
       The right-side chevron is the canonical target — cursor moves ≤2px between collapse/expand.
   - Expanded state: no changes to existing layout or ChevronDown position.
   - Use ChevronUp from lucide-react for the collapsed chevron (already imported in many components —
     check if already imported in StatusBar.tsx; if not, add it).

8. **TypeScript Gate** — zero new errors:
   - Run: cd /d D:\Projects\GregLite\app && pnpm type-check
   - Fix all errors before commit. No @ts-ignore or @ts-expect-error suppressions.
   - Likely new type work needed:
       portfolio_exclusions table → ExclusionRecord interface in types.ts
       PATCH /api/portfolio/:id → PatchProjectBody type
       DELETE /api/portfolio/:id → DeleteProjectBody type
       New ProjectCard fields used in metrics strip → verify they exist in types.ts already
   - After gate passes: sync docs then commit.
       Update D:\Projects\GregLite\STATUS.md: close Sprint 41.0 tasks, update Last Updated header.
       git add -A
       Write commit message to temp_commit_msg.txt:
         feat: Sprint 41.0 - tour fix, project dedup+management, settings drag, statusbar alignment
       git -C D:\Projects\GregLite\app commit -F temp_commit_msg.txt
       git -C D:\Projects\GregLite\app push

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit — no exceptions.
- All DB changes are ADDITIVE. Never DROP or ALTER existing columns.
  Exception: the dedup DELETE in Task 2 removes duplicate rows — this is data cleanup, not schema change.
- portfolio_exclusions is a new table — CREATE TABLE IF NOT EXISTS only.
- Dedup migration order: DELETE duplicates FIRST, then CREATE UNIQUE INDEX.
  Attempting the index before dedup will fail if duplicates exist.
- Sacred Laws are NON-NEGOTIABLE. Read D:\Projects\Gregore\SACRED_LAWS.md before any UX changes.
- Ghost Thread must NEVER block the UI.
- Dev port is 37171 (updated from 3000 in pre-sprint work). Do not reference port 3000.
- Git operations require full path: D:\Program Files\Git\cmd\git.exe
- Commit messages via temp file — em-dashes and special chars break cmd echo:
    Write message to temp_commit_msg.txt
    Then: git commit -F temp_commit_msg.txt
- "Sync, commit, and push" always means: STATUS.md docs update FIRST, then git. Never git first.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell). cd /d D:\Projects\GregLite\app
Git: D:\Program Files\Git\cmd\git.exe
