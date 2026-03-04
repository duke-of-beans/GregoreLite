/**
 * API Utilities
 *
 * Helper functions for API routes
 *
 * @module api/utils
 */

import { NextResponse } from 'next/server';
import type { APIResponse, RateLimitError } from './types';

/**
 * Create success response
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse<APIResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Create error response
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: unknown
): NextResponse<APIResponse> {
  const response: APIResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  if (details !== undefined) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Create validation error response
 */
export function validationError(
  message: string,
  details?: unknown
): NextResponse<APIResponse> {
  return errorResponse(message, 400, details);
}

/**
 * Create rate limit error response
 */
export function rateLimitError(
  retryAfter: number,
  requests: number,
  windowMs: number
): NextResponse<RateLimitError> {
  return NextResponse.json(
    {
      message: 'Rate limit exceeded',
      retryAfter,
      limit: {
        requests,
        windowMs,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}

/**
 * Validate required fields
 */
export function validateRequired<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): { valid: boolean; missing?: string[] } {
  const missing = fields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    return { valid: false, missing: missing as string[] };
  }

  return { valid: true };
}

/**
 * Parse and validate request body
 */
export async function parseRequestBody<T>(
  request: Request
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const body = await request.json();
    return { ok: true, data: body as T };
  } catch (error) {
    return {
      ok: false,
      error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Safe async handler
 *
 * Wraps async route handlers with error handling
 */
export function safeHandler(
  handler: (request: Request) => Promise<Response | NextResponse>
) {
  return async (request: Request): Promise<Response | NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      console.error('API Error:', error);
      const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
      return errorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500,
        isDev ? error : undefined
      );
    }
  };
}

/**
 * Extract search params from URL
 */
export function getSearchParams(request: Request) {
  const url = new URL(request.url);
  return url.searchParams;
}

/**
 * Parse pagination params
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10))
  );

  return { page, pageSize };
}
