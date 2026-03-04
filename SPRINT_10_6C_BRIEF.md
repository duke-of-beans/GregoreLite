# SPRINT 10.6C — EXECUTION BRIEF: Visual Identity & Quick Wins
# Wave 3: Flat messages, density toggle, cost precision, branding, prompt tuning
# Prerequisites: Brief A complete (hydration/API fixes)
# Gate: Flat borderless messages, 3 density presets, 4dp costs, consistent branding

---

## CONTEXT

Project root: `D:\Projects\GregLite`, App: `D:\Projects\GregLite\app`
Blueprint: `D:\Projects\GregLite\SPRINT_10_6_BLUEPRINT.md` (Tasks 4, 11, 12, 13)

These are all independent quick wins. Do them in order listed.

---

## TASK 1 — Flat Borderless Messages + Density Toggle (Blueprint Task 4)

### Read first:
- `D:\Projects\GregLite\app\components\chat\Message.tsx`
- `D:\Projects\GregLite\app\components\chat\MessageList.tsx`

### Create density store

Create: `D:\Projects\GregLite\app\lib\stores\density-store.ts`

```typescript
/**
 * Density Store — Sprint 10.6
 *
 * Three message density presets. Persisted to localStorage.
 * CSS variables set on the message list container — messages read from them.
 */

import { create } from 'zustand';

export type Density = 'compact' | 'comfortable' | 'spacious';

interface DensityState {
  density: Density;
  autoScroll: boolean;
  setDensity: (d: Density) => void;
  cycleDensity: (direction: 'up' | 'down') => void;
  setAutoScroll: (enabled: boolean) => void;
}

const STORAGE_KEY = 'greglite-density';
const SCROLL_KEY = 'greglite-autoscroll';
const ORDER: Density[] = ['compact', 'comfortable', 'spacious'];

function loadDensity(): Density {
  if (typeof window === 'undefined') return 'comfortable';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'compact' || stored === 'comfortable' || stored === 'spacious') return stored;
  return 'comfortable';
}

function loadAutoScroll(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(SCROLL_KEY) !== 'false';
}

export const useDensityStore = create<DensityState>((set) => ({
  density: 'comfortable', // SSR-safe default, synced in useEffect
  autoScroll: true,

  setDensity: (d) => {
    localStorage.setItem(STORAGE_KEY, d);
    set({ density: d });
  },

  cycleDensity: (direction) => {
    set((state) => {
      const idx = ORDER.indexOf(state.density);
      const next = direction === 'up'
        ? ORDER[Math.max(0, idx - 1)]!
        : ORDER[Math.min(ORDER.length - 1, idx + 1)]!;
      localStorage.setItem(STORAGE_KEY, next);
      return { density: next };
    });
  },

  setAutoScroll: (enabled) => {
    localStorage.setItem(SCROLL_KEY, String(enabled));
    set({ autoScroll: enabled });
  },
}));

export const DENSITY_CONFIG = {
  compact:     { fontSize: '13px', lineHeight: '1.4', gap: '8px',  padding: '6px 0',  roleLabelSize: '10px' },
  comfortable: { fontSize: '14px', lineHeight: '1.5', gap: '12px', padding: '8px 0',  roleLabelSize: '11px' },
  spacious:    { fontSize: '15px', lineHeight: '1.6', gap: '20px', padding: '12px 0', roleLabelSize: '12px' },
} as const;
```

### Modify MessageList.tsx

Add density CSS variables on the scroll container:

```typescript
import { useDensityStore, DENSITY_CONFIG } from '@/lib/stores/density-store';

// Inside component:
const density = useDensityStore((s) => s.density);
const config = DENSITY_CONFIG[density];

// On the scroll container div, add style:
style={{
  '--msg-font-size': config.fontSize,
  '--msg-line-height': config.lineHeight,
  '--msg-gap': config.gap,
  '--msg-padding': config.padding,
  '--msg-role-size': config.roleLabelSize,
} as React.CSSProperties}
```

