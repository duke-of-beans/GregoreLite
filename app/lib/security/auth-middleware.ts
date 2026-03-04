/**
 * auth-middleware.ts — Protected Route Auth Middleware — Sprint 8A
 *
 * Validates the Authorization: Bearer {token} header against the app auth token
 * stored in KERNL settings. Returns null if valid (caller continues), or a
 * NextResponse 401 if invalid (caller returns immediately).
 *
 * Usage in a Next.js API route:
 *   const authError = requireAppToken(req);
 *   if (authError) return authError;
 *   // ... proceed with route logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAppAuthToken, validateToken } from './app-token';

/**
 * Validate the request's Authorization header against the app auth token.
 *
 * @returns null if the token is valid (caller should continue processing).
 * @returns NextResponse with 401 status if the token is missing or invalid.
 */
export function requireAppToken(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Missing Authorization header' },
      { status: 401 },
    );
  }

  // Expect: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return NextResponse.json(
      { error: 'Invalid Authorization format. Expected: Bearer <token>' },
      { status: 401 },
    );
  }

  const providedToken = parts[1] ?? '';
  const storedToken = getAppAuthToken();

  if (!validateToken(providedToken, storedToken)) {
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 },
    );
  }

  // Token valid — caller continues
  return null;
}
