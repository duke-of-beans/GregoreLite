═══════════════════════════════════════════════════════════════
SPRINT 25.0 — Portfolio: Add Existing Project + Intelligent Onboarding
Run after Sprint 24.0. Delivers the "bring your stuff in" experience.
═══════════════════════════════════════════════════════════════

Execute Sprint 25.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Dev\TECHNICAL_STANDARDS.md
  Filesystem:read_file D:\Projects\GregLite\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\docs\PORTFOLIO_SPEC.md (CRITICAL — full feature spec, especially sections 2.1, 2.2, 3.2)
  Filesystem:read_file D:\Projects\GregLite\app\lib\portfolio\scanner.ts (Sprint 24 scanner — build on top of it)
  Filesystem:read_file D:\Projects\GregLite\app\lib\portfolio\types.ts (Sprint 24 types)
  Filesystem:read_file D:\Projects\GregLite\app\components\portfolio\PortfolioDashboard.tsx (Sprint 24 dashboard)
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\database.ts (migration patterns)
  Filesystem:read_file D:\Projects\GregLite\GREGORE_AUDIT.md (Section 1 — Greg's voice for onboarding copy)

Summary: This sprint makes GregLite useful to someone who already has projects. The user points at a folder, Greg scans it, asks smart questions about what he finds (especially for non-code projects or unfamiliar types), generates a draft PROJECT_DNA.yaml, and lets the user approve before registering. For projects that need structural cleanup, Greg offers a safe parallel-copy migration with archived originals and a strict verified-deletion flow. The core principle: the user is the architect, Greg is the builder who asks good clarifying questions. This must NOT be intimidating to someone dragging existing work into the system for the first time.

IMPORTANT DESIGN PRINCIPLES (from architecture session with David):
- GregLite is NOT just for code. Research, business, creative, hardware, writing — any project with a lifecycle. Do not pigeonhole the UI or language toward web apps.
- The user's demo is smart and technically capable. If Greg encounters an unfamiliar project type, he should ask intelligent questions ("What are the inputs, outputs, and constraints?") rather than silently guessing wrong. This builds user confidence.
- NEVER touch the original files during migration. Parallel copy, archive the original, user verifies, user deletes old version through a strict mechanism.

Tasks:

1. **Directory scanner** — `lib/portfolio/migrate.ts`:
   - `scanDirectory(dirPath: string): Promise<DirectoryScanResult>` — scans a folder and returns a structured analysis:
     * `buildSystem`: detected build markers (package.json, Cargo.toml, pyproject.toml, go.mod, Makefile, CMakeLists.txt, Gemfile, pom.xml, build.gradle, .csproj — be thorough)
     * `versionControl`: .git detected, last commit date/message/branch if available
     * `documentation`: README.md, CHANGELOG.md, any TODO/STATUS/BACKLOG files found
     * `structure`: detected directories (src/, lib/, docs/, tests/, data/, etc.)
     * `fileDistribution`: map of extension → count (e.g., {".ts": 45, ".md": 12, ".py": 3})
     * `existingDna`: boolean — does PROJECT_DNA.yaml already exist?
     * `totalFiles`: number
     * `totalSizeBytes`: number
   - All file operations via Node.js `fs` (not Tauri). Wrap in try/catch — inaccessible dirs degrade gracefully.
   - Skip `node_modules`, `.git`, `__pycache__`, `.next`, `dist`, `build`, `target` directories during scan.

2. **Type inference** — `lib/portfolio/migrate.ts`:
   - `inferProjectType(scan: DirectoryScanResult): { type: ProjectType; confidence: 'high' | 'medium' | 'low'; reason: string }`:
     * `package.json` or `tsconfig.json` → code (high)
     * `Cargo.toml` → code (high)
     * `pyproject.toml` or `setup.py` → code (high)
     * Dominant `.md` + `.pdf` files, no build system → research (medium)
     * Dominant `.docx` + `.xlsx` files → business (medium)
     * Dominant image/video/audio files → creative (medium)
     * Mixed or unclear → custom (low) — triggers Q&A
   - When confidence is 'low' or 'medium', the onboarding flow should ask questions. When 'high', Greg presents his finding and asks for confirmation.

3. **Onboarding question flow** — `lib/portfolio/onboarding.ts`:
   - `OnboardingQuestion` type: { id: string, question: string, context?: string, options?: string[] }
   - `getOnboardingQuestions(scan: DirectoryScanResult, inferredType: InferResult): OnboardingQuestion[]`:
     * If high confidence code project: 1-2 confirming questions ("I found a TypeScript project with {N} source files and a test suite. Sound right?" + "Any specific metrics you want to track beyond the defaults?")
     * If medium confidence: 3-4 questions clarifying purpose and workflow
     * If low confidence / custom: 5 core questions:
       1. "What is this project actually for?"
       2. "What are the inputs you work with?"
       3. "What does 'done' look like?"
       4. "What are the constraints or deadlines?"
       5. "How do you know if it's going well or badly?"
   - `generateDnaFromAnswers(scan: DirectoryScanResult, answers: Record<string, string>): ProjectDnaYaml`:
     * Produces a complete PROJECT_DNA.yaml content string from scan results + user answers
     * Includes type, metrics fields appropriate to the type, identity, current_state, documents list
     * For custom types: metrics come from answers to questions 2 and 5

4. **Onboarding chat UI** — `components/portfolio/OnboardingChat.tsx`:
   - Conversational interface (NOT a form) — Greg asks questions one at a time in chat bubbles, user types answers.
   - Uses Greg's voice: deadpan professional, data-forward, no exclamation marks.
   - Shows the scan results summary at the top: "I scanned [folder name]. Here's what I found: {N} files, {dominant type}, {build system or 'no build system detected'}."
   - Questions appear one at a time. User answers, Greg acknowledges briefly and moves to next.
   - After final question, Greg shows the draft DNA: "Here's what I'd set up for this project:" with a formatted preview.
   - User can edit the draft (inline text edit or "Change this" interactions) before approving.
   - "Looks good" button confirms and proceeds to migration decision.
   - "Start over" link resets the flow.
   - All copy strings live in `lib/voice/copy-templates.ts` under a new `onboarding` section.

5. **Migration decision + parallel copy** — `lib/portfolio/migrate.ts`:
   - After DNA approval, Greg asks: "Do you want to manage this project in place, or create a clean copy with the standard structure?"
   - **In-place option**: Greg writes PROJECT_DNA.yaml, STATUS.md, and FEATURE_BACKLOG.md (or type-appropriate equivalents) directly into the existing directory. No files are moved or renamed. Minimal disruption.
   - **Copy option** — `migrateProject(sourcePath: string, destPath: string, dna: ProjectDnaYaml)`:
     * Creates destination directory
     * Copies entire source tree to destination (use `fs.cpSync` with recursive: true)
     * Writes DNA/STATUS/BACKLOG files into the copy
     * Renames original: `sourcePath` → `sourcePath_ARCHIVED_YYYY-MM-DD`
     * Creates a `portfolio_archives` row linking project to archive
     * Returns { success: boolean, archivePath: string, newPath: string }
   - **Dependency mapping warning** (copy option only): Before copying, scan for:
     * Absolute path references in config files (package.json scripts, .env, tsconfig paths)
     * Symlinks that may break
     * Large directories (>1GB) — warn about disk space
     * Display warnings to user: "Found {N} absolute path references that may need updating after migration"
   - User must acknowledge warnings before proceeding.

6. **Safe archive deletion** — `components/portfolio/ArchiveManager.tsx` + `app/api/portfolio/archive/route.ts`:
   - Settings or detail panel shows archived projects with status: "Archived — awaiting verification"
   - "Mark as verified" button: user confirms the migrated copy works. Updates `portfolio_archives.verified_by_user = 1`.
   - "Delete archive" button (only visible after verified): triggers strict deletion flow:
     * Modal with red warning styling
     * Text: "This will permanently delete the archived version of [Project Name] at [archive path]. This cannot be undone."
     * "It is your responsibility to verify the migration was successful before deleting."
     * Text input: user must type the project name exactly to confirm
     * "Delete Permanently" button (disabled until name matches)
   - API route: `DELETE /api/portfolio/archive/[id]` — verifies `verified_by_user === 1`, then `fs.rmSync(archivePath, { recursive: true })`, updates `deleted_at` timestamp.
   - NEVER auto-delete. NEVER delete unverified archives.

7. **Add Existing Project flow (full)** — `components/portfolio/AddProjectFlow.tsx`:
   - Replaces the Sprint 24 simplified path-input with the full flow:
     * Step 1: Path input (text field + optional Tauri folder picker if available)
     * Step 2: Scanning animation ("Scanning [folder]..." with spinner)
     * Step 3: OnboardingChat (questions + DNA preview + approval)
     * Step 4: Migration decision (in-place vs. copy, with warnings if copy)
     * Step 5: Completion ("Project registered. You're all set." with link to project card)
   - Each step is a distinct view within the AddProjectFlow component. Back button works to revisit previous steps.
   - Escape key or X button cancels the entire flow and returns to the dashboard.

8. **Telemetry capture** — `lib/portfolio/onboarding.ts`:
   - After successful project registration, write an anonymized row to `portfolio_telemetry`:
     * `project_type`: the final type selected
     * `custom_type_label`: if custom, the label the user provided
     * `questions_asked`: JSON array of question IDs that were asked
     * `metrics_configured`: JSON array of metric field names in the DNA
     * `template_used`: which scaffold template or 'custom'
     * `migration_vs_new`: 'migration'
     * `onboarding_duration_seconds`: time from flow start to completion
   - NO project names, paths, file contents, or user answers stored in telemetry. Strictly anonymous.

9. **API routes** — `app/api/portfolio/`:
   - `POST /api/portfolio/migrate` — accepts { sourcePath, destPath?, inPlace: boolean, dna: string }. Handles the copy + archive + registration.
   - `POST /api/portfolio/scan-directory` — accepts { path: string }, returns DirectoryScanResult.
   - `GET /api/portfolio/archive` — lists all archived projects with verification status.
   - `DELETE /api/portfolio/archive/[id]` — verified deletion (see Task 6).
   - `POST /api/portfolio/onboarding-questions` — accepts { scanResult, inferredType }, returns questions array.

10. **Voice copy** — `lib/voice/copy-templates.ts`:
    - Add `onboarding` section with all conversational strings:
      * Scan summary templates: "I scanned [folder]. Here's what I found: ..."
      * All question strings (the 5 core questions + type-specific variants)
      * Acknowledgment phrases between questions (brief, professional)
      * DNA preview introduction: "Here's what I'd set up for this project:"
      * Migration decision prompt
      * Warning templates for dependency mapping
      * Archive deletion warning text
      * Completion messages
    - All copy follows Greg's voice. No exclamation marks. No "I'm sorry." Data-forward.

11. **TypeScript Gate + Test Suite** — zero new errors, all tests green:
    - `npx tsc --noEmit` from `app/` directory: 0 errors
    - `pnpm test:run`: all existing tests passing + new tests:
      * Scanner: mock fs reads, verify DirectoryScanResult shape
      * Type inference: test each marker → type mapping + confidence levels
      * Onboarding questions: test question selection logic for each confidence level
      * Migration: test copy + archive + rename (mock fs operations)
      * Archive deletion: test verified-only guard

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- All new UI copy goes through lib/voice/copy-templates.ts — no hardcoded strings.
- NEVER touch original files during migration — parallel copy + archive only.
- Archive deletion requires verified_by_user === 1 — no exceptions, no overrides.
- The onboarding flow must work for non-code projects (research, business, creative, hardware, writing, anything).
- Directory scanning skips node_modules, .git, __pycache__, .next, dist, build, target.
- fs.cpSync for copy (Node 16.7+, available in Next.js 16 runtime).
- Ghost Thread must NEVER block the UI.
- Git operations in scanner: try/catch, projects without .git degrade gracefully.
- This sprint adds the "Add Existing" flow. "Create New" is Sprint 26.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell)
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to temp file, then `git commit -F temp_msg.txt`.


