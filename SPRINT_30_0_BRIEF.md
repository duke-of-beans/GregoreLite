═══════════════════════════════════════════════════════════════
SPRINT 30.0 — UX Reality Check: Daily Driver Polish
Run FIRST. No dependencies. Fixes everything found during real daily use.
═══════════════════════════════════════════════════════════════

Execute Sprint 30.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Dev\TECHNICAL_STANDARDS.md
  Filesystem:read_file D:\Projects\GregLite\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\GREGORE_AUDIT.md (Section 1 — voice)
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\chat\ChatInterface.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\Header.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\StatusBar.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\context\ContextPanel.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\chat\InputField.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\morning-briefing\MorningBriefing.tsx
  Filesystem:read_file D:\Projects\GregLite\app\app\globals.css
  Filesystem:read_file D:\Projects\GregLite\app\src-tauri\tauri.conf.json

Summary: Everything found during the first real daily-driving session. This sprint fixes the UX contradictions, visual clutter, and missing polish that separate a shipped product from a usable one. Tab layout rethought, header buttons made consistent, ContextPanel decluttered, message input made smart, StatusBar made collapsible, favicon fixed, and a Quick Capture reference added to the UI. After this sprint, every visible element has been touched by a human who actually used the app.

VOICE MANDATE: All new/changed user-facing text goes through lib/voice/copy-templates.ts.

═══════════════════════════════════════════════════════════════
PHASE A — LAYOUT & NAVIGATION
═══════════════════════════════════════════════════════════════

Tasks:

1. **Rethink tab placement: Projects as meta-navigation** — `components/chat/ChatInterface.tsx` + `components/ui/Header.tsx`:
   - Remove "Projects" from the TABS array entirely. It is NOT a peer of Strategic/Workers/Task Board/Conversation Map — it's a higher-level view.
   - Add a Projects icon button to the Header, positioned LEFT of the `?` help button. Same button styling as the other header buttons (rounded-lg, border, elevated bg).
   - Icon: the same FolderKanban (or equivalent) lucide icon currently used in the tab.
   - On click: opens the PortfolioDashboard as a full-screen overlay (same pattern as SettingsPanel or ChatHistoryPanel — slide in from left or appear as modal). NOT a tab.
   - Tooltip: "Projects (Cmd+P)" — register Cmd+P as the keyboard shortcut.
   - This means the main tabs are now: Strategic, Workers, Task Board, Conversation Map — four tabs, all focused on the CURRENT work session. Projects is the meta-layer above.

2. **Add text labels to ALL tab icons** — `components/chat/ChatInterface.tsx`:
   - Currently some tabs have text, some are icon-only. This is inconsistent.
   - ALL tabs get icon + text at full width (>1024px). At <1024px, collapse to icon-only (Sprint 23.0 responsive behavior stays).
   - The tab bar should render: `[icon] Strategic  [icon] Workers  [icon] Task Board  [icon] Map`
   - Each tab's tooltip should describe what it does, not just its name:
     * Strategic: "Your main conversation with Greg"
     * Workers: "Automated background tasks"
     * Task Board: "Visual status of running tasks"
     * Map: "Timeline of conversation key moments"

3. **Header button consistency** — `components/ui/Header.tsx`:
   - Currently: `?` has circle outline, notification bell has circle outline, settings gear has rounded-lg+border, Cmd+K has rounded-lg+border+text. That's two different button styles in the same row.
   - Unify ALL header buttons to the same style: rounded-lg, border, elevated bg, frost text, hover cyan. No exceptions.
   - Order (left to right): Projects button, `?` Help, Notification bell, Settings gear, Cmd+K command palette.
   - ALL buttons get the same dimensions (padding, border-radius, icon size). Visual rhythm matters.

4. **Remove "CONTEXT" label from ContextPanel** — `components/context/ContextPanel.tsx`:
   - Remove the "CONTEXT" heading and the border line under it entirely.
   - The top of the panel should be: collapse chevron button (top-right corner), then immediately the "+ New Conversation" button, then "RECENT CHATS" section.
   - The panel doesn't need to announce what it is. Its contents are self-explanatory.

5. **Add Quick Capture reference to UI** — `components/ui/StatusBar.tsx` or `components/ui/Header.tsx`:
   - Users won't discover Ctrl+Shift+Space on their own. Add a small, subtle capture icon/button somewhere visible.
   - Option A: A small pencil/note icon in the Header (same style as other header buttons), tooltip: "Quick Capture (Ctrl+Shift+Space)". On click, opens the capture pad.
   - Option B: A `CAPTURE` label in the StatusBar that acts as a click target for opening the pad. Less prominent than a header button.
   - Prefer Option A (header button) for discoverability. The StatusBar is already crowded.

═══════════════════════════════════════════════════════════════
PHASE B — INPUT & INTERACTION
═══════════════════════════════════════════════════════════════

6. **Smart message input: auto-indent lists** — `components/chat/InputField.tsx`:
   - When the user types "1." or "•" or "-" or "*" at the start of a line and hits Enter, automatically:
     * Insert a newline
     * Add the next list marker ("2.", "3.", etc. for numbered; same marker for bullet lists)
     * Indent with appropriate spacing
   - If the user hits Enter on an empty list item (just the marker with no text), break out of the list (remove the marker, return to normal input).
   - If the user starts a line with a tab or 2+ spaces after a list marker, treat as a nested list (indent one level deeper).
   - This matches Claude's web interface behavior and is expected by power users.
   - Also support: when user types ``` (triple backtick), auto-insert closing ``` on the next line and position cursor between them (code block shortcut).

