/**
 * branch-manager.ts — Branch Lifecycle Manager — Phase 7H
 *
 * Handles the git branch operations that wrap every self-evolution session:
 *   1. Verify the working tree is clean (no uncommitted changes)
 *   2. Create the staging branch in the correct format
 *   3. Provide the branch name for KERNL tagging
 *   4. Clean up the branch on abort (if session fails before any commits)
 *
 * All git operations via execSync (cmd on Windows). The session CWD is
 * locked to the branch after creation — the agent cannot change branches.
 *
 * BLUEPRINT §7.3
 */

import { execSync } from 'child_process';
import { generateBranchName } from './branch-namer';

export interface BranchCreateResult {
  ok: true;
  branchName: string;
}

export interface BranchCreateError {
  ok: false;
  reason: string;
}

export type BranchResult = BranchCreateResult | BranchCreateError;

const GIT_TIMEOUT = 15_000;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * createEvolutionBranch — verify clean repo and create a self-evolve branch.
 *
 * @param goalSummary  Used to generate the slug portion of the branch name.
 * @param repoRoot     Absolute path to the repo root.
 * @param at           Date override for deterministic branch names in tests.
 */
export function createEvolutionBranch(
  goalSummary: string,
  repoRoot: string,
  at?: Date,
): BranchResult {
  // Step 1 — Verify clean working tree
  const dirtyReason = checkDirtyRepo(repoRoot);
  if (dirtyReason) {
    return { ok: false, reason: `Repo is not clean: ${dirtyReason}. Commit or stash changes first.` };
  }

  // Step 2 — Generate branch name
  const branchName = generateBranchName(goalSummary, at);

  // Step 3 — Create and checkout the branch
  try {
    runGit(['checkout', '-b', branchName], repoRoot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Failed to create branch '${branchName}': ${msg}` };
  }

  return { ok: true, branchName };
}

/**
 * cleanupBranch — abort the branch by checking out master and deleting the branch.
 * Only call this when the session has NOT made any commits on the branch.
 */
export function cleanupBranch(branchName: string, repoRoot: string): void {
  try {
    runGit(['checkout', 'master'], repoRoot);
    runGit(['branch', '-D', branchName], repoRoot);
  } catch {
    // Best-effort cleanup — log but don't throw
  }
}

/**
 * getCurrentBranch — returns the current HEAD branch name.
 */
export function getCurrentBranch(repoRoot: string): string {
  return runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot).trim();
}

/**
 * getHeadSha — returns the current HEAD commit SHA.
 */
export function getHeadSha(repoRoot: string): string {
  return runGit(['rev-parse', 'HEAD'], repoRoot).trim();
}

// ─── Internals ─────────────────────────────────────────────────────────────────

/**
 * checkDirtyRepo — returns a human-readable reason if the repo is dirty, or null if clean.
 */
function checkDirtyRepo(repoRoot: string): string | null {
  try {
    const status = runGit(['status', '--porcelain'], repoRoot);
    const lines = status.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;

    const staged    = lines.filter((l) => /^[MADRC]/.test(l)).length;
    const unstaged  = lines.filter((l) => /^.[MADRC?]/.test(l)).length;
    return `${staged} staged, ${unstaged} unstaged/untracked change(s)`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `git status failed: ${msg}`;
  }
}

function runGit(args: string[], cwd: string): string {
  return execSync(`git ${args.map(quoteArg).join(' ')}`, {
    cwd,
    encoding: 'utf8',
    timeout: GIT_TIMEOUT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function quoteArg(arg: string): string {
  // Quote args that contain spaces or special characters
  return /[\s"'\\]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}
