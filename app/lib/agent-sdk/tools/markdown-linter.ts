/**
 * markdown-linter.ts — Sprint 11.1
 *
 * Simple rule-based markdown linter — zero external dependencies.
 * Checks .md files for:
 *   no-missing-h1           — file must have exactly one # header
 *   consistent-list-markers — don't mix * and - markers in the same file
 *   no-trailing-whitespace  — lines must not end with spaces
 *   blank-before-header     — headers must be preceded by a blank line
 */

import fs from 'fs';
import path from 'path';

export interface LintViolation {
  file: string;
  line: number;
  rule: string;
  message: string;
}

export interface LintResult {
  violations: LintViolation[];
  fileCount: number;
}

// ─── Per-file lint logic ─────────────────────────────────────────────────────

function lintFile(filePath: string): LintViolation[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const lines = content.split('\n');
  const violations: LintViolation[] = [];

  // ── no-missing-h1 ─────────────────────────────────────────────────────────
  const h1Indices = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /^#\s/.test(l));

  if (h1Indices.length === 0) {
    violations.push({ file: filePath, line: 1, rule: 'no-missing-h1',
      message: 'File is missing a top-level H1 header (# Title).' });
  } else if (h1Indices.length > 1) {
    const second = h1Indices[1];
    if (second) {
      violations.push({ file: filePath, line: second.i + 1, rule: 'no-missing-h1',
        message: 'File has more than one H1 header. Only one top-level title is allowed.' });
    }
  }

  // ── consistent-list-markers ───────────────────────────────────────────────
  const hasDash = lines.some((l) => /^\s*- /.test(l));
  const hasStar = lines.some((l) => /^\s*\* /.test(l));
  if (hasDash && hasStar) {
    const starIdx = lines.findIndex((l) => /^\s*\* /.test(l));
    violations.push({ file: filePath, line: starIdx + 1, rule: 'consistent-list-markers',
      message: 'File mixes * and - list markers. Use one style consistently.' });
  }

  // ── no-trailing-whitespace & blank-before-header ──────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNum = i + 1;

    if (line !== line.trimEnd()) {
      violations.push({ file: filePath, line: lineNum, rule: 'no-trailing-whitespace',
        message: `Line ${lineNum} ends with trailing whitespace.` });
    }

    // Headers (any depth) after line 1 must be preceded by a blank line
    if (/^#{1,6}\s/.test(line) && i > 0) {
      const prev = lines[i - 1] ?? '';
      if (prev.trim() !== '') {
        violations.push({ file: filePath, line: lineNum, rule: 'blank-before-header',
          message: `Header on line ${lineNum} is not preceded by a blank line.` });
      }
    }
  }

  return violations;
}

// ─── File discovery ──────────────────────────────────────────────────────────

function collectMdFiles(targetPath: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(targetPath)) return results;

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (targetPath.endsWith('.md')) results.push(targetPath);
    return results;
  }

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(full);
      }
    }
  }

  walk(targetPath);
  return results;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Lint all .md files under targetPath (or the file itself if a single file).
 */
export function runMarkdownLinter(targetPath: string): LintResult {
  const files = collectMdFiles(targetPath);
  const violations: LintViolation[] = [];
  for (const file of files) {
    violations.push(...lintFile(file));
  }
  return { violations, fileCount: files.length };
}