═══════════════════════════════════════════════════════════════
SPRINT 26.0 — Portfolio: Create New Project + Attention Intelligence
Run after Sprint 25.0. Delivers scaffolding and the "what should I work on" intelligence.
═══════════════════════════════════════════════════════════════

Execute Sprint 26.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Dev\TECHNICAL_STANDARDS.md
  Filesystem:read_file D:\Projects\GregLite\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\docs\PORTFOLIO_SPEC.md (CRITICAL — full feature spec, especially sections 2.1, 2.3, 3.3, 3.5)
  Filesystem:read_file D:\Projects\GregLite\app\lib\portfolio\scanner.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\portfolio\migrate.ts (Sprint 25 — scanner + migration)
  Filesystem:read_file D:\Projects\GregLite\app\lib\portfolio\onboarding.ts (Sprint 25 — question flow)
  Filesystem:read_file D:\Projects\GregLite\app\lib\portfolio\types.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\portfolio\PortfolioDashboard.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\portfolio\OnboardingChat.tsx (Sprint 25 — reuse for Create New)
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts

Summary: Two features in one sprint. (1) "Create New Project" — the user tells Greg what they're building, Greg asks targeted questions based on the type, then scaffolds a complete project directory with type-appropriate tracking files (DNA, STATUS, BACKLOG/TASKS, README, and type-specific extras). (2) "Needs Attention" intelligence — Greg reads every registered project's STATUS and BACKLOG files, triangulates staleness, blockers, deadlines, and test health, and surfaces a prioritized attention queue at the top of the dashboard. This turns the dashboard from a status board into a decision-making tool.

