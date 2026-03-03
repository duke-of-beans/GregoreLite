/**
 * ArtifactPanel — Sprint 2D
 *
 * Right-side panel that renders the active artifact.
 * Routes to the correct sub-renderer based on artifact.type.
 * Appears/disappears via CSS transition driven by Zustand store state.
 *
 * Layout: 40% width of the viewport when open (set by parent).
 */

'use client';

import type { Artifact } from '@/lib/artifacts/types';
import { CodeArtifact } from './CodeArtifact';
import { MarkdownArtifact } from './MarkdownArtifact';
import { SandpackArtifact } from './SandpackArtifact';
import { ArtifactToolbar, PanelCloseButton } from './ArtifactToolbar';

interface ArtifactPanelProps {
  artifact: Artifact;
  onClose: () => void;
}

export function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  return (
    <div className="flex h-full flex-col bg-[var(--deep-space)] border-l border-[var(--shadow)]">
      {/* ── Panel header ─────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[var(--shadow)] px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Type badge */}
          <span className="rounded-sm bg-[var(--elevated)] px-2 py-0.5 text-xs font-mono text-[var(--cyan)] uppercase tracking-wide">
            {artifact.type === 'unknown' ? 'text' : artifact.type}
          </span>

          {/* Toolbar: copy + language */}
          <ArtifactToolbar artifact={artifact} inPanel />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              document.dispatchEvent(new CustomEvent('greglite:open-artifact-library'));
            }}
            className="text-xs text-[var(--mist)] hover:text-[var(--frost)] transition-colors"
            title="Browse Artifact Library (Cmd+L)"
          >
            Browse Library
          </button>
          <PanelCloseButton onClose={onClose} />
        </div>
      </div>

      {/* ── Artifact content ─────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <ArtifactContent artifact={artifact} />
      </div>
    </div>
  );
}

// ─── Route to the right renderer ─────────────────────────────────────────────

function ArtifactContent({ artifact }: { artifact: Artifact }) {
  switch (artifact.type) {
    case 'markdown':
      return <MarkdownArtifact artifact={artifact} />;

    case 'react':
    case 'html':
      return <SandpackArtifact artifact={artifact} />;

    case 'mermaid':
      // Phase 3 — stub for now
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--ghost-text)]">
          <span className="text-4xl">◇</span>
          <p className="text-sm">Mermaid diagram rendering arrives in Phase 3.</p>
          <pre className="mt-2 max-w-xs overflow-auto rounded bg-[var(--elevated)] p-3 text-xs text-[var(--ice-white)]">
            {artifact.content}
          </pre>
        </div>
      );

    case 'code':
    case 'unknown':
    default:
      return <CodeArtifact artifact={artifact} />;
  }
}
