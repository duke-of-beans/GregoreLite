═══════════════════════════════════════════════════════════════
SPRINT 29.0 — Quick Capture Pad: Global Hotkey Note-to-Backlog Pipeline
Run after Sprint 26.0 (Portfolio). Requires portfolio_projects table to exist.
Replace the Notepad scratch workflow with a 3-second capture that routes to the right backlog.
═══════════════════════════════════════════════════════════════

Execute Sprint 29.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Dev\TECHNICAL_STANDARDS.md
  Filesystem:read_file D:\Projects\GregLite\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\docs\PORTFOLIO_SPEC.md
  Filesystem:read_file D:\Projects\GregLite\GREGORE_AUDIT.md (Section 1 — voice)
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\portfolio\types.ts (Sprint 24 — project types)
  Filesystem:read_file D:\Projects\GregLite\app\lib\portfolio\scanner.ts (Sprint 24 — project list)
  Filesystem:read_file D:\Projects\GregLite\app\components\chat\ChatInterface.tsx (keyboard shortcut patterns)
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\CommandPalette.tsx (existing overlay UI pattern)
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\database.ts (migration patterns)
  Filesystem:read_file D:\Projects\GregLite\app\lib\stores\ui-store.ts (global UI state)
  Filesystem:read_file D:\Projects\GregLite\app\lib\embeddings\model.ts (embedding pipeline for dedup)

Summary: David keeps a Notepad doc open to jot bugs, features, and ideas across all projects while doing other work. The capture format is dead simple — project name as a heading, then bullets. This sprint brings that workflow INTO GregLite as a global hotkey capture pad: press Ctrl+Shift+Space (or Cmd+.), a floating micro-input appears, type your thought (optionally prefixed with a project name), hit Enter, and it vanishes. Under the hood, Greg deduplicates against the existing backlog using semantic similarity, routes to the correct project, classifies as bug/feature/question/idea, and tracks mention frequency as a priority signal. Items mentioned multiple times are automatically flagged as higher priority — the user's "accidentally logging things twice" is a feature, not a bug.

VOICE MANDATE: All user-facing text — input placeholders, confirmation toasts, dedup messages, settings labels — goes through lib/voice/copy-templates.ts in Greg's voice. Deadpan professional, no exclamation marks.

Tasks:

1. **Capture data model** — `lib/kernl/database.ts` + `lib/capture/types.ts`:
   - New SQLite table:
     ```sql
     CREATE TABLE IF NOT EXISTS capture_notes (
       id TEXT PRIMARY KEY,
       project_id TEXT,              -- FK to portfolio_projects.id, NULL if unrouted
       raw_text TEXT NOT NULL,       -- exactly what the user typed
       parsed_project TEXT,          -- project name extracted from prefix (e.g., "CadBrix: ...")
       parsed_body TEXT NOT NULL,    -- the note content after stripping project prefix
       classification TEXT NOT NULL DEFAULT 'idea',  -- 'bug', 'feature', 'question', 'idea'
       mention_count INTEGER NOT NULL DEFAULT 1,     -- incremented on semantic dupe detection
       merged_with TEXT,             -- id of the note this was merged into (NULL if primary)
       status TEXT NOT NULL DEFAULT 'inbox',          -- 'inbox', 'backlogged', 'dismissed'
       backlog_item_id TEXT,         -- once promoted to a backlog, reference the item
       created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000),
       last_mentioned_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
     );
     CREATE INDEX IF NOT EXISTS idx_capture_project ON capture_notes(project_id, status);
     CREATE INDEX IF NOT EXISTS idx_capture_mentions ON capture_notes(mention_count DESC);
     ```
   - `CaptureNote` TypeScript interface matching the table.
   - `CaptureClassification = 'bug' | 'feature' | 'question' | 'idea'`
   - `CaptureStatus = 'inbox' | 'backlogged' | 'dismissed'`

2. **Project prefix parser** — `lib/capture/parser.ts`:
   - `parseCaptureInput(raw: string, knownProjects: string[]): { projectName: string | null, body: string }`:
     * Detects `ProjectName:` or `ProjectName -` prefix patterns (case-insensitive).
     * Fuzzy matches against registered project names from `portfolio_projects` — "greglite" matches "GregLite", "covos" matches "COVOS", "cadbrix" matches "CadBrix".
     * If no prefix detected, returns `projectName: null` — the note goes to an "unrouted" inbox.
     * Strips the prefix from the body so the note text is clean.
   - `classifyNote(body: string): CaptureClassification`:
     * Keyword heuristic (fast, no LLM):
       - Bug signals: "broken", "error", "fix", "bug", "doesn't work", "wrong", "crash", "404", "missing", "fails"
       - Feature signals: "should", "add", "new", "ability to", "allow", "enable", "support", "want", "need"
       - Question signals: "?", "what is", "how does", "why", "should we", "thoughts on"
       - Default: 'idea' (everything else)

