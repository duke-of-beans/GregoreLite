GREGLITE SPRINT 8B - Leak Fixes, EoS False Positive Suppression, Code Quality Pass
Phase 8, Sprint 2 of 4 | March 2026

YOUR ROLE: Close the two memory/resource leaks flagged in the Phase 7 EoS scan, suppress the confirmed false positive in phase5-integration.test.ts, then run a full EoS-guided quality pass on the Phase 7 and Phase 8A code. Target: EoS score >= 85 (up from 82). The leaks are real and will matter in long-running sessions. The false positive suppression confirms the fp-tracker mechanism works. The quality pass ensures the codebase David ships on is clean. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\SPRINT_7H_COMPLETE.md - EoS Issues section
7. D:\Projects\GregLite\SPRINT_8A_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- The EventListener leak fix in executor.ts changes the abort/cleanup lifecycle of Agent SDK sessions — read the full executor.ts session lifecycle before touching the removeEventListener placement
- The setInterval fix in rate-limiter.ts requires knowing where the rate limiter is destroyed/garbage collected — trace the full lifetime before adding clearInterval
- EoS reports issues in Phase 8A code that are architectural (not cosmetic) — stop and flag before fixing, do not silently refactor Phase 8A work
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] Run EoS deep scan on full codebase, capture full output to a file → mechanical execution, baseline measurement
[HAIKU] Run EoS deep scan again after all fixes, capture output → mechanical, final measurement
[HAIKU] Run npx tsc --noEmit after each fix → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 8B complete, write SPRINT_8B_COMPLETE.md, git commit, push
[SONNET] Fix 1 — EventListener leak in executor.ts: read the file fully, understand the abort pattern, add removeEventListener in the correct cleanup path (session end, kill, error terminal state). Verify the abort signal still works after the fix.
[SONNET] Fix 2 — setInterval leak in rate-limiter.ts: read the full rate-limiter lifecycle, add clearInterval in the destroy/cleanup method. If no destroy method exists, add one and wire it to the scheduler's session-end path.
[SONNET] Fix 3 — EoS false positive suppression: call the fp-tracker API to suppress the phase5-integration.test.ts:246 false positive. Verify the suppression record is written to the KERNL shim_fp_suppressions table (or equivalent). Verify EoS no longer reports it.
[SONNET] Quality pass: run EoS on full codebase after fixes, review all remaining WARN-level issues in Phase 7 and Phase 8A code. Fix any that are genuine — skip pre-existing issues already known and accepted. Document decisions.
[OPUS] Escalation only if Sonnet fails twice — particularly if the abort lifecycle in executor.ts is complex enough that the fix risks breaking session termination

QUALITY GATES:
1. executor.ts: addEventListener('abort') has a corresponding removeEventListener in all session-end paths (completion, failure, kill)
2. rate-limiter.ts: setInterval has a corresponding clearInterval when the rate limiter is no longer needed
3. No regression on session abort/kill behavior — existing tests for kill and error paths still pass
4. phase5-integration.test.ts:246 false positive suppressed in fp-tracker — EoS no longer reports it
5. EoS deep scan score >= 85 after all fixes (up from 82)
6. Zero new critical issues introduced by fixes
7. pnpm test:run zero failures

FILE LOCATIONS (all existing — modify in place):
  app/lib/agent-sdk/executor.ts           - EventListener leak
  app/lib/agent-sdk/rate-limiter.ts       - setInterval leak
  app/lib/eos/fp-tracker.ts              - false positive suppression API (read before using)

LEAK FIX PATTERN — EventListener:
  BEFORE (wrong):
    controller.signal.addEventListener('abort', handler)
    // handler never removed

  AFTER (correct):
    controller.signal.addEventListener('abort', handler)
    // in cleanup (finally block or explicit cleanup fn):
    controller.signal.removeEventListener('abort', handler)

  Read executor.ts fully first. The abort signal may fire before cleanup runs — ensure removeEventListener is called whether the abort fires or not (put it in a finally block or call it in both the abort handler and the normal cleanup path).

LEAK FIX PATTERN — setInterval:
  BEFORE (wrong):
    this.refillInterval = setInterval(() => this.refill(), 60_000)
    // never cleared

  AFTER (correct):
    this.refillInterval = setInterval(() => this.refill(), 60_000)

    destroy(): void {
      clearInterval(this.refillInterval)
    }

  Then find where the rate limiter instance is created (likely in scheduler.ts) and call destroy() when the scheduler shuts down. If the rate limiter is a singleton, wire destroy() to the Tauri on_window_event cleanup path.

FP SUPPRESSION:
  Read app/lib/eos/fp-tracker.ts to understand the suppression API before calling it.
  The Phase 5 sprint notes describe the fp-tracker mechanism: dismissals on an issue above 20% FP rate → auto-suppress. For a known false positive (confirmed test mock artifact), call the explicit suppress API directly rather than waiting for 20% threshold.
  After suppression, run EoS scan and confirm the issue is absent from results.

QUALITY PASS SCOPE:
  Run EoS on the full codebase after the three fixes above. Review all WARN-level findings.
  For Phase 7 code (any file modified in Phase 7 sprints): fix genuine warnings.
  For Phase 8A code (8A new/modified files): fix any warnings introduced.
  For pre-Phase-7 code: document but do not fix in this sprint — separate concern.
  Target: get EoS from 82 to >= 85. If the three leak fixes and FP suppression alone get there, the quality pass is confirmation, not excavation.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 8B complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-8b: leak fixes (executor EventListener, rate-limiter setInterval), EoS FP suppression, quality pass — EoS {before}→{after})
5. git push
6. Write SPRINT_8B_COMPLETE.md: EoS before/after scores, three fixes described, quality pass findings (what was fixed vs documented-only), final test count

GATES CHECKLIST:
- executor.ts: removeEventListener present in cleanup path, verifiable by code review
- rate-limiter.ts: clearInterval in destroy(), destroy() wired to scheduler shutdown
- Session kill and abort tests still pass (no regression)
- phase5-integration.test.ts:246 absent from EoS output after suppression
- EoS deep scan score >= 85
- Zero new CRITICAL issues in Phase 7/8A code
- pnpm test:run clean
- Commit pushed via cmd -F flag
