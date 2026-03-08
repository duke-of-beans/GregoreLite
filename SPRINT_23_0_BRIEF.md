═══════════════════════════════════════════════════════════════
SPRINT 23.0 — Voice Audit + UX Polish + Responsiveness
Run FIRST. No dependencies. Comprehensive UI/UX pass informed by first real usage.
═══════════════════════════════════════════════════════════════

Execute Sprint 23.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Dev\TECHNICAL_STANDARDS.md
  Filesystem:read_file D:\Projects\GregLite\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\GREGORE_AUDIT.md (Section 1: Brand Voice — critical for this sprint)
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\chat\ChatInterface.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\chat\Message.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\Header.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\StatusBar.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\jobs\JobQueue.tsx
  Filesystem:read_file D:\Projects\GregLite\app\lib\stores\job-store.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\context\ContextPanel.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\transit\SankeyView.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\transit\ZoomController.tsx
  Filesystem:read_file D:\Projects\GregLite\app\app\globals.css

Summary: Three interconnected passes across the entire GregLite UI. (1) Voice/terminology audit — replace all internal codenames and jargon with plain-language, technically descriptive labels that pass the Grandma Test while keeping Greg's deadpan professional personality. (2) UX polish — fix the Workers 404, replace emoji tab icons with consistent SVG icons, move the New Conversation button to the left panel, add scroll-wheel zoom to Transit view. (3) Global responsiveness audit — add proper breakpoints so the app doesn't break on smaller screens or non-1200px windows. After this sprint, every label, tooltip, and layout in GregLite is ready for someone who hasn't read the architecture docs.

═══════════════════════════════════════════════════════════════
PHASE A — VOICE & TERMINOLOGY AUDIT
═══════════════════════════════════════════════════════════════

Tasks:

1. **Rename "Greg" as assistant handle** — `components/chat/Message.tsx` line 324:
   - Change `'GregLite'` to `'Greg'` for the assistant message handle.
   - Greg is the personality. GregLite is the product name. Messages come from Greg, not the product.

2. **Full terminology rename pass** — `lib/voice/copy-templates.ts` + all consuming components:
   The following internal codenames must be replaced with plain-language equivalents everywhere they appear in the UI (labels, tooltips, headings, status text, settings sections, empty states). The underlying code/variable names stay as-is — this is a UI-facing rename only.

   Renames:
   - "Ghost" / "Ghost Thread" → "Background Assistant" or "Background Intelligence"
     * StatusBar: `GHOST: Active` → `BACKGROUND: Active`
     * Settings section: "Ghost" → "Background Assistant"
     * GhostSection.tsx header, toggle label, degraded warning copy
     * GhostCard.tsx any visible "Ghost" labels
     * copy-templates.ts ghost-related strings
   - "AEGIS" → "System Monitor" (already used on the onboarding screen — make it consistent everywhere)
     * StatusBar: `SYSTEM: IDLE` is already good — verify no "AEGIS" leaks into UI
     * Settings if there's an AEGIS section
   - "Sacred Laws" → "Safety Rules" or "Guardrails" in any user-facing context
     * Decision gate messages that mention "Sacred Law" → reword to plain description
     * Settings: if Sacred Laws are mentioned anywhere user-facing
   - "Decision Gate" → "Review Prompt" or "Safety Check" in user-facing labels
     * GatePanel.tsx heading
     * Settings section for override policies
   - "Transit Map" → "Conversation Map" or just "Map" in tab labels and headings
   - "EoS" (Eye of Sauron) → "Code Quality" in any user-facing context
     * Inspector tabs, StatusBar, settings
   - "KERNL" → "Memory" in user-facing context
     * StatusBar: `MEMORY: Ready` — already good, verify no "KERNL" leaks
     * Settings, Inspector tabs
   - "War Room" → "Task Board" or "Orchestration" — currently the tab says "War Room" which is gaming jargon
   - "Workers" tab label is fine but the heading inside says "WORKERS 0/8 active" — add a tooltip: "Background task runners for automated code, testing, and research jobs"

   CRITICAL: Do NOT rename variables, function names, file names, or import paths. This is a UI label pass only. The voice/copy-templates.ts file should be the single source of truth — move any remaining hardcoded strings into it.

