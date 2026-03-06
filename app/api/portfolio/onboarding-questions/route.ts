/**
 * POST /api/portfolio/onboarding-questions
 * Body: { scanResult, answers, inferredType, projectName }
 * Returns: { yaml: string; dna: ProjectDnaYaml }
 * Called by OnboardingChat after the last answer to generate the DNA preview.
 */
import { NextRequest, NextResponse } from 'next/server';
import { generateDnaFromAnswers } from '@/lib/portfolio/onboarding';
import type { DirectoryScanResult, InferResult } from '@/lib/portfolio/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      scanResult?: DirectoryScanResult;
      answers?: Record<string, string>;
      inferredType?: InferResult;
      projectName?: string;
    };

    const { scanResult, answers, inferredType, projectName } = body;

    if (!scanResult || !answers || !inferredType) {
      return NextResponse.json(
        { success: false, error: 'scanResult, answers, and inferredType are required' },
        { status: 400 }
      );
    }

    const result = generateDnaFromAnswers(
      scanResult,
      answers,
      inferredType,
      projectName ?? scanResult.path.split(/[\\/]/).pop() ?? 'Project',
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/portfolio/onboarding-questions] POST error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
