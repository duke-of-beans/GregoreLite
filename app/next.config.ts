import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Only set static export in production — omitting this in dev allows API routes to work
  ...(isProd ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['better-sqlite3', 'keytar', 'sqlite-vec'],
};

export default nextConfig;