IMPORTANT DESIGN PRINCIPLES (from architecture session with David):
- The user is the architect. For unknown project types, Greg asks questions — he doesn't guess. The questions themselves build user confidence ("Greg actually understands what I'm building").
- GregLite is for building and creating ANYTHING — not just web apps. Scaffold templates must flex across code, research, business, creative, and fully custom types.
- Question/answer patterns from onboarding (anonymized) are product telemetry for improving scaffolding over time.
- Staleness thresholds should be reasonable — a code project untouched for 7 days is different from a research project untouched for 7 days. Type-aware attention signals.

Tasks:

1. **Scaffold templates** — `lib/portfolio/scaffold.ts`:
   - `ScaffoldTemplate` type: { type: ProjectType, files: { path: string, content: string | ((answers: Record<string, string>) => string) }[] }
   - Templates for each type. Each template generates a set of files populated from the user's onboarding answers:

   **Code template** (type: 'code'):
   - `PROJECT_DNA.yaml` — identity, current_state (v0.1.0, Phase 1), type: code, metrics (test_count: 0, tsc_errors: 'N/A')
   - `STATUS.md` — header block (Last Updated, Version, Test Count, TSC, Next), Sprint 1 TBD placeholder
   - `FEATURE_BACKLOG.md` — empty structure with status key (SHIPPED/MISSING/NEXT)
   - `README.md` — project name, one-line description, getting started placeholder

   **Research template** (type: 'research'):
   - `PROJECT_DNA.yaml` — identity, type: research, metrics (document_count: 0, methodology)
   - `STATUS.md` — simplified header (Last Updated, Phase, Documents, Next)
   - `RESEARCH_LOG.md` — date-ordered log for findings (replaces BACKLOG for research)
   - `METHODOLOGY.md` — research methodology notes, populated from onboarding answers
   - `README.md`

   **Business template** (type: 'business'):
   - `PROJECT_DNA.yaml` — identity, type: business, metrics (clients, deliverables, revenue_status if applicable)
   - `STATUS.md` — header (Last Updated, Phase, Clients, Next Deliverable)
   - `MILESTONES.md` — milestone tracker with dates and status
   - `README.md`

   **Creative template** (type: 'creative'):
   - `PROJECT_DNA.yaml` — identity, type: creative, metrics (word_count/page_count/track_count — from answers)
   - `STATUS.md` — header (Last Updated, Phase, Progress, Next)
   - `TASK_LIST.md` — simple task list (replaces BACKLOG for creative)
   - `README.md`

   **Custom template** (type: 'custom'):
   - `PROJECT_DNA.yaml` — identity, type: custom, type_label from user, metrics from user's answers to "How do you know if it's going well?"
   - `STATUS.md` — generic header (Last Updated, Phase, Next)
   - `TASK_LIST.md` — simple task list
   - `README.md`

   All templates use `{{variable}}` substitution from onboarding answers.

