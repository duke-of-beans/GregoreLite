/**
 * ArtifactToolbar — Sprint 2D
 *
 * Top bar inside the ArtifactPanel and on inline code blocks.
 * Provides: language label | copy button | close / open-in-editor button.
 */

'use client';

import { useState } from 'react';
import { Copy, Check, X, ExternalLink } from 'lucide-react';
import { useArtifactStore } from '@/lib/artifacts/store';
import type { Artifact } from '@/lib/artifacts/types';

// ─── Inline toolbar (on message code blocks) ─────────────────────────────────

interface InlineToolbarProps {
  artifact: Artifact;
  /** If true, renders without the "open in editor" button (already in panel) */
  inPanel?: boolean;
}

export function ArtifactToolbar({ artifact, inPanel = false }: InlineToolbarProps) {
  const [copied, setCopied] = useState(false);
  const { setArtifact } = useArtifactStore();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable — silently ignore
    }
  };

  const handleOpenInEditor = () => {
    setArtifact(artifact);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Language label */}
      <span className="text-xs text-[var(--ghost-text)] font-mono mr-2">
        {artifact.language}
      </span>

      {/* Copy */}
      <button
        onClick={handleCopy}
        title="Copy code"
        className="flex items-center justify-center rounded p-1 text-[var(--ghost-text)] transition-colors hover:text-[var(--ice-white)] hover:bg-[var(--elevated)]"
      >
        {copied ? <Check size={13} className="text-[var(--cyan)]" /> : <Copy size={13} />}
      </button>

      {/* Open in editor (not shown when already in the panel) */}
      {!inPanel && (
        <button
          onClick={handleOpenInEditor}
          title="Open in editor"
          className="flex items-center justify-center rounded p-1 text-[var(--ghost-text)] transition-colors hover:text-[var(--ice-white)] hover:bg-[var(--elevated)]"
        >
          <ExternalLink size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Panel close button ───────────────────────────────────────────────────────

interface PanelCloseButtonProps {
  onClose: () => void;
}

export function PanelCloseButton({ onClose }: PanelCloseButtonProps) {
  return (
    <button
      onClick={onClose}
      title="Close artifact panel"
      className="flex items-center justify-center rounded p-1 text-[var(--ghost-text)] transition-colors hover:text-[var(--ice-white)] hover:bg-[var(--elevated)]"
    >
      <X size={15} />
    </button>
  );
}
