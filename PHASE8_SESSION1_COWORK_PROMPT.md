Execute Sprint 8A then Sprint 8B for GregLite as a combined session.

Read these files IN ORDER before doing anything:
1. D:\Projects\GregLite\PHASE8A_EXECUTION_BRIEF.md — full Sprint 8A spec
2. D:\Projects\GregLite\PHASE8B_EXECUTION_BRIEF.md — full Sprint 8B spec
3. D:\Projects\GregLite\STATUS.md — current state (ignore any claims that Phase 8 is complete — it was never built)
4. D:\Projects\GregLite\DEV_PROTOCOLS.md

CRITICAL CONTEXT: Phase 8 was claimed complete but ZERO code was shipped. You are building this from scratch. The briefs are accurate and detailed — follow them exactly.

SPRINT 8A — Security Hardening (do first):
1. Refactor all execSync string-form calls in git-tools.ts, branch-manager.ts, self-evolution-orchestrator.ts to execFileSync array form. Preserve all output capture.
2. Install keytar (or equivalent) for OS keychain PAT storage. Write lib/security/keychain-store.ts. Migrate github-api.ts to use it. Remove PAT from SQLite.
3. Write lib/security/app-token.ts and lib/security/auth-middleware.ts. Wire HMAC token auth on the merge route. Generate token on first start, store in KERNL vault.
4. Tests, tsc clean, commit: "sprint-8a: security hardening — execFileSync, OS keychain PAT, merge route auth"
5. Write SPRINT_8A_COMPLETE.md

SPRINT 8B — Leak Fixes + Quality Pass (do second):
1. Fix EventListener leak in executor.ts — add removeEventListener in cleanup paths
2. Fix setInterval leak in rate-limiter.ts — add clearInterval in destroy method, wire to scheduler shutdown
3. Suppress EoS false positive for phase5-integration.test.ts:246
4. Run full EoS scan, fix WARN-level issues in Phase 7/8A code to reach score >= 85
5. Tests, tsc clean, commit: "sprint-8b: leak fixes, EoS FP suppression, quality pass"
6. Write SPRINT_8B_COMPLETE.md with before/after EoS scores

IMPORTANT NOTES:
- SPRINT_7H_COMPLETE.md referenced in the briefs DOES exist — read it for the security audit findings
- SPRINT_8A_COMPLETE.md won't exist when you start 8B — you'll create it at the end of 8A
- Shell: use cmd (not PowerShell — GREGORE profile interferes with output)
- GIT: write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP
- Project path: D:\Projects\GregLite\app
- Baseline before starting: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run