Also add a hydration-safe sync:
```typescript
const setDensity = useDensityStore((s) => s.setDensity);
useEffect(() => {
  const stored = localStorage.getItem('greglite-density');
  if (stored === 'compact' || stored === 'comfortable' || stored === 'spacious') {
    setDensity(stored);
  }
}, [setDensity]);
```

Change the message list gap from `gap-4` to use the CSS variable:
```
<div className="flex flex-col" style={{ gap: 'var(--msg-gap, 12px)' }}>
```

Center the message column with max-width:
```
<div className="mx-auto w-full max-w-3xl">
```

### Modify Message.tsx — Kill bubbles, go flat

**Remove:**
- `justify-end` / `justify-start` wrapper — ALL messages left-aligned
- `max-w-[80%]` — messages use full column width
- `rounded-lg` on the message container
- `border-l-[3px] border-[var(--cyan)] bg-[var(--cyan)]/10` on user messages
- `bg-[var(--elevated)]/60` on assistant messages

**Replace with flat layout:**

```typescript
export function Message({ role, content, timestamp, highlightQuery, isActiveMatch,
  onEdit, onRegenerate, isStreaming, model, tokens, costUsd, latencyMs }: MessageProps) {
  const isUser = role === 'user';
  const showActions = onEdit || onRegenerate;

  return (
    <div
      className="group/msg w-full"
      role="article"
      aria-label={`${isUser ? 'User' : 'AI'} message`}
      data-active-match={isActiveMatch ? 'true' : undefined}
      style={{
        padding: 'var(--msg-padding, 8px 0)',
        scrollMarginTop: isActiveMatch ? '80px' : undefined,
      }}
    >
      {/* Role label */}
      <div
        className="mb-1 font-semibold"
        style={{
          fontSize: 'var(--msg-role-size, 11px)',
          color: isUser ? 'var(--cyan)' : 'var(--frost)',
        }}
      >
        {isUser ? 'You' : 'GregLite'}
      </div>

      {/* Content — subtle left border for user messages only */}
      <div
        style={{
          borderLeft: isUser ? '2px solid var(--cyan)' : 'none',
          paddingLeft: isUser ? '12px' : '0',
          fontSize: 'var(--msg-font-size, 14px)',
          lineHeight: 'var(--msg-line-height, 1.5)',
        }}
        className="text-[var(--ice-white)]"
      >
        {isUser ? (
          <p className="m-0 whitespace-pre-wrap break-words">
            {highlightQuery ? highlightText(content, highlightQuery) : content}
          </p>
        ) : (
          <div className="prose prose-invert max-w-none" style={{ fontSize: 'inherit', lineHeight: 'inherit' }}>
            {highlightQuery ? (
              <p className="m-0 whitespace-pre-wrap break-words">
                {highlightText(content, highlightQuery)}
              </p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {content}
              </ReactMarkdown>
            )}
          </div>
        )}

        {/* Streaming cursor */}
        {isStreaming && (
          <span className="inline-block animate-pulse text-[var(--cyan)]">▌</span>
        )}
      </div>

      {/* Edit / Regenerate hover actions */}
      {showActions && (
        <div className="mt-1 flex items-center gap-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
          {onEdit && (
            <button onClick={onEdit}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-[var(--mist)] hover:text-[var(--ice-white)] hover:bg-[var(--surface)] transition-colors"
              title="Edit message (Cmd+E)">✎ Edit</button>
          )}
          {onRegenerate && (
            <button onClick={onRegenerate}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-[var(--mist)] hover:text-[var(--ice-white)] hover:bg-[var(--surface)] transition-colors"
              title="Regenerate (Cmd+R)">↻ Regenerate</button>
          )}
        </div>
      )}

      {/* Timestamp + metadata */}
      <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--mist)]">
        {timestamp !== undefined && (
          <span>{timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
        )}
        {/* Per-message metadata — shows after streaming completes */}
        {!isStreaming && model && (
          <>
            <span>·</span>
            <span>{model.replace('claude-', '').split('-')[0]}</span>
          </>
        )}
        {!isStreaming && tokens !== undefined && tokens > 0 && (
          <>
            <span>·</span>
            <span>{tokens.toLocaleString()} tokens</span>
          </>
        )}
        {!isStreaming && costUsd !== undefined && costUsd > 0 && (
          <>
            <span>·</span>
            <span>${costUsd.toFixed(4)}</span>
          </>
        )}
        {!isStreaming && latencyMs !== undefined && latencyMs > 0 && (
          <>
            <span>·</span>
            <span>{(latencyMs / 1000).toFixed(1)}s</span>
          </>
        )}
      </div>
    </div>
  );
}
```