2. **Create New Project flow** — `components/portfolio/NewProjectFlow.tsx`:
   - Step 1: "What are you building?" — single free-text input. Greg responds with type inference from the description.
   - Step 2: Targeted follow-up questions (reuses OnboardingChat component from Sprint 25):
     * Code: "Language/framework?", "Target platform?", "Solo or team?"
     * Research: "Research question?", "Methodology?", "Timeline?"
     * Business: "Deliverable?", "Client/audience?", "Key milestones?"
     * Creative: "Medium? (writing, music, art, video, etc.)", "Target completion?", "How do you measure progress?"
     * Custom/Unknown: The 5 core questions from Sprint 25 (what is it for, inputs, outputs, constraints, success metrics)
   - Step 3: Greg shows scaffold preview — list of files that will be created with brief descriptions.
   - Step 4: Path selection — "Where should I create this?" Default: a configurable managed projects directory. User can override.
   - Step 5: Scaffold + register. Greg creates the directory, writes all files, registers in portfolio_projects table.
   - Step 6: Completion — "Project created. Here's your starting point." Link to project card.

3. **Scaffold execution** — `lib/portfolio/scaffold.ts`:
   - `scaffoldProject(template: ScaffoldTemplate, dirPath: string, answers: Record<string, string>): Promise<{ success: boolean, filesCreated: string[] }>`:
     * Creates the directory if it doesn't exist
     * Writes each template file with answer substitution
     * Returns the list of created files
   - `registerProject(dirPath: string, name: string, type: ProjectType, typeLabel?: string)`:
     * INSERT into `portfolio_projects` table
     * Trigger an immediate scan to populate `scan_data`