7. **Message input: auto-expand with content** — `components/chat/InputField.tsx`:
   - Currently the input has a fixed height. Long messages get cramped.
   - The textarea should auto-expand as the user types, up to a maximum of ~40% of the viewport height.
   - Use `scrollHeight` tracking: on every input event, set `textarea.style.height = 'auto'` then `textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px'`.
   - When the content shrinks (user deletes lines), the textarea shrinks back down.
   - Minimum height: 2 lines (~48px). Maximum height: 40vh. Beyond max, the textarea scrolls internally.
   - On send (Enter without Shift), reset height to minimum.

8. **Morning briefing dismiss button** — `components/morning-briefing/MorningBriefing.tsx`:
   - Replace "Start Day" button text with an X/close icon button in the top-right corner of the briefing panel.
   - The current "Start Day" text implies something will happen next (a walkthrough, a setup flow). It should just be a dismiss.
   - Style: small, muted X icon (same as the ChatHistoryPanel close button pattern). Tooltip: "Dismiss briefing".
   - Optionally keep a "Don't show again today" text link below the X for users who find the briefing annoying.

═══════════════════════════════════════════════════════════════
PHASE C — VISUAL POLISH
═══════════════════════════════════════════════════════════════

9. **StatusBar collapse toggle** — `components/ui/StatusBar.tsx` + `lib/stores/ui-store.ts`:
   - Add a collapse/expand toggle on the StatusBar. When collapsed, the StatusBar is completely hidden (0 height) — freeing up that vertical space for the chat.
   - Toggle mechanism: a small chevron icon at the far-left or far-right of the StatusBar. Click to collapse. When collapsed, a thin 2px line appears at the bottom of the screen that expands the StatusBar on hover or click.
   - Store collapsed state in ui-store (persisted to kernl_settings).
   - Also add a Settings toggle: "Show status bar" (on/off). Default: on.
   - This addresses the "visually claustrophobic" feeling compared to Claude/GPT which have minimal or no footer chrome.

10. **Window and taskbar favicon** — `src-tauri/tauri.conf.json` + `src-tauri/icons/`:
    - The Tauri window icon is set via `bundle.icon` paths in tauri.conf.json.
    - Sprint 22 generated 32x32.png, 128x128.png, 128x128@2x.png from icon.png — verify these files still exist in src-tauri/icons/.
    - The window icon in dev mode requires the icon to be compiled into the binary. Check if `tauri.conf.json` has a `windows` section under `app.windows[0]` with an `icon` field — if not, add it: `"icon": "icons/icon.png"`.
    - For the Windows taskbar, the icon comes from the .ico file. Verify `icons/icon.ico` exists and is valid.
    - If the icon STILL doesn't appear in dev mode after these checks, the issue is that Tauri dev mode uses a default icon. The fix is to add `"icon": ["icons/icon.png"]` to the `app.windows[0]` config (not just bundle.icon).

11. **Favicon in the web layer** — `app/app/layout.tsx` or `app/app/favicon.ico`:
    - Verify that `app/favicon.ico` is being served correctly by Next.js.
    - If using the App Router, Next.js should auto-detect `app/favicon.ico`. If not, add explicit metadata in `layout.tsx`:
      ```tsx
      export const metadata = {
        icons: { icon: '/favicon.ico' },
      };
      ```

═══════════════════════════════════════════════════════════════
PHASE D — BACKLOG ITEMS (capture for future sprints, do NOT implement)
═══════════════════════════════════════════════════════════════

The following items from this feedback session should be ADDED to FEATURE_BACKLOG.md as future work, NOT implemented in this sprint:

a. **Start at Windows/Mac boot toggle** — Settings option + NSIS installer wizard option to register GregLite as a startup app. Uses Windows Registry (HKCU\Software\Microsoft\Windows\CurrentVersion\Run) or macOS LaunchAgents plist. Low priority but good for daily driver UX.

b. **Headless browser mode for Claude web tokens** — Use a headless browser (Puppeteer/Playwright) to authenticate with Claude's web interface and route messages through the web session instead of the API. This would eliminate API costs during development/dogfooding. Major feature — requires session management, cookie persistence, and graceful fallback to API when web session expires. Architecturally significant.

═══════════════════════════════════════════════════════════════

12. **Add backlog items from Phase D** — `FEATURE_BACKLOG.md`:
    - Add the two items above under a new "FUTURE / UNSCHEDULED" section (or append to existing).
    - Mark both as ❌ MISSING with brief descriptions.

13. **TypeScript Gate + Test Suite** — zero new errors, all tests green:
    - `npx tsc --noEmit` from `app/` directory: 0 errors.
    - `pnpm test:run`: 1624+ tests passing.
    - No regressions.

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- All new/changed UI copy goes through lib/voice/copy-templates.ts.
- Do NOT implement the backlog items (Phase D) — only add them to FEATURE_BACKLOG.md.
- Projects must be a meta-navigation element (header button + overlay), NOT a tab.
- All header buttons must use identical styling — no mixing circle outlines with rounded-lg borders.
- Input auto-expand must have a max height (40vh) — never let the input push the message list off screen.
- StatusBar collapse state persists via ui-store → kernl_settings.
- Ghost Thread must NEVER block the UI.
- This sprint is 13 tasks across 4 phases. If it exceeds 1 session: Phase A+B first commit, Phase C+D second commit. Both must pass TypeScript gate.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell)
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to temp file, then `git commit -F temp_msg.txt`.
