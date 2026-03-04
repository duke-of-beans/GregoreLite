# SPRINT 10.7 — Stabilization & Polish

**Goal**: Fix all runtime issues discovered during manual testing of Sprint 10.6.
**Branch**: Continue on `main` (commit on top of 65a0c64).
**Pre-req**: Read `SPRINT_10_6_BLUEPRINT.md` for full architecture context.

---

## EXECUTION INSTRUCTIONS

Use Desktop Commander tools for ALL file reads, writes, edits, and shell commands.
Do NOT use KERNL pm_read_file. Do NOT use Filesystem MCP tools.

First, read `D:\Projects\GregLite\SPRINT_10_6_BLUEPRINT.md` for architecture context.
Then execute all 7 fixes below in order. They have NO dependencies on each other.

After ALL fixes are complete:
1. Run `cd /d D:\Projects\GregLite\app && npx tsc --noEmit` — must be ZERO errors
2. Stage and commit: `git add -A && git commit -m "fix: Sprint 10.7 — stabilization fixes (7 bugs)"`

---

## FIX 1: API 500s — output:export conflict

**Root cause**: `next.config.ts` uses `NODE_ENV` to detect dev mode, but system-level
env has `NODE_ENV=production` which overrides `.env.local`. This causes `output: 'export'`
to be active even during `pnpm dev`, which crashes all API routes at module load time.

**ALREADY FIXED** — Verify the current state of `D:\Projects\GregLite\app\next.config.ts`:
- Should detect dev via `process.argv.some(arg => arg === 'dev')`, NOT `process.env.NODE_ENV`
- Variable should be `isDevServer` / `shouldExport`, NOT `isProd`

If the fix is NOT present, apply:
```ts
// Replace the isProd detection with:
const isDevServer = process.argv.some(arg => arg === 'dev') || process.env.NEXT_MANUAL_SIG_HANDLE != null;
const shouldExport = !isDevServer;
// And use shouldExport instead of isProd in the config spread
```

**File**: `app/next.config.ts`

---

## FIX 2: Migration path crash (__dirname)

**Root cause**: `loadMigrationSQL()` uses `join(__dirname, filename)` but `__dirname`
in Next.js Turbopack resolves to `.next` output directory (`D:\ROOT\...`), not the
source directory. SQL files are never found.

**ALREADY FIXED** — Verify `D:\Projects\GregLite\app\lib\database\migrations\index.ts`:
- Should use `join(process.cwd(), 'lib', 'database', 'migrations', filename)`
- NOT `join(__dirname, filename)`

If the fix is NOT present, apply:
```ts
function loadMigrationSQL(filename: string): string {
  const filepath = join(process.cwd(), 'lib', 'database', 'migrations', filename);
  return readFileSync(filepath, 'utf-8');
}
```

**File**: `app/lib/database/migrations/index.ts`

---

## FIX 3: Missing migration file

**Root cause**: Migration registry references `005_advanced_optimizations.sql` but
the file was never created. This crashes at module evaluation time for any route
that imports the database module.

**ALREADY FIXED** — Verify file exists at:
`D:\Projects\GregLite\app\lib\database\migrations\005_advanced_optimizations.sql`

If missing, create it with these indexes (matching the `down` rollback in the registry):
- `idx_conversations_list_covering` — covering index on conversations for list queries
- `idx_conversations_pinned_covering` — covering for pinned conversations
- `idx_conversations_active_only` — filtered index WHERE is_archived = 0
- `idx_conversations_archived_only` — filtered index WHERE is_archived = 1
- `idx_conversations_expensive` — filtered WHERE total_cost > 0
- `idx_messages_pagination` — (conversation_id, created_at DESC, id)
- `idx_messages_tokens` — (conversation_id, prompt_tokens, completion_tokens)
- `idx_attachments_large_files` — (size DESC) WHERE size > 1048576

All with `CREATE INDEX IF NOT EXISTS`.

**File**: `app/lib/database/migrations/005_advanced_optimizations.sql`

---

## FIX 4: Context panel caret position

**Root cause**: In `CollapsedStrip`, the expand button has `mt-auto` which pushes it
to the bottom. The collapse button in the expanded header is at the top. Both should
be at top.

**ALREADY FIXED** — Verify `D:\Projects\GregLite\app\components\context\ContextPanel.tsx`:
- The expand `<button>` in `CollapsedStrip` should NOT have `mt-auto` in its className
- It should just be `text-[var(--mist)] hover:text-[var(--ice-white)] transition-colors`

If `mt-auto` is still present, remove it from the expand button className.

**File**: `app/components/context/ContextPanel.tsx`

---

## FIX 5: Scroll container sizing

**Root cause**: The MessageList wrapper div in ChatInterface has `flex-1 overflow-hidden`
but is NOT a flex container. MessageList's root uses `flex-1` which only works when
the parent is `display: flex`. The scroll container doesn't get a proper height.

