# SPRINT 4B COMPLETE
**Date:** March 2, 2026  
**Gates:** tsc 0 errors · 440/440 tests passing (23 new)  
**Commit:** sprint-4b: decision gate UI, API lock enforcement, Haiku inference

---

## What Was Built

Sprint 4B activated the Decision Gate from a passive trigger detector into a full enforcement loop. The gate now blocks the Claude API, surfaces a non-modal panel, and logs every decision to KERNL.

**Haiku inference** (`lib/decision-gate/inference.ts`) replaces the three always-false stubs with a single `claude-haiku-4-5-20251001` call per `analyze()` invocation. One API call evaluates all three structured triggers simultaneously — `highTradeoff`, `multiProject`, `largeEstimate` — returning strict JSON. The call fails open on any error (bad JSON, network failure, empty messages) so it never blocks the chat route. Estimated cost: ~$0.0005 per analysis call (100 tokens max, Haiku pricing).

**423 enforcement** (`app/api/chat/route.ts`) checks `getDecisionLock()` at the top of the POST handler, before rate limiting. While the gate is locked, every submission returns `{ error: 'decision_locked', reason, trigger }` with status 423. The client detects 423 and shows an inline error — no spinner, no false submit.

**GatePanel** (`components/decision-gate/GatePanel.tsx`) slides in above the input bar (non-modal). It reads `dismissCount` from the Zustand store. After 3 dismissals, the Dismiss button disappears and `MandatoryOverlay` replaces it — a textarea requiring ≥20 characters before the Override button activates. Approve and Override both call their respective API routes, which write to KERNL then release the lock.

**API routes** — three new endpoints:
- `POST /api/decision-gate/approve` — logs to KERNL as `approved`, releases lock
- `POST /api/decision-gate/dismiss` — calls `dismissLock()`, returns `{ released, mandatory, dismissCount }`
- `POST /api/decision-gate/override` — validates rationale length ≥ 20 chars, logs as `overridden`, releases lock

**KERNL logger** (`lib/decision-gate/kernl-logger.ts`) wraps `logDecision()` (better-sqlite3, synchronous) and calls `releaseLock()` after the write. Server-only — client components call API routes, not the logger directly.

**TriggerBadge** — amber pulsing badge in the Header right section when `gateTrigger !== null`. Signals active gate state without blocking the UI.

**Zustand store** expanded with `dismissCount: number` and `setDismissCount()`. `setTrigger(result, dismissCount)` now takes an optional count that's threaded from the server's lock state via the fire-and-forget `analyze()` callback — no client round-trip needed to know how many dismissals remain.

---

## Gate Results

| Gate | Result |
|------|--------|
| tsc --noEmit | ✅ 0 errors |
| pnpm test:run | ✅ 440/440 passing (23 new) |
| Haiku inference — happy path | ✅ Parses clean JSON, markdown-fenced JSON |
| Haiku inference — fail open | ✅ Bad JSON → all false; API error → all false; empty messages → no call |
| Haiku — last 5 messages only | ✅ Verified (10-message array, only messages 5–9 in prompt) |
| logGateApproval — KERNL schema | ✅ thread_id, category, title, impact, rationale all set |
| logGateApproval — call order | ✅ releaseLock fires after logDecision (KERNL write first) |
| dismissCount store shape | ✅ init=0, setTrigger with count, setDismissCount, clearTrigger resets both |
| 423 lock state machine | ✅ unlocked→locked via acquireLock, getLockState returns correct shape |
| analyze() structured triggers | ✅ highTradeoff→high_tradeoff_count, multiProject→multi_project_touch, largeEstimate→large_build_estimate |
| Sync triggers short-circuit Haiku | ✅ repeated_question fires before inference, mockCreate not called |

---

## Key Discoveries

**vitest class constructor mock**: `vi.fn().mockImplementation(() => ({ ... }))` produces a plain function — `new Anthropic()` throws `TypeError: ... is not a constructor`. The fix is `class { messages = { create: mockCreate }; }` inside the mock factory. vitest's warning "The vi.fn() mock did not use 'function' or 'class' in its implementation" is the signal.

**dismissCount threading**: Rather than having GatePanel call `/api/decision-gate/dismiss` and then re-query the lock state for count, `dismissCount` comes from the server in the fire-and-forget `setTrigger(result, dismissCount)` call. The panel reads it directly from the Zustand store — zero extra round-trips.

**Server/client boundary for KERNL**: `logDecision()` is a better-sqlite3 call (synchronous, Node.js only). It must never be imported into a client component. GatePanel calls `/api/decision-gate/approve` and `/api/decision-gate/override`, which are Next.js Route Handlers — server-only by default. `kernl-logger.ts` is the server-side wrapper; client code never imports it.

**NextResponse vs Response in safeHandler**: The `safeHandler` wrapper in the chat route returns `Promise<NextResponse<unknown>>`. Returning a bare `new Response(...)` inside it causes a TypeScript error. Must use `NextResponse.json({ ... }, { status: 423 })`.

---

## Files Created

- `app/lib/decision-gate/inference.ts` — Haiku structured trigger inference
- `app/lib/decision-gate/kernl-logger.ts` — KERNL write + releaseLock wrapper
- `app/app/api/decision-gate/approve/route.ts`
- `app/app/api/decision-gate/dismiss/route.ts`
- `app/app/api/decision-gate/override/route.ts`
- `app/components/decision-gate/GatePanel.tsx`
- `app/components/decision-gate/TriggerBadge.tsx`
- `app/components/decision-gate/ContradictionView.tsx`
- `app/components/decision-gate/MandatoryOverlay.tsx`
- `app/components/decision-gate/index.ts`
- `app/lib/__tests__/unit/decision-gate-4b.test.ts` (23 tests)

## Files Modified

- `app/lib/decision-gate/index.ts` — replaced 3 stubs with single `inferStructuredTriggers` call
- `app/lib/stores/decision-gate-store.ts` — added `dismissCount`, `setDismissCount`, updated `setTrigger` signature
- `app/app/api/chat/route.ts` — 423 lock check, `dismissCount` passed to `setTrigger`
- `app/components/chat/ChatInterface.tsx` — GatePanel wired above input bar, 423 handling
- `app/components/ui/Header.tsx` — TriggerBadge in right section

---

## Next: Sprint 4C — Integration Hardening + Phase 4 Certification
