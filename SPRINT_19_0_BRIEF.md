GREGLITE SPRINT 19.0 — Sacred Laws Enforcement
Trust infrastructure: reversibility, focus protection, attention budget | March 2026

YOUR ROLE: Close the enforcement gaps in Sacred Laws 3, 5, 10, and strengthen Law 12 (Ghost Veto). These are the partially-enforced laws where the mechanism exists but the awareness doesn't. This sprint makes GregLite trustworthy for autonomous and semi-autonomous operation. David is CEO. Zero debt.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\GREGORE_AUDIT.md — READ §3 (Sacred Laws Audit) FULLY
4. D:\PROJECTS\Gregore\docs\SACRED_LAWS.md — READ FULLY (the 12 laws spec)
5. D:\Projects\GregLite\app\lib\agent-sdk\query.ts — agent session driver (tool execution loop)
6. D:\Projects\GregLite\app\lib\agent-sdk\scope-enforcer.ts — existing write scope checks
7. D:\Projects\GregLite\app\lib\decision-gate\index.ts — gate pipeline
8. D:\Projects\GregLite\app\lib\decision-gate\trigger-detector.ts — trigger conditions
9. D:\Projects\GregLite\app\lib\decision-gate\override-policies.ts — Sprint 18.0 policy system
10. D:\Projects\GregLite\app\lib\stores\ui-store.ts — user preferences
11. D:\Projects\GregLite\app\lib\voice/copy-templates.ts — Sprint 17.0 voice system
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- Undo infrastructure requires changes to ALL agent SDK tools — if scope exceeds 10 files, checkpoint and document remaining work
- Attention budget tracking must be lightweight — if polling or event counting adds >5ms per message, rethink the approach
- Sonnet has failed on the same problem twice → spawn Opus subagent

---

═══════════════════════════════════════════════════════════════════════════════
LAW 3: REVERSIBILITY — Every action must have a defined undo path
═══════════════════════════════════════════════════════════════════════════════

TASK 1: Action journal for agent tool calls

New file: app/lib/agent-sdk/action-journal.ts

Every agent tool execution (fs_write, run_command, git_commit) gets a journal entry BEFORE execution with enough information to undo it.

```typescript
interface ActionJournalEntry {
  id: string;
  session_id: string;
  tool_name: string;
  action_type: 'file_write' | 'file_delete' | 'command' | 'git_commit';
  target_path?: string;
  before_state?: string;       // file contents before write, null for new files
  after_state?: string;        // file contents after write
  command?: string;            // for run_command
  reversible: boolean;         // false for truly irreversible actions
  undone: boolean;
  created_at: number;
}

export function journalBeforeWrite(sessionId: string, filePath: string): string  // returns entry ID, captures before_state
export function journalAfterWrite(entryId: string, filePath: string): void       // captures after_state
export function journalCommand(sessionId: string, command: string): string
export function undoAction(entryId: string): UndoResult
export function getSessionActions(sessionId: string): ActionJournalEntry[]
```

DB table: `action_journal` in schema.sql (idempotent CREATE TABLE IF NOT EXISTS)

