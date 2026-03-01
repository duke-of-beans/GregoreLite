# GREGLITE — SPRINT 2D EXECUTION BRIEF
## Artifact Rendering (Monaco + Sandpack + Markdown)
**Instance:** Parallel Workstream D (run simultaneously with 2A, 2B, 2C)
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Phase 1 baseline:** TypeScript 0 errors, 24/24 tests, KERNL SQLite live at .kernl/greglite.db

---

## YOUR ROLE

Bounded execution worker. You are building the artifact rendering system — code gets Monaco, runnable React/HTML gets Sandpack, markdown gets a proper renderer. This is what makes GregLite feel like a development environment and not a chat window. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order before writing any code:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\PROJECT_DNA.yaml`
5. `D:\Projects\GregLite\STATUS.md`
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md`
7. `D:\Projects\GregLite\SPRINT_2D_Artifacts.md` — your complete spec

Then verify baseline:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Same fix applied 3+ times
- Monaco or Sandpack SSR issues that can't be resolved in 2 attempts (Next.js SSR + Monaco is a known landmine — use dynamic imports with `ssr: false`)
- Operation estimated >8 minutes without a checkpoint
- TypeScript errors increase beyond baseline

Write a BLOCKED report with: what you were doing, what triggered the stop, what decision is needed.

---

## QUALITY GATES (ALL REQUIRED BEFORE COMMIT)

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. No mocks, stubs, or TODOs in production code
4. Every new module has at least one vitest test
5. STATUS.md updated
6. Conventional commit format

---

## WHAT YOU ARE BUILDING

### Install dependencies first

```powershell
cd D:\Projects\GregLite\app
pnpm add @monaco-editor/react @codesandbox/sandpack-react shiki react-markdown remark-gfm
```

Verify these don't break the build before writing any component code:
```powershell
npx tsc --noEmit
```

### New files

```
app/components/artifacts/
  ArtifactPanel.tsx       — right-side panel, 40% width, animated open/close
  CodeArtifact.tsx        — Monaco editor, read-only for Phase 2
  MarkdownArtifact.tsx    — react-markdown with remark-gfm
  SandpackArtifact.tsx    — Sandpack for react/html artifact types
  ArtifactToolbar.tsx     — copy button, "open in editor" button, close X
  index.ts                — exports

app/lib/artifacts/
  detector.ts             — parses Claude response, extracts largest code block
  store.ts                — Zustand store: activeArtifact, setArtifact, clearArtifact
  kernl-sync.ts           — writes artifact record to KERNL artifacts table
  types.ts                — Artifact, ArtifactType interfaces
```

### Artifact types

```typescript
export type ArtifactType = 'code' | 'markdown' | 'react' | 'html' | 'mermaid' | 'unknown';

export interface Artifact {
  id: string;
  type: ArtifactType;
  language: string;
  content: string;
  threadId?: string;
}
```

### Detection logic

Called on every assistant response in `ChatInterface` — after setting message state, before rendering:

```typescript
export function detectArtifact(content: string): Artifact | null {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let largest: Artifact | null = null;

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = match[1]?.toLowerCase() ?? 'text';
    const code = match[2];

    if (!largest || code.length > largest.content.length) {
      let type: ArtifactType = 'code';
      if (lang === 'markdown' || lang === 'md') type = 'markdown';
      if (lang === 'jsx' || lang === 'tsx') type = 'react';
      if (lang === 'html') type = 'html';
      if (lang === 'mermaid') type = 'mermaid';

      largest = { id: nanoid(), type, language: lang, content: code };
    }
  }

  return largest;
}
```

### Monaco — critical: SSR

Monaco cannot run server-side. Use Next.js dynamic import:

```typescript
// In CodeArtifact.tsx
import dynamic from 'next/dynamic';
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
```

Same pattern for Sandpack:
```typescript
const Sandpack = dynamic(
  () => import('@codesandbox/sandpack-react').then(m => m.Sandpack),
  { ssr: false }
);
```

### Monaco config

```typescript
<Editor
  height="100%"
  language={artifact.language}
  value={artifact.content}
  theme="vs-dark"
  options={{
    readOnly: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    wordWrap: 'on',
    lineNumbers: 'on',
    renderLineHighlight: 'none',
  }}
/>
```

