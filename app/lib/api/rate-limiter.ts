/**
 * Rate Limiter
 *
 * In-memory rate limiting for API routes
 *
 * @module api/rate-limiter
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly requests: number;
  private readonly windowMs: number;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(requests: number, windowMs: number) {
    this.requests = requests;
    this.windowMs = windowMs;

    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed
   */
  check(identifier: string): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
  } {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    // No entry or expired - allow
    if (!entry || entry.resetAt <= now) {
      this.limits.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });

      return {
        allowed: true,
        remaining: this.requests - 1,
        resetAt: now + this.windowMs,
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.requests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfter,
      };
    }

    // Increment count
    entry.count++;
    this.limits.set(identifier, entry);

    return {
      allowed: true,
      remaining: this.requests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (entry.resetAt <= now) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Reset limit for identifier
   */
  reset(identifier: string): void {
    this.limits.delete(identifier);
  }

  /**
   * Get current stats
   */
  getStats(): {
    totalEntries: number;
    requests: number;
    windowMs: number;
  } {
    return {
      totalEntries: this.limits.size,
      requests: this.requests,
      windowMs: this.windowMs,
    };
  }

  /**
   * Tear down the cleanup interval. Call on process shutdown to prevent leaks.
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.limits.clear();
  }
}

// Global rate limiter instance
// Default: 100 requests per 15 minutes
const REQUESTS = typeof process !== 'undefined' && process.env.API_RATE_LIMIT_REQUESTS
  ? parseInt(process.env.API_RATE_LIMIT_REQUESTS, 10)
  : 100;
const WINDOW_MS = typeof process !== 'undefined' && process.env.API_RATE_LIMIT_WINDOW_MS
  ? parseInt(process.env.API_RATE_LIMIT_WINDOW_MS, 10)
  : 900000;

export const rateLimiter = new RateLimiter(REQUESTS, WINDOW_MS);

/**
 * Get identifier for rate limiting
 *
 * Uses IP address or user ID
 */
export function getRateLimitIdentifier(request: Request): string {
  // Try to get IP from headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to URL origin (not ideal but works for development)
  try {
    const url = new URL(request.url);
    return url.hostname;
  } catch {
    return 'unknown';
  }
}
