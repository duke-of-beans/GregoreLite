/**
 * Ghost Privacy — Layer 1: Hard-Coded Path and Content Exclusions
 *
 * checkPathLayer1()    — inspect the file path before reading content
 * checkContentLayer1() — inspect content for private key headers
 *
 * These are absolute rules. Nothing in Layer 4 can override them.
 */

import path from 'path';
import type { ExclusionResult } from './types';
import { NOT_EXCLUDED } from './types';

// ─── Path component exclusions (any component matching → excluded) ─────────────

const EXCLUDED_DIR_COMPONENTS = new Set([
  '.ssh', '.gnupg', 'secrets', 'vault', 'private', 'personal', 'medical', 'legal',
]);

// ─── Filename suffix exclusions ───────────────────────────────────────────────

const EXCLUDED_EXTENSIONS = new Set([
  '.env', '.pem', '.key', '.p12', '.pfx', '.cer', '.crt',
]);

// ─── Filename substring exclusions (case-insensitive) ────────────────────────

const EXCLUDED_NAME_SUBSTRINGS = [
  'password', 'secret', 'token', 'credential', 'apikey', 'api_key', 'private_key',
];

// ─── Content-level triggers ───────────────────────────────────────────────────

const PRIVATE_KEY_HEADERS = [
  'BEGIN PRIVATE KEY',
  'BEGIN RSA PRIVATE KEY',
  'BEGIN EC PRIVATE KEY',
  'BEGIN OPENSSH PRIVATE KEY',
  'BEGIN DSA PRIVATE KEY',
  'BEGIN PGP PRIVATE KEY BLOCK',
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check a file path against Layer 1 rules.
 * Returns an exclusion result if the path matches any hard-coded rule.
 * Call this BEFORE reading the file content.
 */
export function checkPathLayer1(filePath: string): ExclusionResult {
  const normalised = filePath.replace(/\\/g, '/');
  const parsed = path.parse(normalised);
  const nameLower = parsed.base.toLowerCase();

  // Walk all path components for excluded directory names
  const components = normalised.split('/').filter(Boolean);
  for (const component of components) {
    const cl = component.toLowerCase();
    if (EXCLUDED_DIR_COMPONENTS.has(cl)) {
      return { excluded: true, layer: 1, reason: 'excluded directory', pattern: component };
    }
  }

  // File extension check — also handle dotfiles like .env where path.parse gives ext: ''
  const ext = parsed.ext.toLowerCase();
  const baseLower = parsed.base.toLowerCase();
  if (EXCLUDED_EXTENSIONS.has(ext) || EXCLUDED_EXTENSIONS.has(baseLower)) {
    const matched = EXCLUDED_EXTENSIONS.has(ext) ? ext : baseLower;
    return { excluded: true, layer: 1, reason: 'excluded file extension', pattern: matched };
  }

  // Filename substring check (without extension, case-insensitive)
  const nameNoExt = parsed.name.toLowerCase();
  for (const sub of EXCLUDED_NAME_SUBSTRINGS) {
    if (nameNoExt.includes(sub) || nameLower.includes(sub)) {
      return { excluded: true, layer: 1, reason: 'excluded filename pattern', pattern: sub };
    }
  }

  return NOT_EXCLUDED;
}

/**
 * Check file content for private key headers.
 * Run this AFTER reading the file but BEFORE chunking.
 */
export function checkContentLayer1(content: string): ExclusionResult {
  for (const header of PRIVATE_KEY_HEADERS) {
    if (content.includes(header)) {
      return { excluded: true, layer: 1, reason: 'private key content detected', pattern: header };
    }
  }
  return NOT_EXCLUDED;
}
