# Sprint 8D Complete — First-Run Onboarding, README, v1.0.0 Tag

**Date:** 2026-03-04
**Commit:** 22aac71
**Branch:** master
**Tag:** v1.0.0
**Tests:** 887/890 passing (3 pre-existing artifact detector failures, no regression)
**EoS Score:** 100/100 (target ≥ 85)
**tsc:** Clean (0 errors)

---

## Deliverables

### First-Run Onboarding Wizard

Four-step wizard shown on first launch, gated by `first_run_complete` setting in KERNL.

**Step 1 — API Key:** Input field with `sk-ant-` prefix validation, validates against Anthropic `/v1/models` endpoint, stores in Windows Credential Manager via keytar. Only a `anthropic_api_key_configured = 'true'` flag is stored in SQLite — never the raw key. Skip button available.

**Step 2 — KERNL Memory:** Auto-checks database on mount. Shows table names and row counts. Falls back to "will be created on first use" if DB not initialized.

**Step 3 — AEGIS Connection:** Auto-pings `localhost:3033/health` with 3s timeout. Three states: checking → connected/unavailable. Graceful skip if AEGIS not running.

**Step 4 — Ready:** Summary of setup status (API key, KERNL, AEGIS). Sets `first_run_complete = 'true'` on launch. On second launch, onboarding is not shown.

**Files created:**
- `app/components/onboarding/OnboardingFlow.tsx` — wizard container with step routing + progress indicator
- `app/components/onboarding/OnboardingStep1ApiKey.tsx` — API key entry + validation + keychain storage
- `app/components/onboarding/OnboardingStep2Kernl.tsx` — KERNL database status display
- `app/components/onboarding/OnboardingStep3Aegis.tsx` — AEGIS connection test with graceful skip
- `app/components/onboarding/OnboardingStep4Ready.tsx` — summary + launch button
- `app/components/onboarding/index.ts` — barrel export
- `app/app/api/onboarding/route.ts` — GET (status) + POST (5 actions)
- `app/lib/security/keychain-store.ts` — added storeAnthropicKey, getAnthropicKey, deleteAnthropicKey

### page.tsx Wiring

`app/page.tsx` converted to client component. Checks `first_run_complete` via `/api/onboarding` GET on mount. Shows OnboardingFlow if false, main cockpit if true. Loading state prevents flash.

### README.md

Full rewrite as product document. Sections: What It Is, What Makes It Different, Requirements, Install, Architecture, Development, Self-Evolution. Prose paragraphs, no vaporware. Every claim verified against actual codebase.

### EoS Fix

Added `out/` and `src-tauri/target/` to exclude patterns in `lib/eos/types.ts`. The `out/` directory from Sprint 8C static export was causing false positives (invisible chars and smart quotes in bundled JS).

---

## Phase 8 Certification Gates — ALL PASSED

| Gate | Status |
|------|--------|
| execSync zero in git-tools, branch-manager, orchestrator | ✅ Verified |
| OS keychain: PAT + API key via keytar | ✅ Verified |
| Merge route: requireAppToken auth gate | ✅ Verified |
| executor.ts: removeEventListener in 3 paths | ✅ Verified |
| rate-limiter.ts: clearInterval in destroy() | ✅ Verified |
| EoS FP suppression | ✅ Verified |
| EoS ≥ 85 | ✅ 100/100 |
| tauri.conf.json version = "1.0.0" | ✅ Verified |
| NSIS config present | ✅ Verified |
| build-installer.bat exists | ✅ Verified |
| Onboarding shown on first launch | ✅ Implemented |
| API key in keychain, not plaintext | ✅ Verified |
| AEGIS graceful skip | ✅ Implemented |
| README accurate product document | ✅ Written |
| tsc --noEmit exit 0 | ✅ Clean |
| pnpm test:run no regression | ✅ 887/890 (baseline) |
| BLUEPRINT_FINAL.md §13 Phase 8 entry | ✅ Written |
| git tag v1.0.0 on remote | ✅ Pushed |

---

## Phase 8 Sprint Summary

| Sprint | Focus | Commit |
|--------|-------|--------|
| 8A | Security hardening (execSync, keychain, merge auth) | 8e25a72 |
| 8B | Leak fixes + EoS quality pass | b154aad |
| 8C | NSIS installer, Tauri build, auto-updater config | 5de4800 |
| 8D | Onboarding wizard, README, certification, v1.0.0 tag | 22aac71 |
