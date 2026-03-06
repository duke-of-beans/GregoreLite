═══════════════════════════════════════════════════════════════
SPRINT 22.0 — First Launch Polish + Missing Dependency
Run FIRST. No dependencies. Fixes the 6 issues found during first real launch.
═══════════════════════════════════════════════════════════════

Execute Sprint 22.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Dev\TECHNICAL_STANDARDS.md
  Filesystem:read_file D:\Projects\GregLite\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\Header.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\chat\ChatInterface.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\chat\ChatHistoryPanel.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\transit\ScrollbarLandmarks.tsx
  Filesystem:read_file D:\Projects\GregLite\app\components\ui\StatusBar.tsx
  Filesystem:read_file D:\Projects\GregLite\app\app\page.tsx
  Filesystem:read_file D:\Projects\GregLite\app\lib\stores\thread-tabs-store.ts

Summary: Six issues found during the first real launch of GregLite on March 6, 2026. The app opens to a stale conversation instead of a blank slate, there's no visible "New Conversation" button, the Chat History drawer has transparency bleed-through, scrollbar landmark ticks exist but aren't clickable for navigation, the ATTN budget counter in the StatusBar is cryptic to anyone who hasn't read the Sacred Laws spec, and the Ghost scorer's embedding dependency is missing. After this sprint, GregLite feels like a finished product on first open.

Tasks:

1. **Always open on a new conversation** — `app/app/page.tsx` + `lib/stores/thread-tabs-store.ts`:
   - On app launch, the ChatInterface should render with an empty message list and a fresh conversationId — never auto-restore the last active thread.
   - The thread-tabs-store's initialization or the page.tsx startup logic should call the "new thread" action instead of restoring the previous tab state.
   - Existing conversations remain accessible via Chat History (Cmd+[) or the "See All" link in the ContextPanel.
   - Previous thread restore behavior should still work when explicitly clicking a conversation in Chat History — just not on cold boot.

2. **Add visible "New Conversation" button** — `components/ui/Header.tsx`:
   - Add a `+` icon button to the left of the notification bell in the header's right section (or next to the logo — wherever feels natural).
   - On click, dispatch `window.dispatchEvent(new CustomEvent('greglite:new-thread'))` (same as the existing logo click behavior).
   - Style: same button treatment as the settings gear and Cmd+K button (rounded-lg, border, elevated bg, frost text, hover cyan).
   - Tooltip: "New conversation (Cmd+N)".
   - The logo click can keep its new-thread behavior too — this just makes it discoverable.

3. **Fix Chat History drawer transparency** — `components/chat/ChatHistoryPanel.tsx`:
   - The drawer's background uses `var(--bg)` which appears to be semi-transparent or undefined in some contexts, causing the main content to bleed through.
   - Replace with an explicit opaque background: `background: 'var(--deep-space, #0a0e17)'` (the app's root background color) as a hardcoded fallback.
   - Also ensure the backdrop overlay is fully opaque enough: `rgba(0,0,0,0.5)` instead of the current `0.3`.
   - The drawer should feel like a solid panel, not a translucent overlay.

4. **Make scrollbar landmark ticks clickable** — `components/transit/ScrollbarLandmarks.tsx`:
   - Add an `onScrollToMessage` prop: `(messageIndex: number) => void`.
   - On each landmark tick, add `onClick` that calls `onScrollToMessage(e.message_index)` when `message_index` is available.
   - Change `cursor: 'default'` to `cursor: 'pointer'` on clickable ticks (those with a valid `message_index`).
   - In the parent (MessageList.tsx or ChatInterface.tsx), wire `onScrollToMessage` to scroll the message container to the target message element (e.g., `document.getElementById('message-{index}')?.scrollIntoView({ behavior: 'smooth', block: 'center' })`).
   - This is the DeepSeek-style behavior: no matter where you are in the scroll, clicking a tick jumps you to that point in the conversation.

5. **Hide ATTN budget from StatusBar** — `components/ui/StatusBar.tsx`:
   - Remove the `ATTN: 100/100 CT` display from the StatusBar entirely.
   - The attention budget system (lib/focus/attention-budget.ts) stays intact — it still gates interrupts internally.
   - The ATTN display should move to the Inspector drawer's existing "Learning" or "Quality" tab where power users can find it.
   - Add a simple "Attention Budget" section to the Inspector (InspectorDrawer.tsx) showing the current budget, spend breakdown, and reset time.

6. **Install @xenova/transformers** — package.json:
   - Run `pnpm add @xenova/transformers` in the `app/` directory.
   - Verify the Ghost scorer's embedding model (`lib/embeddings/model.ts`) can now import the package without the `ERR_MODULE_NOT_FOUND` error.
   - The first run will download the model (~30MB) — this is expected and should happen in the background without blocking the UI.
   - If the import path needs adjustment for the Turbopack/Next.js environment, fix it. The current code uses dynamic import with `/* webpackIgnore: true */` which may need updating for Turbopack.

7. **Fix SQLite schema gaps** — `lib/kernl/schema.sql` + database initialization:
   - Three schema errors appeared at runtime:
     a. `conversation_events` table missing `created_at` column — add it to the CREATE TABLE or run an ALTER TABLE migration.
     b. `eos_reports` table missing `scanned_at` column — same treatment.
     c. `kernl_settings` table doesn't exist — ensure `runMigrations()` creates it if missing.
   - Check `lib/kernl/schema.sql` and `lib/kernl/database.ts` for the migration logic.
   - All three should be handled by the existing `runMigrations()` function — if the tables exist but are missing columns, use `ALTER TABLE ADD COLUMN IF NOT EXISTS` pattern (SQLite doesn't support IF NOT EXISTS on ALTER, so catch the "duplicate column" error).

8. **TypeScript Gate + Test Suite** — zero new errors, all tests green:
   - `npx tsc --noEmit` from `app/` directory: 0 errors.
   - `pnpm test:run` from `app/` directory: 1344+ tests passing (may add new tests for scrollbar click behavior).
   - No regressions in existing functionality.

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- All new UI components go in src/components/ with barrel exports.
- KERNL SQLite database — never modify schema without migration.
- Sacred Laws are NON-NEGOTIABLE — read SACRED_LAWS.md before any UX changes.
- Ghost Thread must NEVER block the UI. Dev mode works WITHOUT Tauri watcher.
- Git operations require full path: `D:\Program Files\Git\cmd\git.exe`
- Commit messages via temp file (em-dashes break cmd).
- The @xenova/transformers install may take time (downloads model on first use) — do not let this block other tasks.
- SQLite ALTER TABLE doesn't support IF NOT EXISTS — wrap in try/catch for "duplicate column name" errors.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell)
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to temp file, then `git commit -F temp_msg.txt`.
