# SPRINT 2D — Artifact Rendering
## GregLite Phase 2 | Parallel Workstream D
**Status:** READY TO QUEUE (after Phase 1 complete)  
**Depends on:** Phase 1 complete (Sprint 1E gates passed)  
**Parallel with:** 2A, 2B, 2C, 2E  
**Estimated sessions:** 3–4

---

## OBJECTIVE

When Claude returns code, markdown documents, or other structured content, render it properly — not as raw text. Monaco editor for code files, Sandpack for runnable React/JS, markdown renderer for documents. This makes GregLite feel like a real development environment, not a chat window.

**Success criteria:**
- Code blocks in Claude responses rendered with syntax highlighting (Monaco)
- Markdown headers, lists, tables rendered properly
- "Open in editor" expands code to full Monaco pane
- Sandpack renders runnable React/HTML/JS snippets in sandbox
- Artifact panel appears right of strategic thread when artifact is active
- Artifacts saved to KERNL artifacts table
- Copy button on every code block

---

## NEW FILES TO CREATE

```
app/components/artifacts/
  ArtifactPanel.tsx       — right-side panel for expanded artifact view
  CodeArtifact.tsx        — Monaco editor display
  MarkdownArtifact.tsx    — rendered markdown
  SandpackArtifact.tsx    — Sandpack sandbox
  ArtifactToolbar.tsx     — copy, open in editor, save actions
  index.ts                — exports

app/lib/artifacts/
  detector.ts             — detects artifact type in Claude response
  store.ts                — Zustand store for active artifact
  kernl-sync.ts           — writes artifacts to KERNL artifacts table
  types.ts                — Artifact, ArtifactType interfaces
```

---

## ARTIFACT TYPES

```typescript
type ArtifactType = 
  | 'code'          // any language, Monaco renderer
  | 'markdown'      // documents, reports
  | 'react'         // runnable React component, Sandpack
  | 'html'          // runnable HTML, Sandpack
  | 'mermaid'       // diagrams (Phase 3 — stub for now)
  | 'unknown';      // fallback, render as plain text
```

---

## DETECTION LOGIC

Parse Claude response for markdown code fences. Extract language tag. Determine artifact type:

```typescript
function detectArtifact(content: string): Artifact | null {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const match = codeBlockRegex.exec(content);
  if (!match) return null;

  const lang = match[1]?.toLowerCase() ?? 'text';
  const code = match[2];

  let type: ArtifactType = 'code';
  if (lang === 'markdown' || lang === 'md') type = 'markdown';
  if (lang === 'jsx' || lang === 'tsx') type = 'react';
  if (lang === 'html') type = 'html';

  return { type, language: lang, content: code, id: nanoid() };
}
```

For responses with multiple code blocks, show the largest/most significant one in the artifact panel. Others rendered inline in the message.

---

## MONACO SETUP

Install: `npm install @monaco-editor/react`

```typescript
import Editor from '@monaco-editor/react';

// In CodeArtifact.tsx:
<Editor
  height="400px"
  language={artifact.language}
  value={artifact.content}
  theme="vs-dark"
  options={{
    readOnly: true,           // Phase 1: read only. Phase 3: editable
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    fontFamily: 'JetBrains Mono, Fira Code, monospace',
  }}
/>
```

---

## SANDPACK SETUP

Install: `npm install @codesandbox/sandpack-react`

Use for `react` and `html` artifact types only. Set up with minimal template, no external dependencies unless Claude explicitly specified them.

```typescript
import { Sandpack } from '@codesandbox/sandpack-react';

// In SandpackArtifact.tsx:
<Sandpack
  template={artifact.type === 'react' ? 'react' : 'vanilla'}
  files={{ '/App.js': artifact.content }}
  theme="dark"
  options={{ showConsole: true, editorHeight: 300 }}
/>
```

---

## LAYOUT CHANGE

When an artifact is active, the layout shifts from two panels to three:

```
┌──────────────┬──────────────────────┬──────────────────┐
│ CONTEXT (15%)│ STRATEGIC THREAD(45%)│ ARTIFACT PANEL   │
│              │                      │ (40%)            │
│              │                      │ [Monaco/Sandpack] │
└──────────────┴──────────────────────┴──────────────────┘
```

Artifact panel has an X to close (returns to 2-panel layout). Transition is animated.

---

## KERNL SYNC

Every artifact saved → write to KERNL artifacts table:

```typescript
await kernl.db.run(
  `INSERT INTO artifacts (id, thread_id, path, type, content_hash, created_at, project_id)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [artifact.id, threadId, null, artifact.type, hash(artifact.content), Date.now(), projectId]
);
```

---

## INLINE RENDERING IN MESSAGES

Even without the expanded panel, every code block in a message should have:
- Syntax highlighting (use `highlight.js` or Shiki — lightweight)
- Language label (top right)
- Copy button (top right)
- "Open in editor" button → opens artifact panel

Install: `npm install shiki` — better performance than highlight.js for VS Code-style themes.

---

## GATES

- [ ] Code blocks in messages have syntax highlighting
- [ ] Copy button works on every code block
- [ ] "Open in editor" expands Monaco panel
- [ ] React snippet in Sandpack is runnable
- [ ] Artifact panel appears/disappears with animation
- [ ] Artifacts written to KERNL
- [ ] pnpm type-check clean
- [ ] Commit: `sprint-2d: artifact rendering, Monaco, Sandpack`
