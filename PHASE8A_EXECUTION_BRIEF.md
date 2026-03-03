GREGLITE SPRINT 8A - Security Hardening: Shell Injection Fix, OS Keychain, Merge Route Auth
Phase 8, Sprint 1 of 4 | Foundation for v1.0.0 ship | March 2026

YOUR ROLE: Close the three security warnings from the Phase 7 audit. All three are explicitly logged for Sprint 8A in SPRINT_7H_COMPLETE.md. These are not optional before shipping: shell injection via execSync string form is a code quality violation independent of deployment context; plaintext PAT in SQLite is wrong regardless of who uses this; the merge route needs auth before any network exposure. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\SPRINT_7H_COMPLETE.md - read the Security Audit Findings section fully before touching any file
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- keytar is not available for the Windows target — check the package before adopting it. Windows Credential Manager via keytar is the preferred path; if unavailable fall back to node-keytar or a direct Windows CryptoAPI call via a Rust Tauri command. Document the decision.
- The merge route auth pattern requires session tokens that do not exist in the current Tauri app — design the auth mechanism for a desktop-local app before implementing. A simple app-scoped HMAC token stored in KERNL vault is sufficient; JWT is overkill.
- execFileSync array form changes behavior of any git call that pipes output — verify each refactored call's output capture still works before moving on.
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] Audit all execSync calls in git-tools.ts and branch-manager.ts — list every call site, the string form used, and output capture pattern → read-only analysis, mechanical
[HAIKU] Run npx tsc --noEmit after each fix batch → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 8A complete, write SPRINT_8A_COMPLETE.md, git commit message, commit -F, push
[SONNET] Fix 1 — execSync → execFileSync: refactor all git invocations in git-tools.ts, branch-manager.ts, and self-evolution-orchestrator.ts to array form. Preserve all output capture. Run tsc after each file.
[SONNET] Fix 2 — OS keychain for PAT: install keytar (or alternative), write keychain-store.ts with storePAT(token)/getPAT()/deletePAT(), migrate github-api.ts to use it, remove PAT from SQLite settings table, write KERNL migration to drop/null the column.
[SONNET] Fix 3 — Merge route auth: design and implement desktop-local HMAC token auth. Generate a random 32-byte token on first app start, store in KERNL vault (key: app_auth_token). Tauri frontend reads token from KERNL on load, sends as Authorization: Bearer {token} header. Merge route middleware validates. Token never leaves the machine.
[SONNET] Update all tests affected by execFileSync refactor and keychain changes
[OPUS] Escalation only if Sonnet fails twice — particularly if keytar Windows integration has build issues

QUALITY GATES:
1. Zero execSync(string) calls remain in git-tools.ts, branch-manager.ts, self-evolution-orchestrator.ts
2. All replaced with execFileSync('git', args[]) — no string concatenation, no shell invocation
3. All git call outputs still captured correctly (stdout/stderr)
4. GitHub PAT stored in OS keychain, NOT in SQLite
5. getPAT() falls back gracefully if keychain entry missing: returns null, github-api.ts surfaces "PAT not configured" error to job queue UI
6. SQLite settings table PAT column removed or nulled
7. POST /api/agent-sdk/jobs/[id]/merge requires valid Authorization: Bearer header
8. Token validated via HMAC-safe comparison (not ===)
9. Missing/invalid token → 401, logged to KERNL audit log
10. pnpm test:run zero failures

FILE LOCATIONS (all existing — modify in place):
  app/lib/agent-sdk/self-evolution/git-tools.ts
  app/lib/agent-sdk/self-evolution/branch-manager.ts
  app/lib/agent-sdk/self-evolution/self-evolution-orchestrator.ts
  app/lib/agent-sdk/self-evolution/github-api.ts
  app/app/api/agent-sdk/jobs/[id]/merge/route.ts

NEW FILES:
  app/lib/security/keychain-store.ts     - PAT storage via OS keychain
  app/lib/security/app-token.ts          - HMAC desktop-local auth token generation + validation
  app/lib/security/auth-middleware.ts    - middleware function for protected API routes

EXECSYNC → EXECFILESYNC PATTERN:
  BEFORE (wrong):
    execSync(`git commit -m "${message}"`)
    execSync(`git push origin ${branchName}`)

  AFTER (correct):
    execFileSync('git', ['commit', '-m', message], { cwd, encoding: 'utf8' })
    execFileSync('git', ['push', 'origin', branchName], { cwd, encoding: 'utf8' })

  Import: import { execFileSync } from 'child_process'
  Remove: import { execSync } from 'child_process' (only if no remaining execSync uses)

  For output capture, execFileSync returns stdout as string when encoding: 'utf8' is set.
  For status-only calls (no output needed), wrap in try/catch — non-zero exit throws.

KEYCHAIN STORE:
  Try: keytar (npm install keytar) — wraps Windows Credential Manager, macOS Keychain, libsecret
  Service name: 'ai.greglite.app'
  Account name: 'github_pat'

  export async function storePAT(token: string): Promise<void>
  export async function getPAT(): Promise<string | null>
  export async function deletePAT(): Promise<void>

  If keytar build fails on Windows target: use Tauri's invoke to call a Rust command that wraps Windows Credential Manager directly via the windows-credentials crate. Document which path was taken in SPRINT_8A_COMPLETE.md.

MERGE ROUTE AUTH:
  app-token.ts:
    generateAppToken(): 32 bytes crypto.randomBytes → hex string
    validateToken(provided: string, stored: string): boolean — use crypto.timingSafeEqual

  On first app start: check KERNL vault for key 'app_auth_token'. If missing, generateAppToken(), store it. Return to frontend via a safe Tauri command (not an HTTP route — Tauri IPC only for this).

  Frontend: on app mount, call Tauri command getAppAuthToken(), store in Zustand. Include as Authorization: Bearer {token} header on all calls to /api/agent-sdk/jobs/*/merge.

  auth-middleware.ts:
    export function requireAppToken(req: NextRequest): Response | null
    Returns null if valid (continue), returns NextResponse with 401 if invalid.
    Merge route: call requireAppToken at top, return 401 if non-null.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 8A complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-8a: security hardening — execFileSync, OS keychain PAT, merge route auth)
5. git push
6. Write SPRINT_8A_COMPLETE.md: which keychain library was used and why, token auth design rationale, all three fixes verified, any tricky output-capture edge cases in the execFileSync migration

GATES CHECKLIST:
- grep for execSync in git-tools.ts, branch-manager.ts, orchestrator.ts → zero results
- All git calls use execFileSync('git', args[]) array form
- Output capture works: git status, git diff, git push all return expected output
- PAT in OS keychain: storePAT → getPAT round trip works
- PAT not in SQLite: PRAGMA table_info(settings) shows column removed or migration nulls existing value
- getPAT() returns null if not set, github-api surfaces clear error message
- Merge route: request without token → 401
- Merge route: request with wrong token → 401
- Merge route: request with correct token → proceeds normally
- timingSafeEqual used for token comparison
- pnpm test:run clean
- Commit pushed via cmd -F flag
