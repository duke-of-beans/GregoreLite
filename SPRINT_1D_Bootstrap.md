# SPRINT 1D — Bootstrap Sequence
## GregLite Phase 1 | Session 4 of 5 (Sequential)
**Status:** READY TO QUEUE (after 1C gates pass)  
**Depends on:** Sprint 1C complete  
**Blocks:** Sprint 1E

---

## OBJECTIVE

Implement the full bootstrap sequence from BLUEPRINT_FINAL.md §2.1. On every app open, GregLite loads KERNL context, dev protocols, and builds a context injection package before the first API call. Cold start target: under 60 seconds measured end to end.

**Success criteria:**
- App open → KERNL hydrates (active workstreams, last session summary, last 5 decisions, blockers)
- Dev protocol files loaded from disk (D:\Dev\TECHNICAL_STANDARDS.md, D:\Dev\CLAUDE_INSTRUCTIONS.md)
- Context injection package built and sent as system prompt on first API call
- UI renders before Claude responds (non-blocking)
- Cold start time logged and under 60s
- AEGIS STARTUP signal sent (stub OK if AEGIS not yet integrated)

---

## NEW FILES TO CREATE

```
app/lib/bootstrap/
  index.ts            — orchestrates full bootstrap sequence
  context-builder.ts  — builds context injection package from KERNL + dev protocols
  dev-protocols.ts    — loads TECHNICAL_STANDARDS.md and CLAUDE_INSTRUCTIONS.md from disk
  aegis-signal.ts     — sends STARTUP signal (stub for now, real in 2C)
  types.ts            — BootstrapResult, ContextPackage interfaces
```

---

## BOOTSTRAP SEQUENCE (from §2.1)

```
1. Load KERNL: active workstreams, last session summary, recent decisions (last 5), unresolved blockers
2. Load dev protocols from disk:
   - D:\Dev\TECHNICAL_STANDARDS.md
   - D:\Dev\CLAUDE_INSTRUCTIONS.md
3. Build context injection package
4. Send AEGIS STARTUP signal (stub: log only)
5. Render UI (non-blocking — happens in parallel with step 6)
6. Send first API call with full context package as system prompt
```

---

## CONTEXT INJECTION PACKAGE FORMAT

```typescript
interface ContextPackage {
  systemPrompt: string;       // assembled from all sources below
  kernlContext: {
    activeProjects: KERNLProject[];
    recentDecisions: KERNLDecision[];
    lastSessionSummary: string | null;
    activeSession: string | null;
  };
  devProtocols: {
    technicalStandards: string | null;   // null if file unreadable
    claudeInstructions: string | null;
    loadErrors: string[];
  };
  bootstrapTimestamp: number;
  coldStartMs: number;
}
```

### System prompt assembly

```typescript
function buildSystemPrompt(pkg: ContextPackage): string {
  const parts = [
    'You are GregLite, a premier AI development environment.',
    'You function as COO to the user\'s CEO role.',
    'Be direct, execution-focused, and intelligence-first.',
    '',
  ];

  if (pkg.devProtocols.technicalStandards) {
    parts.push('=== TECHNICAL STANDARDS ===');
    parts.push(pkg.devProtocols.technicalStandards);
    parts.push('');
  }

  if (pkg.devProtocols.claudeInstructions) {
    parts.push('=== OPERATING INSTRUCTIONS ===');
    parts.push(pkg.devProtocols.claudeInstructions);
    parts.push('');
  }

  if (pkg.kernlContext.lastSessionSummary) {
    parts.push('=== LAST SESSION SUMMARY ===');
    parts.push(pkg.kernlContext.lastSessionSummary);
    parts.push('');
  }

  if (pkg.kernlContext.recentDecisions.length > 0) {
    parts.push('=== RECENT DECISIONS ===');
    pkg.kernlContext.recentDecisions.forEach(d => {
      parts.push(`- ${d.decision} (${new Date(d.timestamp).toLocaleDateString()})`);
    });
    parts.push('');
  }

  if (pkg.kernlContext.activeProjects.length > 0) {
    parts.push('=== ACTIVE PROJECTS ===');
    pkg.kernlContext.activeProjects.forEach(p => {
      parts.push(`- ${p.name}${p.path ? ` (${p.path})` : ''}`);
    });
    parts.push('');
  }

  return parts.join('\n');
}
```

### Dev protocol file loading

Use Node.js `fs.readFile` with absolute paths. If file not found, log warning and continue — never block bootstrap on missing files. Store load errors in `devProtocols.loadErrors` for visibility.

```typescript
async function loadDevProtocols(): Promise<DevProtocols> {
  const paths = {
    technicalStandards: 'D:\\Dev\\TECHNICAL_STANDARDS.md',
    claudeInstructions: 'D:\\Dev\\CLAUDE_INSTRUCTIONS.md',
  };
  // ... load each, catch errors, return nulls with error messages
}
```

---

## INTEGRATION POINTS

### Wire into chat route

Replace static system prompt in 1A with context package system prompt:

```typescript
// In chat route — get context package built at boot (cached in module-level var)
const systemPrompt = getBootstrapContext()?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
```

Context package should be built once at server start and refreshed every 30 minutes or on explicit user action.

### Wire into UI

In `app/app/page.tsx` or a new `BootstrapProvider`:
- Call `bootstrap.run()` on mount
- Show loading state while bootstrapping (spinner in context panel, not blocking input)
- Log cold start time to console

---

## TIMING TARGETS

| Phase | Target |
|-------|--------|
| App shell visible | <3s |
| KERNL hydrated | <10s |
| Dev protocols loaded | <15s |
| UI interactive | <20s |
| First API call sent | <45s |
| Total cold start | <60s |

---

## GATES

- [ ] Dev protocol files load from disk into system prompt
- [ ] Last session summary appears in system prompt (verify via network tab)
- [ ] Recent decisions appear in system prompt
- [ ] Cold start time logged to console, under 60s
- [ ] UI renders before Claude responds
- [ ] pnpm type-check clean
- [ ] Commit: `sprint-1d: bootstrap sequence, context injection`