3. **Semantic deduplication** — `lib/capture/dedup.ts`:
   - `findDuplicate(newNote: string, projectId: string | null): Promise<{ isDuplicate: boolean, existingNote: CaptureNote | null, similarity: number }>`:
   - Strategy (in order, stop at first match):
     * **Exact match**: normalize whitespace + lowercase, compare against existing `parsed_body` for the same project. Threshold: 100% match → definite dupe.
     * **Token overlap**: split both into word tokens, compute Jaccard similarity. Threshold: >0.7 → likely dupe.
     * **Embedding similarity** (if @xenova/transformers available): embed both, cosine similarity. Threshold: >0.85 → likely dupe.
   - If duplicate found: increment `mention_count` on the existing note, update `last_mentioned_at`, store the new note with `merged_with` pointing to the primary.
   - The `mention_count` is the key signal — items mentioned 3+ times should surface as high-priority in the capture inbox.
   - If embedding model is not available (first run, model downloading), fall back to token overlap only. Never block capture on embedding.

4. **Capture API routes** — `app/api/capture/`:
   - `POST /api/capture` — accepts `{ text: string }`. Parses project prefix, classifies, deduplicates, stores. Returns `{ note: CaptureNote, wasDuplicate: boolean, mergedWith?: string }`.
   - `GET /api/capture/inbox` — returns all notes with status='inbox', sorted by mention_count DESC then created_at DESC. Supports `?project=` filter.
   - `POST /api/capture/[id]/promote` — moves a note to 'backlogged' status and writes it to the project's FEATURE_BACKLOG.md or TASK_LIST.md (depending on project type from Portfolio).
   - `POST /api/capture/[id]/dismiss` — sets status='dismissed'. Note stays in DB for dedup but won't surface.
   - `GET /api/capture/stats` — returns per-project note counts, top-mentioned items, classification breakdown.

