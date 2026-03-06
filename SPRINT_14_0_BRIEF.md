GREGLITE SPRINT 14.0 — Production Readiness: Start Breaking It
End-to-end verification, fix the 3 failing tests, hardening for daily driver use | March 2026

YOUR ROLE: Make GregLite production-ready for David to use as his daily driver. This means: fix everything that would crash, confuse, or block on first real use. You are the QA engineer and the release engineer. Run the app, use it, find the gaps, fix them. David is CEO. Zero debt.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\README.md
4. D:\Projects\GregLite\RELEASE_CHECKLIST.md
5. D:\Projects\GregLite\app\.env.example
6. D:\Projects\GregLite\app\.env.local
7. D:\Projects\GregLite\app\package.json
8. D:\Projects\GregLite\app\app\page.tsx
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- Tempted to add new features — this is HARDENING ONLY
- A fix cascades into 5+ files — stop, document the scope, get confirmation
- Redis/BullMQ is actually required for dev startup — document and provide a workaround
- Sonnet has failed on the same problem twice → spawn Opus subagent

---

This sprint has three phases: fix known issues, verify the cold start path, and harden error handling for real usage.

═══════════════════════════════════════════════════════════════════════════════
PHASE 1: FIX KNOWN ISSUES (Tasks 1–4)
═══════════════════════════════════════════════════════════════════════════════

TASK 1: Fix the 3 pre-existing test failures

These 3 tests have been failing since Phase 5 and have been carried forward across every sprint since. They are in:
- artifacts/detector.test.ts (likely 1-2 failures)
- phase5-integration.test.ts (likely 1-2 failures)

READ the test files. READ the implementation files they test. Understand why they fail. Fix the root cause — do NOT delete the tests or mark them as skip.

Possible causes (from Sprint 5C key discoveries):
- `scoreClass` import chain pulling in `lib/database/migrations/index.ts` which reads SQL files that don't exist — was supposedly fixed by extracting to `lib/eos/score-class.ts` but may have regressed
- EoS deep scan catches test fixtures as false positives
- `shim_improvements` table may not exist in the test DB context

Goal: 1207/1207 tests passing (or whatever the count is — zero failures).

TASK 2: Fix .env.example

The file references `gregore.db` but the codebase uses `greglite.db`. Also:
- Clarify which env vars are actually required vs optional
- Is REDIS_URL needed for dev? BullMQ is in dependencies. If Redis isn't running, does the app crash on startup or degrade gracefully?
- Is OPENAI_API_KEY / GOOGLE_API_KEY / XAI_API_KEY / DEEPSEEK_API_KEY used anywhere? GregLite is Claude-only per the blueprint. Remove dead env vars or mark them clearly as unused.
- Add any env vars that are actually needed but missing from the example (e.g., KERNL_DB_PATH, AEGIS port)

TASK 3: Clean up dead dependencies

Audit package.json:
- `@ai-sdk/openai` — is this used? GregLite is Claude-only
- `ioredis` — is this used outside of BullMQ? If BullMQ isn't actively used in dev, note it
- `googleapis` — used by Ghost email (Gmail connector). Fine if Ghost is active.
- `jsdom` — was installed in Sprint 11.3 but not needed (per SPRINT_11_3_COMPLETE.md). Remove if unused.
- `happy-dom` — check if used. May be a duplicate of jsdom.
- Any other deps that were added speculatively but never imported

Don't remove anything that's actually imported. Run `pnpm why <package>` or grep for imports before removing.

TASK 4: Fix version inconsistency

- package.json says 1.0.0
- tauri.conf.json says 1.0.0
- But we've shipped through v1.1.0 (Phase 9) and now have Transit Map + 13.0 polish
- Decide: either bump to 1.2.0 (Transit Map release) or leave at 1.0.0 and document that version bumps happen at release time, not at sprint completion
- Update PROJECT_DNA.yaml and README.md if version changes

═══════════════════════════════════════════════════════════════════════════════
PHASE 2: COLD START VERIFICATION (Tasks 5–8)
═══════════════════════════════════════════════════════════════════════════════

TASK 5: Fresh database cold start

Delete the .kernl directory (or use a temp KERNL_DB_PATH) and start the app:
1. `cd D:\Projects\GregLite\app && pnpm dev`
2. Open http://localhost:3000
3. Verify: onboarding wizard appears (first_run_complete is false)
4. Walk through all 4 onboarding steps — does each one work? Does API key validation hit the Anthropic API? Does KERNL init succeed? Does AEGIS connection check handle "not running" gracefully?
5. After onboarding, verify the main cockpit loads: ContextPanel on left, ChatInterface on right
6. Send a real message to Claude — does the API call succeed? Does SSE streaming render progressively? Does the message persist in KERNL?