3. **Tooltip/help text audit** — every button, tab, and status indicator:
   - Every icon button in the Header must have a descriptive `title` tooltip (most already do — verify completeness).
   - Every tab (Strategic, Workers, War Room, Transit) needs a tooltip describing what it shows.
   - Every StatusBar section needs a tooltip explaining what the metric means in plain English.
   - Every Settings section needs a 1-line description under the heading explaining what it controls.
   - Inspector drawer tabs need tooltips.
   - ContextPanel sections (Recent Chats, Session, Recent Decisions, Quality) need brief descriptors.
   - If implementing tooltips is lightweight enough, prefer actual tooltip components over `title` attributes for better styling. Otherwise `title` is fine.

4. **Add a lightweight "What's this?" guide** — accessible from Header or Settings:
   - A simple modal or drawer (triggered by a `?` button in the Header) that shows a ~10 item list:
     * "Strategic" — Your main conversation thread with Greg
     * "Workers" — Automated background tasks (code generation, testing, research)
     * "Task Board" — Visual status of all running and queued worker tasks
     * "Conversation Map" — Visual timeline of your conversation's key moments
     * "Background Assistant" — Watches your files and email for relevant context
     * "System Monitor" — Tracks CPU/memory to manage workload intensity
     * "Review Prompts" — Greg pauses to double-check before risky actions
     * "Memory" — Greg's persistent knowledge from past conversations
     * "Code Quality" — Automated code health scoring
     * "Inspector" — Detailed diagnostics panel (cost, quality, learning insights)
   - Copy lives in `lib/voice/copy-templates.ts` under a new `guide` section.
   - This replaces the need for complex tour tips. Simple, scannable, always accessible.

═══════════════════════════════════════════════════════════════
PHASE B — UX FIXES
═══════════════════════════════════════════════════════════════

5. **Fix Workers tab 404** — `lib/stores/job-store.ts`:
   - Replace all `/api/jobs` references with `/api/agent-sdk/jobs`:
     * `fetchJobs()`: `fetch('/api/jobs')` → `fetch('/api/agent-sdk/jobs')`
     * `spawnJob()`: `fetch('/api/jobs', ...)` → `fetch('/api/agent-sdk/jobs', ...)`
     * `killJob()`: `fetch('/api/jobs/${jobId}', ...)` → `fetch('/api/agent-sdk/jobs/${jobId}', ...)`
   - The `/api/jobs` routes were deleted in Sprint 11.0 (route consolidation). The store was never updated.

6. **Replace emoji tab icons with SVG** — `components/chat/ChatInterface.tsx` TABS array:
   - Current emoji icons render inconsistently across OS/WebView: `★` (star), `⚙` (gear), `🗺` (map), `🚇` (subway).
   - Replace with inline SVG icons from lucide-react or hand-drawn SVGs that match the existing icon style (the settings gear SVG in Header.tsx is the reference style: 24x24 viewBox, stroke-based, strokeWidth 2).
   - New icons:
     * Strategic → compass or chat-bubble icon (visually says "main conversation")
     * Workers → cpu or terminal icon (visually says "automated tasks")
     * War Room (renamed Task Board) → layout-grid or kanban icon
     * Transit (renamed Conversation Map) → route or git-branch icon
   - Render these as `<svg>` elements inline in the tab, sized to match text (h-4 w-4).
   - All icons should use `currentColor` for stroke so they inherit the tab's active/inactive color.

7. **Move New Conversation button to left panel** — `components/ui/Header.tsx` + `components/context/ContextPanel.tsx`:
   - Remove the `+` New Conversation button from the Header.
   - Remove the `greglite:new-thread` dispatch from the GregLite logo click (logo should do nothing or navigate to strategic tab).
   - Add a "+ New Conversation" button at the top of the ContextPanel, directly above the "Recent Chats" section.
   - Style: full-width button with a `+` icon and "New Conversation" label. Subtle border, frost text, hover cyan. Matches the panel's visual language.
   - On click: dispatches `window.dispatchEvent(new CustomEvent('greglite:new-thread'))`.

8. **Add scroll-wheel zoom to Transit/Conversation Map** — `components/transit/ZoomController.tsx` + `SankeyView.tsx` + `SubwayMap.tsx`:
   - Listen for `wheel` events on the Transit view container.
   - Scroll up (deltaY < 0) → zoom in (Z1 → Z2 → Z3).
   - Scroll down (deltaY > 0) → zoom out (Z3 → Z2 → Z1).
   - Debounce wheel events (150ms) to prevent rapid zoom flickering.
   - Call `e.preventDefault()` to prevent page scroll while hovering over the Transit view.
   - The existing ZoomController already has `zoomIn`/`zoomOut` methods — wire the wheel events to those.

