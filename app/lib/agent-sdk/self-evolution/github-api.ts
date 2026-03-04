/**
 * github-api.ts — GitHub API Client — Phase 7H
 *
 * Handles all GitHub API interactions for the self-evolution PR workflow:
 *   - createPR()       — open a PR from the evolution branch
 *   - mergePR()        — squash merge after David confirms
 *   - pollCIStatus()   — check commit status every 5 minutes
 *   - storePAT()       — persist the GitHub PAT to KERNL vault
 *   - getPAT()         — retrieve the PAT from KERNL vault
 *
 * PAT stored in KERNL vault under key 'github_pat'.
 * David is the only merge gate — mergePR() must only be called after explicit
 * user action (clicking [Merge PR] in JobCard).
 *
 * BLUEPRINT §7.7
 */

import {
  storePAT as keychainStorePAT,
  getPAT as keychainGetPAT,
  deletePAT as keychainDeletePAT,
} from '@/lib/security/keychain-store';

// ─── Public types ─────────────────────────────────────────────────────────────

export type CIStatus = 'success' | 'failure' | 'pending' | 'error' | 'missing';

export interface CreatePRInput {
  owner: string;
  repo: string;
  head: string;
  title: string;
  body: string;
  base?: string;
}

export type CreatePRResult =
  | { ok: true; prNumber: number; prUrl: string; headSha: string }
  | { ok: false; reason: string };

export type MergePRResult =
  | { ok: true; mergeCommitSha: string }
  | { ok: false; reason: string };

// ─── PAT management ───────────────────────────────────────────────────────────
// PAT stored in OS keychain via keytar (Windows Credential Manager).
// SQLite settings table is NOT used for PAT storage — Sprint 8A security fix.

/** Store a GitHub PAT in the OS keychain. */
export async function storePAT(pat: string): Promise<void> {
  await keychainStorePAT(pat);
}

/** Retrieve the GitHub PAT from OS keychain. Returns null if not set. */
export async function getPAT(): Promise<string | null> {
  return keychainGetPAT();
}

/** Delete the GitHub PAT from OS keychain. */
export async function deletePAT(): Promise<boolean> {
  return keychainDeletePAT();
}

// ─── GitHub API calls ─────────────────────────────────────────────────────────

/**
 * createPR — open a pull request on GitHub.
 */
export async function createPR(input: CreatePRInput): Promise<CreatePRResult> {
  const pat = await getPAT();
  if (!pat) {
    return { ok: false, reason: 'GitHub PAT not set. Please add your token in Settings.' };
  }

  const { owner, repo, head, title, body, base = 'main' } = input;

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: githubHeaders(pat),
      body: JSON.stringify({ title, body, head, base }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, reason: `GitHub API ${res.status}: ${text}` };
    }

    const data = await res.json() as { number: number; html_url: string; head: { sha: string } };
    return { ok: true, prNumber: data.number, prUrl: data.html_url, headSha: data.head.sha };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * mergePR — squash merge a PR. Only call after David clicks [Merge PR].
 */
export async function mergePR(
  owner: string,
  repo: string,
  prNumber: number,
  commitTitle: string,
): Promise<MergePRResult> {
  const pat = await getPAT();
  if (!pat) {
    return { ok: false, reason: 'GitHub PAT not set.' };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
      {
        method: 'PUT',
        headers: githubHeaders(pat),
        body: JSON.stringify({ merge_method: 'squash', commit_title: commitTitle }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, reason: `GitHub API ${res.status}: ${text}` };
    }

    const data = await res.json() as { sha: string };
    return { ok: true, mergeCommitSha: data.sha };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * pollCIStatus — check the combined commit status for a SHA.
 * Returns 'missing' if no CI statuses exist yet.
 */
export async function pollCIStatus(
  owner: string,
  repo: string,
  sha: string,
): Promise<CIStatus> {
  const pat = await getPAT();
  if (!pat) return 'error';

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/status`,
      { headers: githubHeaders(pat) },
    );

    if (!res.ok) return 'error';

    const data = await res.json() as { state: string; total_count: number };
    if (data.total_count === 0) return 'missing';

    const state = data.state as string;
    if (state === 'success') return 'success';
    if (state === 'failure') return 'failure';
    return 'pending';
  } catch {
    return 'error';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function githubHeaders(pat: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${pat}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}
