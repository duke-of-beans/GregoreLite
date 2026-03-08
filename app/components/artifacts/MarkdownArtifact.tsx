'use client';
/**
 * MarkdownArtifact — Sprint 2D
 *
 * Renders markdown content in the ArtifactPanel using react-markdown + remark-gfm.
 * GFM adds: tables, strikethrough, task lists, autolink literals.
 */


import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Artifact } from '@/lib/artifacts/types';

interface MarkdownArtifactProps {
  artifact: Artifact;
}

export function MarkdownArtifact({ artifact }: MarkdownArtifactProps) {
  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      <div
        className={[
          'prose prose-invert prose-sm max-w-none',
          // Tables
          'prose-table:border-collapse prose-td:border prose-td:border-[var(--shadow)] prose-th:border prose-th:border-[var(--shadow)]',
          'prose-td:px-3 prose-td:py-2 prose-th:px-3 prose-th:py-2',
          // Code inside markdown
          'prose-code:text-[var(--cyan)] prose-code:bg-[var(--elevated)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs',
          // Pre blocks
          'prose-pre:bg-[var(--deep-space)] prose-pre:border prose-pre:border-[var(--shadow)]',
        ].join(' ')}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {artifact.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