### Add keyboard shortcuts to ChatInterface.tsx

In the existing keyboard handler `useEffect`, add:

```typescript
// Cmd+Shift+= — increase density (more compact)
if (meta && e.shiftKey && (e.key === '=' || e.key === '+')) {
  e.preventDefault();
  useDensityStore.getState().cycleDensity('up');
}
// Cmd+Shift+- — decrease density (more spacious)
if (meta && e.shiftKey && e.key === '-') {
  e.preventDefault();
  useDensityStore.getState().cycleDensity('down');
}
```

Import `useDensityStore` at the top.

---

## TASK 2 — Cost Display 4 Decimal Places (Blueprint Task 11)

### Modify StatusBar.tsx

File: `D:\Projects\GregLite\app\components\ui\StatusBar.tsx`

Find: `costToday.toFixed(2)`
Replace with: `costToday.toFixed(4)`

That's it for StatusBar. The per-message cost annotation is already handled in
Task 1 above (the `costUsd?.toFixed(4)` in Message.tsx metadata line).

---

## TASK 3 — GregLite Branding Consistency (Blueprint Task 12)

Search and replace across UI-facing strings only.

Run this grep to find all instances:
```
grep -rn "Gregore Lite\|GREGORE" app/components/ app/app/
```

Expected changes:
- `app/components/ui/Header.tsx` — any "Gregore Lite" text → "GregLite"
- `app/app/layout.tsx` — metadata title → "GregLite"
- `app/components/chat/MessageList.tsx` — empty state "GREGORE" → "GregLite"
- Any other component with the old name

Do NOT change: comments, PROJECT_DNA.yaml, README, git history, or non-UI strings.

---

## TASK 4 — Anti-Bootstrap System Prompt (Blueprint Task 13)

File: `D:\Projects\GregLite\app\lib\bootstrap\index.ts` (or wherever `getBootstrapSystemPrompt()` is defined — may also be `app/lib/chat/system-prompt.ts`)

Read the file first. Find where the system prompt string is assembled.

Add this preamble at the START of the system prompt (before any existing content):

```
You are GregLite, a personal cognitive operating system. You are direct, concise, and technically precise.

IMPORTANT: Respond conversationally to casual messages like greetings, short questions, or chitchat. Do NOT auto-execute bootstrap sequences, file reads, environment detection, or load any instruction files unless the user explicitly requests work on a specific project, codebase, or task. If the user says "hey", "you there", "what's up", or similar, just respond naturally as a conversational partner.

When the user DOES request specific work, then engage your full capabilities.
```

---

## FINAL GATES

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — 890+ tests passing
3. Messages render flat, left-aligned, no bubbles, centered column
4. Three density presets work via Cmd+Shift+= / Cmd+Shift+-
5. Density persists across page reloads
6. StatusBar cost shows 4 decimal places
7. All UI text says "GregLite" (no "Gregore Lite" or "GREGORE")
8. Sending "hey" gets conversational response, not bootstrap

## COMMITS

```
feat(ux): flat borderless messages with 3-tier density toggle
feat(ux): cost display 4 decimal places + per-message metadata
fix(brand): GregLite branding consistency across all UI strings
fix(prompt): anti-bootstrap system prompt for casual conversations
```
