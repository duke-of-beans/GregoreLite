GREGLITE SPRINT 8D - First-Run Onboarding, README, v1.0.0 Tag, Phase 8 Certification
Phase 8, Sprint 4 of 4 | FINAL SPRINT | March 2026

YOUR ROLE: Ship Gregore Lite v1.0.0. First-run onboarding guides David through API key entry, KERNL initialization, and AEGIS connection so the app is immediately useful on a fresh install. README is rewritten as a proper product document, not a dev log. v1.0.0 git tag is created. Full Phase 8 certification runs. BLUEPRINT_FINAL.md §13 Phase 8 entry is written. This is the line between "project" and "product." David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\SPRINT_8C_COMPLETE.md
7. D:\Projects\GregLite\BLUEPRINT_FINAL.md - §14 (product funnel) and §10 (UI/UX)
8. All SPRINT_8[A-C]_COMPLETE.md files
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- First-run detection logic (has the user entered an API key before?) needs to survive app updates — design the persistence before building the UI. The KERNL settings table is the right store; first_run_complete: boolean is sufficient.
- The README references features that have not been built — read the full app structure before writing to ensure every claim is accurate. No vaporware in the README.
- The git tag requires the commit to be pushed before tagging — tag only after the final commit is on remote.
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] KERNL migration: add settings table rows for first_run_complete, anthropic_api_key_configured, aegis_connected → mechanical, check existing settings schema first
[HAIKU] OnboardingStep type + step config array (4 steps defined below) → types only, mechanical
[HAIKU] Run npx tsc --noEmit after each sprint section → mechanical
[HAIKU] Run EoS deep scan final certification → mechanical execution, capture full output
[HAIKU] Run pnpm test:run final pass, capture counts → mechanical
[HAIKU] git tag v1.0.0 && git push origin v1.0.0 → mechanical, only after final commit is pushed
[HAIKU] Update BLUEPRINT_FINAL.md §13 Phase 8 completion entry → content specified below, mechanical doc write
[HAIKU] SESSION END: Update STATUS.md Phase 8 complete / v1.0.0 SHIPPED, write SPRINT_8D_COMPLETE.md, git commit, push
[SONNET] OnboardingFlow.tsx: 4-step wizard, shown on first launch only, skippable after step 1
[SONNET] Step 1 — API Key: input field for Anthropic API key, test call to validate (list models endpoint), store success flag in KERNL settings
[SONNET] Step 2 — KERNL Init: show KERNL database status (tables, row counts), auto-run if not initialized, confirm with progress indicator
[SONNET] Step 3 — AEGIS: test AEGIS connection (ping AEGIS HTTP endpoint), show connected/not connected, skip gracefully if AEGIS not running
[SONNET] Step 4 — Ready: summary of what's configured, [Launch Gregore Lite] button, sets first_run_complete = true in KERNL
[SONNET] Wire OnboardingFlow: check first_run_complete on app mount, show wizard if false, show main app if true
[SONNET] Write README.md (full rewrite — content specified below)
[OPUS] Escalation only if Sonnet fails twice — particularly if the onboarding API key validation call has auth/CORS issues in the Tauri context

QUALITY GATES:
1. First-run onboarding shown on cold install (first_run_complete = false or missing)
2. Step 1 API key: validates against Anthropic API before accepting, stores configured flag (never stores raw key in KERNL — only "configured: true")
3. Step 2 KERNL init: tables exist and row counts shown
4. Step 3 AEGIS: graceful skip if AEGIS not running (onboarding does not block on AEGIS)
5. Step 4: sets first_run_complete = true, transitions to main app
6. On second launch: onboarding not shown
7. README accurately describes the product as built (no claims beyond what exists)
8. Phase 8 integration gate: EoS >= 85, 890+ tests passing (no regression), tsc clean
9. BLUEPRINT_FINAL.md §13 Phase 8 entry written
10. git tag v1.0.0 on remote
11. pnpm test:run zero failures

FILE LOCATIONS:
  app/components/onboarding/
    OnboardingFlow.tsx        - wizard container, step routing
    OnboardingStep1ApiKey.tsx - API key entry + validation
    OnboardingStep2Kernl.tsx  - KERNL init status + confirmation
    OnboardingStep3Aegis.tsx  - AEGIS connection test
    OnboardingStep4Ready.tsx  - summary + launch button

  app/README.md               - full rewrite (product document)

API KEY HANDLING — IMPORTANT:
Never store the raw Anthropic API key in KERNL SQLite or anywhere on disk in plaintext. The correct pattern is:
  - David enters key in the onboarding UI
  - App calls Tauri command storeApiKey(key) → stores in OS keychain (same keytar/Windows Credential Manager integration from Sprint 8A)
  - KERNL settings table stores: anthropic_api_key_configured = 'true' (not the key itself)
  - On each API call, retrieve key from keychain via getApiKey()
  - If keychain entry missing: surface "API key not configured" error, offer to re-open onboarding step 1

