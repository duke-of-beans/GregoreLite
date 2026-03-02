GREGLITE SPRINT 6I - Ghost Thread Integration + Phase 6 Hardening
Phase 6, Sprint 9 of 9 | Sequential after 6H | March 2, 2026

YOUR ROLE: Certify Phase 6 complete. End-to-end integration testing, performance measurement, security audit of the untrusted content boundary, and closing out the Ghost Thread as a production feature. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - section 6 fully
7. D:\Projects\GregLite\SPRINT_6H_COMPLETE.md
8. All previous SPRINT_6[A-H]_COMPLETE.md files - scan for open issues flagged by prior sprints
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- Security audit finds [UNTRUSTED CONTENT] label is stripped or bypassed at any point - this is a hard block, do not continue until resolved
- Integration test reveals Ghost chunks leaking into Cross-Context Engine suggestions - fix the source filter before shipping
- EoS self-scan health score drops below 75 due to Phase 6 additions - investigate and fix before marking complete
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] Run EoS self-scan + capture full output → mechanical execution + output capture
[HAIKU] Run pnpm test:run + capture pass/fail counts → mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] Performance measurements: run timing scripts for startup/shutdown/ingest/scorer, capture output → mechanical
[HAIKU] Update BLUEPRINT_FINAL.md section 13 completion log → content specified (date, test count, EoS score, timings), mechanical doc write
[HAIKU] SESSION END: Update STATUS.md Phase 6 complete, write SPRINT_6I_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] Write phase6-integration.test.ts: 30+ tests covering lifecycle, watcher, privacy exclusion, ingest, scorer, Privacy Dashboard API
[SONNET] Cross-context leakage test: index 50 Ghost chunks, assert absent from standard surfacing results
[SONNET] Fix any failing integration tests
[SONNET] Fix any EoS critical issues if health score drops below 75
[OPUS] TASK 2 - Security audit: trace every path where Ghost content enters a Claude API call, verify [UNTRUSTED CONTENT] label survives end-to-end → this is novel verification requiring genuine synthesis across multiple subsystems; if any path is missing the label, the fix may require architectural changes

QUALITY GATES:
1. Full integration test suite: all Ghost components working end-to-end
2. No Ghost chunks appear in Cross-Context Engine suggestion cards
3. [UNTRUSTED CONTENT] label present in every Claude API call that includes Ghost content
4. Privacy exclusion: 10 test cases per layer, all passing
5. EoS self-scan on updated GregLite codebase: health score >= 75
6. Ghost startup time under 3 seconds from app open
7. Ghost shutdown time under 5 seconds from app close
8. pnpm test:run zero failures

TASKS:

TASK 1 - END-TO-END INTEGRATION TEST SUITE
Write phase6-integration.test.ts covering:

  Ghost Lifecycle:
  - Ghost starts in correct order on lifecycle.startGhost()
  - Ghost stops within 5 seconds on lifecycle.stopGhost()
  - Degraded component does not prevent other components from running
  - AEGIS PARALLEL_BUILD pauses all components, resume restores all

  Filesystem Watcher:
  - should_exclude() in Rust returns true for node_modules path
  - should_exclude() returns true for .env file
  - should_exclude() returns false for allowed .ts file
  - FileChangeEvent emitted for valid file change

  Privacy Exclusion:
  - Layer 1: .pem file excluded before IO
  - Layer 1: file in secrets/ dir excluded
  - Layer 1: file with "password" in name excluded
  - Layer 2: chunk containing SSN pattern excluded
  - Layer 2: chunk with valid Luhn CC number excluded
  - Layer 2: chunk with sk-xxxxx API key excluded
  - Layer 2: chunk with invalid Luhn CC number NOT excluded
  - Layer 3: email with attorney-client subject excluded
  - Layer 4: user exclusion pattern triggers on matching path
  - All 10: exclusion logged to ghost_exclusion_log

  Ingest Pipeline:
  - ingestFile() produces content_chunks rows with source: ghost
  - ingestEmail() produces content_chunks rows with source: ghost
  - Ghost chunks NOT returned by standard findSimilarChunks() call
  - Ghost chunks ARE returned when includeGhost: true

  Interrupt Scorer:
  - buildActiveContextVector() returns null when no active session
  - generateCandidates() returns only Ghost-sourced chunks
  - Candidates below 0.75 filtered out
  - canSurface() returns false after 2 suggestions in 24h
  - criticalOverride() bypasses 24h cap when both thresholds met

  Privacy Dashboard API:
  - DELETE /api/ghost/items/:id cascades to content_chunks and vec_index
  - POST /api/ghost/exclusions adds to ghost_exclusions
  - POST /api/ghost/purge clears all ghost data