4. **Needs Attention analyzer** — `lib/portfolio/analyzer.ts`:
   - `analyzeAttention(projects: ProjectCard[]): AttentionItem[]`:
   - `AttentionItem` type: { projectId: string, projectName: string, severity: 'high' | 'medium' | 'low', reason: string, actionSuggestion: string }
   - Checks for each project:
     * **Staleness** (type-aware thresholds):
       - Code: amber at 7 days, red at 14 days
       - Research: amber at 14 days, red at 30 days (research moves slower)
       - Business: amber at 5 days, red at 10 days (client work is time-sensitive)
       - Creative: amber at 14 days, red at 30 days
       - Custom: amber at 10 days, red at 21 days (default)
     * **Blockers**: scan STATUS.md and BACKLOG for keywords: "BLOCKED", "blocked", "waiting on", "depends on", "can't proceed"
     * **Test failures**: if test_passing < test_count (code projects only)
     * **Approaching deadlines**: if STATUS.md or DNA contains a date within 7 days of today
     * **High velocity acknowledgment**: if project was active within 24 hours and has no blockers, mark as "On track — high activity"
   - Sort by severity (high first), then by staleness (most stale first)
   - Returns max 10 attention items (don't overwhelm)

5. **Attention Queue UI** — `components/portfolio/AttentionQueue.tsx`:
   - Rendered at the top of PortfolioDashboard, above the project card grid
   - Collapsed by default: "3 projects need attention" with expand/collapse toggle
   - Expanded: list of AttentionItem cards with:
     * Project name (clickable — scrolls to or highlights that project card)
     * Severity dot (red/amber/green)
     * Reason (1 line, Greg's voice): "Stale for 12 days. Sprint 42 was listed as next."
     * Action suggestion: "Pick up where you left off" or "Review blockers" or "Run tests"
   - "Dismiss" button per item (hides for current session, reappears next time if still relevant)
   - If no items need attention: "All projects on track." (green, no expand)

6. **Wire analyzer into dashboard** — `components/portfolio/PortfolioDashboard.tsx`:
   - On each data fetch (30s poll + tab activate), run `analyzeAttention()` on the project list
   - Pass attention items to AttentionQueue
   - Also add a subtle health dot glow to ProjectCards that appear in the attention queue (amber or red pulse)

7. **API routes** — `app/api/portfolio/`:
   - `POST /api/portfolio/scaffold` — accepts { name, type, typeLabel?, dirPath, answers: Record<string, string> }. Creates directory, writes files, registers project, returns created file list.
   - `GET /api/portfolio/attention` — returns attention analysis for all active projects (runs analyzer server-side).

8. **Onboarding questions for Create New** — `lib/portfolio/onboarding.ts`:
   - Add `getNewProjectQuestions(description: string, inferredType: InferResult): OnboardingQuestion[]`:
     * Different from Sprint 25's existing-project questions — these are about what the user WANTS to build, not what already exists
     * The initial description ("What are you building?") feeds into type inference, then type-specific questions follow
   - Add `inferTypeFromDescription(description: string): InferResult`:
     * Keyword matching on the description: "app", "api", "website" → code; "paper", "study", "analysis" → research; "client", "agency", "deliverable" → business; "novel", "album", "film" → creative
     * Low confidence if no clear signals → triggers the 5 core questions

9. **Telemetry for Create New** — `lib/portfolio/onboarding.ts`:
   - Same pattern as Sprint 25 but with `migration_vs_new: 'new'`
   - Capture which template was used and which custom metrics were configured

10. **Voice copy** — `lib/voice/copy-templates.ts`:
    - Add `scaffold` section:
      * "What are you building?" prompt
      * Type-specific question strings for new projects
      * Scaffold preview descriptions for each file type
      * Path selection prompt
      * Completion messages
    - Add `attention` section:
      * Staleness messages at each severity level
      * Blocker detection messages
      * Test failure messages
      * Deadline approaching messages
      * "All on track" message
      * Action suggestions per attention type
    - All copy: Greg's voice. Deadpan professional. No exclamation marks.

11. **Priority override** — `components/portfolio/ProjectCard.tsx` + `lib/portfolio/analyzer.ts`:
    - Add a "Mute" option on project cards: "I know this is stale — mute attention signals for [30 days / until I resume / permanently]"
    - Store mute preferences in `portfolio_projects` table (add `attention_muted_until INTEGER` column via ALTER TABLE migration with try/catch)
    - Analyzer respects mute: skip muted projects in attention queue

12. **TypeScript Gate + Test Suite** — zero new errors, all tests green:
    - `npx tsc --noEmit`: 0 errors
    - `pnpm test:run`: all passing + new tests:
      * Scaffold: verify each template produces correct file list and content
      * Type inference from description: test keyword mapping
      * Analyzer: test staleness calculation with type-aware thresholds
      * Analyzer: test blocker keyword detection
      * Analyzer: test mute override behavior
      * Attention queue: test sorting by severity

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- All new UI copy goes through lib/voice/copy-templates.ts — no hardcoded strings.
- Scaffold templates must work for ALL project types — not just code. Research, business, creative, custom.
- Type inference from description is keyword-based heuristic only — no LLM call needed. Keep it fast and deterministic.
- Staleness thresholds are TYPE-AWARE — do not apply code project thresholds to research projects.
- Attention queue maxes out at 10 items — don't overwhelm.
- Mute override is a user preference, not a permanent state — it can have an expiration.
- Ghost Thread must NEVER block the UI.
- This is a large sprint (12 tasks). If it exceeds 1 session, split: Tasks 1-4 + 7-9 (scaffolding) first commit, Tasks 5-6 + 10-12 (attention intelligence) second commit. Both must pass TypeScript gate.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell)
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to temp file, then `git commit -F temp_msg.txt`.
