/**
 * Sidecar build script — Sprint 36.0
 *
 * Uses esbuild to bundle the Express server + all Next.js route handlers
 * into a single dist/server.js, ready for pkg to package as server.exe.
 *
 * Path alias resolution:
 *   @/lib/...  →  ../../app/lib/...    (Next.js app lib)
 *   next/server →  src/shims/next-server.ts  (minimal NextResponse shim)
 *   @xenova/transformers → src/shims/xenova-transformers.ts  (no-op shim)
 *   puppeteer-core → src/shims/puppeteer-core.ts  (no-op shim)
 *
 * Native modules (better-sqlite3, keytar, sqlite-vec) are marked external
 * so pkg can bundle their .node binaries via the "assets" config.
 */

import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';

const sidecarRoot = __dirname;
const appRoot = path.resolve(sidecarRoot, '..', 'app');

async function main(): Promise<void> {
  // Ensure dist/ exists
  if (!fs.existsSync(path.join(sidecarRoot, 'dist'))) {
    fs.mkdirSync(path.join(sidecarRoot, 'dist'), { recursive: true });
  }

  await esbuild.build({
    entryPoints: [path.join(sidecarRoot, 'src', 'server.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: path.join(sidecarRoot, 'dist', 'server.js'),
    format: 'cjs',
    // Native modules — pkg bundles their .node files via assets config
    external: [
      'better-sqlite3',
      'keytar',
      'sqlite-vec',
      // framer-motion is UI-only; if any API code accidentally imports it
      // we want a loud failure rather than bundling the whole animation library.
      'framer-motion',
    ],
    plugins: [
      {
        name: 'greglite-alias-resolver',
        setup(build) {
          // next/server → minimal shim (provides NextResponse for route handlers)
          build.onResolve({ filter: /^next\/server$/ }, () => ({
            path: path.join(sidecarRoot, 'src', 'shims', 'next-server.ts'),
          }));

          // @xenova/transformers → no-op shim (embeddings degrade gracefully)
          build.onResolve({ filter: /^@xenova\/transformers$/ }, () => ({
            path: path.join(sidecarRoot, 'src', 'shims', 'xenova-transformers.ts'),
          }));

          // puppeteer-core → no-op shim (web session mode requires desktop app)
          build.onResolve({ filter: /^puppeteer-core$/ }, () => ({
            path: path.join(sidecarRoot, 'src', 'shims', 'puppeteer-core.ts'),
          }));

          // react / react-dom → minimal shim (Zustand v5 imports useSyncExternalStore;
          // API routes never render components so a stub is safe)
          build.onResolve({ filter: /^react$/ }, () => ({
            path: path.join(sidecarRoot, 'src', 'shims', 'react.ts'),
          }));
          build.onResolve({ filter: /^react-dom(\/.*)?$/ }, () => ({
            path: path.join(sidecarRoot, 'src', 'shims', 'react.ts'),
          }));

          // @/* → GregLite/app/* (mirrors Next.js tsconfig path alias)
          // Must resolve to an actual file path with extension so esbuild
          // can read it. Probe order: exact, .ts, /index.ts, /index.js
          build.onResolve({ filter: /^@\// }, (args) => {
            const subpath = args.path.slice(2); // strip '@/'
            const base = path.resolve(appRoot, subpath);
            const candidates = [
              base,
              base + '.ts',
              base + '.tsx',
              base + '/index.ts',
              base + '/index.tsx',
              base + '/index.js',
            ];
            for (const candidate of candidates) {
              if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return { path: candidate };
              }
            }
            // Return the .ts guess anyway; esbuild will give a clear error
            return { path: base + '.ts' };
          });
        },
      },
    ],
    define: {
      // Tell any Next.js internals we're running in Node.js
      'process.env.NEXT_RUNTIME': '"nodejs"',
      'process.env.NODE_ENV': '"production"',
    },
    logLevel: 'info',
  });

  console.log('[build] ✅ dist/server.js written');
}

main().catch((err) => {
  console.error('[build] FAILED:', err);
  process.exit(1);
});