### Sandpack config

```typescript
<Sandpack
  template={artifact.type === 'react' ? 'react' : 'vanilla'}
  files={{ [artifact.type === 'react' ? '/App.js' : '/index.js']: artifact.content }}
  theme="dark"
  options={{
    showConsole: true,
    editorHeight: 300,
    showNavigator: false,
  }}
/>
```

### Layout — 3-panel when artifact active

Currently the app has a 2-panel layout (context + strategic thread). When an artifact is active, shift to 3-panel:

```
┌──────────────┬──────────────────────┬──────────────────┐
│ CONTEXT (15%)│ STRATEGIC THREAD(45%)│ ARTIFACT (40%)   │
└──────────────┴──────────────────────┴──────────────────┘
```

Read the existing layout in `app/app/page.tsx` and `app/components/layout/` before modifying. The layout shift should be CSS-driven (flex widths), animated with a CSS transition, and triggered by Zustand artifact store state.

### Inline rendering in messages

Every code block in a message (not just the artifact panel) should have:
- Shiki syntax highlighting (use `createHighlighter` with `theme: 'github-dark'`)
- Language label top-right
- Copy button top-right (copies raw code, not highlighted HTML)
- "Open in editor" button → dispatches to Zustand store → opens artifact panel

The `Message.tsx` component (already exists from Phase 1) needs to be updated to replace raw `<pre><code>` blocks with this highlighted version. Read how messages are currently rendered before touching this file.

### KERNL sync

After detecting an artifact and setting it in Zustand store, write to KERNL:

```typescript
// In kernl-sync.ts
export async function syncArtifact(artifact: Artifact, threadId: string): Promise<void> {
  await fetch('/api/kernl/artifact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: artifact.id,
      threadId,
      type: artifact.type,
      contentHash: await hashContent(artifact.content),
    }),
  });
}
```

If the KERNL `artifacts` table doesn't exist yet (may have been deferred in Phase 1), add it:
```sql
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  path TEXT,
  type TEXT NOT NULL,
  content_hash TEXT,
  created_at INTEGER NOT NULL,
  project_id TEXT,
  FOREIGN KEY(thread_id) REFERENCES threads(id)
);
```

---

## CHECKPOINTING

Every 3 file writes:
1. `npx tsc --noEmit` — Monaco/Sandpack type issues surface fast, catch them early
2. `git add && git commit -m "sprint-2d(wip): [what you just did]"`

---

## SESSION END

When all gates pass:

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Update `D:\Projects\GregLite\STATUS.md` — mark Sprint 2D complete
4. Final commit: `git commit -m "sprint-2d: artifact rendering, Monaco, Sandpack"`
5. `git push`
6. Write `SPRINT_2D_COMPLETE.md` to `D:\Projects\GregLite\` with: what was built, SSR issues encountered, decisions made, anything deferred

---

## GATES CHECKLIST

- [ ] Code blocks in messages have Shiki syntax highlighting
- [ ] Language label visible on every code block
- [ ] Copy button copies raw code (not highlighted HTML)
- [ ] "Open in editor" button opens artifact panel
- [ ] Monaco renders in artifact panel for code artifacts
- [ ] Sandpack renders and runs for react/html artifacts
- [ ] Markdown artifacts render headings, lists, tables via react-markdown
- [ ] Artifact panel opens/closes with CSS transition animation
- [ ] 3-panel layout active when artifact is open, 2-panel when closed
- [ ] Artifacts written to KERNL artifacts table
- [ ] No SSR errors in console
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed

---

## ENVIRONMENT

- Project root: `D:\Projects\GregLite\`
- App dir: `D:\Projects\GregLite\app\`
- Package manager: pnpm
- KERNL DB: `D:\Projects\GregLite\app\.kernl\greglite.db`
- API key: already in `app\.env.local`
- Do NOT modify anything in `D:\Projects\Gregore\`
- Do NOT commit `.env.local`
- Known landmine: Monaco + Next.js SSR — always use `dynamic(..., { ssr: false })`
