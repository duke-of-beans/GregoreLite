/**
 * git-tools.ts — Git Tool Implementations — Phase 7H
 *
 * Implements the git_commit, git_status, and git_diff tools injected exclusively
 * into self_evolution sessions. These are LOCAL operations only — no push authority.
 *
 * Tool contract (matches tool-injector definitions):
 *   git_commit  { files: string[], message: string } → staged commit summary
 *   git_status  {}                                   → working tree status
 *   git_diff    { path: string }                     → diff for one file
 *
 * BLUEPRINT §7.3 (local commits only, no push)
 */

import { execSync } from 'child_process';

const GIT_TIMEOUT = 30_000;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface GitCommitInput {
  files: string[];    // relative or absolute paths to stage
  message: string;    // commit message
}

export interface GitStatusInput {
  // no required fields
}

export interface GitDiffInput {
  path?: string;      // file to diff; if omitted, diffs all tracked files
}

// ─── Tool implementations ─────────────────────────────────────────────────────

/**
 * executeGitCommit — stage specified files and create a local commit.
 * Push is explicitly not permitted.
 */
export function executeGitCommit(input: GitCommitInput, repoRoot: string): string {
  const { files, message } = input;

  if (!message || message.trim().length === 0) {
    return 'ERROR: commit message is required.';
  }
  if (!files || files.length === 0) {
    return 'ERROR: at least one file must be specified.';
  }

  try {
    // Stage each file individually — safer than git add .
    for (const f of files) {
      runGit(['add', '--', f], repoRoot);
    }

    // Write commit message to temp file to avoid shell escaping issues
    const msgFile = '.git/SELF_EVOLVE_COMMIT_MSG';
    const { writeFileSync } = require('fs') as typeof import('fs');
    writeFileSync(`${repoRoot}/${msgFile}`, message, 'utf8');
    const result = runGit(['commit', '-F', msgFile], repoRoot);

    return `Committed:\n${result.trim()}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `ERROR: git commit failed: ${msg}`;
  }
}

/**
 * executeGitStatus — return the working tree status as a structured string.
 */
export function executeGitStatus(_input: GitStatusInput, repoRoot: string): string {
  try {
    const status = runGit(['status', '--short'], repoRoot);
    if (!status.trim()) {
      return 'Working tree clean. Nothing to commit.';
    }
    return `Working tree status:\n${status.trim()}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `ERROR: git status failed: ${msg}`;
  }
}

/**
 * executeGitDiff — return the diff for a specific file.
 */
export function executeGitDiff(input: GitDiffInput, repoRoot: string): string {
  try {
    if (input.path) {
      // Single-file diff: staged first, then unstaged if staged is empty
      let diff = runGit(['diff', '--cached', '--', input.path], repoRoot);
      if (!diff.trim()) {
        diff = runGit(['diff', '--', input.path], repoRoot);
      }
      if (!diff.trim()) {
        return `No changes detected in: ${input.path}`;
      }
      return diff;
    }
    // Full diff: concatenate staged and unstaged changes
    const staged   = runGit(['diff', '--cached'], repoRoot).trim();
    const unstaged = runGit(['diff'], repoRoot).trim();
    const parts: string[] = [];
    if (staged)   parts.push(`=== Staged changes ===\n${staged}`);
    if (unstaged) parts.push(`=== Unstaged changes ===\n${unstaged}`);
    if (parts.length === 0) return 'Working tree clean. No changes detected.';
    return parts.join('\n\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `ERROR: git diff failed: ${msg}`;
  }
}

// ─── Internals ─────────────────────────────────────────────────────────────────

function runGit(args: string[], cwd: string): string {
  return execSync(`git ${args.map(quoteArg).join(' ')}`, {
    cwd,
    encoding: 'utf8',
    timeout: GIT_TIMEOUT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function quoteArg(arg: string): string {
  return /[\s"'\\]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}
