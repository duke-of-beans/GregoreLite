GREGLITE MEGA-SPRINT 18.0 — Memory Shimmer + Decision Gate Enhancement
Real-time context reveals on typing + intelligent three-choice gate | March 2026

YOUR ROLE: Build two of Gregore's most distinctive features into GregLite. First: the Memory Shimmer — as the user types, words that match KERNL memory entries glow with a cyan shimmer, and clicking them expands a memory card showing the source. Second: the Adaptive Override System — every decision gate warning offers three choices (just this once / always allow / never warn) and the system learns from choices. David is CEO. Zero debt.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\GREGORE_AUDIT.md — READ §2 Patterns 3 (Shimmer) + 5 (Adaptive Override)
4. D:\Projects\GregLite\app\app\globals.css — shimmer keyframe + .memory-match class ALREADY EXIST
5. D:\Projects\GregLite\app\components\chat\ChatInterface.tsx — READ FULLY (input field where shimmer applies)
6. D:\Projects\GregLite\app\lib\kernl\index.ts — KERNL public API (FTS5 search)
7. D:\Projects\GregLite\app\lib\kernl\session-manager.ts — searchThread() or FTS5 query functions
8. D:\Projects\GregLite\app\lib\cross-context\proactive.ts — existing proactive suggestions (checkOnInput)
9. D:\Projects\GregLite\app\lib\decision-gate\trigger-detector.ts — current trigger logic
10. D:\Projects\GregLite\app\lib\decision-gate\lock.ts — lock/dismiss lifecycle
11. D:\Projects\GregLite\app\lib\decision-gate\types.ts — GateTrigger type
12. D:\Projects\GregLite\app\components\decision-gate/ or wherever GatePanel.tsx lives — current gate UI
13. D:\Projects\GregLite\app\lib\stores/ — Zustand stores (decision-gate-store, ui-store)
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- Shimmer causes input lag — if the debounced KERNL query takes >50ms, reduce query scope or increase debounce. Typing must never feel laggy.
- The shimmer highlight operates on the RENDERED text near the input (suggestion overlay), NOT by modifying the actual input value. You cannot inject HTML spans into a textarea/input — use an overlay approach.
- Decision gate override policies must be stored in SQLite (KERNL settings or new table), not localStorage.
- Sonnet has failed on the same problem twice → spawn Opus subagent

---

═══════════════════════════════════════════════════════════════════════════════
PHASE 1: MEMORY SHIMMER (Tasks 1-7)
═══════════════════════════════════════════════════════════════════════════════

TASK 1: Memory query hook

New file: app/lib/memory/shimmer-query.ts

```typescript
/**
 * Debounced KERNL query for shimmer matches.
 * Returns terms from the input that match existing KERNL memory.
 *
 * Strategy: extract meaningful tokens from input (skip stopwords),
 * query KERNL FTS5 for each token, return tokens that have matches.
 */
export function queryShimmerMatches(
  input: string,
  conversationId: string,
): ShimmerMatch[]

interface ShimmerMatch {
  term: string;           // The word/phrase that matched
  startIndex: number;     // Character position in input string
  endIndex: number;       // End position
  source: 'memory' | 'decision' | 'ghost';  // Where the match came from
  sourceId: string;       // Thread/decision/chunk ID for click-to-expand
  preview: string;        // First 80 chars of the matching content
}
```

Implementation:
1. Extract tokens from input (lowercase, split whitespace, filter stopwords — reuse the list from topic-detector.ts)
2. Skip if input < 3 meaningful tokens (too short to match)
3. For each token, query KERNL FTS5: `SELECT * FROM messages_fts WHERE messages_fts MATCH ? LIMIT 3`
4. Also check `content_chunks` (Cross-Context) for Ghost-indexed content
5. Also check `decisions` table for decision history matches
6. Return matches with positions (use String.indexOf for each matched term)
7. Total query budget: <50ms. If FTS5 is too slow on many tokens, limit to first 5 tokens.

TASK 2: Shimmer overlay component

New file: app/components/chat/ShimmerOverlay.tsx

This is an OVERLAY positioned on top of the input field, NOT a modification to the input value. The input remains a plain textarea. The overlay renders highlighted spans at the same character positions.

```typescript
interface ShimmerOverlayProps {
  matches: ShimmerMatch[];
  inputText: string;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onMatchClick: (match: ShimmerMatch) => void;
}
```

