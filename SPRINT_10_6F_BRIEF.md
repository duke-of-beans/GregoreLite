# SPRINT 10.6F — EXECUTION BRIEF: Auto-Scroll + Stop Button
# Wave 4 continued: Scroll management and stream interruption
# Prerequisites: Brief B complete (SSE streaming), Brief C complete (density store exists)
# Gate: Smart auto-scroll, floating button, stop interrupts stream with partial content preserved

---

## CONTEXT

Project root: `D:\Projects\GregLite`, App: `D:\Projects\GregLite\app`
Blueprint: `D:\Projects\GregLite\SPRINT_10_6_BLUEPRINT.md` (Tasks 5 and 9)

---

## TASK 1 — Auto-Scroll + Floating Scroll-to-Bottom (Blueprint Task 5)

### Read first:
- `D:\Projects\GregLite\app\components\chat\MessageList.tsx`

### Create ScrollToBottom component

Create: `D:\Projects\GregLite\app\components\chat\ScrollToBottom.tsx`

```typescript
/**
 * ScrollToBottom — Sprint 10.6
 *
 * Floating button that appears when user scrolls up from bottom.
 * Pulses when new content arrives while scrolled up.
 * Click smoothly scrolls to bottom.
 */

'use client';

interface ScrollToBottomProps {
  visible: boolean;
  hasNewContent: boolean;
  onClick: () => void;
}

export function ScrollToBottom({ visible, hasNewContent, onClick }: ScrollToBottomProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className={[
        'absolute bottom-4 left-1/2 -translate-x-1/2 z-10',
        'flex items-center justify-center',
        'h-8 w-8 rounded-full',
        'bg-[var(--elevated)] border border-[var(--shadow)]',
        'text-[var(--frost)] hover:text-[var(--ice-white)]',
        'shadow-lg transition-all duration-200',
        hasNewContent ? 'animate-bounce' : '',
      ].join(' ')}
      title="Scroll to bottom"
      aria-label="Scroll to bottom"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* New content dot indicator */}
      {hasNewContent && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--cyan)]" />
      )}
    </button>
  );
}
```

### Modify MessageList.tsx — Smart scroll management

Replace the simple auto-scroll `useEffect` with IntersectionObserver pattern:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollToBottom } from './ScrollToBottom';
import { useDensityStore } from '@/lib/stores/density-store';

// Inside component, add:
const sentinelRef = useRef<HTMLDivElement>(null);
const [isAtBottom, setIsAtBottom] = useState(true);
const [hasNewContent, setHasNewContent] = useState(false);
const autoScroll = useDensityStore((s) => s.autoScroll);

// IntersectionObserver to detect if user is at bottom
useEffect(() => {
  const sentinel = sentinelRef.current;
  const container = scrollRef.current;
  if (!sentinel || !container) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      const atBottom = entry?.isIntersecting ?? false;
      setIsAtBottom(atBottom);
      if (atBottom) setHasNewContent(false);
    },
    {
      root: container,
      threshold: 0.1,
    }
  );

  observer.observe(sentinel);
  return () => observer.disconnect();
}, []);

// Auto-scroll on new messages (only when at bottom and autoScroll enabled)
useEffect(() => {
  if (isAtBottom && autoScroll && scrollRef.current) {
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  } else if (!isAtBottom && messages.length > 0) {
    // New content arrived while scrolled up
    setHasNewContent(true);
  }
}, [messages, isAtBottom, autoScroll]);

const scrollToBottom = useCallback(() => {
  if (scrollRef.current) {
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }
}, []);
```

In the JSX, make the scroll container `position: relative` and add the sentinel + button:

```typescript
<div
  ref={scrollRef}
  className="relative flex-1 overflow-y-auto px-6 py-4"
  role="log"
  aria-label="Message history"
  aria-live="polite"
>
  {/* Message content... */}
  <div className="mx-auto w-full max-w-3xl">
    {/* ... existing message rendering ... */}
  </div>

  {/* Bottom sentinel for IntersectionObserver */}
  <div ref={sentinelRef} className="h-1 w-full" aria-hidden />

  {/* Floating scroll-to-bottom button */}
  <ScrollToBottom
    visible={!isAtBottom}
    hasNewContent={hasNewContent}
    onClick={scrollToBottom}
  />
