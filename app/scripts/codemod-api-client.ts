/**
 * Codemod: replace fetch('/api/...) with apiFetch('/api/...) in client components.
 * Adds import { apiFetch } from '@/lib/api-client' when not already present.
 *
 * Run: npx tsx scripts/codemod-api-client.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const APP_ROOT = path.resolve(__dirname, '..');

// Directories to scan (client-side only — lib/ and app/api/ are excluded)
const SCAN_DIRS = [
  path.join(APP_ROOT, 'components'),
  path.join(APP_ROOT, 'app'),
];

// Pattern: fetch('/api/ — captures only literal string calls, not variables
const FETCH_API_RE = /fetch\('\/api\//g;

function getFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip Next.js API routes and build output
      if (['api', '.next', 'node_modules'].includes(entry.name)) continue;
      results.push(...getFiles(full));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function injectImport(content: string): string {
  const importLine = "import { apiFetch } from '@/lib/api-client';";

  // Already present — skip
  if (content.includes("from '@/lib/api-client'")) return content;

  const lines = content.split('\n');

  // Find the last consecutive import block line index
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    // 'use client' / 'use server' directives + blank lines before imports are ok
    if (trimmed === "'use client';" || trimmed === '"use client";') continue;
    if (trimmed === "'use server';" || trimmed === '"use server";') continue;
    if (trimmed === '') continue;
    if (trimmed.startsWith('import ') || trimmed.startsWith('// ') || trimmed.startsWith('/*') || trimmed.startsWith(' *') || trimmed.startsWith('*/')) {
      if (trimmed.startsWith('import ')) lastImportIdx = i;
      continue;
    }
    // First non-import, non-comment, non-blank line — stop
    break;
  }

  if (lastImportIdx === -1) {
    // No imports found — prepend
    return importLine + '\n' + content;
  }

  lines.splice(lastImportIdx + 1, 0, importLine);
  return lines.join('\n');
}

function processFile(filePath: string): boolean {
  const original = fs.readFileSync(filePath, 'utf-8');

  if (!FETCH_API_RE.test(original)) return false;
  FETCH_API_RE.lastIndex = 0; // reset after test()

  let updated = original.replace(FETCH_API_RE, "apiFetch('/api/");
  updated = injectImport(updated);

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf-8');
    return true;
  }
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────
let total = 0;
let modified = 0;

for (const dir of SCAN_DIRS) {
  for (const file of getFiles(dir)) {
    total++;
    if (processFile(file)) {
      modified++;
      const rel = path.relative(APP_ROOT, file);
      console.log(`  ✓ ${rel}`);
    }
  }
}

console.log(`\nCodemod complete: ${modified} files modified (${total} scanned)`);
