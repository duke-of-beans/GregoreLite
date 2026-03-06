/**
 * POST /api/portfolio/scan-directory
 * Body: { path: string; warningsOnly?: boolean }
 * Returns: DirectoryScanResult + InferResult + OnboardingQuestion[]
 * Or if warningsOnly: { warnings: DependencyWarning[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { scanDirectory, inferProjectType, getDependencyWarnings } from '@/lib/portfolio/migrate';
import { getOnboardingQuestions } from '@/lib/portfolio/onboarding';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { path?: string; warningsOnly?: boolean };
    const { path: dirPath, warningsOnly = false } = body;

    if (!dirPath || typeof dirPath !== 'string') {
      return NextResponse.json({ success: false, error: 'path is required' }, { status: 400 });
    }

    if (warningsOnly) {
      const warnings = getDependencyWarnings(dirPath);
      return NextResponse.json({ success: true, data: { warnings } });
    }

    const scan = scanDirectory(dirPath);
    const inferred = inferProjectType(scan);
    const questions = getOnboardingQuestions(scan, inferred);

    return NextResponse.json({ success: true, data: { scan, inferred, questions } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/portfolio/scan-directory] POST error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