</div>
```

Remove the old simple auto-scroll useEffect that just sets `scrollTop = scrollHeight`.

---

## TASK 2 — Stop/Interrupt Button (Blueprint Task 9)

### Read first:
- `D:\Projects\GregLite\app\components\chat\ChatInterface.tsx`
- `D:\Projects\GregLite\app\components\chat\SendButton.tsx`

### Add AbortController to ChatInterface.tsx

Add a ref for the abort controller:

```typescript
const abortControllerRef = useRef<AbortController | null>(null);
const [isStreaming, setIsStreaming] = useState(false);
```

In `handleSubmit`, create an AbortController and pass its signal to fetch:

```typescript
// At the start of handleSubmit, after input validation:
const controller = new AbortController();
abortControllerRef.current = controller;
setIsStreaming(true);

// In the fetch call:
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
  signal: controller.signal,
});
```

After the streaming loop (or in the catch for AbortError):

```typescript
// After the while(true) reader loop:
setIsStreaming(false);
abortControllerRef.current = null;

// In the catch block, handle abort:
} catch (error) {
  setIsStreaming(false);
  abortControllerRef.current = null;

  if (error instanceof DOMException && error.name === 'AbortError') {
    // User stopped generation — keep partial content
    if (fullContent) {
      finalizeStreamingMessage(tabId, fullContent, {});
    }

    // Capture interruption event for Transit Map
    try {
      const { captureEvent } = await import('@/lib/events/capture');
      if (streamConversationId) {
        captureEvent({
          conversation_id: streamConversationId,
          event_type: 'quality.interruption',
          category: 'quality',
          payload: {
            partial_content_length: fullContent?.length ?? 0,
            time_to_interrupt_ms: Date.now() - streamStartTime,
          },
        });
      }
    } catch { /* non-blocking */ }

    setSendButtonState('normal');
    return;
  }

  // Non-abort error
  const errorMessage: MessageProps = { ... };
  appendMessage(tabId, errorMessage);
  setSendButtonState('normal');
}
```

Add `streamStartTime` tracking:
```typescript
const streamStartTime = Date.now(); // Right before the fetch call
```

### Create stop handler

```typescript
const handleStop = useCallback(() => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
}, []);
```

### Modify SendButton to show stop state

Read: `D:\Projects\GregLite\app\components\chat\SendButton.tsx`

The SendButton currently has states: `normal`, `checking`, `approved`, `warning`, `veto`.

Add `streaming` to the `SendButtonState` type:
```typescript
export type SendButtonState = 'normal' | 'checking' | 'approved' | 'warning' | 'veto' | 'streaming';
```

Add a prop for the stop handler:
```typescript
interface SendButtonProps {
  state: SendButtonState;
  onClick: () => void;
  onStop?: () => void;
  disabled?: boolean;
}
```

In the render, when `state === 'streaming'`, show a red stop button:
```typescript
if (state === 'streaming') {
  return (
    <button
      onClick={onStop}
      className="flex items-center justify-center h-9 w-9 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition-colors"
      title="Stop generating"
      aria-label="Stop generating"
      data-send-button
    >
      {/* Stop icon — solid square */}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
        <rect x="2" y="2" width="8" height="8" rx="1" />
      </svg>
    </button>
  );
}
```

### Wire in ChatInterface

During streaming, set button state to `'streaming'`:
```typescript
// After appendMessage for the streaming placeholder:
setSendButtonState('streaming');

// After stream completes or is aborted:
setSendButtonState('approved'); // or 'normal'
```

Pass `handleStop` to SendButton:
```typescript
<SendButton
  state={sendButtonState}
  onClick={handleSubmit}
  onStop={handleStop}
  disabled={!input.trim() || restoring}
/>
```

---

## FINAL GATES

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — 890+ tests passing
3. Auto-scroll follows new messages when at bottom
4. Scrolling up pauses auto-scroll
5. Floating button appears with bounce when scrolled up and new content arrives
6. Click button scrolls smoothly to bottom
7. Stop button (red square) appears during streaming
8. Click stop aborts stream, preserves partial content in message
9. Send button returns to normal after stop
10. Transit Map captures `quality.interruption` event on stop

## COMMITS

```
feat(ux): smart auto-scroll with floating scroll-to-bottom button
feat(chat): stop/interrupt button with partial content preservation
```
