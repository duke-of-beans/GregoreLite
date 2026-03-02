GREGLITE SPRINT 6H - Ghost Thread Context Panel Cards
Phase 6, Sprint 8 of 9 | Sequential after 6G | March 2, 2026

YOUR ROLE: Build the Ghost suggestion cards in the context panel. The Ghost speaks at most twice a day. When it does, a card appears in the context panel with a one-sentence summary, source, and two actions: Tell me more or Noted. Cards auto-expire after 4 hours. This sprint is UI-only - the scoring engine (6E) already generates suggestions and emits ghost:suggestion-ready. Wire the UI to it. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - section 6.4 (card description) and 6.7
7. D:\Projects\GregLite\SPRINT_6G_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- Tell me more requires injecting Ghost content into the strategic thread - design that injection carefully before building (untrusted content label must survive the injection)
- Auto-expire via setTimeout has reliability issues if the app is backgrounded for hours - use a comparison against surfacedAt + 4h on every render instead
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] GhostCard.tsx: static layout (icon, summary, source, two buttons) → layout fully specified, mechanical
[HAIKU] GhostCardActions.tsx: two buttons with onClick handlers → spec is simple, mechanical
[HAIKU] POST /api/ghost/suggestions/:id/feedback route → simple POST, body spec defined, mechanical
[HAIKU] handleNoted(): record feedback + remove from Zustand array → logic fully specified, mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 6H complete, write SPRINT_6H_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] GhostCardList.tsx: Zustand integration, expiry filter on render, section header conditional, max 2 cap
[SONNET] handleTellMeMore(): fetch chunk content → build injection string with [GHOST CONTEXT - UNTRUSTED CONTENT] prefix → inject into thread context buffer → show indicator → record feedback
[SONNET] Ghost context active indicator: show below thread input with dismiss X
[SONNET] Wire ghost:suggestion-ready Tauri event to Zustand ghostSuggestions update (if not already done in 6F)
[OPUS] Escalation only if Sonnet fails twice on the same problem — particularly if the context injection mechanism from 6F needs redesign

QUALITY GATES:
1. Ghost cards appear in context panel when ghost:suggestion-ready fires
2. Cards show: one-sentence summary, source label, score indicator (optional, subtle), Tell me more + Noted buttons
3. Tell me more: injects the chunk content into the active thread as context (with [UNTRUSTED CONTENT] prefix visible to Claude, not to David)
4. Noted: dismisses card, records 'noted' in ghost_suggestion_feedback
5. Cards auto-expire 4 hours after surfacing (checked on render, not via setTimeout)
6. Maximum 2 active Ghost cards at any time (enforced by scorer in 6E, but also enforced in UI)
7. Ghost cards visually distinct from Cross-Context suggestion cards

FILE LOCATIONS:
  app/components/ghost/
    GhostCard.tsx            - single suggestion card
    GhostCardList.tsx        - container, manages active cards from Zustand store
    GhostCardActions.tsx     - Tell me more / Noted buttons with handlers

  app/lib/ghost/
    card-actions.ts          - handleTellMeMore(suggestion), handleNoted(suggestion)

GHOST CARD VISUAL DESIGN:
Ghost cards should feel different from Cross-Context suggestion cards. Suggestions are blue-tinted. Ghost cards should be a muted dark teal or charcoal - something that says "this came from outside your current work" rather than "this is related to what you are building."

Card layout:
  [ghost icon] Ghost
  [one sentence summary]
  Source: [file path or "Email: Subject Line" truncated at 50 chars]
  [Tell me more]  [Noted]

The ghost icon can be a simple eye outline (lucide-react Eye icon). Do not use a spooky ghost emoji.

Score indicator: optional, shown only if score > 0.90. A small amber dot labeled "High relevance". Below 0.90, show nothing - the card stands on its own summary.

Critical suggestions (isCritical: true from 6E) get a subtle amber left border.

TELL ME MORE:
When David clicks Tell me more:
  1. Fetch the full chunk content from content_chunks WHERE chunk_id = suggestion.chunkId
  2. Build a context injection string:
       "[GHOST CONTEXT - UNTRUSTED CONTENT - Source: {source}]\n\n{chunkContent}\n\n[END GHOST CONTEXT]"
  3. Add this as a system-level context injection into the active strategic thread (not as a user message)
     - Method: add to the thread's context buffer that gets prepended to the next Claude API call
     - Do NOT show this injection text to David in the UI
  4. Show a subtle indicator on the thread: "Ghost context active" with the source name
  5. Record 'expanded' in ghost_suggestion_feedback
  6. Dismiss the card (same as Noted)

The [UNTRUSTED CONTENT] label in the injected text ensures that if Claude processes it, it is framed as external untrusted content (section 6.6 security requirement). Claude sees the label. David does not see the injection text.

NOTED:
When David clicks Noted:
  1. Record 'noted' in ghost_suggestion_feedback
  2. Remove card from Zustand ghost suggestions array
  3. The dismissed_at timestamp is set on the ghost_surfaced row via API call

API route:
  POST /api/ghost/suggestions/:id/feedback
  body: { action: 'noted' | 'expanded' }

AUTO-EXPIRE:
On every render of GhostCardList, filter out suggestions where:
  Date.now() > suggestion.expiresAt

Do not use setTimeout or setInterval for this. A simple filter on render is sufficient and more reliable.

PLACEMENT IN CONTEXT PANEL:
Ghost cards appear in their own section in the context panel, below Cross-Context suggestions and above the Quality section from Phase 5.

Section header: "From Ghost" with the ghost eye icon.

If no active Ghost suggestions, do not show the section header at all (no empty state needed - Ghost absence is normal).

GHOST CONTEXT ACTIVE INDICATOR:
When Tell me more is clicked and Ghost context is injected into the thread:
  - Show a small indicator below the thread input: "Ghost context active - {source}" with an X to dismiss
  - Dismiss removes the context injection from the thread buffer

This is similar to how Cross-Context "Tell me more" works but visually distinguished.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 6H complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-6h: Ghost context panel cards, Tell me more injection, auto-expire)
5. git push
6. Write SPRINT_6H_COMPLETE.md: end-to-end Ghost card flow tested (scorer -> card -> Tell me more), untrusted content label verified in API calls, auto-expire behavior verified

GATES CHECKLIST:
- Ghost card appears in context panel when ghost:suggestion-ready fires
- Card shows correct summary, source, and optional score indicator
- Tell me more: injects chunk content into thread context buffer
- [GHOST CONTEXT - UNTRUSTED CONTENT] label present in injected text (verify in network tab or API log)
- David does not see the injection text in the UI thread
- "Ghost context active" indicator appears after Tell me more
- Noted: records feedback, removes card
- Cards with expiresAt in the past filtered out on render
- Maximum 2 Ghost cards ever visible
- Critical suggestions have amber left border
- Ghost cards visually distinct from Cross-Context suggestion cards
- pnpm test:run clean
- Commit pushed via cmd -F flag
