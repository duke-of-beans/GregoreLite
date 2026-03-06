/**
 * POST /api/portfolio/scaffold
 *
 * Creates a new project directory with type-appropriate scaffold files,
 * registers the project in portfolio_projects, and returns the created file list.
 *
 * Body: {
 *   name:       string          — project display name
 *   type:       ProjectType     — code | research | business | creative | custom
 *   typeLabel?: string          — human label for custom type
 *   dirPath:    string          — absolute path where the project will be created
 *   answers:    Record<string, string> — answers from the onboarding Q&A
 * }
 *
 * Response: { success: true, data: { projectId, filesCreated } }
 *         | { success: false, error: string }
 */

import { NextResponse } from 'next/server';
import { getScaffoldTemplate, scaffoldProject, registerProject } from '@/lib/portfolio/scaffold';
import { captureNewProjectTelemetry } from '@/lib/portfolio/onboarding';
import type { ProjectType } from '@/lib/portfolio/types';

const VALID_TYPES = new Set<ProjectType>(['code', 'research', 'business', 'creative', 'custom']);

interface ScaffoldBody {
  name: string;
  type: ProjectType;
  typeLabel?: string;
  dirPath: string;
  answers: Record<string, string>;
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: ScaffoldBody;
  try {
    body = await req.json() as ScaffoldBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, type, typeLabel, dirPath, answers } = body;

  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
  }
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ success: false, error: `Invalid type: ${type}` }, { status: 400 });
  }
  if (!dirPath?.trim()) {
    return NextResponse.json({ success: false, error: 'dirPath is required' }, { status: 400 });
  }

  // Inject project name into answers for template substitution
  const enrichedAnswers: Record<string, string> = { ...answers, name: name.trim() };

  const template = getScaffoldTemplate(type);
  const result = scaffoldProject(template, dirPath.trim(), enrichedAnswers);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error ?? 'Scaffold failed' }, { status: 500 });
  }

  const projectId = registerProject(dirPath.trim(), name.trim(), type, typeLabel);

  // Capture telemetry (non-blocking, non-critical)
  try {
    captureNewProjectTelemetry({
      projectType: type,
      customTypeLabel: typeLabel,
      questionsAsked: Object.keys(answers),
      metricsConfigured: result.filesCreated,
      templateUsed: template.label,
      onboardingDurationSeconds: 0, // Caller can pass duration if needed
    });
  } catch { /* telemetry is non-critical */ }

  return NextResponse.json({
    success: true,
    data: { projectId, filesCreated: result.filesCreated },
  });
}
