Execute Sprint 8D for GregLite — First-Run Onboarding, README, Phase 8 Certification, v1.0.0 Tag.

Read these files IN ORDER before doing anything:
1. D:\Projects\GregLite\PHASE8D_EXECUTION_BRIEF.md — full Sprint 8D spec
2. D:\Projects\GregLite\SPRINT_8C_COMPLETE.md — previous sprint results
3. D:\Projects\GregLite\SPRINT_8A_COMPLETE.md — keychain decision (needed for API key storage approach)
4. D:\Projects\GregLite\STATUS.md — current state
5. D:\Projects\GregLite\DEV_PROTOCOLS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md — §14 product funnel + §10 UI/UX (for README tone)

CRITICAL CONTEXT: Phase 8 was never built. Sprints 8A, 8B, 8C have now been completed. You are completing the final sprint and certifying the phase.

SPRINT 8D — Onboarding + README + Certification:
1. KERNL migration: add first_run_complete, anthropic_api_key_configured settings rows
2. Build OnboardingFlow.tsx with 4 steps:
   - Step 1: API key entry + validation (test call to Anthropic). Store key in OS keychain (same approach as 8A — read SPRINT_8A_COMPLETE.md). Store only "configured: true" in KERNL settings. NEVER store raw key in SQLite.
   - Step 2: KERNL init status (show tables, row counts, auto-init if needed)
   - Step 3: AEGIS connection test (ping health endpoint, graceful skip if not running)
   - Step 4: Summary + [Launch Gregore Lite] button → sets first_run_complete = true
3. Wire into app mount: check first_run_complete, show wizard if false, main app if true
4. Write README.md as a product document (NOT a dev log). Sections: what it is, what makes it different, requirements, install, architecture overview, development, self-evolution. Accurate — no vaporware claims.
5. Run FULL Phase 8 certification gates (all 4 sprints — checklist in the brief)
6. Update BLUEPRINT_FINAL.md §13 Phase 8 entry (change ⚠️ to ✅ with real data)
7. Update STATUS.md — Phase 8 COMPLETE
8. Commit: "phase-8: v1.0.0 — onboarding, README, security hardened, EoS {score}, {tests} tests"
9. git tag v1.0.0 && git push origin v1.0.0
10. Write SPRINT_8D_COMPLETE.md with all gate results

IMPORTANT NOTES:
- For API key storage: read SPRINT_8A_COMPLETE.md to see what keychain approach was used. Use the same one.
- The AEGIS step must NOT block onboarding — graceful skip with "connect later in settings"
- README must be accurate: read the actual codebase before making claims
- Shell: use cmd (not PowerShell)
- GIT: write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP
- Project path: D:\Projects\GregLite\app
- After final commit + push: git tag v1.0.0 && git push origin v1.0.0
