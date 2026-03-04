/**
 * app-token.ts — Desktop-Local HMAC Auth Token — Sprint 8A
 *
 * Generates and validates a random 32-byte app-scoped authentication token.
 * Used to protect sensitive API routes (e.g., merge) from unauthorized calls.
 *
 * Token lifecycle:
 *   - Generated once on first app start via generateAppToken().
 *   - Stored in KERNL settings table (key: 'app_auth_token').
 *   - Frontend reads token via getAppAuthToken() on mount, stores in Zustand.
 *   - Sent as Authorization: Bearer {token} on protected route calls.
 *   - Validated via validateToken() using crypto.timingSafeEqual (no timing leaks).
 *
 * The token never leaves the machine — it's a desktop-local auth mechanism.
 */

import crypto from 'crypto';
import { getDatabase } from '@/lib/kernl/database';

const TOKEN_KEY = 'app_auth_token';

/**
 * Generate a cryptographically random 32-byte hex token.
 */
export function generateAppToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate a provided token against the stored token using timing-safe comparison.
 * Returns true if tokens match, false otherwise.
 */
export function validateToken(provided: string, stored: string): boolean {
  if (!provided || !stored) return false;

  // Both must be the same length for timingSafeEqual
  const providedBuf = Buffer.from(provided, 'utf8');
  const storedBuf = Buffer.from(stored, 'utf8');

  if (providedBuf.length !== storedBuf.length) return false;

  return crypto.timingSafeEqual(providedBuf, storedBuf);
}

/**
 * Get the app auth token from KERNL settings.
 * If no token exists yet, generates one and stores it (first-start flow).
 */
export function getAppAuthToken(): string {
  const db = getDatabase();

  const row = db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(TOKEN_KEY) as { value: string } | undefined;

  if (row?.value) {
    return row.value;
  }

  // First start — generate and persist
  const token = generateAppToken();
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(TOKEN_KEY, token, Date.now());

  return token;
}
