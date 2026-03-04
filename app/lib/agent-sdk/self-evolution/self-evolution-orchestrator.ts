/**
 * self-evolution-orchestrator.ts — Sprint 7H
 *
 * Pre-flight and post-processing lifecycle hooks for self-evolution sessions.
 * Called from index.ts which wires them around the scheduler.enqueue() call.
 *
 * Flow:
 *   spawnSelfEvolutionSession (index.ts)
 *     → runPreFlight          verify clean repo, create branch, update in-memory manifest
 *     → scheduler.enqueue     session runs (query.ts + SHIM gate from Sprint 7G)
 *     → runPostProcessing     local tests → push → createPR → CI polling
 *
 * Contract: neither runPreFlight nor runPostProcessing ever throw in a way that
 * prevents the scheduler completion callback from firing. Errors are logged.
 *
 * BLUEPRINT §7
 */

import { execFileSync } from 'child_process';
import { getDatabase } from '../../kernl/database';
import type { TaskManifest } from '../types';
import { createEvolutionBranch, getHeadSha } from './branch-manager';
import { buildPRDescription } from './pr-description-builder';
import { createPR, pollCIStatus } from './github-api';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface SelfEvolutionConfig {
  repoRoot: string;
  githubOwner?: string;
  githubRepo?: string;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function dbUpdateBranch(manifestId: string, branchName: string): void {
  getDatabase()
    .prepare(
      `UPDATE manifests
       SET self_evolution_branch = ?, is_self_evolution = 1, updated_at = ?
       WHERE id = ?`,
    )
    .run(branchName, Date.now(), manifestId);
}

function dbUpdatePR(
  manifestId: string,
  prNumber: number | null,
  ciPassed: boolean | null,
): void {
  getDatabase()
    .prepare(
      `UPDATE manifests
       SET pr_number = ?, ci_passed = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      prNumber,
      ciPassed === null ? null : ciPassed ? 1 : 0,
      Date.now(),
      manifestId,
    );
}

interface ManifestRow {
  self_evolution_branch: string | null;
  goal_summary: string | null;
  target_component: string | null;
  shim_score_after: number | null;
  title: string | null;
}

function dbGetManifest(manifestId: string): ManifestRow | null {
  return (
    getDatabase()
      .prepare(
        `SELECT self_evolution_branch, goal_summary, target_component,
                shim_score_after, title
         FROM manifests WHERE id = ?`,
      )
      .get(manifestId) as ManifestRow | null
  ) ?? null;
}

function dbGetFilesModified(manifestId: string): string[] {
  const row = getDatabase()
    .prepare(`SELECT files_modified FROM job_state WHERE manifest_id = ?`)
    .get(manifestId) as { files_modified: string | null } | null;
  if (!row?.files_modified) return [];
  try {
    return JSON.parse(row.files_modified) as string[];
  } catch {
    return [];
  }
}

function dbGetJobStatus(manifestId: string): string | null {
  const row = getDatabase()
    .prepare(`SELECT status FROM job_state WHERE manifest_id = ?`)
    .get(manifestId) as { status: string } | null;
  return row?.status ?? null;
}

// ─── Deferred branch DB write ─────────────────────────────────────────────────
// runPreFlight is called before the manifest row exists in DB (query.ts inserts
// it on first tool call). We defer the DB write to flushPendingBranchUpdate,
// which is called at the start of runPostProcessing when the row is guaranteed.

const _pendingBranchUpdates = new Map<string, string>(); // manifestId → branchName

/** Persist a deferred branch name to DB once the manifest row exists. */
export function flushPendingBranchUpdate(manifestId: string): void {
  const branchName = _pendingBranchUpdates.get(manifestId);
  if (!branchName) return;
  _pendingBranchUpdates.delete(manifestId);
  try {
    dbUpdateBranch(manifestId, branchName);
  } catch (err) {
    console.error(
      `[SelfEvolution] Failed to persist branch name for ${manifestId}: ${String(err)}`,
    );
  }
}

// ─── Pre-flight ───────────────────────────────────────────────────────────────

/**
 * runPreFlight — called by index.ts BEFORE scheduler.enqueue.
 *
 * 1. Creates a self-evolve/{date}-{slug} branch in the repo.
 * 2. Mutates the manifest in-memory so buildSystemPrompt picks up the branch.
 * 3. Queues a deferred DB write (manifest row doesn't exist yet).
 *
 * Throws if the working tree is dirty — the caller should surface this to the
 * user (dirty repo = cannot create clean evolution branch).
 */
export function runPreFlight(manifest: TaskManifest, repoRoot: string): void {
  const goalSummary = manifest.task.title ?? manifest.task.description;

  const branchResult = createEvolutionBranch(goalSummary, repoRoot);

  // Throws on dirty repo — caller surfaces to user before any session state is set
  if (!branchResult.ok) {
    throw new Error(branchResult.reason);
  }

  // Mutate in-memory manifest — buildSystemPrompt will include the branch name
  manifest.self_evolution_branch = branchResult.branchName;
  manifest.is_self_evolution = true;

  // Queue deferred DB persist
  _pendingBranchUpdates.set(manifest.manifest_id, branchResult.branchName);
}

// ─── Post-processing ──────────────────────────────────────────────────────────

const SHIM_THRESHOLD    = 70;
const TEST_TIMEOUT_MS   = 5 * 60 * 1000; // 5 min

/**
 * runPostProcessing — called by index.ts after the session's onComplete fires.
 *
 * 1. Flush deferred branch DB write.
 * 2. Gate: session must have status = 'completed'.
 * 3. SHIM gate: shim_score_after must be ≥ 70 (or null, meaning no files modified).
 * 4. Local test run: npx vitest run --passWithNoTests.
 * 5. git push origin {branch}.
 * 6. createPR → store pr_number.
 * 7. Background CI polling (fire-and-forget) → set ci_passed when resolved.
 *
 * Never throws — all errors are logged so _complete() always fires in index.ts.
 */
export async function runPostProcessing(
  manifestId: string,
  config: SelfEvolutionConfig,
): Promise<void> {
  const { repoRoot, githubOwner, githubRepo } = config;

  // Flush deferred branch DB write (manifest row now exists)
  flushPendingBranchUpdate(manifestId);

  // ── Status gate ───────────────────────────────────────────────────────────
  const jobStatus = dbGetJobStatus(manifestId);
  if (jobStatus !== 'completed') {
    console.info(
      `[SelfEvolution] Post-processing skipped — status: ${jobStatus ?? 'unknown'}`,
    );
    return;
  }

  const manifestRow = dbGetManifest(manifestId);
  if (!manifestRow) {
    console.error(`[SelfEvolution] Manifest row not found for ${manifestId}`);
    return;
  }

  // ── SHIM gate ─────────────────────────────────────────────────────────────
  // shim_score_after is null when no files were modified (SHIM gate didn't run).
  // Score null → allow. Score < threshold → abort PR creation.
  if (
    manifestRow.shim_score_after !== null &&
    manifestRow.shim_score_after < SHIM_THRESHOLD
  ) {
    console.warn(
      `[SelfEvolution] SHIM score ${manifestRow.shim_score_after} < ${SHIM_THRESHOLD} ` +
      `for ${manifestId}. Skipping PR creation.`,
    );
    return;
  }

  // ── Local test run ────────────────────────────────────────────────────────
  try {
    execFileSync('npx', ['vitest', 'run', '--passWithNoTests'], {
      cwd: repoRoot,
      stdio: 'pipe',
      timeout: TEST_TIMEOUT_MS,
      shell: true, // npx is a .cmd on Windows — requires shell to resolve
    });
    console.info(`[SelfEvolution] Local tests passed for ${manifestId}`);
  } catch (err) {
    const execErr = err as { stderr?: Buffer; stdout?: Buffer };
    const detail =
      execErr.stderr?.toString().slice(0, 300) ??
      execErr.stdout?.toString().slice(0, 300) ??
      String(err);
    console.warn(
      `[SelfEvolution] Tests failed for ${manifestId} — aborting PR creation. ${detail}`,
    );
    return;
  }

  // ── GitHub PR creation ────────────────────────────────────────────────────
  if (!githubOwner || !githubRepo) {
    console.info(
      `[SelfEvolution] GitHub owner/repo not configured — skipping PR for ${manifestId}`,
    );
    return;
  }

  const branchName = manifestRow.self_evolution_branch;
  if (!branchName) {
    console.error(`[SelfEvolution] Branch name missing for ${manifestId}`);
    return;
  }

  // Push the branch to origin before creating PR
  try {
    execFileSync('git', ['push', 'origin', branchName], { cwd: repoRoot, stdio: 'pipe' });
  } catch (err) {
    console.error(
      `[SelfEvolution] git push origin ${branchName} failed: ${String(err)}`,
    );
    return;
  }

  const filesChanged = dbGetFilesModified(manifestId);

  const prBody = buildPRDescription({
    manifestId,
    goalSummary: manifestRow.goal_summary ?? manifestRow.title ?? 'Self-evolution session',
    targetComponent: manifestRow.target_component ?? 'unknown',
    filesChanged,
    shimScoreBefore: null,
    shimScoreAfter: manifestRow.shim_score_after,
  });

  let prNumber: number;
  try {
    const result = await createPR({
      owner: githubOwner,
      repo: githubRepo,
      title: `self-evolve: ${manifestRow.goal_summary ?? manifestRow.title ?? manifestId}`,
      body: prBody,
      head: branchName,
      base: 'main',
    });
    if (!result.ok) {
      console.error(`[SelfEvolution] PR creation failed: ${result.reason}`);
      return;
    }
    prNumber = result.prNumber;
    console.info(`[SelfEvolution] PR #${prNumber} created for ${manifestId}`);
  } catch (err) {
    console.error(
      `[SelfEvolution] PR creation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  // Record PR number; CI not yet resolved (ci_passed = null → button disabled)
  dbUpdatePR(manifestId, prNumber, null);

  // CI polling is long-running — fire-and-forget, never blocks the scheduler
  void _pollCI(manifestId, githubOwner, githubRepo, prNumber, repoRoot);
}

// ─── Background CI polling ────────────────────────────────────────────────────

const CI_POLL_INTERVAL_MS  = 30_000; // 30 seconds
const CI_POLL_MAX_ATTEMPTS = 20;     // 10 minutes total

async function _pollCI(
  manifestId: string,
  owner: string,
  repo: string,
  prNumber: number,
  repoRoot: string,
): Promise<void> {
  let headSha: string;
  try {
    headSha = getHeadSha(repoRoot);
  } catch (err) {
    console.error(`[SelfEvolution] Could not resolve HEAD SHA for CI polling: ${String(err)}`);
    return;
  }

  for (let attempt = 1; attempt <= CI_POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise<void>((res) => setTimeout(res, CI_POLL_INTERVAL_MS));

    try {
      const ciStatus = await pollCIStatus(owner, repo, headSha);
      console.info(
        `[SelfEvolution] CI poll ${attempt}/${CI_POLL_MAX_ATTEMPTS}: ` +
        `${ciStatus} for PR #${prNumber}`,
      );

      if (ciStatus === 'success') {
        dbUpdatePR(manifestId, prNumber, true);
        console.info(
          `[SelfEvolution] CI passed — [Merge PR] button now active for ${manifestId}`,
        );
        return;
      }

      if (ciStatus === 'failure' || ciStatus === 'error') {
        dbUpdatePR(manifestId, prNumber, false);
        console.warn(`[SelfEvolution] CI ${ciStatus} for PR #${prNumber}`);
        return;
      }

      // 'pending' or 'missing' — keep polling
    } catch (err) {
      console.warn(
        `[SelfEvolution] CI poll attempt ${attempt} error: ${String(err)}`,
      );
    }
  }

  console.warn(`[SelfEvolution] CI polling timed out for PR #${prNumber}`);
  // Leave ci_passed as null — [Merge PR] button stays disabled
}
