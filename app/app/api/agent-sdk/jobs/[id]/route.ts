/**
 * GET /api/agent-sdk/jobs/[id]
 *
 * Single session detail: manifest row + job_state row merged.
 *
 * Sprint 7F — Job Queue UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getManifestRow } from '@/lib/agent-sdk/job-tracker';
import { readJobState } from '@/lib/agent-sdk/query';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const row = getManifestRow(id);
    if (!row) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const state = readJobState(id);

    return NextResponse.json({
      data: {
        manifestId: row.id,
        title: row.title ?? '(untitled)',
        taskType: row.task_type ?? 'code',
        status: row.status,
        isSelfEvolution: row.is_self_evolution === 1,
        selfEvolutionBranch: row.self_evolution_branch,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        tokensUsed: row.tokens_used,
        costUsd: row.cost_usd,
        resultReport: row.result_report ? JSON.parse(row.result_report) : null,
        stepsCompleted: state?.steps_completed ?? 0,
        filesModified: state?.files_modified ? JSON.parse(state.files_modified) : [],
        lastEvent: state?.last_event ? JSON.parse(state.last_event) : null,
        logPath: state?.log_path ?? null,
        tokensUsedSoFar: state?.tokens_used_so_far ?? 0,
        costSoFar: state?.cost_so_far ?? 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
