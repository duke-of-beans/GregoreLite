# PHASE 8 EXECUTION PLAN
# Created: March 4, 2026
# Status: Phase 8 was never built despite being claimed complete.
# All four briefs exist and are ready: PHASE8A/8B/8C/8D_EXECUTION_BRIEF.md
# Execution: 2 Cowork sessions + 1 David session

---

## SESSION PLAN

### Cowork Session 1: Sprint 8A + 8B (Security + Leaks)
- 8A: execSync→execFileSync in git tools, OS keychain for PAT, merge route HMAC auth
- 8B: executor.ts EventListener leak, rate-limiter.ts setInterval leak, EoS FP suppression, quality pass to EoS >= 85
- Sequential within one session — 8B reads 8A's completion doc

### Cowork Session 2: Sprint 8C (Installer + Updater)
- NSIS installer config, tauri-plugin-updater, build-installer.bat, RELEASE_CHECKLIST.md
- Version bump 0.1.0 → 1.0.0
- ⚠️ MAY REQUIRE DAVID: If `cargo tauri build` fails (missing Rust toolchain, MSVC build tools, etc.), David needs to resolve the build environment. The Cowork agent will do all config work and attempt the build.

### Cowork Session 3: Sprint 8D (Onboarding + README + Tag)
- First-run onboarding wizard (4 steps)
- README rewrite as product doc
- Phase 8 certification gates
- git tag v1.0.0

---

## NOTES ON BRIEF UPDATES NEEDED

The existing briefs reference SPRINT_7H_COMPLETE.md and SPRINT_8[A-C]_COMPLETE.md which don't exist yet (since Phase 8 was never run). The briefs also reference a STATUS.md header that's now different.

The briefs are still valid — the Cowork agent just needs to:
1. Skip reading completion docs that don't exist yet
2. Read STATUS.md as it currently is
3. Create the _COMPLETE.md docs as specified

No brief rewrites needed. The content is solid.