TASK 2 - SECURITY AUDIT: UNTRUSTED CONTENT BOUNDARY
Manually trace every path where Ghost content enters a Claude API call:
  1. Interrupt scorer summary generation (6E) - verify system prompt contains [UNTRUSTED CONTENT] instruction
  2. Tell me more context injection (6H) - verify [GHOST CONTEXT - UNTRUSTED CONTENT] prefix in injected text
  3. Any other path where Ghost chunks touch a Claude API call

For each path, add an assertion in the integration test:
  - The Claude API call body.system contains 'UNTRUSTED CONTENT' OR
  - The content prefix in messages contains '[GHOST CONTEXT - UNTRUSTED CONTENT]'

If any path is missing this label, add it before marking the audit complete.

TASK 3 - CROSS-CONTEXT LEAKAGE VERIFICATION
Run the Cross-Context Engine suggestion surfacing with Ghost data indexed and verify:
  - findSimilarChunks() called without includeGhost: true returns 0 Ghost chunks
  - The suggestion cards in the context panel (Phase 3/Phase 5) never show Ghost-sourced content

Add a test that indexes 50 Ghost chunks, then runs standard Cross-Context surfacing, and asserts Ghost chunks are absent from results.

TASK 4 - PERFORMANCE MEASUREMENT
Measure and record in SPRINT_6I_COMPLETE.md:

  Ghost startup sequence:
    - Total time from lifecycle.startGhost() to ghost:status-changed 'running'
    - Target: under 3 seconds
    - Measured: ?

  Ghost shutdown:
    - Total time from lifecycle.stopGhost() to ghost:status-changed 'stopped'
    - Target: under 5 seconds
    - Measured: ?

  Ingest throughput:
    - Files per second at full speed (IDLE AEGIS profile)
    - Target: at least 5 files/second
    - Measured: ?

  Scorer run time:
    - Time from runScorer() call to ghost:suggestion-ready (if threshold met)
    - Target: under 10 seconds (includes Claude haiku API call for summary)
    - Measured: ?

TASK 5 - EOS SELF-SCAN
Run EoS on the Phase 6 codebase and compare to Phase 5 baseline (82/100):
  - Target: >= 75 (some regression acceptable given Rust additions, but not below 75)
  - If any new critical issues: fix them before marking complete
  - Record full scan output in SPRINT_6I_COMPLETE.md

TASK 6 - UPDATE BLUEPRINT
In BLUEPRINT_FINAL.md section 13 (Completion Log), mark Phase 6 complete with:
  - Date
  - Final test count
  - EoS health score
  - Ghost startup/shutdown timing
  - First real Ghost suggestion (if generated during testing)

TASK 7 - PHASE 7 READINESS
Read BLUEPRINT section 7 (Self-Evolution Mode). Note dependencies from Phase 6:
  - Self-Evolution uses the same Agent SDK infrastructure (Phase 2)
  - It does NOT use Ghost components directly
  - KERNL logging from Phase 4 is the main prerequisite
  Record Phase 7 dependencies in SPRINT_6I_COMPLETE.md.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - all tests passing including new phase6-integration.test.ts
3. Update STATUS.md - Phase 6 complete
4. Update BLUEPRINT_FINAL.md section 13 - Phase 6 completion logged
5. git commit -F .git\COMMIT_MSG_TEMP (message: phase-6: complete - Ghost Thread, filesystem watcher, email connectors, privacy engine, interrupt scorer)
6. git push
7. Write SPRINT_6I_COMPLETE.md: full integration test results, security audit findings, performance measurements, EoS score, Phase 7 dependencies

GATES CHECKLIST - PHASE 6 CERTIFICATION:
- All integration tests passing (30+ tests in phase6-integration.test.ts)
- [UNTRUSTED CONTENT] label verified on every path Ghost content enters Claude API
- Ghost chunks never appear in Cross-Context Engine results (verified by test)
- Privacy exclusion: all 10 test cases per layer passing
- EoS health score >= 75 on Phase 6 codebase
- Ghost startup under 3 seconds (measured)
- Ghost shutdown under 5 seconds (measured)
- Privacy Dashboard: delete, add exclusion, purge all working end-to-end
- BLUEPRINT_FINAL.md Phase 6 marked complete
- STATUS.md Phase 6 complete
- pnpm test:run zero failures
- Phase 6 completion commit pushed via cmd -F flag
