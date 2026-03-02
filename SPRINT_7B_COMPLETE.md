# Sprint 7B Complete — Permission Matrix: Tool Injection + Write Scope Enforcement

**Completed:** March 2, 2026
**TSC:** 0 errors
**Tests:** 761/761 passing (36 files, +25 new permission-matrix tests)
**Baseline delta:** +25 tests vs Sprint 7A (736 → 761)

---

## Summary

Sprint 7B implements the declarative permission matrix from §4.3.3. Every session type now receives exactly the tools it needs — no more, no less — injected at spawn time. Write scope is enforced at the tool-executor layer as a second independent guardrail. A `scope_violations` table provides a complete audit trail of every rejected write attempt.

---

## Files Modified

| File | Change |
|------|--------|
| `app/lib/agent-sdk/types.ts` | Added `analysis` to `TaskType` union + `TASK_PRIORITY` |
| `app/lib/kernl/schema.sql` | Added `scope_violations` table + 2 indexes |
| `app/lib/agent-sdk/query.ts` | Replaced hardcoded `AGENT_TOOLS` with `selectTools()`, integrated `checkWriteScope()`, renamed tool names to `fs_read`/`fs_write`, added stub handling, used `resolveCwd()` |

## Files Created

| File | Purpose |
|------|---------|
| `app/lib/agent-sdk/permission-config.ts` | Static permission matrix: 7 session types × {permissionMode, tools[], cwdPolicy} |
| `app/lib/agent-sdk/tool-injector.ts` | `selectTools()`: builds SDK Tool array; `isStubTool()`: stub detection; `getToolNames()`: for tests |
| `app/lib/agent-sdk/scope-enforcer.ts` | `checkWriteScope()`: validates write paths vs manifest.files[]; `logScopeViolation()`: DB audit; `resolveCwd()`: CWD policy resolver |
| `app/lib/agent-sdk/__tests__/permission-matrix.test.ts` | 25 unit tests covering tool injection, readOnly enforcement, stub detection, write scope, docs-only restriction, CWD resolution |

---

## Permission Matrix (Implemented)

| Session Type | Mode | Tools Injected |
|---|---|---|
| `code` | acceptEdits | fs_read, list_directory, fs_write, run_command, test_runner†, shim_check† |
| `test` | acceptEdits | fs_read, list_directory, fs_write, run_command, test_runner† |
| `docs` | acceptEdits | fs_read, list_directory, fs_write_docs_only, markdown_linter† |
| `research` | readOnly | fs_read, list_directory, kernl_search_readonly† |
| `analysis` | readOnly | fs_read, list_directory, shim_readonly_audit† |
| `self_evolution` | acceptEdits | fs_read, list_directory, fs_write, run_command, git_branch_tools†, shim_check†, test_runner† |

† = stub tool (returns NOT_IMPLEMENTED until 7G/7H)

---

## Architecture Decisions

**Tool injection is the primary enforcement layer.** readOnly sessions simply never receive write tools — there is no code path that could execute a write because the tool definition does not exist in the injected set. The scope-enforcer is a secondary independent check for sessions that do have write tools.

**Stub tools are declaratively marked** with an internal `_stub: true` flag on the registry entry. The executor checks `isStubTool()` before dispatching. The flag is stripped from the SDK Tool object so it never leaks to the Anthropic API. Each stub returns a descriptive NOT_IMPLEMENTED message identifying the implementing sprint (7G or 7H).

**`analysis` is a new TaskType.** The blueprint §4.3.3 lists it as a distinct session type with read-only tools focused on SHIM auditing. Added to `TaskType`, `TASK_PRIORITY` (priority 40, same as research), and `PERMISSION_CONFIG`.

**CWD policy is resolved at spawn time** via `resolveCwd()`. The effective working directory is injected into the opening user message so the agent knows its boundaries from the first turn. `docs` sessions get `<project>/docs`; `research` gets `os.tmpdir()/greglite-sessions/<manifest_id>`; all others get `project_path`.

**`logScopeViolation()` is non-fatal.** DB write errors inside `logScopeViolation` are silently swallowed. The write was already rejected before the log attempt; enforcement must never crash a session.

---

## Stub Tools Documented (to be implemented)

| Tool | Implementing Sprint |
|---|---|
| `test_runner` | Sprint 7G — SHIM hybrid integration |
| `shim_check` | Sprint 7G — SHIM hybrid integration |
| `shim_readonly_audit` | Sprint 7G — SHIM hybrid integration |
| `markdown_linter` | Sprint 7G — SHIM hybrid integration |
| `kernl_search_readonly` | Sprint 7G — SHIM hybrid integration |
| `git_branch_tools` | Sprint 7H — Self-evolution mode |

---

## Next Sprint

**Sprint 7C** — Error handling + restart: failure detection, `INTERRUPTED` state recovery, exponential backoff, handoff reports, crash-safe session teardown.
