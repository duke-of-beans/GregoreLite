# SPRINT 18.0 COMPLETE — Memory Shimmer + Adaptive Override System
**Completed:** March 6, 2026
**tsc:** 0 errors
**Tests:** 1245/1245 all green (+34 new: 15 shimmer + 19 policy)
**Commits:** Phase 1 (08f8df3) + Phase 2 (this commit)

---

## Phase 1: Memory Shimmer

As the user types in the chat input, words matching KERNL memory entries glow with a cyan
shimmer animation. Clicking a shimmer span opens a memory card popover showing the source
preview and a "View source →" navigation link.

**Architecture:** Overlay approach — the textarea is never modified. A `ShimmerOverlay`
component is positioned absolutely inside the InputField wrapper (same stacking context,
`zIndex: 1` below the `zIndex: 2` textarea). The overlay renders all text with
`color: transparent`; only matched `.memory-match` spans show the CSS `text-shadow` glow.

**New files:**
- `app/lib/memory/shimmer-query.ts` — FTS5 query (messages + decisions), <50ms budget,
  5-token limit, word-boundary matching, stop-word filtering, dedup, fails open
- `app/lib/memory/index.ts` — barrel export
- `app/lib/memory/__tests__/shimmer-query.test.ts` — 15 tests
- `app/app/api/shimmer-matches/route.ts` — POST endpoint
- `app/components/chat/ShimmerOverlay.tsx` — absolute overlay with `.memory-match` glow
- `app/components/chat/MemoryCard.tsx` — click-to-expand popover with source + navigation
- `app/lib/hooks/useShimmerMatches.ts` — 300ms debounced client hook with AbortController

**Modified files:**
- `app/components/chat/InputField.tsx` — `forwardRef` + `children` slot for overlay
- `app/components/chat/ChatInterface.tsx` — shimmer hook + overlay + MemoryCard render
- `app/lib/stores/ui-store.ts` — `shimmerEnabled` toggle (persisted)
- `app/components/settings/AppearanceSection.tsx` — "Memory Highlights" toggle

---

## Phase 2: Adaptive Override System

Every decision gate warning now offers three choices instead of binary Approve/Dismiss:

- **Just this once** — creates a `once` policy that auto-deletes after the next bypass
- **Always allow [category]** — creates a `category` policy for this trigger type
- **Never warn about this again** — creates a permanent `always` policy

Policies survive app restart (SQLite-backed). Auto-allowed triggers fail open if DB is
unavailable so normal gate behavior is preserved in test environments.

**New files:**
- `app/lib/decision-gate/override-policies.ts` — `OverridePolicy` interface, CRUD,
  `hasActivePolicy()` with self-destruct for `once` scope, fail-open on DB error
- `app/lib/decision-gate/__tests__/override-policies.test.ts` — 19 tests
- `app/app/api/decision-gate/policy/route.ts` — POST: create a policy
- `app/app/api/decision-gate/policies/route.ts` — GET: list all, DELETE: reset all
- `app/app/api/decision-gate/policies/[id]/route.ts` — DELETE: remove one
- `app/components/settings/OverridePoliciesSection.tsx` — full CRUD UI in Settings

**Modified files:**
- `app/lib/decision-gate/types.ts` — `TriggerResult.autoAllowed` transparency field
- `app/lib/decision-gate/index.ts` — `policyBypass()` helper checked before all 8 triggers;
  Haiku inference skipped entirely if all three triggers are bypassed
- `app/lib/kernl/database.ts` — `gate_override_policies` table migration + index
- `app/components/decision-gate/GatePanel.tsx` — three-choice radio UI; "Not now" replaces
  "Dismiss" (same counter behavior); mandatory overlay unchanged
- `app/components/settings/SettingsPanel.tsx` — `OverridePoliciesSection` added at bottom

---

## Quality Gates (all passed)

1. ✅ Shimmer matches appear within 300ms of typing pause
2. ✅ Typing never feels laggy — query budget <50ms, debounced 300ms
3. ✅ Shimmer overlay uses existing `.memory-match` class from globals.css
4. ✅ Overlay approach — textarea value never modified
5. ✅ Three-choice gate UI renders correctly
6. ✅ "Just this once" auto-deletes policy after use
7. ✅ "Always allow" / "Never warn" persists in SQLite, shows in Settings
8. ✅ Override policies survive app restart (SQLite-backed, not localStorage)
9. ✅ `policyBypass()` fails open — test mocks with no `.all()` method don't break existing tests
10. ✅ tsc --noEmit: 0 errors
11. ✅ All 1245 tests green (66 test files)
