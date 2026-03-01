/**
 * SandpackArtifact — Sprint 2D
 *
 * Runs React and HTML artifacts in a live Sandpack sandbox.
 * Uses Next.js dynamic import with ssr: false — Sandpack requires the browser.
 */

'use client';

import dynamic from 'next/dynamic';
import type { Artifact } from '@/lib/artifacts/types';

// ssr: false is mandatory — Sandpack uses browser APIs
const Sandpack = dynamic(
  () => import('@codesandbox/sandpack-react').then((m) => m.Sandpack),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[var(--ghost-text)] text-sm">
        Loading sandbox…
      </div>
    ),
  },
);

interface SandpackArtifactProps {
  artifact: Artifact;
}

export function SandpackArtifact({ artifact }: SandpackArtifactProps) {
  const isReact = artifact.type === 'react';

  const files = isReact
    ? { '/App.js': artifact.content }
    : { '/index.html': artifact.content };

  return (
    <div className="h-full w-full overflow-hidden">
      <Sandpack
        template={isReact ? 'react' : 'vanilla'}
        files={files}
        theme="dark"
        options={{
          showConsole: true,
          editorHeight: 300,
          showNavigator: false,
          showTabs: false,
          showLineNumbers: true,
        }}
      />
    </div>
  );
}