═══════════════════════════════════════════════════════════════
PHASE C — GLOBAL RESPONSIVENESS AUDIT
═══════════════════════════════════════════════════════════════

9. **Add responsive breakpoints to globals.css**:
   - Currently there are ZERO responsive breakpoints in the CSS. The app is hardcoded for ~1200px.
   - Add breakpoints:
     * `@media (max-width: 1024px)` — tablet/small laptop
     * `@media (max-width: 768px)` — small tablet/large phone
     * `@media (max-width: 640px)` — phone (if ever needed — low priority for a desktop app)
   - The app is Tauri desktop, so the primary concern is window resize behavior down to 800x600 (the minWidth/minHeight in tauri.conf.json).

10. **ContextPanel responsive collapse** — `components/context/ContextPanel.tsx`:
    - At < 1024px, the ContextPanel should collapse to an icon-only sidebar or hide entirely behind a hamburger toggle.
    - At full width, it should remain as-is (20% width).
    - Add a toggle button (hamburger or chevron) that shows/hides the panel.
    - Store collapsed state in ui-store so it persists across tab switches.

11. **Header responsive behavior** — `components/ui/Header.tsx`:
    - At < 1024px, hide the "Cmd+K" text label on the command palette button (keep the icon).
    - At < 768px, stack the right-side buttons more tightly (reduce gap).
    - The GregLite logo text can shrink or hide at very small widths — icon only.

12. **Tab bar responsive behavior** — `components/chat/ChatInterface.tsx`:
    - At < 1024px, tab labels should hide and show icons only.
    - At < 768px, tabs should be swipeable or overflow-scroll horizontal.
    - Ensure the tab active indicator still works with icon-only tabs.

13. **Message list and input area** — `components/chat/MessageList.tsx` + `InputField.tsx`:
    - Message text should wrap properly at all widths. Check max-width constraints.
    - Input field should remain full-width and accessible at all breakpoints.
    - Code blocks inside messages should get horizontal scroll at narrow widths (not overflow the container).
    - Receipt footers should stack vertically at narrow widths instead of inline.

14. **StatusBar responsive behavior** — `components/ui/StatusBar.tsx`:
    - At < 1024px, abbreviate labels: "COST TODAY" → "COST", "JOBS: 0 active" → "JOBS: 0", "SYSTEM: IDLE" → "SYS: IDLE".
    - At < 768px, show only the most critical 2-3 metrics (cost + system + memory), hide the rest.
    - The StatusBar should never line-wrap — always single row, with overflow hidden if needed.

15. **Inspector drawer responsive** — `components/inspector/InspectorDrawer.tsx`:
    - At < 1024px, the Inspector should overlay the full content area instead of pushing it aside.
    - Tab labels in the Inspector should be icon-only at narrow widths.

16. **JobQueue panel responsive** — `components/jobs/JobQueue.tsx`:
    - At < 1024px, the JobQueue panel should overlay or collapse (not take 25% of a small screen).
    - Add a toggle to show/hide similar to the ContextPanel.

17. **TypeScript Gate + Test Suite** — zero new errors, all tests green:
    - `npx tsc --noEmit` from `app/` directory: 0 errors.
    - `pnpm test:run` from `app/` directory: 1344+ tests passing.
    - No regressions.

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- All UI label changes go through lib/voice/copy-templates.ts — no new hardcoded strings in components.
- Do NOT rename variables, function names, file names, or import paths in the voice audit — UI labels only.
- KERNL SQLite database — never modify schema without migration.
- Sacred Laws are NON-NEGOTIABLE — read SACRED_LAWS.md before any UX changes.
- Ghost Thread must NEVER block the UI. Dev mode works WITHOUT Tauri watcher.
- Git operations require full path: `D:\Program Files\Git\cmd\git.exe`
- Commit messages via temp file (em-dashes break cmd).
- This is a large sprint (17 tasks). If it exceeds 1 session, split into two commits: Phase A+B first, Phase C second. Both must pass TypeScript gate independently.
- For responsive work: use Tailwind responsive prefixes (sm:, md:, lg:) where possible. Fall back to CSS @media queries in globals.css for complex cases. Do NOT add a Tailwind config — we use the pre-defined class subset only.
- Tab icons: prefer lucide-react SVG components (already installed as a dependency). If a suitable icon doesn't exist in lucide, use a hand-drawn inline SVG matching the Header.tsx settings gear style.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell)
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to temp file, then `git commit -F temp_msg.txt`.
