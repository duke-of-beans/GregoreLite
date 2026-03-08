# PORTFOLIO DASHBOARD — Feature Specification
# Version: 1.0.0
# Date: March 6, 2026
# Author: David Kirsch + Claude (architecture session)
# Location: D:\Projects\GregLite\docs\PORTFOLIO_SPEC.md

---

## 1. Purpose

GregLite needs a single-screen view of every project the user is managing — code, research, business, creative, whatever — showing what state each is in, what needs attention, and enabling the user to make enterprise-level decisions about what to work on today.

This is NOT just for web apps. GregLite is for building and creating anything. A novelist tracking three manuscripts, a researcher managing five studies, an entrepreneur juggling a SaaS product and a marketing agency — they all need this dashboard.

## 2. Core Principles

### 2.1 The User Is the Architect
Greg does NOT silently guess how to structure a project. When Greg encounters something unfamiliar — a project type he hasn't seen, a workflow that doesn't fit existing templates — he asks intelligent questions:

- "What is this project actually for?"
- "What are the inputs you work with?"
- "What does 'done' look like for this?"
- "What are the constraints or deadlines?"
- "How do you know if it's going well or badly?"

These questions accomplish two things: they give Greg the data to build the right tracking structure, and they give the user confidence that Greg understands their project before touching anything. The user remains the architect. Greg is the builder who asks good clarifying questions before starting.

### 2.2 Never Touch the Original
When migrating an existing project into GregLite's managed structure:

1. **Copy** the project into the managed directory structure (parallel copy)
2. **Archive** the original by renaming it (e.g., `MyProject` -> `MyProject_ARCHIVED_2026-03-06`)
3. **User verifies** the migration was successful by working in the new copy
4. **User deletes** the archive ONLY through a strict deletion mechanism with explicit warnings:
   - "This will permanently delete the archived version of [Project Name]"
   - "Have you verified that the migrated version works correctly?"
   - "This action cannot be undone"
   - Require typing the project name to confirm (not just clicking "OK")

### 2.3 Not Just Code
The PROJECT_DNA.yaml schema must be type-aware. Different project types surface different metrics:

```yaml
# Code project
type: code
metrics:
  test_count: 1344
  tsc_errors: 0
  last_commit: "2026-03-06"

# Research project
type: research
metrics:
  document_count: 145
  last_finding: "Crisis capitalism corpus analysis"
  methodology: "Research Veritas v2.14"

# Business project
type: business
metrics:
  clients: 3
  revenue_status: "growing"
  next_deliverable: "Q1 report"

# Creative project
type: creative
metrics:
  word_count: 45000
  chapters_complete: 12
  target_completion: "2026-06-01"

# Custom (user-defined via onboarding questions)
type: custom
type_label: "Hardware Prototype"
metrics:
  pcb_revision: "v3.2"
  test_results: "4/7 passing"
  next_milestone: "FCC certification"
```

### 2.4 Refresh Speed
- **On tab activate:** Instant render from SQLite cache
- **Background poll:** Every 30 seconds, scan all registered project DNA/STATUS files
- **Git data (last commit, branch):** Async fill-in after initial render — heavier operation, runs in background, updates cards when ready
- **Manual refresh:** Button on dashboard for immediate full scan
- Total scan budget for 20 projects: < 200ms (file reads only, no computation)

### 2.5 Anonymized Telemetry
Every project onboarding interaction (questions asked, answers given, template selected, custom fields created) should be captured in a local `portfolio_telemetry` SQLite table. This data — with all project names, file paths, and content stripped — can be exported as anonymized feature data for GregLite product development. Fields:

- `project_type` (code/research/business/creative/custom)
- `custom_type_label` (if custom)
- `questions_asked` (which onboarding questions Greg asked)
- `metrics_configured` (which metric fields the user chose)
- `template_used` (which scaffold template was applied)
- `migration_vs_new` (was this a new project or an existing migration?)
- `onboarding_duration_seconds`
- `timestamp`

No project names, paths, content, or personally identifiable information.

## 3. User Flows

### 3.1 First Open — Empty State
Portfolio tab shows:
- Clean empty state with Greg's voice: "No projects here yet."
- Two prominent buttons: "Add Existing Project" and "Create New Project"
- Brief description: "This is your command center. Every project you're managing shows up here with its current status and what needs your attention next."