Document every failure. Fix what's fixable in this sprint. Log blockers for follow-up.

TASK 6: Multi-turn conversation verification

With a working API key, have a real conversation:
1. Send 5+ messages back and forth
2. Verify: messages persist across page refresh
3. Verify: thread appears in chat history panel (Cmd+[)
4. Verify: context panel shows active thread info
5. Verify: Transit Map events are being captured (check conversation_events table or the scrollbar landmarks)
6. Verify: cost tracking shows real token usage in the cost breakdown
7. Try the density toggle (compact/comfortable/spacious) — does it work?
8. Try Cmd+Shift+M (Transit metadata toggle) — does metadata appear on messages?

TASK 7: Error recovery verification

Test failure modes:
1. Invalid API key → does the app show a clear error, not a blank screen?
2. Network disconnect mid-stream → does the app handle it gracefully? Does partial content survive?
3. Very long message (paste 2000 words) → does the UI handle it?
4. Rapid-fire messages (send 3 in quick succession) → does the queue handle it or does it crash?
5. Open the app with no .env.local → what happens? Does onboarding catch it?

TASK 8: Feature surface smoke test

Quick verification that major features don't crash on load:
1. Command palette (Cmd+K) → opens, can search, can execute commands
2. Inspector drawer (Cmd+I) → opens, all 6 tabs load without error (Thread/KERNL/Quality/Jobs/Costs/Learning)
3. Settings panel → opens, all sections render, toggles work
4. War Room tab → renders (even if empty — should show empty state, not crash)
5. Transit tab → renders subway map (even if no events yet — should show empty state)
6. Artifact panel → if applicable, test with a code block response
7. Thread management: create new thread (Cmd+N), switch threads, rename, delete
8. Keyboard shortcuts panel → lists all shortcuts accurately

═══════════════════════════════════════════════════════════════════════════════
PHASE 3: ERROR HANDLING HARDENING (Tasks 9–12)
═══════════════════════════════════════════════════════════════════════════════

TASK 9: Global error boundary

Check if a React error boundary exists at the app level (page.tsx or layout.tsx):
- If not: add one. Any unhandled render error should show a recovery UI, not a white screen.
- The error boundary should: show the error message, offer "Reload" and "Clear thread and reload" options, log the error to console.
- Wrap ChatInterface specifically — a crash in the chat shouldn't kill the context panel or settings.

TASK 10: API route error standardization

Audit all API routes in app/api/ for consistent error handling:
- Every route should return structured JSON errors: { error: string, code?: string }
- No route should return 500 with an HTML error page
- Every route should have try/catch at the top level
- Check particularly: /api/chat (the main streaming route), /api/transit/*, /api/bootstrap, /api/context

TASK 11: Startup resilience

The bootstrap sequence (page.tsx → /api/onboarding → /api/bootstrap) has failure points:
- If /api/onboarding throws, the app shows "Loading..." forever (the catch sets showOnboarding to false, which is correct — but verify)
- If /api/bootstrap throws, does the chat still work? The chat should function without bootstrap context (degraded but functional)
- If KERNL database is corrupted (schema mismatch from a botched migration), what happens? The app should detect this and offer to reset.
- If AEGIS is not running, verify the app doesn't repeatedly error-log connection failures (should log once then go quiet)

TASK 12: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — ALL passing (0 failures — the 3 pre-existing should be fixed)
3. Verify dev cold start works end-to-end
4. Update STATUS.md: version, test count, next steps
5. Update PROJECT_DNA.yaml
6. Write SPRINT_14_0_COMPLETE.md with a "Known Issues" section for anything you found but couldn't fix
7. Commit: "chore: Sprint 14.0 — production readiness (3 test fixes, cold start verification, error hardening)"
8. Push

---

QUALITY GATES:
 1. 0 test failures (fix the 3 pre-existing)
 2. .env.example is accurate and documented
 3. Dead dependencies removed or documented
 4. Cold start from empty database → onboarding → first message works
 5. Multi-turn conversation persists and Transit events capture
 6. Error boundary catches render crashes
 7. Invalid API key shows clear error message
 8. All major features load without crash (smoke test)
 9. No infinite "Loading..." states
10. tsc clean

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. This is HARDENING — do NOT add features
3. Fix root causes, not symptoms (no test skips, no error swallowing)
4. Use cmd shell (not PowerShell)
5. Document everything you find in SPRINT_14_0_COMPLETE.md — especially things you CAN'T fix in this sprint
6. If Redis is required and not running, the app must degrade gracefully, not crash