For file writes: capture file contents before the write. If the file is new (doesn't exist), mark before_state as null and undo = delete the file.
For commands: log the command but mark as reversible=false (commands are generally not undoable).
For git commits: store the commit hash; undo = git revert.

TASK 2: Wire journal into agent query loop

File: app/lib/agent-sdk/query.ts

Before each tool execution in the agentic loop:
1. If tool is fs_write or fs_write_docs_only: call journalBeforeWrite(), execute, call journalAfterWrite()
2. If tool is run_command or test_runner: call journalCommand()
3. If tool is git_commit: call journalCommand() with the commit hash in after_state

This wraps existing tool execution — don't change the tools themselves, wrap the calls.

TASK 3: Undo UI in Inspector

In the Inspector drawer's Jobs tab, add an "Action History" section for the selected job:
- List of actions with timestamps
- Reversible actions get an "↩ Undo" button
- Clicking undo calls the API, restores before_state
- Irreversible actions shown grayed with tooltip "This action cannot be undone"

New API route: app/app/api/agent-sdk/actions/route.ts
- GET ?sessionId=xxx → list actions
- POST { entryId, action: 'undo' } → execute undo

═══════════════════════════════════════════════════════════════════════════════
LAW 5: PROTECT DEEP WORK — Never interrupt focused work without critical cause
═══════════════════════════════════════════════════════════════════════════════

TASK 4: Focus state detection

New file: app/lib/focus/focus-tracker.ts

Track user focus state based on input activity patterns:

```typescript
type FocusState = 'idle' | 'browsing' | 'composing' | 'deep_work';

export function updateFocusState(event: FocusEvent): void
export function getFocusState(): FocusState
export function onFocusChange(callback: (state: FocusState) => void): () => void
```

Heuristics:
- idle: no input activity for >5 minutes
- browsing: occasional clicks/scrolls, no sustained typing
- composing: active typing in the input field
- deep_work: sustained typing (>60s continuous) OR rapid message exchange (>3 messages in 2 minutes)

Store as module-level state (not SQLite — transient).

TASK 5: Interrupt cost gate

File: app/lib/focus/interrupt-gate.ts

Every interruption (notification, status update, decision gate popup, Ghost suggestion) passes through this gate:

```typescript
interface InterruptRequest {
  type: 'notification' | 'gate' | 'ghost_suggestion' | 'status_update';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export function shouldInterrupt(request: InterruptRequest): boolean
```

Rules per Sacred Laws §5:
- idle → allow all interrupts
- browsing → allow medium+ severity
- composing → allow high+ severity only
- deep_work → allow critical only (everything else queued)

Queued interrupts surface when focus state drops below their threshold.

TASK 6: Wire interrupt gate

Wire shouldInterrupt() into:
- Decision gate: check before showing GatePanel (if not critical, queue it)
- Ghost suggestions: check before surfacing cards (if composing/deep_work, queue)
- Notifications: check before ToastStack (if deep_work, queue)
- Status updates: always allow (they're passive — StatusBar, not popups)

Add queue drain: when focus state transitions DOWN (e.g., deep_work → browsing), drain queued interrupts in order.

═══════════════════════════════════════════════════════════════════════════════
LAW 10: ATTENTION IS SCARCE — Track and budget cognitive interrupts
═══════════════════════════════════════════════════════════════════════════════

TASK 7: Attention budget tracker

New file: app/lib/focus/attention-budget.ts

```typescript
const DAILY_BUDGET = 100;  // cognitive tokens per day

interface AttentionSpend {
  type: string;
  cost: number;
  timestamp: number;
}

export function spendAttention(type: string, cost: number): boolean  // false if budget exceeded
export function getAttentionRemaining(): number
export function getAttentionHistory(): AttentionSpend[]
export function resetDailyBudget(): void  // auto-resets at midnight
```

Costs per Sacred Laws §10:
- Ghost suggestion surfaced: 1 CT
- Status notification: 3 CT
- Decision gate warning: 5 CT
- Gate mandatory (veto): 10 CT
- Critical system alert: 25 CT

When budget approaches zero, only critical interrupts pass through. Show budget in StatusBar tooltip: "Attention: 73/100 remaining"

TASK 8: Wire attention budget

Wire spendAttention() into the interrupt gate (Task 6) — each allowed interrupt also deducts from the budget. When budget hits 0, only critical severity passes.

Add to StatusBar: subtle attention indicator (just a number in the tooltip, not a visible bar — per Gregore's "no badges" rule).

═══════════════════════════════════════════════════════════════════════════════
LAW 12: GHOST VETO — Expand gate scope beyond debt language
═══════════════════════════════════════════════════════════════════════════════

TASK 9: Expand decision gate to check Laws 1, 3, 5

File: app/lib/decision-gate/trigger-detector.ts

Add new trigger types:
- `append_only_violation`: detect DELETE or UPDATE keywords in agent tool outputs targeting KERNL tables (Law 1)
- `reversibility_missing`: detect agent proposing an action without a journal entry (Law 3) — this is a safety check, not a block
- `deep_work_interruption`: fire when a gate would interrupt during deep_work focus state (Law 5) — downgrades the gate to queued instead of immediate

These extend the existing trigger framework (8 triggers → 11). Each gets a VOICE template in copy-templates.ts.

TASK 10: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing
3. New tests:
   - action-journal: write/undo, new file undo = delete, command journal, session listing
   - focus-tracker: state transitions, deep_work threshold, idle timeout
   - interrupt-gate: shouldInterrupt rules per focus state
   - attention-budget: spend, depletion, daily reset, budget-exceeded blocks
4. Update STATUS.md
5. Write SPRINT_19_0_COMPLETE.md
6. Commit: "feat: Sprint 19.0 — Sacred Laws enforcement (reversibility journal, focus protection, attention budget, expanded gate)"
7. Push

---

QUALITY GATES:
 1. Agent file writes have before_state captured in action_journal
 2. Undo restores file to before_state
 3. Focus state tracks idle/browsing/composing/deep_work correctly
 4. Deep work blocks non-critical interrupts (queued, not lost)
 5. Attention budget tracks daily spend
 6. Budget depletion blocks low-severity interrupts
 7. Gate expanded to check Laws 1, 3, 5
 8. tsc clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. Action journal wraps existing tool calls — do NOT refactor the tools themselves
3. Focus tracking is transient (module state, not SQLite) — it resets on app restart
4. Attention budget resets daily — no persistent guilt across days
5. Queued interrupts are NEVER lost — they surface when focus state allows
6. Use cmd shell (not PowerShell)
7. Use VOICE templates for all new gate messages
