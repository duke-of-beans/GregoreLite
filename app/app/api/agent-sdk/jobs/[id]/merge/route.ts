/**
 * POST /api/agent-sdk/jobs/[id]/merge
 *
 * Merges the GitHub PR for a completed self-evolution session.
 * David is always the merge gate — this endpoint is the only path to merge.
 *
 * Guards:
 *   - Manifest must exist and be a self-evolution session.
 *   - CI must have passed (ci_passed = 1 in DB).
 *   - pr_number must be set.
 *   - GitHub owner/repo must be configured in settings table.
 *
 * Sprint 7H — Self-Evolution Mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import { mergePR } from '@/lib/agent-sdk/self-evolution/github-api';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ManifestMergeRow {
  id: string;
  title: string | null;
  is_self_evolution: number;
  pr_number: number | null;
  ci_passed: number | null;
  goal_summary: string | null;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: manifestId } = await params;
    const db = getDatabase();

    // ── Load manifest row ─────────────────────────────────────────────────
    const row = db
      .prepare(
        `SELECT id, title, is_self_evolution, pr_number, ci_passed, goal_summary
         FROM manifests WHERE id = ?`,
      )
      .get(manifestId) as ManifestMergeRow | null;

    if (!row) {
      return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
    }

    if (!row.is_self_evolution) {
      return NextResponse.json(
        { error: 'Not a self-evolution session' },
        { status: 400 },
      );
    }

    if (!row.pr_number) {
      return NextResponse.json(
        { error: 'No PR number found — PR may not have been created yet' },
        { status: 409 },
      );
    }

    if (row.ci_passed !== 1) {
      return NextResponse.json(
        {
          error:
            row.ci_passed === 0
              ? 'CI failed — cannot merge'
              : 'CI has not finished — cannot merge yet',
        },
        { status: 409 },
      );
    }

    // ── Load GitHub config from settings ──────────────────────────────────
    const ownerRow = db
      .prepare(`SELECT value FROM settings WHERE key = 'github_owner'`)
      .get() as { value: string } | null;

    const repoRow = db
      .prepare(`SELECT value FROM settings WHERE key = 'github_repo'`)
      .get() as { value: string } | null;

    if (!ownerRow?.value || !repoRow?.value) {
      return NextResponse.json(
        {
          error:
            'GitHub owner/repo not configured. ' +
            'Set github_owner and github_repo in the settings table.',
        },
        { status: 503 },
      );
    }

    const owner = ownerRow.value;
    const repo  = repoRow.value;

    // ── Execute squash merge ──────────────────────────────────────────────
    const commitTitle =
      `self-evolve: ${row.goal_summary ?? row.title ?? manifestId} (#${row.pr_number})`;

    const result = await mergePR(owner, repo, row.pr_number, commitTitle);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason ?? 'GitHub API rejected merge' },
        { status: 422 },
      );
    }

    // Mark ci_passed = 2 as a sentinel for "merged" so the button can update
    db.prepare(
      `UPDATE manifests SET ci_passed = 2, updated_at = ? WHERE id = ?`,
    ).run(Date.now(), manifestId);

    return NextResponse.json({
      data: {
        merged: true,
        prNumber: row.pr_number,
        sha: result.mergeCommitSha,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
