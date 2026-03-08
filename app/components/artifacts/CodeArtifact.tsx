'use client';
/**
 * CodeArtifact — Sprint 2D
 *
 * Monaco editor in read-only mode for the ArtifactPanel.
 * Uses Next.js dynamic import with ssr: false — Monaco cannot run server-side.
 *
 * Phase 2: read-only. Phase 3: editable with write-back.
 */


import dynamic from 'next/dynamic';
import type { Artifact } from '@/lib/artifacts/types';

// Critical: ssr: false prevents "document is not defined" during SSR
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[var(--ghost-text)] text-sm font-mono">
        Loading editor…
      </div>
    ),
  },
);

interface CodeArtifactProps {
  artifact: Artifact;
}

export function CodeArtifact({ artifact }: CodeArtifactProps) {
  return (
    <div className="h-full w-full">
      <MonacoEditor
        height="100%"
        language={artifact.language === 'text' ? 'plaintext' : artifact.language}
        value={artifact.content}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
          wordWrap: 'on',
          lineNumbers: 'on',
          renderLineHighlight: 'none',
          folding: true,
          automaticLayout: true,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
          },
        }}
      />
    </div>
  );
}
