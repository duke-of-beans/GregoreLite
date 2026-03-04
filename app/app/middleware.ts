/**
 * Next.js Middleware
 *
 * Initializes database before API requests
 * Ensures schema is ready before any operations
 *
 * @module middleware
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

let dbInitialized = false;

/**
 * Initialize database (singleton pattern)
 *
 * KERNL's getDatabase() auto-initialises on first call — no explicit
 * migration step required.  We keep the singleton flag so we only log once.
 */
function ensureDatabaseInitialized(): void {
  if (dbInitialized) return;

  // Calling getDatabase() triggers auto-init of the KERNL SQLite layer.
  getDatabase();
  dbInitialized = true;
  console.log('[Middleware] KERNL database initialised');
}

/**
 * Middleware function
 *
 * Runs before all API routes to ensure database is ready
 */
export async function middleware(request: NextRequest) {
  // Only initialize for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    try {
      ensureDatabaseInitialized();
    } catch (error) {
      console.error('[Middleware] Failed to initialize database:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Database initialization failed',
          details:
            process.env.NODE_ENV === 'development'
              ? error instanceof Error
                ? error.message
                : String(error)
              : undefined,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }
  }

  // Continue to route handler
  return NextResponse.next();
}

/**
 * Middleware matcher configuration
 *
 * Runs middleware only for API routes
 */
export const config = {
  matcher: '/api/:path*',
};