If keytar is not available and keychain integration from 8A had issues, read SPRINT_8A_COMPLETE.md for the decision made there and use the same approach.

AEGIS CONNECTION TEST:
AEGIS runs at http://localhost:PORT (read the port from D:\Dev\aegis\ config or D:\Dev\CLAUDE_INSTRUCTIONS.md). Send a GET /health or GET /status request. If response is 200: show "AEGIS connected ✓". If timeout/refused: show "AEGIS not running — you can connect later in settings" and continue. Never block onboarding on AEGIS.

README CONTENT — write as a product document, not a dev log:
  Title: GREGORE LITE
  Tagline: A cognitive cockpit for Claude — persistent memory, agent jobs, and self-evolution.

  Sections (prose paragraphs, no excessive bullets):
  1. What it is: single-user desktop app (Tauri + Next.js), strategic thread with full KERNL memory, Agent SDK job queue, Ghost context from filesystem + email, self-evolution mode.
  2. What makes it different: the app can improve its own codebase. David reviews the PR. Nothing merges without his click.
  3. Requirements: Windows 10/11, Node 20+, Anthropic API key, AEGIS (optional).
  4. Install: download installer from Releases, run setup.exe, enter API key on first launch.
  5. Architecture (brief — link to BLUEPRINT_FINAL.md for full detail): 5-layer stack, 8 phases built, 890 tests, EoS 85+.
  6. Development: clone, cd app, pnpm install, pnpm dev.
  7. Self-evolution: how to trigger, what the PR flow looks like, David's merge gate.

  Tone: confident, precise, no hyperbole. This README is for David and for anyone he shows the project to.

PHASE 8 INTEGRATION GATES:

GATE 1 — Security (from 8A):
  - grep for execSync in git-tools.ts, branch-manager.ts, orchestrator.ts → zero results
  - getPAT() uses OS keychain
  - Merge route returns 401 without valid token

GATE 2 — Quality (from 8B):
  - EoS deep scan >= 85
  - executor.ts EventListener: removeEventListener present
  - rate-limiter.ts: clearInterval present
  - phase5-integration.test.ts FP suppressed

GATE 3 — Installer (from 8C):
  - tauri.conf.json version = "1.0.0"
  - NSIS installer config present
  - build-installer.bat exists

GATE 4 — Ship (this sprint):
  - Onboarding shown on first launch, skipped on subsequent
  - API key stored in OS keychain (not plaintext)
  - README is a product document, accurate
  - pnpm test:run all passing
  - tsc --noEmit exit 0
  - EoS >= 85
  - git tag v1.0.0 on remote

BLUEPRINT_FINAL.MD §13 PHASE 8 ENTRY (write exactly this, filling in actuals):
  **Phase 8 — Ship Prep: v1.0.0** — ✅ COMPLETE ({DATE}).
  Security hardening: execSync → execFileSync (shell injection closed), OS keychain for GitHub PAT and Anthropic API key, merge route auth (HMAC desktop token). Leak fixes: executor.ts EventListener leak closed, rate-limiter.ts setInterval leak closed. EoS FP suppression: phase5-integration.test.ts:246 suppressed. EoS: {8B_score}→{8D_score}/{target}. NSIS installer, tauri-plugin-updater, build-installer.bat. First-run onboarding (4-step wizard: API key, KERNL init, AEGIS ping, launch). README rewritten as product document. {FINAL_TEST_COUNT} tests passing. git tag v1.0.0.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - all tests passing
3. EoS deep scan - >= 85
4. All Phase 8 integration gates checked (list above)
5. Update BLUEPRINT_FINAL.md §13 Phase 8 entry
6. Update STATUS.md - Phase 8 complete, v1.0.0 SHIPPED
7. git commit -F .git\COMMIT_MSG_TEMP (message: phase-8: v1.0.0 — onboarding, README, security hardened, EoS {score}, {test_count} tests)
8. git push
9. git tag v1.0.0 && git push origin v1.0.0
10. Write SPRINT_8D_COMPLETE.md: all Phase 8 gates documented, final EoS score, final test count, onboarding flow described, any first-run edge cases found

GATES CHECKLIST — FULL PHASE 8:
- execSync zero in self-evolution git files
- OS keychain: PAT + API key stored via keychain, not SQLite
- Merge route: 401 without token
- executor.ts: removeEventListener present
- rate-limiter.ts: clearInterval present
- EoS FP suppressed
- EoS >= 85
- tauri.conf.json version = "1.0.0"
- NSIS config present
- Onboarding: shown first launch, not shown on second
- API key stored in keychain (not plaintext in settings)
- AEGIS step: graceful skip if not running
- README: accurate product document, no vaporware
- pnpm test:run all passing (no regression from 890)
- tsc clean
- BLUEPRINT_FINAL.md §13 Phase 8 entry written
- git tag v1.0.0 on remote
- Commit pushed via cmd -F flag
