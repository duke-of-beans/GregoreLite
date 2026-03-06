# SPRINT 19.0 — Sacred Laws Enforcement — COMPLETE

**Date:** March 6, 2026
**Branch:** main
**tsc:** 0 errors
**Tests:** 1344/1344 (99 new tests across 5 files)
**Laws enforced:** 1 (Append-Only), 3 (Reversibility), 5 (Protect Deep Work), 10 (Attention Budget), 12 (Ghost Veto)

---

## What Shipped

### Task 1-2: Action Journal (Law 3 — Reversibility)

`app/lib/agent-sdk/action-journal.ts` — WAL-mode SQLite table `action_journal` via `getDatabase()`. Three entry points:

- `journalBeforeWrite(sessionId, path)` — reads existing file content as `before_state`, inserts row with `reversible=1`.
- `journalAfterWrite(entryId, path)` — reads post-write content, UPDATEs `after_state`.
- `journalCommand(sessionId, cmd, toolName?, afterState?)` — logs commands with `reversible=0`.

Wired into `query.ts` tool execution loop: `journalBeforeWrite` before every `write_file` / `edit_file` call, `journalAfterWrite` after successful write, `journalCommand` for `run_command` / `git_commit` tools.

`undoAction(entryId)` restores `before_state` to disk (or deletes file if `before_state` was null). Marks entry `undone=1` to prevent double-undo. Returns typed `{ success, message }`.

### Task 3: Undo API + Inspector UI

`app/app/api/agent-sdk/undo/route.ts` — POST `{ entryId }` → calls `undoAction()`, returns JSON. Inspector Jobs tab → Action History panel lists all reversible entries for current session with file path, before/after state preview, and Undo button.

### Tasks 4-5-7: Focus Tracker + Interrupt Gate + Attention Budget (Law 5 + Law 10)

`app/lib/focus/focus-tracker.ts` — Module-level state machine (`idle | browsing | composing | deep_work`). Key constants: `COMPOSING_TIMEOUT_MS=30000`, `DEEP_WORK_TYPING_MS=60000`, `DEEP_WORK_MSG_THRESHOLD=3` (strictly >3 = 4+ messages). `firstTypingAt` resets if gap between keydowns exceeds 30s. `getFocusState()` re-evaluates from timestamps on every call. `onFocusChange(cb)` returns unsubscribe.

`app/lib/focus/interrupt-gate.ts` — `shouldInterrupt({ type, severity, message, id? })` evaluates focus×severity matrix. Blocked items go into module-level queue. `onQueueDrain(cb)` fires when `onFocusChange` detects a drop in focus level — releases all queued items that now pass the new focus threshold. `clearInterruptQueue()` for test resets.

`app/lib/focus/attention-budget.ts` — `DAILY_BUDGET=100 CT`. `spendAttention(type)` deducts cost, returns false when exhausted (critical_alert always passes). `resetDailyBudget()` for midnight reset. `getAttentionTooltip()` returns "Attention: N/100 remaining".

### Tasks 6+8: UI Wiring (Law 5 gate in components)

- **`GatePanel.tsx`** — `shouldInterrupt` called once on mount via `useState` initializer; if blocked, `onQueueDrain` watches for this gate's `interruptId` to appear in released items, then `setShow(true)`.
- **`GhostCardList.tsx`** — Tauri listener checks `shouldInterrupt` before `addGhostSuggestion`. Blocked suggestions held in `useRef` Map, released via `onQueueDrain`.
- **`ToastStack.tsx`** — Per-notification gate check in `useEffect`. Gated IDs tracked in state; `onQueueDrain` adds released IDs. Visible filter: `!dismissed && gatedIds.has(id)`.
- **`StatusBar.tsx`** — `getAttentionTooltip()` polled every 10s, displayed as `ATTN: 97/100` with full tooltip on hover.

### Task 9: Decision Gate Expansion — 8→11 Triggers (Laws 1/3/5)

Three new `GateTrigger` values in `types.ts`:
- `append_only_violation` — UPDATE/DELETE/DROP on audit/journal tables
- `reversibility_missing` — fs_write/overwrite without journal/undo/backup mention
- `deep_work_interruption` — status/summary requests during high-velocity sessions (6+ messages)

New detectors in `trigger-detector.ts`: `detectAppendOnlyViolation`, `detectReversibilityMissing`, `detectDeepWorkInterruption`. All three wired into `decision-gate/index.ts` `analyze()` as synchronous checks before the async section.

Voice templates added to `copy-templates.ts`. `TRIGGER_LABELS` updated in `GatePanel.tsx` + `OverridePoliciesSection.tsx`.

### Task 10: Tests (99 new, all green)

| File | Tests | Status |
|------|-------|--------|
| `lib/focus/__tests__/attention-budget.test.ts` | 31 | ✅ |
| `lib/focus/__tests__/focus-tracker.test.ts` | 13 | ✅ |
| `lib/focus/__tests__/interrupt-gate.test.ts` | 22 | ✅ |
| `lib/decision-gate/__tests__/trigger-detector-s19.test.ts` | 22 | ✅ |
| `lib/agent-sdk/__tests__/action-journal.test.ts` | 11 | ✅ |

---

## tsc Fixes During Sprint

- `action-journal.ts`: removed unused `execSync` import; removed `command: undefined` and `target_path: undefined` from `insertEntry` calls (`exactOptionalPropertyTypes` violation).
- `ToastStack.tsx`: type-narrowed released IDs via explicit `for` loop with `r.id !== undefined` guard; fixed `n.message ?? n.title` (`Notification.message` is optional).
- `OverridePoliciesSection.tsx`: added 3 new trigger labels to its `Record<GateTrigger, string>` (exhaustive map required all values).
- `trigger-detector-s19.test.ts`: removed unused `msgs` helper function.

---

## Next

Sprint 20.0 TBD.
