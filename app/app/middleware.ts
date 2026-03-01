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
import { initializeDatabase } from '@/lib/database/connection';
import { initializeSchema } from '@/lib/database/init';

let dbInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize database (singleton pattern)
 */
async function ensureDatabaseInitialized(): Promise<void> {
  // If already initialized, return immediately
  if (dbInitialized) {
    return;
  }

  // If initialization in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      console.log('[Middleware] Initializing database...');
      
      // Initialize database connection
      await initializeDatabase();
      
      // Run migrations
      await initializeSchema();
      
      dbInitialized = true;
      console.log('[Middleware] Database initialized successfully');
    } catch (error) {
      console.error('[Middleware] Database initialization failed:', error);
      initializationPromise = null; // Allow retry on next request
      throw error;
    }
  })();

  return initializationPromise;
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
      await ensureDatabaseInitialized();
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
        { status: 500 }
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
