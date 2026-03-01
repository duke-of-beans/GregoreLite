/**
 * SimilarityDiff — Monaco diff view (Sprint 3F)
 *
 * Shows existing matched content (left) vs proposed manifest description
 * (right) in a read-only side-by-side diff. Loaded via dynamic import to
 * prevent Next.js SSR crash on @monaco-editor/react.
 *
 * BLUEPRINT §5.4 — Monaco diff SSR pattern
 */

'use client';

import dynamic from 'next/dynamic';

const DiffEditor = dynamic(
  () => import('@monaco-editor/react').then((m) => m.DiffEditor),
  { ssr: false, loading: () => <div style={loadingStyle}>Loading diff…</div> }
);

interface SimilarityDiffProps {
  existingContent: string;
  proposedDescription: string;
}

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '300px',
  color: 'var(--mist)',
  fontSize: '12px',
};

export function SimilarityDiff({
  existingContent,
  proposedDescription,
}: SimilarityDiffProps) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          fontSize: '10px',
          color: 'var(--mist)',
          letterSpacing: '0.06em',
        }}
      >
        <span>EXISTING IMPLEMENTATION</span>
        <span>PROPOSED TASK</span>
      </div>
      <DiffEditor
        original={existingContent}
        modified={proposedDescription}
        language="typescript"
        theme="vs-dark"
        height="300px"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          renderSideBySide: true,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}
