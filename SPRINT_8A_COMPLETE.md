# Sprint 8A Complete — Security Hardening

**Date:** 2026-03-04
**Commit:** 8e25a72
**Branch:** master
**Tests:** 888/890 passing (same baseline) | tsc clean

---

## Fixes Delivered

### Fix 1: Shell Injection Prevention (execSync → execFileSync)

Refactored all `execSync(string)` calls to `execFileSync('git', args[])` array form across three files, eliminating the shell-injection attack vector identified in the Sprint 7H security audit.

**Files changed:**
- `lib/agent-sdk/self-evolution/git-tools.ts` — import swap, `runGit()` rewritten to array form, `quoteArg()` removed
- `lib/agent-sdk/self-evolution/branch-manager.ts` — same pattern, JSDoc updated
- `lib/agent-sdk/self-evolution/self-evolution-orchestrator.ts` — two direct calls converted; npx vitest call retains `shell: true` (Windows .cmd shim requirement)

### Fix 2: OS Keychain PAT Storage

Replaced SQLite-based GitHub PAT storage with OS keychain via keytar 7.9.0 (native rebuild for Node 22, Windows Credential Manager backend).

**Files changed:**
- `lib/security/keychain-store.ts` — NEW: storePAT, getPAT, deletePAT wrappers around keytar
- `lib/agent-sdk/self-evolution/github-api.ts` — migrated from `@/lib/kernl/database` to keychain-store; storePAT/getPAT/deletePAT now async; all callers (createPR, mergePR, pollCIStatus) updated with await

### Fix 3: Merge Route Authentication

Added Bearer token authentication to the merge API route using crypto.randomBytes token generation and crypto.timingSafeEqual validation.

**Files changed:**
- `lib/security/app-token.ts` — NEW: generateAppToken, validateToken (timingSafeEqual), getAppAuthToken (reads/creates in KERNL settings)
- `lib/security/auth-middleware.ts` — NEW: requireAppToken(req) → null | 401 NextResponse
- `app/api/agent-sdk/jobs/[id]/merge/route.ts` — auth gate wired at top of POST handler

### Test Updates

Phase 7 integration test suite overhauled for Sprint 8A changes:
- child_process mock updated from execSync to execFileSync
- Keychain-store mock added via vi.hoisted()
- 19 mockExecSync references renamed to mockExecFileSync
- All assertions converted from string-matching to array-matching
- GitHub API PAT tests converted to async keychain API

---

## Security Audit Items Resolved

| Finding | Severity | Resolution |
|---------|----------|------------|
| execSync shell injection | HIGH | execFileSync array form |
| PAT in SQLite plaintext | HIGH | OS keychain (keytar) |
| Merge route unauthenticated | MEDIUM | Bearer token + timingSafeEqual |