Implementation:
- Position: absolute, same position/size as the input textarea
- pointer-events: none on the container (don't block typing)
- pointer-events: auto on individual shimmer spans (for click)
- Each matched term rendered as a span with the `.memory-match` class (ALREADY IN globals.css — shimmer keyframe + hover underline)
- Non-matched text rendered as invisible (transparent) spans for positioning
- Font size, line-height, padding must EXACTLY match the input field to align text
- Clicking a shimmer span fires onMatchClick with the match data

This is architecturally similar to how code editors show inline suggestions — an overlay with identical text metrics.

TASK 3: Memory card popover

New file: app/components/chat/MemoryCard.tsx

When a shimmer match is clicked, show a small card near the cursor:

```typescript
interface MemoryCardProps {
  match: ShimmerMatch;
  position: { x: number; y: number };
  onClose: () => void;
  onNavigate: (sourceId: string) => void;  // click to jump to source thread
}
```

Content:
- Source type badge: "Memory" / "Decision" / "Ghost" in small pill
- Preview text (80 chars)
- Source thread title or decision title
- "View source →" link (navigates to the thread/decision)
- Fade in 150ms, dismiss on click outside or Escape

Style: var(--elevated) background, subtle border, max-width 300px. Position near the clicked shimmer span. Avoid clipping off screen edges.

TASK 4: Debounced shimmer hook

New file: app/hooks/useShimmerMatches.ts

```typescript
export function useShimmerMatches(
  inputText: string,
  conversationId: string,
  enabled: boolean,
): ShimmerMatch[]
```

Implementation:
- Debounce: 300ms after last keystroke (do NOT query on every character)
- Skip if inputText < 10 chars or < 3 tokens
- Skip if enabled === false (user preference)
- Call queryShimmerMatches(), update state with results
- Clear matches when input is cleared
- Cancel pending query on unmount

TASK 5: Wire shimmer into ChatInterface

File: app/components/chat/ChatInterface.tsx

1. Import useShimmerMatches, ShimmerOverlay, MemoryCard
2. Call useShimmerMatches with the current input text and active conversation ID
3. Render ShimmerOverlay positioned over the input textarea
4. On match click, show MemoryCard popover
5. Add user preference to ui-store: `shimmerEnabled: boolean` (default true)
6. Add to Settings > Appearance: "Memory highlights" toggle

TASK 6: Add shimmer preference and memory barrel

New file: app/lib/memory/index.ts — barrel export for shimmer-query

Add to ui-store: `shimmerEnabled` boolean, default true
Add to Settings > Appearance section

TASK 7: Shimmer tests

New file: app/lib/memory/__tests__/shimmer-query.test.ts

Tests:
- Returns matches for terms that exist in KERNL FTS5
- Returns empty for terms with no matches
- Skips short inputs (<10 chars)
- Stopwords are filtered
- Positions (startIndex/endIndex) are correct
- Total query time <50ms on mock data
- Handles special characters in input

═══════════════════════════════════════════════════════════════════════════════
CHECKPOINT: After Task 7, verify:
  npx tsc --noEmit — 0 errors
  pnpm test:run — all passing
  Commit: "feat: Sprint 18.0 Phase 1 — Memory Shimmer (real-time context reveals)"
  Push, then continue to Phase 2.
═══════════════════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════════════════
PHASE 2: ADAPTIVE OVERRIDE SYSTEM (Tasks 8-13)
═══════════════════════════════════════════════════════════════════════════════

TASK 8: Override policy types and storage

New file: app/lib/decision-gate/override-policies.ts

```typescript
interface OverridePolicy {
  id: string;                          // nanoid
  trigger_type: GateTrigger;           // which trigger this policy covers
  scope: 'once' | 'category' | 'always';  // how broadly it applies
  category?: string;                   // for 'category' scope — e.g., "code_review" topic
  created_at: number;                  // Unix ms
  expires_at: number | null;           // null = permanent, otherwise auto-expire
}

// CRUD
export function createPolicy(trigger: GateTrigger, scope: string, category?: string): OverridePolicy
export function getPolicies(): OverridePolicy[]
export function getPoliciesForTrigger(trigger: GateTrigger): OverridePolicy[]
export function deletePolicy(id: string): void
export function hasActivePolicy(trigger: GateTrigger, category?: string): boolean
```

Storage: New `gate_override_policies` table in KERNL schema.sql:
```sql
CREATE TABLE IF NOT EXISTS gate_override_policies (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('once', 'category', 'always')),
  category TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
```

Add migration to runMigrations() in database.ts.

TASK 9: Wire policies into trigger detector

File: app/lib/decision-gate/trigger-detector.ts (or index.ts — wherever analyze() lives)

Before running trigger detection:
1. Check if an active override policy exists for each trigger type
2. If `hasActivePolicy(trigger, category)` → skip that trigger, log as "auto-allowed by policy"
3. 'once' policies: auto-delete after first use (single-use bypass)
4. 'category' policies: check if the current conversation topic matches the category
5. 'always' policies: always bypass that trigger type

Add transparency: when a trigger is auto-allowed, include it in the response metadata so the receipt footer can show "ℹ Auto-allowed by override policy"

TASK 10: Three-choice Gate UI

File: app/components/decision-gate/GatePanel.tsx (or wherever the gate warning renders)

Current: binary dismiss/address buttons
New: three choices per Gregore UI_UX_FINAL_DIRECTION.md Part 3:

```
┌─────────────────────────────────────────┐
│  ⚠ Review Required                      │
│                                         │
│  [Human-readable gate message]          │
│                                         │
│  How should I handle this?              │
│                                         │
│  ○ Just this once                       │
│  ○ Always allow [trigger category]      │
│  ○ Never warn about this again          │
│                                         │
│  [Cancel]  [Proceed]                    │
└─────────────────────────────────────────┘
```

Behavior:
- "Just this once" → creates a 'once' policy (auto-deletes after use), proceeds
- "Always allow [category]" → creates a 'category' policy, proceeds
- "Never warn about this again" → creates an 'always' policy for this trigger type, proceeds
- Cancel → keeps the gate active (same as current behavior)

Use the VOICE gate messages from lib/voice/copy-templates.ts (Sprint 17.0).

TASK 11: Policy management in Settings

Add a new section to Settings: "Review Policies" (or nest under an existing section)

List all active override policies:
- Trigger type (human-readable name from VOICE)
- Scope (once/category/always)
- Created date
- Delete button (×) to remove individual policies
- "Reset all policies" button at the bottom

TASK 12: Override policy tests

New file: app/lib/decision-gate/__tests__/override-policies.test.ts

Tests:
- Create and retrieve a policy
- 'once' policy auto-deletes after first hasActivePolicy check
- 'category' policy matches trigger + category
- 'always' policy bypasses regardless of category
- deletePolicy removes it
- getPoliciesForTrigger filters correctly
- Expired policies don't match

TASK 13: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing
3. Verify: trigger a gate → three-choice UI appears → "Just this once" proceeds and doesn't persist
4. Verify: "Always allow" creates persistent policy visible in Settings
5. Verify: subsequent triggers of same type auto-allowed with transparency note
6. Verify: shimmer highlights appear while typing (if KERNL has indexed data)
7. Verify: clicking shimmer shows memory card with source preview
8. Update STATUS.md
9. Write SPRINT_18_0_COMPLETE.md
10. Commit: "feat: Sprint 18.0 — Memory Shimmer + Adaptive Override System"
11. Push

---

QUALITY GATES:
 1. Shimmer matches appear within 300ms of typing pause
 2. Typing never feels laggy (query budget <50ms)
 3. Shimmer overlay aligns perfectly with input text
 4. Clicking shimmer shows memory card with source preview
 5. Memory card "View source" navigates to the thread
 6. Three-choice gate UI renders correctly
 7. "Just this once" auto-deletes policy after use
 8. "Always allow" persists in SQLite and shows in Settings
 9. Auto-allowed triggers show transparency note in receipt
10. Override policies survive app restart (SQLite-backed)
11. tsc clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. Shimmer is an OVERLAY — do NOT inject HTML into the textarea value
3. Shimmer query must be <50ms — if KERNL FTS5 is slow, reduce scope
4. Override policies in SQLite (not localStorage — survives data clears)
5. Use cmd shell (not PowerShell)
6. Use EXISTING .memory-match class and @keyframes shimmer from globals.css
7. Mid-sprint checkpoint commit after Phase 1 before starting Phase 2
8. 'once' policies are single-use — auto-delete after first bypass
