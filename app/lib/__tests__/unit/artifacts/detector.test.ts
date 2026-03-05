/**
 * Artifact Detector — Unit Tests
 * Sprint 2D
 */

import { describe, it, expect } from 'vitest';
import { detectArtifact } from '@/lib/artifacts/detector';

describe('detectArtifact', () => {
  it('returns null for a message with no code blocks', () => {
    expect(detectArtifact('This is a plain text response with no code.')).toBeNull();
  });

  it('returns null for a code block below the minimum length threshold', () => {
    const short = '```ts\nconst x = 1;\n```';
    expect(detectArtifact(short)).toBeNull();
  });

  it('detects a TypeScript code block and resolves type to code', () => {
    const content = `
Here is the implementation:

\`\`\`typescript
export function greet(name: string): string {
  if (!name) throw new Error('Name is required');
  return \`Hello, \${name}! Welcome to GregLite.\`;
}
\`\`\`
    `;
    const artifact = detectArtifact(content);
    expect(artifact).not.toBeNull();
    expect(artifact!.type).toBe('code');
    expect(artifact!.language).toBe('typescript');
    expect(artifact!.content).toContain('greet');
  });

  it('resolves jsx language tag to react type', () => {
    const content = `
\`\`\`jsx
function MyComponent() {
  return <div className="container"><h1>Hello from GregLite artifact panel</h1></div>;
}
export default MyComponent;
\`\`\`
    `;
    const artifact = detectArtifact(content);
    expect(artifact).not.toBeNull();
    expect(artifact!.type).toBe('react');
    expect(artifact!.language).toBe('jsx');
  });

  it('resolves tsx language tag to react type', () => {
    const content = `
\`\`\`tsx
interface Props { title: string; }
function Card({ title }: Props) {
  return <div className="card"><h2>{title}</h2></div>;
}
export default Card;
\`\`\`
    `;
    const artifact = detectArtifact(content);
    expect(artifact!.type).toBe('react');
    expect(artifact!.language).toBe('tsx');
  });

  it('resolves html language tag to html type', () => {
    const content = `
\`\`\`html
<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8"><title>GregLite</title></head>
  <body><h1>Hello from the artifact panel</h1></body>
</html>
\`\`\`
    `;
    const artifact = detectArtifact(content);
    expect(artifact!.type).toBe('html');
  });

  it('resolves markdown language tag to markdown type', () => {
    const content = `
\`\`\`markdown
# GregLite Architecture

## Overview
This document describes the artifact rendering system built in Sprint 2D.

## Components
- ArtifactPanel
- CodeArtifact
- MarkdownArtifact
- SandpackArtifact
\`\`\`
    `;
    const artifact = detectArtifact(content);
    expect(artifact!.type).toBe('markdown');
  });

  it('resolves mermaid language tag to mermaid type', () => {
    const content = `
\`\`\`mermaid
graph TD
  A[ChatInterface] --> B[detectArtifact]
  B --> C[useArtifactStore]
  C --> D[ArtifactPanel]
  D --> E[CodeArtifact]
  D --> F[MarkdownArtifact]
  D --> G[SandpackArtifact]
\`\`\`
    `;
    const artifact = detectArtifact(content);
    expect(artifact!.type).toBe('mermaid');
  });

  it('picks the largest block when multiple code blocks are present', () => {
    const content = `
Short one first:

\`\`\`python
x = 1
y = 2
z = x + y
\`\`\`

Longer one second:

\`\`\`python
def fibonacci(n: int) -> list[int]:
    """Return the first n Fibonacci numbers."""
    if n <= 0:
        return []
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence[:n]

if __name__ == '__main__':
    print(fibonacci(10))
\`\`\`
    `;
    const artifact = detectArtifact(content);
    expect(artifact!.content).toContain('fibonacci');
  });

  it('generates a unique id for each detected artifact', () => {
    const content = `
\`\`\`typescript
export const GREGLITE_VERSION = '0.1.0';
export const SPRINT = '2D';
export const FEATURE = 'artifact-rendering';
export const DESCRIPTION = 'Artifact detection and rendering pipeline for GregLite cockpit UI';
export const AUTHOR = 'GregLite Team';
\`\`\`
    `;
    const a1 = detectArtifact(content);
    const a2 = detectArtifact(content);
    expect(a1!.id).toBeTruthy();
    expect(a2!.id).toBeTruthy();
    expect(a1!.id).not.toBe(a2!.id);
  });

  it('falls back to language "text" and type "unknown" for a bare fence', () => {
    // Build a block long enough to pass the MIN_ARTIFACT_LENGTH (120) threshold
    const code = 'A'.repeat(150);
    const content = `\`\`\`\n${code}\n\`\`\``;
    const artifact = detectArtifact(content);
    expect(artifact!.type).toBe('unknown');
    expect(artifact!.language).toBe('text');
  });
});
