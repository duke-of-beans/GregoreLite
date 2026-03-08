═══════════════════════════════════════════════════════════════
SPRINT 27.0 — Ambient Memory: "Hey, Remember This?"
Run after Sprint 26.0 (Portfolio intelligence). Requires Background Assistant infrastructure.
Greg becomes the friend who remembers what matters.
═══════════════════════════════════════════════════════════════

Execute Sprint 27.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Dev\TECHNICAL_STANDARDS.md
  Filesystem:read_file D:\Projects\GregLite\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\docs\PORTFOLIO_SPEC.md
  Filesystem:read_file D:\Projects\GregLite\GREGORE_AUDIT.md (Section 1 — Greg's voice is CRITICAL for this sprint)
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\ghost\lifecycle.ts (Background Assistant lifecycle)
  Filesystem:read_file D:\Projects\GregLite\app\lib\ghost\scorer\index.ts (existing scorer pipeline)
  Filesystem:read_file D:\Projects\GregLite\app\lib\ghost\scorer\types.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\ghost\ingest\index.ts (ingest pipeline)
  Filesystem:read_file D:\Projects\GregLite\app\lib\ghost\ingest\types.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\ghost\GhostCard.tsx (existing card UI)
  Filesystem:read_file D:\Projects\GregLite\app\components\context\ContextPanel.tsx
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\database.ts

Summary: Greg becomes the friend who notices what matters. The Background Assistant already sweeps local files and scores them for relevance — this sprint adds a "memory recall" layer that detects meaningful content the user hasn't touched in a while, past conversations worth revisiting, project milestones worth acknowledging, and personal moments worth surfacing. These appear as ambient "recall cards" in the ContextPanel — warm, personal, never intrusive. Think Google Photos' "remember this day?" but across ALL content types (files, projects, conversations, career milestones) and filtered through Greg's deadpan-professional-but-genuinely-thoughtful voice. Must feel like a friend remembering a shared memory, never like surveillance.

VOICE MANDATE: Every piece of user-facing text in this sprint — card titles, recall messages, settings labels, empty states — MUST go through lib/voice/copy-templates.ts and follow Greg's established voice: deadpan professional, data-forward, sardonic edge in empty states, genuinely warm in recall moments without being sentimental. No exclamation marks. No "I'm sorry." No emoji in system messages. Greg acknowledges the personal without being mushy — think: "You spent 3 weeks on this last spring. It shipped." not "Wow, remember how hard you worked on this? 🎉"

Tasks:

1. **Memory recall data model** — `lib/kernl/database.ts` + `lib/recall/types.ts`:
   - New SQLite table via CREATE TABLE IF NOT EXISTS in migration block:
     ```sql
     CREATE TABLE IF NOT EXISTS recall_events (
       id TEXT PRIMARY KEY,
       type TEXT NOT NULL,           -- 'file_revisit', 'conversation_callback', 'project_milestone', 'personal_moment', 'work_anniversary', 'pattern_insight'
       source_type TEXT NOT NULL,    -- 'file', 'conversation', 'project', 'email', 'custom'
       source_id TEXT,               -- path, conversation_id, project_id, etc.
       source_name TEXT NOT NULL,    -- human-readable name for display
       message TEXT NOT NULL,        -- Greg's recall message (from voice templates)
       context_data TEXT,            -- JSON blob of supporting data (dates, stats, related items)
       relevance_score REAL NOT NULL DEFAULT 0.5,  -- 0-1, higher = more worth surfacing
       surfaced_at INTEGER,          -- NULL until shown to user
       user_action TEXT,             -- 'appreciated', 'dismissed', 'snoozed', NULL
       acted_at INTEGER,
       created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
     );
     CREATE INDEX IF NOT EXISTS idx_recall_surfaced ON recall_events(surfaced_at, user_action);
     CREATE INDEX IF NOT EXISTS idx_recall_type ON recall_events(type, created_at DESC);
     ```
   - `RecallEvent` TypeScript interface matching the table shape.
   - `RecallType` union type for the 6 recall categories.
   - `RecallUserAction = 'appreciated' | 'dismissed' | 'snoozed'`

2. **Recall detector pipeline** — `lib/recall/detector.ts`:
   - `runRecallDetection(): Promise<RecallEvent[]>` — the main sweep that finds things worth remembering. Runs on a schedule (every 2 hours, configurable). Returns new recall events to be stored.
   - Detection strategies (each is a pure function that returns 0+ RecallEvents):

   **a. File Revisit** — `detectFileRevisits()`:
   - Query `content_chunks` table for files that were accessed/modified >30 days ago but had high relevance scores when they were active.
   - Cross-reference with filesystem: is the file still there? When was it last modified?
   - Threshold: file was relevant (>0.6 relevance at time of indexing), hasn't been modified in 30+ days, was modified frequently before that (>5 modifications in its active period).
   - Message template: "You worked on {filename} pretty intensively last {month}. Haven't touched it since." or "This came up in 3 conversations back in {month}: {filename}."

   **b. Conversation Callback** — `detectConversationCallbacks()`:
   - Query `threads` + `messages` for conversations with >10 messages that are 14+ days old.
   - Look for conversations that had decisions logged (`decisions` table with matching `thread_id`).
   - Message template: "You made a decision about {topic} two weeks ago. Worth checking how that played out?" or "{project}: you and Greg worked through {decision_title} on {date}. Still holding up?"

   **c. Project Milestone** — `detectProjectMilestones()`:
   - Query `portfolio_projects` for projects that recently crossed version boundaries (e.g., scan_data shows version changed from last scan).
   - Or: project that was stale but just became active again.
   - Message template: "{project} hit {version}. That's {sprint_count} sprints since you started." or "{project} is active again after {days} days. Welcome back."

   **d. Pattern Insight** — `detectPatternInsights()`:
   - Look at user's work patterns from conversation timestamps and project activity:
     * "You've been working on {project} every day this week. That's unusual — normally you rotate."
     * "Three of your last five conversations were about {topic}. Turning into a focus area?"
   - Lightweight heuristic — no ML, just timestamp/frequency analysis.

   **e. Personal Moment** — `detectPersonalMoments()`:
   - Anniversary of project creation dates ("GregLite turns 1 week old today. You've shipped {N} sprints.")
   - First-time events from telemetry ("First time you've had 5+ projects active simultaneously.")
   - This is the warmest category — Greg's voice can be slightly more personal here while staying professional.

3. **Recall scorer** — `lib/recall/scorer.ts`:
   - `scoreRecallEvent(event: RecallEvent, userHistory: RecallUserAction[]): number`:
   - Factors:
     * Base relevance from detection (0-1)
     * Recency penalty: recent items score lower (avoid "remember yesterday?" noise)
     * Diversity bonus: different recall types score higher (don't surface 5 file revisits in a row)
     * Dismissal penalty: if user frequently dismisses a recall type, lower that type's scores
     * Appreciation bonus: if user frequently appreciates a recall type, boost it
   - Returns adjusted score 0-1. Only events >0.4 get surfaced.
   - The scorer learns from the user's actions over time — this is how Greg calibrates between helpful and annoying.

4. **Recall scheduler** — `lib/recall/scheduler.ts`:
   - `startRecallScheduler()` / `stopRecallScheduler()`:
   - Runs `runRecallDetection()` every 2 hours (configurable in settings).
   - On each run: detect → score → store top 3-5 events in `recall_events` with `surfaced_at = NULL`.
   - A separate "surface" step runs every 30 minutes: picks the highest-scored unsurfaced event and marks it `surfaced_at = now()`.
   - Maximum 3 recall surfaces per day (hard cap). Configurable down to 0 (disable recalls entirely).
   - Wire into Background Assistant lifecycle: start after Ghost starts, stop on Ghost shutdown. Degrades gracefully if Ghost is paused.
   - Schedule uses `.unref()` so it doesn't prevent Node.js from exiting.

5. **Recall Card UI** — `components/recall/RecallCard.tsx`:
   - Appears in the ContextPanel below "Recent Decisions" and above "Quality".
   - Card design: subtle warm background (not the cyan of Ghost cards — use a warm amber/gold tint at very low opacity, `rgba(255, 191, 36, 0.05)` border, `rgba(255, 191, 36, 0.8)` accent).
   - Content:
     * Type icon (small, muted): 📁 file, 💬 conversation, 🏗️ project, 💡 insight, ✦ personal — OR use subtle SVG icons matching the lucide-react style from Sprint 23.
     * Greg's message (the recall text, 1-2 lines, truncated with "..." if needed)
     * Source name (smaller, muted: filename, project name, conversation title)
     * Relative time ("from 3 weeks ago", "last month")
   - Actions (appear on hover, not always visible):
     * "Thanks" (👍 icon or checkmark) — logs 'appreciated', removes card with subtle fade
     * "Not now" (dismiss icon) — logs 'dismissed', removes card
     * "Remind me later" (clock icon) — logs 'snoozed', hides card for 24 hours
   - Click the card body → navigates to the source (opens file in project detail, loads conversation, etc.)
   - Framer Motion: use `cardLift` from `lib/design/animations.ts` for hover, `fadeIn` for appearance.
   - Maximum 1 recall card visible at a time in the ContextPanel. Next one appears after the current is acted on or after 4 hours (auto-dismiss if ignored).

6. **ContextPanel integration** — `components/context/ContextPanel.tsx`:
   - Add a "RECALL" section between "Recent Decisions" and "Quality".
   - Section only appears when there's an active (surfaced, not acted on) recall event.
   - When no recall is active, the section is completely hidden (no empty state, no "no memories" — just invisible).
   - Fetch active recall from `/api/recall/active` on mount and every 60 seconds.

7. **API routes** — `app/api/recall/`:
   - `GET /api/recall/active` — returns the currently surfaced recall event (if any). Returns `{ event: RecallEvent | null }`.
   - `POST /api/recall/action` — accepts `{ eventId: string, action: RecallUserAction }`. Updates the event, removes from active display.
   - `POST /api/recall/run` — manually trigger a recall detection pass (for testing/debugging). Returns detected events.
   - `GET /api/recall/history` — returns last 50 recall events with user actions (for Inspector diagnostics).

8. **Recall settings** — `components/settings/RecallSection.tsx`:
   - New section in Settings panel: "Recall" (or "Memory Highlights" in user-facing copy per Sprint 23 voice audit).
   - Controls:
     * Enable/disable recall entirely (toggle)
     * Maximum recalls per day: slider 0-5 (default 3)
     * Detection frequency: dropdown (1h, 2h, 4h, 8h — default 2h)
     * Per-type toggles: enable/disable each recall type independently
   - All settings stored in `kernl_settings` table.

9. **Voice copy — recall messages** — `lib/voice/copy-templates.ts`:
   - Add `recall` section with all recall message templates. These are the heart of the feature — they define whether Greg feels like a friend or a stalker. Get the voice RIGHT:

   ```typescript
   recall: {
     // File revisit
     file_revisit_intensive: (filename: string, month: string) =>
       `You worked on ${filename} pretty intensively last ${month}. Haven't touched it since.`,
     file_revisit_conversations: (filename: string, count: number, month: string) =>
       `This came up in ${count} conversations back in ${month}: ${filename}.`,
     file_revisit_forgotten: (filename: string, days: number) =>
       `${filename}. ${days} days since you last opened it. Still relevant?`,

     // Conversation callback
     conversation_decision: (topic: string, timeAgo: string) =>
       `You made a call on ${topic} ${timeAgo}. Worth checking how that played out?`,
     conversation_deep: (project: string, title: string, date: string) =>
       `${project}: you worked through ${title} on ${date}. Still holding up?`,

     // Project milestone
     project_version: (project: string, version: string, sprintCount: number) =>
       `${project} hit ${version}. That's ${sprintCount} sprints since you started.`,
     project_reactivated: (project: string, days: number) =>
       `${project} is active again after ${days} days. Welcome back.`,

     // Pattern insight
     pattern_focus: (project: string) =>
       `You've been on ${project} every day this week. That's not your usual rotation.`,
     pattern_topic: (topic: string, count: number) =>
       `${count} of your last conversations circled back to ${topic}. Turning into a focus area?`,

     // Personal moment
     moment_anniversary: (project: string, duration: string, sprintCount: number) =>
       `${project} turns ${duration} old today. ${sprintCount} sprints shipped.`,
     moment_first: (description: string) =>
       `First time: ${description}.`,

     // Actions
     action_appreciated: 'Noted.',
     action_dismissed: 'Gone.',
     action_snoozed: 'Will circle back tomorrow.',

     // Settings
     settings_title: 'Memory Highlights',
     settings_description: 'Greg surfaces things worth remembering — old files, past decisions, project milestones. Adjust how often and what types.',
     settings_frequency_label: 'How often Greg looks for things to surface',
     settings_max_per_day_label: 'Maximum highlights per day',
     settings_type_toggles_label: 'What Greg looks for',
   }
   ```

   Note the voice: short, direct, data-forward. "Haven't touched it since." not "It's been a while since you worked on this!" The sardonic edge is subtle — "Still holding up?" implies Greg is genuinely curious, not prompting. "Welcome back." is warm without being saccharine.

10. **Inspector integration** — `components/inspector/InspectorDrawer.tsx`:
    - Add a "Recall" section to the Learning tab (or create a dedicated Memory tab if the Learning tab is getting crowded).
    - Shows: recall detection stats (last run time, events detected, events surfaced today), user action breakdown (appreciated vs dismissed vs snoozed — helps Greg learn), and the last 10 recall events with their actions.
    - This is the diagnostic view for power users who want to understand Greg's recall behavior.

11. **Frequency calibration** — `lib/recall/scorer.ts`:
    - Track the ratio of appreciated:dismissed:snoozed actions over time.
    - If dismissal rate exceeds 60% over the last 20 events, Greg automatically reduces recall frequency by one step (e.g., 2h → 4h) and logs: "Dialing it back. You've been dismissing most highlights — I'll surface fewer."
    - If appreciation rate exceeds 70%, Greg can suggest increasing frequency: "You seem to like these. Want me to surface more?"
    - These auto-adjustments show in the settings section with an explanation. User can override at any time.

12. **TypeScript Gate + Test Suite** — zero new errors, all tests green:
    - `npx tsc --noEmit`: 0 errors
    - `pnpm test:run`: all passing + new tests:
      * Detector: test each detection strategy with mock data
      * Scorer: test relevance scoring, dismissal penalty, diversity bonus
      * Frequency calibration: test auto-reduction trigger at 60% dismissal rate
      * Recall card: test action dispatching (appreciated/dismissed/snoozed)
      * API routes: test active recall fetch, action recording

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- ALL recall message copy MUST go through lib/voice/copy-templates.ts. Zero hardcoded strings.
- Greg's voice in recall messages is CRITICAL. Deadpan professional, genuinely warm without sentimentality, data-forward. Review GREGORE_AUDIT.md §1 before writing any copy.
- Maximum 3 recalls per day by default. NEVER overwhelm the user.
- Maximum 1 recall card visible at a time. No notification stack.
- Recall section in ContextPanel is INVISIBLE when no active recall — no empty state, no placeholder.
- The recall detector runs server-side (Node.js). No Tauri dependencies.
- All detection is heuristic (timestamp/frequency analysis). No LLM calls in the detection pipeline — save API costs for the strategic thread.
- The scorer MUST learn from user actions. Dismissal patterns reduce frequency. Appreciation patterns can increase it. This is what separates "helpful friend" from "annoying notification system."
- Ghost Thread must NEVER block the UI. Recall detection is async and non-blocking.
- If the Background Assistant is paused or stopped, recall detection pauses too. No recalls surface during downtime.
- This is a large sprint (12 tasks). Split if needed: Tasks 1-4 + 7 (backend pipeline) first commit, Tasks 5-6 + 8-11 (UI + voice + calibration) second commit.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell)
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to temp file, then `git commit -F temp_msg.txt`.


═══════════════════════════════════════════════════════════════
SPRINT 28.0 — Ceremonial Onboarding: Life & Work Synthesis
Run after Sprint 27.0 (Ambient Memory). Requires Portfolio + Background Assistant + Recall.
The moment Greg truly sees you for the first time.
═══════════════════════════════════════════════════════════════

Execute Sprint 28.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Dev\TECHNICAL_STANDARDS.md
  Filesystem:read_file D:\Projects\GregLite\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\docs\PORTFOLIO_SPEC.md
  Filesystem:read_file D:\Projects\GregLite\GREGORE_AUDIT.md (Section 1 — voice)
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\ghost\lifecycle.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\ghost\ingest\index.ts
  Filesystem:read_file D:\Projects\GregLite\app\lib\recall\detector.ts (Sprint 27 — detection pipeline)
  Filesystem:read_file D:\Projects\GregLite\app\lib\portfolio\scanner.ts (Sprint 24 — project scanner)
  Filesystem:read_file D:\Projects\GregLite\app\components\portfolio\PortfolioDashboard.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\onboarding\OnboardingFlow.tsx (existing 4-step wizard)

Summary: The most emotionally significant feature in GregLite. When a new user starts, they index data sources one at a time — files, projects, email, etc. Each source addition triggers a short synthesis: "Now that I can see your career data, here's what stands out..." and crucially, shows what NEW capabilities are unlocked by COMBINING this source with previously indexed ones. Each synthesis builds excitement and demonstrates concrete value. After all sources are indexed, a final master synthesis delivers a clear, outside-looking-in view of the user's life and work — patterns they've never seen about themselves. This moment must be earned through data depth and genuinely insightful. It also motivates users who skipped optional sources to go back and add them.

VOICE MANDATE: This is Greg at his most thoughtful. Still deadpan professional — no exclamation marks, no "Wow!" — but genuinely insightful and respectful of the magnitude of what the user is sharing. Greg acknowledges that the user is trusting him with their digital life. The tone is: "I see you clearly now. Here's what I notice." Not: "OMG look at all this amazing data!! 🎉"

Tasks:

1. **Indexing source registry** — `lib/synthesis/types.ts` + `lib/kernl/database.ts`:
   - New SQLite table:
     ```sql
     CREATE TABLE IF NOT EXISTS indexing_sources (
       id TEXT PRIMARY KEY,
       type TEXT NOT NULL,        -- 'local_files', 'projects', 'email', 'conversations', 'calendar', 'notes', 'custom'
       label TEXT NOT NULL,       -- user-facing name: "Local Files", "Projects", "Email", etc.
       status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'indexing', 'complete', 'skipped', 'error'
       path_or_config TEXT,       -- path for files, config JSON for email/calendar
       indexed_count INTEGER DEFAULT 0,   -- files/items indexed so far
       total_count INTEGER,               -- estimated total (NULL if unknown)
       started_at INTEGER,
       completed_at INTEGER,
       synthesis_text TEXT,       -- Greg's per-source synthesis (populated after completion)
       combination_text TEXT,     -- Greg's combination synthesis (what this + previous sources unlock)
       created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
     );
     ```
   - `IndexingSource` TypeScript interface.
   - `IndexingStatus` type.
   - `SynthesisResult` type: { sourceId: string, sourceSynthesis: string, combinationSynthesis: string | null, capabilitiesUnlocked: string[] }

2. **Per-source synthesis generator** — `lib/synthesis/generator.ts`:
   - `generateSourceSynthesis(source: IndexingSource, previousSources: IndexingSource[]): Promise<SynthesisResult>`:
   - This DOES use the Claude API — it's a one-time synthesis per source, worth the cost.
   - Prompt structure:
     * System: "You are Greg, a cognitive operating system. You've just finished indexing a user's {source_type}. Provide a brief, insightful synthesis of what you found — patterns, notable items, and what capabilities this data enables. Be direct, data-forward, genuinely thoughtful. No exclamation marks. No filler. Address the user directly."
     * If previous sources exist, add: "You previously indexed {list}. Explain what NEW capabilities are unlocked by COMBINING this new source with the existing data. Be specific — name concrete things you can now do that weren't possible before."
   - Parse the response into `sourceSynthesis` (what Greg found in this source alone) and `combinationSynthesis` (what combining with previous sources unlocks).
   - Extract `capabilitiesUnlocked` as a short list of concrete new abilities.
   - Store results in `indexing_sources` table.

3. **Master synthesis generator** — `lib/synthesis/master.ts`:
   - `generateMasterSynthesis(sources: IndexingSource[]): Promise<MasterSynthesis>`:
   - Triggered when all non-skipped sources are complete (or user explicitly requests it).
   - `MasterSynthesis` type: { overview: string, patterns: string[], insights: string[], blindSpots: string[], capabilitySummary: string }
   - Prompt structure:
     * System: "You are Greg. You've now fully indexed a user's digital life across these sources: {list with counts}. Deliver a master synthesis — a clear, outside-looking-in view of their life and work. Identify patterns they probably haven't noticed about themselves. Be specific, cite data. This is the moment you truly see them for the first time. Be worthy of the trust they've placed in you. Deadpan professional — no sentimentality, no exclamation marks — but genuinely insightful. Structure your response as: OVERVIEW (2-3 sentences, the big picture), PATTERNS (3-5 patterns you notice), INSIGHTS (2-3 things that might surprise them), BLIND_SPOTS (1-2 areas where data is thin or missing — gently encourages adding more sources), CAPABILITIES (summary of what Greg can now do with this combined data)."
   - Parse structured response into MasterSynthesis fields.
   - Store in a new `master_synthesis` table (or as a special row in `indexing_sources` with type='master').

4. **Source indexing orchestrator** — `lib/synthesis/orchestrator.ts`:
   - `IndexingOrchestrator` class that manages the ceremony:
     * `addSource(type, path/config)` — registers source, starts indexing
     * `onSourceComplete(sourceId)` — triggers per-source synthesis, then combination synthesis
     * `onAllComplete()` — triggers master synthesis
     * `getProgress()` — returns current state of all sources for the UI
   - Wires into Background Assistant's ingest pipeline: when Ghost finishes processing a batch of files, the orchestrator updates `indexed_count` and checks for completion.
   - For non-file sources (email, calendar): the orchestrator manages the connection and import flow.

5. **Ceremonial UI — Source Addition Flow** — `components/synthesis/SourceAdditionFlow.tsx`:
   - Replaces or extends the existing OnboardingFlow for the data indexing phase.
   - Each source addition is a mini-ceremony:
     * Step 1: Source selection card (icon + name + description of what Greg can do with it)
     * Step 2: Configuration (path picker for files, OAuth for email, etc.)
     * Step 3: Indexing progress — NOT a boring loading bar. Instead:
       - Animated counter showing items indexed ("247 files scanned...")
       - Every few seconds, a preview snippet: "Found your GregLite project... 1,344 tests, nice."
       - Category breakdown appearing in real-time: "12 TypeScript projects, 145 research documents, 3 business plans..."
     * Step 4: Per-source synthesis — Greg's analysis appears, typewriter-style (character by character, ~50ms per character, feels like Greg is thinking and writing)
     * Step 5: Combination synthesis (if previous sources exist) — "Now that I can see both your code AND your research... {combination insight}". Show capabilities unlocked as they appear, each with a subtle animation (fade-in from left, staggered 200ms).
   - "Add Another Source" button returns to Step 1.
   - "I'm done for now" button exits the ceremony. If not all sources are added, Greg gently notes what's missing: "Your email and calendar aren't connected yet. When you're ready, I'll be able to {specific capability}."

6. **Master Synthesis Ceremony** — `components/synthesis/MasterSynthesis.tsx`:
   - Full-screen or near-full-screen modal that appears when all sources complete.
   - The big moment. Design:
     * Dark background, centered content, plenty of breathing room.
     * Opening: "I see you now." (Greg's voice, large text, fade-in, 2-second pause)
     * Overview section: Greg's big-picture summary, typewriter-style.
     * Patterns section: each pattern fades in sequentially (1 second apart). Each is a card with a brief label and 1-2 sentence explanation.
     * Insights section: same treatment. These should feel like genuine revelations.
     * Blind spots section (optional — only if there are genuinely missing sources): "There are a few things I can't see yet." with specific suggestions.
     * Capabilities summary: "Here's what I can do for you now:" with a grid of capability cards.
   - "Let's get to work" button dismisses and opens the Strategic tab with a fresh conversation.
   - The master synthesis is saved and accessible later from Settings or the Inspector.

7. **Progress persistence** — API routes for synthesis state:
   - `GET /api/synthesis/status` — returns all indexing sources with their status and synthesis text.
   - `POST /api/synthesis/add-source` — registers and starts indexing a new source.
   - `GET /api/synthesis/master` — returns the master synthesis (if completed). Returns null if not all sources are done.
   - `POST /api/synthesis/generate-master` — manually trigger master synthesis (for users who want it before adding all sources).

7. **Re-engagement nudges** — `lib/synthesis/nudges.ts`:
   - For users who completed onboarding with some sources skipped:
     * After 3 days of active use, surface a recall card (Sprint 27 system): "You're getting good use out of Greg with {N} sources. Connecting your email would let me {specific capability}."
     * After a relevant moment: e.g., user mentions a meeting in conversation → "If your calendar were connected, I'd already know about that meeting."
   - Maximum 1 source nudge per week. Never nag. If dismissed twice for the same source, stop nudging for that source permanently.
   - Voice: helpful, specific about what's gained, never guilt-tripping. "Your call. I just wanted you to know what's possible." not "You're missing out!"

8. **Synthesis animation library** — `lib/design/synthesis-animations.ts`:
   - Typewriter effect: configurable speed (default 30ms/char for synthesis text, 50ms for master synthesis).
   - Counter animation: number ticking up smoothly (used for "247 files scanned" counter).
   - Staggered fade-in: for capability cards and pattern cards (200ms stagger between items).
   - Reveal animation: for the master synthesis opening ("I see you now." with a slow 2s fade).
   - All animations respect `prefers-reduced-motion` — instant display instead of animation.
   - Export from `lib/design/index.ts` alongside existing animation module.

9. **Voice copy — synthesis messages** — `lib/voice/copy-templates.ts`:
   - Add `synthesis` section:
     ```typescript
     synthesis: {
       // Source selection
       source_local_files_title: 'Local Files',
       source_local_files_desc: 'Your documents, code, research, and creative work.',
       source_projects_title: 'Projects',
       source_projects_desc: 'Registered projects with their status and backlogs.',
       source_email_title: 'Email',
       source_email_desc: 'Conversations, attachments, and professional context.',
       source_calendar_title: 'Calendar',
       source_calendar_desc: 'Schedule, meetings, and time commitments.',

       // Indexing progress
       indexing_scanning: (count: number) => `${count.toLocaleString()} items scanned...`,
       indexing_preview: (finding: string) => `Found: ${finding}`,
       indexing_complete: (count: number, type: string) => `${count.toLocaleString()} ${type} indexed.`,

       // Combination unlocks
       combination_intro: 'Now that I can see both...',
       capability_unlocked: (capability: string) => capability,

       // Skipped sources
       skipped_gentle: (sourceLabel: string, capability: string) =>
         `${sourceLabel} isn't connected yet. When you're ready, I'll be able to ${capability}.`,

       // Master synthesis
       master_opening: 'I see you now.',
       master_patterns_header: 'Patterns',
       master_insights_header: 'Things you might not have noticed',
       master_blindspots_header: 'What I can\'t see yet',
       master_capabilities_header: 'What I can do for you now',
       master_dismiss: 'Let\'s get to work.',

       // Re-engagement nudges
       nudge_source: (sourceLabel: string, capability: string) =>
         `Connecting ${sourceLabel} would let me ${capability}. Your call.`,
       nudge_contextual: (sourceLabel: string, capability: string) =>
         `If ${sourceLabel} were connected, ${capability}.`,
     }
     ```

10. **Telemetry for synthesis** — `lib/synthesis/orchestrator.ts`:
    - Capture anonymized onboarding data to `portfolio_telemetry`:
      * Which sources were added, in what order
      * Which sources were skipped
      * Time spent on each synthesis step (reading, not just waiting)
      * Whether user completed master synthesis or exited early
      * Whether nudges led to additional source connections
    - No content, names, paths, or synthesis text in telemetry. Strictly behavioral data.

11. **TypeScript Gate + Test Suite** — zero new errors, all tests green:
    - `npx tsc --noEmit`: 0 errors
    - `pnpm test:run`: all passing + new tests:
      * Synthesis generator: test prompt construction with various source combinations
      * Master synthesis: test parsing of structured response
      * Orchestrator: test source lifecycle (pending → indexing → complete → synthesis)
      * Nudge logic: test weekly cap, permanent dismissal after 2x
      * Animation: test reduced-motion fallback

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- ALL synthesis and ceremony copy MUST go through lib/voice/copy-templates.ts.
- Greg's voice is CRITICAL here. This is the most personal feature in the product. Deadpan professional, genuinely insightful, respectful of the trust. Review GREGORE_AUDIT.md §1 before writing ANY user-facing text.
- Per-source synthesis and master synthesis DO use Claude API calls. Budget ~$0.05-0.10 per synthesis. This is a one-time cost per source that's absolutely worth it.
- Master synthesis quality must be genuinely impressive. If the insight is shallow, the ceremony falls flat. The prompt engineering for the master synthesis is the most important work in this sprint.
- Typewriter animation speed: 30ms/char for per-source synthesis, 50ms/char for master synthesis (slower = more gravitas).
- Maximum 1 source nudge per week. Dismissed twice = permanent silence for that source. Never nag.
- All animations respect prefers-reduced-motion.
- The master synthesis is stored permanently and accessible from Settings/Inspector. This isn't a one-time-only experience.
- Ghost Thread must NEVER block the UI. Synthesis generation is async.
- This is a large sprint (11 tasks). Split if needed: Tasks 1-4 + 7 (backend pipeline + API) first commit, Tasks 5-6 + 8-10 (UI + animations + voice) second commit.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell)
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to temp file, then `git commit -F temp_msg.txt`.
