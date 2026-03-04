import type { NextConfig } from 'next';

// Static export is ONLY for Tauri production builds.
// Set TAURI_BUILD=1 in your Tauri build script to enable.
// In dev mode (pnpm dev), output must NOT be 'export' or all API routes break.
const isTauriBuild = process.env.TAURI_BUILD === '1';

const nextConfig: NextConfig = {
  ...(isTauriBuild ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['better-sqlite3', 'keytar', 'sqlite-vec'],
};

export default nextConfig;