5. **Capture Pad UI — the floating micro-input** — `components/capture/CapturePad.tsx`:
   - Global overlay that appears on `Ctrl+Shift+Space` (Windows) / `Cmd+.` (Mac).
   - Design: centered floating input, ~500px wide, slight glassmorphic backdrop blur, subtle drop shadow. Appears with a fast spring animation (scale 0.95→1, opacity 0→1, 100ms).
   - Components:
     * Single text input with placeholder: "Bug, feature, idea... prefix with project name" (from voice templates)
     * Small project pill showing the detected project (updates live as user types a prefix). Shows "Unrouted" in muted text if no project detected.
     * Classification badge (bug/feature/question/idea) — updates live based on keyword detection. Small, non-intrusive, just informational.
   - Behavior:
     * Enter → submit, show brief confirmation toast ("Captured." or "Merged — mentioned 3x now."), pad vanishes. Total time: <3 seconds.
     * Escape → cancel, pad vanishes.
     * Click outside → cancel, pad vanishes.
     * Shift+Enter → newline (for multi-line notes, rare but supported).
   - Auto-focus the input immediately on open. No animation delay on the input focus.
   - The pad renders at z-index above everything (above command palette, above modals).
   - Works from ANY tab (Strategic, Workers, Portfolio, Conversation Map — doesn't matter).

6. **Keyboard shortcut registration** — `components/chat/ChatInterface.tsx` or global keyboard handler:
   - Register `Ctrl+Shift+Space` (and `Cmd+.` on Mac) globally.
   - Toggle `capturePadOpen` in ui-store.
   - Must not conflict with existing shortcuts (Cmd+K for command palette, Cmd+N for new thread, etc.).
   - Also register `Cmd+Shift+C` as an alternative (easier to remember: Cmd+Shift+Capture).

7. **Confirmation toast** — `components/capture/CaptureToast.tsx`:
   - Ultra-brief toast that appears bottom-center after capture, auto-dismisses after 2 seconds.
   - Variants (from voice templates):
     * Normal capture: "Captured." (just the word, nothing else — Greg is efficient)
     * Duplicate merged: "Merged. That's {N}x now." (the count is the useful data)
     * Routed to project: "→ {ProjectName}" (shows where it went)
     * Unrouted: "Captured. No project matched — check your inbox." (helpful, not scolding)
   - Framer Motion: slide-up + fade-in, slide-down + fade-out on dismiss.

8. **Capture inbox view** — `components/capture/CaptureInbox.tsx`:
   - Accessible from: command palette (`Cmd+K → "capture inbox"`), or a small badge on the Portfolio tab showing inbox count.
   - Shows all inbox notes grouped by project (unrouted at the top).
   - Each note shows: parsed body, classification badge, mention count (highlighted if 3+), relative time, project pill.
   - Actions per note:
     * "Promote" → writes to project backlog, changes status to 'backlogged'
     * "Dismiss" → hides from inbox
     * "Re-route" → change project assignment (dropdown of registered projects)
   - Bulk actions: "Promote all for {project}" button per project group.
   - Sort: mention_count DESC by default (most-mentioned = most important). Toggle to chronological.
   - The inbox is also where unrouted notes get manually assigned to projects.

9. **Backlog promotion** — `lib/capture/promote.ts`:
   - `promoteToBacklog(noteId: string): Promise<{ success: boolean, filePath: string }>`:
   - Reads the project's type from portfolio_projects.
   - Determines target file:
     * Code projects: FEATURE_BACKLOG.md
     * Research projects: RESEARCH_LOG.md
     * Business projects: MILESTONES.md or TASK_LIST.md
     * Creative projects: TASK_LIST.md
     * Custom: TASK_LIST.md (safe default)
   - Appends the note to the target file in the appropriate format:
     * Bug: `- [ ] **BUG:** {body} (captured {date}, mentioned {N}x)`
     * Feature: `- [ ] **FEATURE:** {body} (captured {date}, mentioned {N}x)`
     * Question: `- [ ] **QUESTION:** {body} (captured {date})`
     * Idea: `- [ ] **IDEA:** {body} (captured {date})`
   - Updates capture_notes.status = 'backlogged' and sets backlog_item_id.
   - If the target file doesn't exist, create it with a basic header.

10. **Conversation capture integration** — `lib/capture/conversation.ts`:
    - If the user says something in the Strategic thread that matches capture patterns ("remind me to add X to the CadBrix backlog", "note for GregLite: ..."), Greg should be able to capture it.
    - This is NOT an automatic extraction from every message — it's triggered by explicit phrasing:
      * "Remind me to...", "Note for {project}:...", "Add to backlog:...", "Capture:..."
    - Implementation: a lightweight message post-processor that checks the user's latest message for capture trigger phrases. If found, call the same `POST /api/capture` pipeline.
    - Greg confirms in the conversation: "Captured to {project} inbox." — then continues the conversation normally.
    - This is a STRETCH GOAL for this sprint. If it adds too much complexity, defer to Sprint 30 and just ship the hotkey pad.

11. **Voice copy** — `lib/voice/copy-templates.ts`:
    - Add `capture` section:
      ```typescript
      capture: {
        // Pad
        placeholder: 'Bug, feature, idea... prefix with project name',
        project_detected: (name: string) => name,
        project_unrouted: 'Unrouted',

        // Toasts
        toast_captured: 'Captured.',
        toast_merged: (count: number) => `Merged. That's ${count}x now.`,
        toast_routed: (project: string) => `→ ${project}`,
        toast_unrouted: 'Captured. No project matched — check your inbox.',

        // Inbox
        inbox_title: 'Capture Inbox',
        inbox_empty: 'Inbox clear. Nothing pending.',
        inbox_promote: 'Promote to backlog',
        inbox_dismiss: 'Dismiss',
        inbox_reroute: 'Re-route',
        inbox_promote_all: (project: string) => `Promote all for ${project}`,
        inbox_mention_count: (count: number) => `${count}x`,
        inbox_high_priority: 'Mentioned 3+ times',

        // Classification badges
        class_bug: 'Bug',
        class_feature: 'Feature',
        class_question: 'Question',
        class_idea: 'Idea',

        // Settings
        settings_title: 'Quick Capture',
        settings_description: 'Global hotkey notepad that routes thoughts to the right project backlog.',
        settings_hotkey_label: 'Capture shortcut',
        settings_dedup_label: 'Smart merge (detects duplicate notes)',
      }
      ```

12. **Settings** — `components/settings/CaptureSection.tsx`:
    - New section in Settings: "Quick Capture" (or whatever voice templates say)
    - Controls:
      * Hotkey display (read-only for now — show the registered shortcut)
      * Smart merge toggle (dedup on/off, default on)
      * Default project (dropdown — auto-route notes without a prefix to this project)
      * Show capture inbox badge on Portfolio tab (toggle, default on)

13. **TypeScript Gate + Test Suite** — zero new errors, all tests green:
    - `npx tsc --noEmit`: 0 errors
    - `pnpm test:run`: all passing + new tests:
      * Parser: test project prefix detection with fuzzy matching, classification keywords
      * Dedup: test exact match, token overlap, merge behavior, mention count increment
      * API: test capture route (normal, dupe, unrouted), inbox listing, promotion
      * Promotion: test backlog file append for each project type

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- ALL user-facing text goes through lib/voice/copy-templates.ts. Zero hardcoded strings.
- Greg's voice throughout. "Captured." not "Note saved successfully! ✓"
- The capture pad must appear and be ready for input in <200ms. No loading spinners, no API calls before the input is focused. Dedup runs AFTER submit, not before.
- Dedup must NEVER block capture. If embedding model is unavailable, fall back to token overlap. If that's slow, fall back to exact match. The note is always saved.
- Mention count is a FEATURE. Users accidentally logging things twice means the item is important. Surface high-mention items prominently.
- The capture pad works from ANY tab, ANY state. It's a global overlay.
- Conversation capture (Task 10) is a STRETCH GOAL. Ship the hotkey pad first. If time allows, add conversation capture. If not, defer.
- The floating pad must not interfere with the command palette (Cmd+K). Different shortcuts, different z-index stacking.
- Ghost Thread must NEVER block the UI.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell)
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to temp file, then `git commit -F temp_msg.txt`.