### 3.2 Add Existing Project
1. User clicks "Add Existing Project"
2. Folder picker opens (or user types/pastes a path)
3. **Greg scans the directory** — looks for:
   - Build system markers: package.json, Cargo.toml, pyproject.toml, go.mod, Makefile, CMakeLists.txt
   - Version control: .git (extracts last commit, branch, remote URL)
   - Documentation: README.md, CHANGELOG.md, any existing status/todo files
   - Project structure: src/, lib/, docs/, tests/ directories
   - File type distribution: what extensions dominate? (.ts, .py, .md, .docx, etc.)
4. **Greg presents findings and asks questions:**
   - "I found a TypeScript project with 45 source files, a test suite, and a README. Sound right?"
   - OR: "This folder has mostly markdown files and PDFs. What kind of project is this?"
   - OR: "I see a mix of code and documents. What's the primary purpose?"
   - For unknown types: "How does this project work exactly? What are the inputs, outputs, and constraints?"
5. **Greg generates a draft PROJECT_DNA.yaml** based on scan + answers
6. User reviews and approves (can edit before confirming)
7. **Migration decision:**
   - "Do you want to manage this project in place, or would you like me to create a clean copy with the standard file structure?"
   - If in-place: Greg adds DNA/STATUS/BACKLOG files to the existing directory. Minimal disruption.
   - If copy: Greg creates a parallel copy in the managed projects directory, adds structure files, archives the original with timestamp suffix.
8. Project appears on dashboard immediately

### 3.3 Create New Project
1. User clicks "Create New Project"
2. Greg asks: "What are you building?" (free text)
3. Based on the answer, Greg asks 3-5 targeted follow-up questions:
   - For code: "What language/framework? What's the target platform? Solo or team?"
   - For research: "What's the research question? What methodology? What's the timeline?"
   - For business: "What's the deliverable? Who's the client? What are the milestones?"
   - For unknown: "Walk me through how this works. What goes in, what comes out, and what does success look like?"
