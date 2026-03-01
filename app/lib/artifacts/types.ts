/**
 * Artifact Types — Sprint 2D
 *
 * Artifact = a meaningful code block or document extracted from a Claude response.
 * Rendered in the right-side ArtifactPanel when the user clicks "Open in editor".
 */

export type ArtifactType =
  | 'code'      // any language → Monaco (read-only, Phase 2)
  | 'markdown'  // documents, reports → react-markdown
  | 'react'     // JSX/TSX → Sandpack sandbox
  | 'html'      // HTML → Sandpack sandbox
  | 'mermaid'   // diagrams → Phase 3 stub
  | 'unknown';  // fallback: plain text

export interface Artifact {
  /** nanoid, generated at detection time */
  id: string;
  type: ArtifactType;
  /** Raw language tag from the code fence (e.g. "typescript", "jsx", "python") */
  language: string;
  /** Raw content of the code block */
  content: string;
  /** Thread ID this artifact was produced in — set after wiring into ChatInterface */
  threadId?: string;
}
