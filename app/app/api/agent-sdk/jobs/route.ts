/**
 * GET /api/agent-sdk/jobs
 *
 * Returns all sessions: DB manifest rows (started/finished) PLUS
 * in-memory pending sessions from the scheduler queue.
 *
 * Sprint 7F — Job Queue UI
 */

import { NextResponse } from 'next/server';
import { listManifestRows } from '@/lib/agent-sdk/job-tracker';
import { readJobState } from '@/lib/agent-sdk/query';
import { getPendingManifests } from '@/lib/agent-sdk';

export async function GET() {
  try {
    // DB rows — all manifests that have started or finished
    const rows = listManifestRows();

    const dbJobs = rows.map((row) => {
      const state = readJobState(row.id);
      return {
        manifestId: row.id,
        title: row.title ?? '(untitled)',
        taskType: row.task_type ?? 'code',
        status: row.status,
        isSelfEvolution: row.is_self_evolution === 1,
        selfEvolutionBranch: row.self_evolution_branch ?? null,
        // Sprint 7H: PR tracking fields
        prNumber: (row.pr_number as number | null) ?? null,
        ciPassed: row.ci_passed === null ? null : row.ci_passed === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        tokensUsed: row.tokens_used,
        costUsd: row.cost_usd,
        resultReport: row.result_report ? JSON.parse(row.result_report) : null,
        // job_state fields
        stepsCompleted: state?.steps_completed ?? 0,
        filesModified: state?.files_modified ? JSON.parse(state.files_modified) : [],
        lastEvent: state?.last_event ? JSON.parse(state.last_event) : null,
        logPath: state?.log_path ?? null,
        description: row.description ?? null,
        projectPath: row.project_path ?? null,
        tokensUsedSoFar: state?.tokens_used_so_far ?? 0,
        costSoFar: state?.cost_so_far ?? 0,
        queuePosition: undefined as number | undefined,
        priority: undefined as number | undefined,
      };
    });

    // In-memory pending sessions (not yet in DB)
    const pendingIds = new Set(rows.map((r) => r.id));
    const pendingJobs = getPendingManifests()
      .filter(({ manifest }) => !pendingIds.has(manifest.manifest_id))
      .map(({ entry, manifest }) => ({
        manifestId: manifest.manifest_id,
        title: manifest.task.title,
        taskType: manifest.task.type,
        status: 'pending',
        isSelfEvolution: manifest.is_self_evolution,
        selfEvolutionBranch: manifest.self_evolution_branch ?? null,
        prNumber: null,
        ciPassed: null,
        createdAt: manifest.spawned_by.timestamp,
        updatedAt: entry.enqueuedAt,
        tokensUsed: 0,
        costUsd: 0,
        resultReport: null,
        stepsCompleted: 0,
        filesModified: [] as string[],
        lastEvent: null,
        logPath: null,
        description: manifest.task.description ?? null,
        projectPath: manifest.context.project_path ?? null,
        tokensUsedSoFar: 0,
        costSoFar: 0,
        queuePosition: entry.queuePosition ?? undefined,
        priority: entry.priority,
      }));

    return NextResponse.json({ data: [...pendingJobs, ...dbJobs] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