4. Greg scaffolds the project directory with type-appropriate files:
   - PROJECT_DNA.yaml (populated from answers)
   - STATUS.md (initialized with "Phase 1 TBD" or equivalent)
   - FEATURE_BACKLOG.md or TASK_LIST.md (depending on type)
   - README.md (basic description from user's answers)
   - Type-specific extras (e.g., research gets METHODOLOGY.md, business gets MILESTONES.md)
5. Project appears on dashboard

### 3.4 Dashboard View
Each project is a card showing:
- **Name** and **type badge** (Code, Research, Business, Creative, [Custom Label])
- **Phase/Status** — one-line summary from DNA
- **Last activity** — last commit date (code) or last file modification (non-code)
- **Health signal** — green/amber/red dot based on:
  - Green: active in last 7 days, no blockers
  - Amber: 7-14 days stale, or has items marked "blocked"
  - Red: 14+ days stale, or failing tests, or explicit blockers
- **What's next** — extracted from STATUS.md "Next:" line or equivalent
- **Needs attention** — Greg's assessment of why this project might need work today

Click a card -> detail panel slides in with full STATUS.md content, backlog summary, and a "Start Working" button that sets up the session context for that project.

### 3.5 "Needs Attention" Intelligence
Greg reads each project's STATUS.md and FEATURE_BACKLOG.md and triangulates:
- **Staleness:** "GHM Dashboard hasn't been touched in 12 days. Sprint 42 was listed as next."
- **Blockers:** "TESSRYX has 2 items marked BLOCKED in the backlog."
- **Momentum:** "GregLite just shipped 5 sprints — high velocity, no blockers."
- **Deadlines:** "Demand.io application deadline is March 15. Cover letter not started."
- **Test health:** "Eye of Sauron test suite has 3 failures since last commit."

This is surfaced as a brief sentence on each card and as a prioritized "attention queue" at the top of the dashboard: "3 projects need attention" with the most urgent first.

## 4. Data Model

### 4.1 SQLite Tables (in greglite.db)

```sql
-- Project registry (source of truth for what's managed)
CREATE TABLE IF NOT EXISTS portfolio_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'custom',
  type_label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  registered_at INTEGER NOT NULL,
  last_scanned_at INTEGER,
  scan_data TEXT
);

-- Onboarding telemetry (anonymized product data)
CREATE TABLE IF NOT EXISTS portfolio_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_type TEXT NOT NULL,
  custom_type_label TEXT,
  questions_asked TEXT,
  metrics_configured TEXT,
  template_used TEXT,
  migration_vs_new TEXT NOT NULL,
  onboarding_duration_seconds INTEGER,
  created_at INTEGER NOT NULL
);

-- Archived project references (for safe deletion flow)
CREATE TABLE IF NOT EXISTS portfolio_archives (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES portfolio_projects(id),
  original_path TEXT NOT NULL,
  archive_path TEXT NOT NULL,
  archived_at INTEGER NOT NULL,
  verified_by_user INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER
);
```

### 4.2 Scanner Cache
The scanner reads each project's DNA + STATUS on a 30-second cycle and writes to `portfolio_projects.scan_data` as a JSON blob:

```json
{
  "version": "1.1.0",
  "phase": "Sprint 23 shipped",
  "last_commit": "2026-03-06T11:30:00Z",
  "last_commit_message": "feat: Sprint 23.0 Phase C",
  "branch": "master",
  "test_count": 1344,
  "test_passing": 1344,
  "tsc_errors": 0,
  "next_sprint": "Sprint 24.0 TBD",
  "blockers": [],
  "health": "green",
  "attention_reason": null,
  "custom_metrics": {}
}
```

## 5. Architecture

### 5.1 Files
```
lib/portfolio/
  scanner.ts        — reads all DNA/STATUS files, writes to SQLite cache
  analyzer.ts       — "needs attention" intelligence (staleness, blockers, health)
  scaffold.ts       — creates new project directories with type-appropriate templates
  migrate.ts        — handles existing project import (scan, copy, archive)
  onboarding.ts     — question flow logic for new/unknown project types
  types.ts          — ProjectCard, ScanResult, OnboardingQuestion types

app/api/portfolio/
  route.ts          — GET (list all projects with scan data), POST (register new)
  [id]/route.ts     — GET (single project detail), PATCH (update), DELETE (archive)
  scan/route.ts     — POST (trigger immediate rescan)
  scaffold/route.ts — POST (create new project from onboarding answers)
  migrate/route.ts  — POST (import existing project)
  archive/route.ts  — POST (archive management, deletion with verification)

components/portfolio/
  PortfolioDashboard.tsx  — main dashboard view (grid of project cards)
  ProjectCard.tsx         — individual project card with health signal
  ProjectDetail.tsx       — slide-in detail panel
  AddProjectFlow.tsx      — folder picker + scan + question flow
  NewProjectFlow.tsx      — create new project with onboarding questions
  OnboardingChat.tsx      — conversational Q&A for project setup
  ArchiveManager.tsx      — safe deletion flow with verification
  AttentionQueue.tsx      — prioritized "needs attention" list at top
```

### 5.2 Tab Integration
New tab in ChatInterface.tsx TABS array:
```typescript
{ id: 'portfolio', label: 'Projects', icon: FolderKanban /* lucide */ }
```
Position: first tab (leftmost), before Strategic. This is the "home base" view.

## 6. Sprint Breakdown

### Sprint 24.0 — Portfolio Scanner + Dashboard UI (Read-Only)
- Scanner: reads registered project DNA/STATUS files from disk
- SQLite tables for project registry
- Portfolio tab with project cards (name, type, phase, last activity, health dot)
- Detail panel (click card -> see full status)
- 30-second background refresh + on-tab-activate instant render from cache
- Git data async fill-in (last commit date, branch)
- "Start Working" button on detail panel
- Responsive layout matching Sprint 23.0 breakpoints
- Manual "Add Project" by path (simplified — no scan/Q&A yet, just register + scan DNA)

### Sprint 25.0 — Add Existing Project + Intelligent Onboarding
- Directory scanner (detects project type from file markers)
- Onboarding question flow for unknown types
- Draft DNA generation from scan + answers
- In-place vs. copy migration decision
- Archive management for copied projects (parallel copy, rename original)
- Safe deletion flow with typed confirmation
- Telemetry capture (anonymized)
- Dependency mapping warnings before migration

### Sprint 26.0 — Create New Project + Attention Intelligence
- "Create New Project" flow with type-targeted questions
- Scaffold templates for code/research/business/creative/custom
- Custom type support (user-defined metrics from Q&A)
- Auto-registration in project registry
- "Needs Attention" intelligence (staleness, blockers, deadlines, test health)
- Attention queue at top of dashboard
- Telemetry export mechanism (anonymized JSON)

## 7. Open Questions

1. Should the Portfolio tab replace Strategic as the default landing view?
2. Should "Start Working" open a new strategic thread with context, or switch to existing?
3. How aggressive should staleness signals be? (3 days? 7 days? configurable?)
4. Should scaffold templates be bundled or community-contributed?
5. Telemetry export format: JSON lines? CSV? API to GregLite HQ?
6. Should the attention queue support user-set priority overrides? ("I know this is stale, I'm ignoring it on purpose")

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-06 | Initial spec. Three-sprint breakdown. Core principles: user-is-architect, never-touch-original, not-just-code, 30s refresh, anonymized telemetry. |
