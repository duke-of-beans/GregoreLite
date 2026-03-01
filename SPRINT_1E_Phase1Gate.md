# SPRINT 1E — Phase 1 Completion Gate
## GregLite Phase 1 | Session 5 of 5 (Sequential)
**Status:** READY TO QUEUE (after 1D gates pass)  
**Depends on:** Sprints 1A–1D complete  
**Unlocks:** All five Phase 2 parallel sprints

---

## OBJECTIVE

Integration, hardening, and measurement. Phase 1 is done when a conversation survives app restart with full context restored. This sprint wires everything together, runs the full gate checklist, and commits the Phase 1 baseline.

**Success criteria (hard gates — all must pass):**
- Send 5 messages → kill app → restart → all 5 messages visible in UI
- System prompt contains dev protocol content from D:\Dev\
- System prompt contains last session summary from KERNL
- Cold start measured and logged: under 60 seconds
- pnpm type-check: zero errors
- pnpm test:run: zero failures
- No Gregore-specific imports anywhere in active code (grep check)
- Header displays "Gregore Lite" not "GREGORE"

---

## TASKS

### Task 1 — Fix Header branding

`app/components/ui/Header.tsx` — update hardcoded "GREGORE" text to "Gregore Lite".

### Task 2 — Grep audit for Gregore leftovers

Run and verify zero results for each:
```powershell
Select-String -Path "app\**\*.ts","app\**\*.tsx" -Pattern "OrchestrationExecutor" -Recurse
Select-String -Path "app\**\*.ts","app\**\*.tsx" -Pattern "ghostApproved" -Recurse
Select-String -Path "app\**\*.ts","app\**\*.tsx" -Pattern "override-policies" -Recurse
Select-String -Path "app\**\*.ts","app\**\*.tsx" -Pattern "from '@/lib/aot'" -Recurse
Select-String -Path "app\**\*.ts","app\**\*.tsx" -Pattern "from '@/lib/orchestration'" -Recurse
Select-String -Path "app\**\*.ts","app\**\*.tsx" -Pattern "from '@/lib/world'" -Recurse
```

Any hits → fix before proceeding.

### Task 3 — End-to-end restart test

Manual verification:
1. Start pnpm dev
2. Send 5 messages, get 5 responses
3. Kill terminal (Ctrl+C)
4. Restart pnpm dev
5. Open localhost:3000
6. Verify all 5 messages visible without user action

### Task 4 — System prompt verification

Open browser DevTools → Network tab → find POST /api/chat → inspect request body → confirm system prompt contains:
- Dev protocol content (TECHNICAL_STANDARDS.md excerpt)
- Last session summary
- Recent decisions list

### Task 5 — Cold start timing

Add explicit console.time('bootstrap') / console.timeEnd('bootstrap') around full bootstrap sequence. Capture the number. Must be under 60,000ms.

### Task 6 — Update STATUS.md

Mark Phase 1 complete. Add Phase 2 as active. Record cold start baseline measurement.

### Task 7 — Update BLUEPRINT_FINAL.md

Update Phase 1 completion gate in §13 with actual measured cold start time and date completed.

---

## CLEANUP TASKS (if not done in 1A)

- Delete `app/lib/hooks/useBudgetPreference.ts` (Gregore budget UI)
- Delete `app/lib/hooks/useReceiptPreference.ts` (Gregore receipt UI)  
- Delete `app/lib/types/cognitive.ts` (AOT types — deleted module)
- Clean up `app/lib/types/index.ts` to remove exports for deleted types
- Clean up `app/lib/services/index.ts` to remove pattern exports that no longer exist

---

## PHASE 1 COMPLETION CERTIFICATE

When all gates pass, commit with:
```
git commit -m "phase-1: complete — working strategic thread, KERNL persistence, crash recovery, bootstrap sequence"
```

This commit is the baseline. Phase 2 sprints are now all unblocked and can run in parallel.

---

## GATES (all required)

- [ ] Conversation survives restart (manual test, 5 messages)
- [ ] System prompt contains dev protocol content
- [ ] System prompt contains KERNL session summary
- [ ] Cold start under 60s (logged)
- [ ] pnpm type-check: zero errors
- [ ] pnpm test:run: zero failures
- [ ] Zero Gregore orchestration imports in active code
- [ ] Header shows "Gregore Lite"
- [ ] STATUS.md updated
- [ ] Phase 1 completion commit pushed