**ALREADY FIXED** — Verify in `D:\Projects\GregLite\app\components\chat\ChatInterface.tsx`:
- The `{/* Message list */}` wrapper div should be:
  `className="flex-1 overflow-hidden flex flex-col"`
- NOT just `className="flex-1 overflow-hidden"`

If `flex flex-col` is missing, add it to the wrapper div's className.

**File**: `app/components/chat/ChatInterface.tsx`

---

## FIX 6: System prompt anti-bootstrap guard

**Root cause**: The `DEFAULT_SYSTEM_PROMPT` correctly tells GregLite not to auto-execute
bootstrap sequences on casual messages. BUT when the full bootstrap runs, `buildSystemPrompt()`
creates a different prompt that injects CLAUDE_INSTRUCTIONS.md and TECHNICAL_STANDARDS.md
WITHOUT the anti-bootstrap guard. The LLM sees the bootstrap instructions and executes them.

**File**: `app/lib/bootstrap/context-builder.ts`

**Action**: Add the anti-bootstrap guard to `buildSystemPrompt()`. The FIRST lines of the
assembled prompt must include the conversational guard. Edit the `parts` array at the top
of `buildSystemPrompt()`:

Replace the opening lines:
```ts
  const parts: string[] = [
    'You are GregLite, a premier AI development environment.',
    "You function as COO to the user's CEO role.",
    'Be direct, execution-focused, and intelligence-first.',
    '',
  ];
```

With:
```ts
  const parts: string[] = [
    'You are GregLite, a personal cognitive operating system.',
    "You function as COO to the user's CEO role.",
    'Be direct, execution-focused, and intelligence-first.',
    '',
    'IMPORTANT: Respond conversationally to casual messages like greetings, short questions, or chitchat.',
    'Do NOT auto-execute bootstrap sequences, file reads, environment detection, or load any instruction files',
    'unless the user explicitly requests work on a specific project, codebase, or task.',
    'If the user says "hey", "what\'s up", or similar, just respond naturally.',
    'When the user DOES request specific work, then engage your full capabilities.',
    '',
  ];
```

---

## FIX 7: Artifact panel false positive on bootstrap responses

**Root cause**: `detectArtifact()` opens the artifact/right panel whenever any code block
exceeds 50 characters. Bootstrap responses contain code fences (bash commands, XML tool
calls) that trigger the detector. This opens the right panel on casual prompts.

**File**: `app/lib/artifacts/detector.ts`

**Action**: Add filtering to skip code blocks that look like bootstrap/tool output rather
than real artifacts. After the `while` loop match, before the length check, add:

```ts
    // Skip code blocks that look like tool calls, bootstrap output, or shell commands
    const skipPatterns = [
      /^#\s*Step\s/m,               // Bootstrap step comments
      /Filesystem:read_file/,        // MCP tool calls
      /<kernl>/,                     // KERNL XML
      /<get_session_context>/,       // KERNL session
      /^bash\s*$/m,                  // bash language tag with no real code
      /CLAUDE_INSTRUCTIONS/,         // Bootstrap file reads
      /TECHNICAL_STANDARDS/,         // Bootstrap file reads
    ];
    if (skipPatterns.some(pat => pat.test(code))) continue;
```

Insert this block inside the `while` loop, AFTER `const code = match[2];` and BEFORE
the `if (!code || code.length < MIN_ARTIFACT_LENGTH) continue;` line.

Also increase `MIN_ARTIFACT_LENGTH` from 50 to 120 to reduce noise from small blocks:
```ts
const MIN_ARTIFACT_LENGTH = 120;
```

---

## VERIFICATION CHECKLIST

After all 7 fixes:

1. `npx tsc --noEmit` — zero errors
2. Delete `.next` folder, run `pnpm dev`
3. Open localhost:3000
4. Console should show NO 500 errors on API routes
5. Context panel: collapse caret and expand caret both at TOP
6. Send "hey" — response should be casual, no bootstrap, no right panel
7. Scroll should work in message list (messages stay in view, can scroll)
8. Code blocks from real coding requests should still open artifact panel

---

## FILES TOUCHED

| # | File | Change |
|---|------|--------|
| 1 | `app/next.config.ts` | Dev detection via process.argv |
| 2 | `app/lib/database/migrations/index.ts` | process.cwd() for SQL paths |
| 3 | `app/lib/database/migrations/005_advanced_optimizations.sql` | New file |
| 4 | `app/components/context/ContextPanel.tsx` | Remove mt-auto from expand button |
| 5 | `app/components/chat/ChatInterface.tsx` | Add flex flex-col to scroll wrapper |
| 6 | `app/lib/bootstrap/context-builder.ts` | Anti-bootstrap guard in full prompt |
| 7 | `app/lib/artifacts/detector.ts` | Skip bootstrap blocks, raise threshold |
