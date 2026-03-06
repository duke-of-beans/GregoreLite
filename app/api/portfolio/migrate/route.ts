/**
 * POST /api/portfolio/migrate
 * Body: { sourcePath, destPath?, inPlace, dna, projectName, answers }
 * Handles: register project + in-place DNA write OR parallel-copy migration.
 *
 * PUT /api/portfolio/migrate
 * Body: telemetry params — writes anonymized row to portfolio_telemetry.
 */
import { NextRequest, NextResponse } from 'next/server';
import { migrateProject, writeInPlaceDna } from '@/lib/portfolio/migrate';
import { captureOnboardingTelemetry } from '@/lib/portfolio/onboarding';
import { getDatabase } from '@/lib/kernl/database';
import type { ProjectDnaYaml, ProjectType } from '@/lib/portfolio/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sourcePath?: string;
      destPath?: string;
      inPlace?: boolean;
      dna?: string;
      projectName?: string;
      answers?: Record<string, string>;
    };

    const { sourcePath, destPath, inPlace = true, dna: dnaStr, projectName } = body;

    if (!sourcePath || typeof sourcePath !== 'string') {
      return NextResponse.json({ success: false, error: 'sourcePath is required' }, { status: 400 });
    }
    if (!dnaStr) {
      return NextResponse.json({ success: false, error: 'dna is required' }, { status: 400 });
    }

    const dna = JSON.parse(dnaStr) as ProjectDnaYaml;
    const name = projectName ?? sourcePath.split(/[\\/]/).pop() ?? 'Project';

    // Register in portfolio_projects first (get the ID for archive FK)
    const db = getDatabase();
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const finalPath = inPlace ? sourcePath : (destPath ?? sourcePath);

    db.prepare(`
      INSERT OR IGNORE INTO portfolio_projects (id, name, path, type, type_label, status, registered_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(
      projectId,
      name,
      finalPath,
      dna.type,
      dna.type_label ?? null,
      Date.now(),
    );

    if (inPlace) {
      writeInPlaceDna(sourcePath, dna);
      return NextResponse.json({ success: true, data: { id: projectId, mode: 'inplace', path: finalPath } });
    }

    // Copy migration
    if (!destPath) {
      return NextResponse.json({ success: false, error: 'destPath required for copy migration' }, { status: 400 });
    }

    const result = migrateProject(sourcePath, destPath, dna, projectId);
    if (!result.success) {
      // Rollback the registration
      try { db.prepare('DELETE FROM portfolio_projects WHERE id = ?').run(projectId); } catch { /* ignore */ }
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { id: projectId, mode: 'copy', path: result.newPath, archivePath: result.archivePath },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/portfolio/migrate] POST error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as {
      projectType?: string;
      customTypeLabel?: string;
      questionsAsked?: string[];
      metricsConfigured?: string[];
      templateUsed?: string;
      onboardingDurationSeconds?: number;
    };

    captureOnboardingTelemetry({
      projectType: (body.projectType ?? 'custom') as ProjectType,
      customTypeLabel: body.customTypeLabel,
      questionsAsked: body.questionsAsked ?? [],
      metricsConfigured: body.metricsConfigured ?? [],
      templateUsed: body.templateUsed ?? 'custom',
      onboardingDurationSeconds: body.onboardingDurationSeconds ?? 0,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
