# GREGLITE — SPRINT 3G EXECUTION BRIEF
## Ranking, Suppression + Proactive Surfacing UI
**Instance:** Sequential after 3F
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Depends on:** Sprint 3F complete

---

## YOUR ROLE

Bounded execution worker. You are completing the Cross-Context Engine's user-facing layer — the suggestion cards that appear in the context panel, the full ranking formula, and the suppression enforcement. After this sprint, Cross-Context is a working end-to-end feature. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §5.7 (Proactive Surfacing) fully

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. Maximum 2 suggestion cards visible at any time
4. Suppressed suggestions never appear in the main panel
5. Auto-expire: suggestions older than 4 hours disappear without user action
6. STATUS.md updated

---

## WHAT YOU ARE BUILDING

### New files

```
app/components/cross-context/
  SuggestionCard.tsx        — inline context panel card: summary, source, actions
  SuggestionPanel.tsx       — max-2 container, manages display rotation

app/lib/cross-context/
  proactive.ts              — on-input trigger, query pipeline, surface top 2
  value-boost.ts            — valueBoost calculation (placeholder for Phase 4 expansion)
```

### Full ranking formula — from §5.7

```typescript
// surfacing.ts — upgrade from 3E stub to full formula
export async function scoreCandidate(
  candidate: VectorSearchResult,
  context: { activeProjectId?: string }
): Promise<number> {
  const sim2 = Math.pow(candidate.similarity, 2);

  // Recency factor: 1.0 for last 7 days, linear decay to 0.5 at 90 days
  const chunk = await getChunkMeta(candidate.chunkId);
  const ageDays = (Date.now() - chunk.createdAt) / (1000 * 60 * 60 * 24);
  const recencyFactor = ageDays <= 7 ? 1.0 : Math.max(0.5, 1.0 - (ageDays - 7) / (90 - 7) * 0.5);

  // Relevance boost: 1.2 if chunk belongs to active project
  const relevanceBoost = chunk.projectId === context.activeProjectId ? 1.2 : 1.0;

  // Dismissal penalty: 0.2 × dismissals in last 30 days, capped at 0.8
  const recentDismissals = await getDismissalsInWindow(candidate.chunkId, 30 * 24 * 60 * 60 * 1000);
  const dismissalPenalty = Math.min(0.8, recentDismissals * 0.2);

  // Value boost: 1.5 if marked critical (Phase 3 stub — always 1.0 for now)
  const valueBoost = await getValueBoost(candidate.chunkId);

  return sim2 * recencyFactor * relevanceBoost * (1 - dismissalPenalty) * valueBoost;
}
```

### On-input trigger

Every user message triggers a background similarity search. If any results pass the `onInputSuggestion` threshold, surface the top 2:

```typescript
// proactive.ts
export async function checkOnInput(userMessage: string, activeProjectId?: string): Promise<Suggestion[]> {
  if (userMessage.length < 50) return []; // too short to be meaningful

  const threshold = await getThreshold('onInputSuggestion');
  const candidates = await findSimilarChunks(userMessage, 20, threshold);

  const scored: Array<Suggestion & { displayScore: number }> = [];
  for (const candidate of candidates) {
    if (await isSuppressed(candidate.chunkId)) continue;
    const displayScore = await scoreCandidate(candidate, { activeProjectId });
    if (displayScore >= 0.70) {
      scored.push({ ...candidate, displayScore, surfacedAt: Date.now() });
    }
  }

  return scored.sort((a, b) => b.displayScore - a.displayScore).slice(0, 2);
}
```

Wire into chat route — after receiving user message, BEFORE sending to Anthropic:

```typescript
// Fire and forget — do not delay response
checkOnInput(body.message, activeProjectId)
  .then(suggestions => {
    if (suggestions.length > 0) {
      suggestionStore.setSuggestions(suggestions);
    }
  })
  .catch(err => logger.warn('[proactive] check failed', { err }));
```

### Suggestion card UI

Appears in context panel (Sprint 2B's SuggestionSlot — now activated):

```tsx
// SuggestionCard.tsx
<div className="suggestion-card">
  <div className="suggestion-header">
    <span className="suggestion-source">{sourceLabel}</span>
    <span className="suggestion-score">{(displayScore * 100).toFixed(0)}% match</span>
  </div>
  <p className="suggestion-summary">{oneSentenceSummary}</p>
  <div className="suggestion-actions">
    <button onClick={onTellMeMore}>Tell me more</button>
    <button onClick={onDismiss}>Noted</button>
  </div>
</div>
```

"Tell me more" → injects the matched chunk content into the strategic thread as context, adds a system message "Related context from [source]:", then the chunk content. Does not interrupt the current conversation.

"Noted" → records `dismissed` feedback, triggers suppression check.

### Auto-expire

Suggestions older than 4 hours disappear without user action. Implemented via a `setTimeout` in the Zustand store when a suggestion is added.

```typescript
// In suggestion Zustand store:
setTimeout(() => {
  removeSuggestion(suggestion.id);
}, 4 * 60 * 60 * 1000);
```

### Suggestions counter in context panel

Update `SuggestionSlot.tsx` from Phase 2B — the placeholder "Suggestions: [0]" now shows the real count from the Zustand store:

```tsx
<div className="suggestion-slot">
  {suggestions.length > 0
    ? <span>Suggestions: [{suggestions.length}]</span>
    : <span className="muted">No suggestions</span>
  }
</div>
```

---

## CHECKPOINTING

Every 3 file writes: `npx tsc --noEmit` + `git add && git commit -m "sprint-3g(wip): [description]"`

---

## SESSION END

1. Zero errors, zero failures
2. Update STATUS.md — Sprint 3G complete
3. `git commit -m "sprint-3g: proactive surfacing, suggestion cards, ranking formula"`
4. `git push`
5. Write `SPRINT_3G_COMPLETE.md` — surfacing latency observed, any ranking formula tuning done

---

## GATES CHECKLIST

- [ ] Suggestion cards appear in context panel after sending a relevant message
- [ ] Max 2 suggestion cards visible simultaneously
- [ ] "Tell me more" injects context into strategic thread
- [ ] "Noted" records dismissed feedback and triggers suppression check
- [ ] Suppressed suggestions do not re-appear until window expires
- [ ] Auto-expire: cards older than 4 hours disappear
- [ ] `SuggestionSlot` counter shows real count (not placeholder 0)
- [ ] On-input check is fire-and-forget (does not delay chat response)
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
